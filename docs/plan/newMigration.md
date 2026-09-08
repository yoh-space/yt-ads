# New Migration & Workflow Unification — Execution Plan

> **Purpose.** This is the authoritative, code-grounded roadmap for the 10-phase / 58-step implementation plan. Each step below is mapped to its **current state** in the codebase (verified against source), the **work required**, and the **files touched**. It supersedes vague phase descriptions with concrete, testable increments and an execution order.
>
> **Grounding.** Line references are accurate at the time of writing and may drift as code changes; invariants, not line numbers, are what you must preserve.

---

## 0. How to read this plan

For every numbered step from the original plan there is:

- **Status** — `DONE` (implemented and wired), `PARTIAL` (works for the common path but has gaps the step calls out), `TODO` (not present / needs new work), `NEW` (a shared module that must be created).
- **Where** — file:line anchors.
- **Do** — the concrete change to make in this codebase.
- **Verify** — how to prove it works (test / `pnpm check` / smoke).

The plan is deliberately **backend-first**: Phases 1–5 + 8–9 establish data + resolver + ledger invariants that the UI (Phases 6–7) consumes. Phases 6–7 are the last because they depend on the stabilized preview/ink contract.

---

## 1. Executive gap summary

| Phase | Title | Status after audit | Biggest gaps |
|---|---|---|---|
| 0 | Baseline & contracts | PARTIAL | Behavior exists; **no handler tests** (only pure-helper tests). No schema snapshot artifact. |
| 1 | Unify catalog & BOM resolution | PARTIAL | Dual routing systems (`SERVICE_ROUTING_MAP` + `MATERIAL_TYPE_CATALOG`); **no `bomResolver.ts`**; BOM expansion inline in `orders.ts`; `materialTypeCatalog` table not authoritative at runtime. |
| 2 | Normalize material & ink models | PARTIAL | `materialFamily` and `inkColor` **fields missing**; create validator omits them; duplicate/alias catalog entries unnormalized in DB. |
| 3 | Atomic request→ledger | PARTIAL | `materialRequests.issue` **does not link `parentInventoryId`** (parent tier not decremented); fragile insert-then-patch; missing negative-test coverage; machine/operator identity cross-check gaps. |
| 4 | Unified deduction engine | PARTIAL | Logic exists but **split across `jobs.ts` + `inventory.ts` + `materialUsage.ts`**; no shared `deductJobRequirements`; incremental-vs-completion mode not unified. |
| 5 | Ink & solvent validation | PARTIAL | Aggregate ink check exists in `validateDispatchResources`; **no per-color requirement model**; no structured machine ink config. |
| 6 | Dispatch modal refinement | PARTIAL | `OrderConfirmModal` already auto-routes with preview + gated button; **no reservation step**, no per-color ink UI, no explicit status sections. |
| 7 | Operator dashboard | PARTIAL | Shell has status + active job + production/scrap/offcut + queue; **no `MachineFluidGauge`**, no per-color ink, completed-job not fully locked. |
| 8 | Data migration | PARTIAL | Migration infra exists (hand-rolled `migrations` table); **no recipe→BOM**, material-normalization, or dimension-backfill migration yet. |
| 9 | Verification | PARTIAL | Minimal coverage; no Convex handler tests; no dispatch/operator UI tests. |

---

## 2. Phase 0 — Baseline & Contracts

### Step 1 — Freeze current behavior with focused tests
- **Status:** PARTIAL
- **Where:** `convex/materialUsage.test.ts`, `convex/services.test.ts`, `convex/validation.test.ts` (existing, pure helpers only)
- **Do:**
  1. Add `convex/jobs.test.ts` — freeze auto-deduction / BOM-deduction / idempotent-completion behavior using `convex.test` harness (or pure extractable units).
  2. Add `convex/materialRequests.test.ts` — freeze issue/acknowledge contract (issue parity with `inventory.ts:issueStockToOperator`).
  3. Add `convex/orders.test.ts` — freeze `previewAutoRouting` shape (machine, material, allocation, inkCheck).
  4. Add `convex/inventoryLedger.test.ts` — freeze `recordInventoryEvent` invariant behavior (positive qty, note, active material, insufficient stock, EXHAUSTED flip).
  5. Add `convex/bom.test.ts` — freeze BOM allocation math.
- **Why before changing:** every later refactor must keep these green so behavior is preserved.

### Step 2 — Capture current schema & migration state
- **Status:** TODO
- **Do:** commit a snapshot copy of the five modules into `docs/plan/snapshots/` and record the current migration keys run (`migrations` table rows) and the `schema.ts` diff-able baseline. This is the `before` for **Phase 8**.
- **Files:** `convex/schema.ts`, `convex/orders.ts`, `convex/materialRequests.ts`, `convex/inventoryLedger.ts`, `convex/jobs.ts`.

---

## 3. Phase 1 — Unify Catalog & BOM Resolution

### Step 3 — Make `materialTypeCatalog` the authoritative service→material/machine source
- **Status:** PARTIAL. Table exists (`schema.ts:818`, seeded from `MATERIAL_TYPE_CATALOG` via `ensureMaterialTypeCatalog`), but **runtime** reads the constant (`orderAutomation.ts:52` `resolveRouteForService`).
- **Do:** in `convex/bomResolver.ts` (new), add `loadMaterialTypeCatalog(ctx)` that queries the table (falling back to the in-memory constant only when the table is empty / during fresh workspace bootstrap). Change `resolveRouteForService` to a DB-backed `resolveServiceRoute(ctx, serviceType)`.

### Step 4 — Make `serviceBOM` the authoritative multi-material recipe source
- **Status:** PARTIAL. `serviceBOM` table exists and is expanded inline in `confirmOrderAndIssueJobCard` (`orders.ts:906-952`), but there is no reusable reader.
- **Do:** add `loadActiveBomForService(ctx, serviceType)` in `bomResolver.ts` and use it from both preview and confirm.

### Step 5 — Deprecate `serviceMaterialRecipes` from active reads
- **Status:** PARTIAL. `serviceRecipes.ts` still exposes CRUD over the legacy table.
- **Do:** keep `convex/serviceRecipes.ts` read-only-compatible for migration, but route all *production* reads through `serviceBOM`. Add a `deprecated` note comment; do not delete the table (Phase 8 migrates it).

### Step 6 — Add `convex/bomResolver.ts` with shared functions
- **Status:** NEW
- **Functions:**
  - `resolveServiceRoute(ctx, serviceType)` — DB-backed material-type route (Step 3).
  - `resolveJobBOM(ctx, serviceType, dimensions, quantity)` — expand `serviceBOM` rows into planned base quantities + approved scrap + package units (moves logic currently at `orders.ts:906-952`).
  - `resolveMachineCandidates(ctx, route)` — wrap `compatibleMachines` + `selectMachineByLoad` from `orderAutomation.ts` behind a DB query.
  - `resolveMaterialAllocation(order, material, config)` — delegate to `computeStandardAllocation` (`orderAutomation.ts:144`).
  - `resolveInkRequirements(machine, orderAreaM2, config)` — the per-color ink model built in Phase 5.
- **Threading:** `resolver.ts` is imported by `orders.ts` (preview + confirm) and by `jobs.ts` (manual create + complete).

### Step 7 — Point `previewAutoRouting`, `confirmOrderAndIssueJobCard`, and job creation at the resolver
- **Status:** TODO
- **Where:** `orders.ts:735` (`previewAutoRouting`), `orders.ts:775` (`confirmOrderAndIssueJobCard`), `jobs.ts:183` (`create`)
- **Do:** replace inline routing/BOM branches with resolver calls so all three paths share one implementation.

### Step 8 — Remove direct production decisions from `src/shared/machine-catalog.ts`
- **Status:** PARTIAL
- **Where:** `src/shared/machine-catalog.ts` exports `SERVICE_ROUTING_MAP` used by `orders.ts:22`.
- **Do:** stop importing `SERVICE_ROUTING_MAP` in production Convex code. Retain the file as **seed/default data**: backfill `materialTypeCatalog` rows and machine defaults from it, but the running decision path reads the DB. This removes the dual-source drift.

---

## 4. Phase 2 — Normalize Material & Ink Models

### Step 9 — Standardize material families
- **Status:** TODO. `catalogFamily` (`ROLL | RIGID_SHEET | INK_SOLVENT | HARDWARE`, `schema.ts:26`) groups materials, but there is no functional family that separates raw/ink/solvent/hardware for consumption logic.
- **Do:** add a `materialFamily` enum to `schema.ts`: `RAW_MATERIAL | INK | SOLVENT | HARDWARE`. Seed/derive it from `catalogFamily` + `isSolvent` (`INK_SOLVENT` + `isSolvent` → `SOLVENT`; `INK_SOLVENT` without → `INK`; `ROLL`/`RIGID_SHEET` → `RAW_MATERIAL`; `HARDWARE` → `HARDWARE`).

### Step 10 — Add structured fields to `materials`
- **Status:** PARTIAL (`isSolvent`, `packageSize`, `packageUnit`, `compatibleMachineTypes` exist).
- **Missing fields (add to `schema.ts` + `materials.create` validator + seed `materialMasterFields`):**
  - `materialFamily` (new enum from Step 9).
  - `inkColor` (`v.optional(v.string())`) — parsed from `specificationValue` for ink records (single canonical color per material row).
- **Do:** add `materialFamily`, `inkColor` columns; extend `convex/material-specifications.ts` `MaterialSpecificationDefinition` so ink records carry `inkColor`; extend `materialMasterFields` (`seed.ts:24`) to write them; extend `materials.ts create/update` validators.

### Step 11 — Keep base-unit rules strict
- **Status:** PARTIAL. `productionType: "ink"` + `issuedMillilitres`/`consumedMillilitres`/`remainingMillilitres` on `operatorSubStock` exist (`inventoryLedger.ts:113-181`), but mL/L handling is scattered.
- **Do:** centralize in `materialUsage.ts`: enforce `RAW_MATERIAL` uses `m²/m/pcs`, `INK` uses `mL` base + `L` package, `SOLVENT` uses `L` and is excluded from automatic consumption (already true via `classifyMaterialProductionType`, but make it family-driven, not heuristic name-driven).

### Step 12 — Normalize existing aliases & duplicates (migration)
- **Status:** TODO (migration infra exists in `convex/migrations.ts`; no material-normalization migration).
- **Do:** add a `materialNormalization` migration (internal action + guarded mutation, following the existing `normalizePackageMetadata` pattern) that:
  - Resolves each existing material row to its canonical `findMaterialSpecification` record (latest wins).
  - Patches `materialFamily`, `inkColor`, `catalogFamily`, `packageSize`, `packageLabel`, `conversionRatio`.
  - Consolidates duplicate rows where the canonical name maps to multiple existing records, adding alias rows rather than deleting history.

### Step 13 — Migration tests for alias→canonical resolution
- **Status:** PARTIAL (`src/shared/material-specifications.test.ts` covers `findMaterialSpecification` aliases; **no Convex migration test**).
- **Do:** add `convex/materialNormalization.test.ts` proving old names resolve to the canonical records and that duplicate rows are consolidated without touching `stock_movements`.

---

## 5. Phase 3 — Atomic Request-to-Ledger Workflow

### Step 14 — Extend `materialRequests` with package + source-stock refs
- **Status:** PARTIAL. `materialRequests` already has `packageUnit`, `requestedPackages`, `issuedPackages`, `conversionRatioSnapshot`, `requestGroupId`.
- **Missing fields on `materialRequests`:** `parentInventoryId`, `operatorSubStockId`, `machineId`.
- **Do:** add `parentInventoryId`, `operatorSubStockId`, `machineId` (optional, set at issue time) to `schema.ts` + `materialRequests.ts` issue/acknowledge. `materialRequestLines` already has `requestGroupId`/`jobCardId`/`materialId`.

### Step 15 — Refactor `materialRequests.issue` into one transaction
- **Status:** PARTIAL — this is the single most important correctness gap.
- **Current (`materialRequests.ts:196-311`):** validates status + remaining qty, **pre-populates** an `operatorSubStock` row with zero quantities (`:236-255`), calls `recordInventoryEvent` with **no `parentInventoryId`** (`:256`), so **`parentInventory.totalStockQuantity` is NOT decremented**.
- **Required single-transaction sequence:**
  1. Validate request status (not `Received`/`Short Stock`/`Discrepancy`).
  2. Validate remaining requested qty / packages.
  3. Validate **central package stock** against the resolved `parentInventory` row.
  4. Decrement `parentInventory.totalStockQuantity`.
  5. Decrement central `material.quantity`
  6. Create/update `operatorSubStock` **with `parentInventoryId` set** and **only the base/package fields, letting `recordInventoryEvent` own the quantities** (remove the redundant pre-populated `issuedBaseQuantity`/`remainingBaseQuantity` that the ledger then patched).
  7. `recordInventoryEvent(STORE_TO_OPERATOR_TRANSFER, { parentInventoryId, operatorSubStockId, packageQuantity, ... })` — one call now decrements **both** `material.quantity` and `parentInventory.totalStockQuantity` and sets sub-stock quantities atomically.
  8. Patch request status → `Issued` / `Partially Issued`.
  9. Patch matching `materialRequestLines`.
  10. Patch matching `jobMaterialRequirements` status (→ `ISSUED`).

### Step 16 — Remove direct pre-population of sub-stock quantities
- **Status:** TODO
- **Do:** in `materialRequests.ts:236` and `inventory.ts:195` (`issueStockToOperator`), stop writing `issuedBaseQuantity`/`remainingBaseQuantity`/`issuedMillilitres`/`consumedMillilitres` ahead of the ledger. Insert the sub-stock row with `parentInventoryId`, identity, and zero/monotonic counters only; let `recordInventoryEvent` (which already computes ink mL) be the **only** writer of balance fields. This eliminates ghost all-zero sub-stock rows if the event throws.

### Step 17 — Require operator machine + identity match
- **Status:** PARTIAL (`canAccessMaterialRequest` in `authorization.ts:205`).
- **Do:** in `issue`, cross-check that the resolved sub-stock `machineId === job.machineId`, and that an operator-issued request `requestedBy` maps to the issuing operator role of `job.machineId`. Add a `canIssueForMachine` guard.

### Step 18 — Prevent issuance on invalid states
- **Status:** PARTIAL — `Received` and qty-overage are already blocked; **`Short Stock` / `Discrepancy` and parent-package-insufficiency are NOT**.
- **Do:** add explicit guards for status `Short Stock`/`Discrepancy`, and a parent package stock check (Step 15.3).

### Step 19 — Strict acknowledgement
- **Status:** PARTIAL (`acknowledge` at `materialRequests.ts:314` only checks `Issued`/`Partially Issued`).
- **Do:** block `Received` when any line in the group is still `Partially Issued` unless the request-level issued qty == requested qty. Update `materialRequestLines` on acknowledge.

### Step 20 — Negative tests
- **Status:** TODO. Add `convex/materialRequests.test.ts`:
  - duplicate issue (second issue after `Issued`).
  - partial issue then over-issue.
  - insufficient central packages.
  - wrong machine / wrong operator.
  - state transitions into `Short Stock`/`Discrepancy` cannot be issued.

---

## 6. Phase 4 — Unified Deduction Engine

### Step 21 — One internal `deductJobRequirements(jobCardId, actorId, mode)` function
- **Status:** NEW. Currently split: `jobs.ts:376 recordAutomaticDeduction` + `jobs.ts:532 recordAutomaticBomDeductions` + `inventory.ts:320` (log-time deduction) + `inventoryLedger.ts` (`recordInventoryEvent`).
- **Do:** create `convex/jobConsumption.ts` (new) hosting `deductJobRequirements`. It becomes the **only** place that iterates `jobMaterialRequirements` and emits the ledger movements for a job.

### Step 22 — Function responsibilities
- Load all open (non-`COMPLETED`) `jobMaterialRequirements`.
- Deduct each requirement FIFO from operator floor stock (`deductOperatorStock`).
- Deduct any remainder from central stock via `recordInventoryEvent`.
- Record every movement in `stock_movements`.
- Deduct ink separately in mL (base) / L (package).
- **Skip solvent** automatic deduction (family = `SOLVENT`).
- Mark fulfilled requirements `COMPLETED`.
- Preserve all invariants of `recordInventoryEvent` (positive qty, note, active, non-negative).

### Step 23 — Refactor both call paths to the shared function
- **Do:** `jobs.recordProduction` (via `recordProductionInternal`, `jobs.ts:50`) and `jobs.complete` (`jobs.ts:581`) both invoke `deductJobRequirements` with `mode: "incremental"` and `mode: "completion"` respectively.

### Step 24 — Decide accounting mode
- **Incremental:** deduct actual production `inputQuantity` (raw) + the ink for `outputQuantity` area.
- **Completion:** deduct remaining planned allocation (planned + approved scrap − already consumed).
- **Do:** express both as `mode` on `deductJobRequirements`; remove the divergent inline logic.

### Step 25 — Prevent double deduction
- **Status:** partially handled (completion skips `COMPLETED` rows).
- **Do:** give each `jobMaterialRequirements` a `consumedBaseQuantity` accumulator; incremental updates it; completion deducts `remaining = planned + scrap − consumedBaseQuantity` and marks `COMPLETED`. Never deduct a `COMPLETED` row twice.

### Step 26 — Idempotent completion
- **Status:** DONE (`jobs.ts:592` `if (job.status === "Completed") return;`) and preserved. Add a test proving a second `complete` produces **zero** new `stock_movements`.

---

## 7. Phase 5 — Ink & Solvent Validation

### Step 27 — Structured machine ink requirements
- **Status:** TODO. Machine has `compatibleInks` (names) + `associatedInkFamilies`, but no structured per-color rates.
- **Do:** add to `convex/schema.ts: machines` a structured ink config (e.g. `inkRequirements: array<{ materialName, inkColor?, rateMlPerSqM? }>`), seeded from `MACHINE_CATALOG.compatibleInkNames` + system `inkMlPerSquareMetre`. Optionally per-color rates.

### Step 28 — Resolve ink requirements from 3 sources
- **Order of precedence:** machine config → service BOM ink rows → system `inkMlPerSquareMetre` (fallback). Centralize in `bomResolver.resolveInkRequirements`.

### Step 29 — Validate each required ink color independently
- **Status:** TODO (current `validateDispatchResources` aggregates all ink into one litres total).
- **Do:** iterate required colors, query `materials` by `materialFamily: INK` + `inkColor` + available stock, compare per color.

### Step 30 — Per-color preview shape
```ts
{
  requiredMl, requiredLitres, availableLitres,
  color, materialName, sufficient,
}
```
- **Do:** change `DispatchResourceCheck.ink` from a single object to `Array<InkCheck>`.

### Step 31 — Block dispatch on ink failure
- **Status:** PARTIAL (`canDispatch` already false when ink insufficient aggregate).
- **Do:** extend to block when required ink material missing, color stock zero, below required, or machine requires ink but none compatible configured. Reflect per-color in `canDispatch`.

### Step 32 — Keep solvents outside automatic deduction
- **Status:** DONE (`jobs.ts:485` skips `isSolvent`; `classifyMaterialProductionType` excludes solvents). Keep family-driven.

### Step 33 — Separate solvent workflow
- **Status:** DONE-ish (stock-out, reconciliation flows exist; `solventNames` on machine).
- **Do:** document + lightly formalize the maintenance / periodic-adjustment / floor-transfer / reconciliation paths (these already exist in `inventory.ts`); no new table needed.

---

## 8. Phase 6 — Dispatch Modal Refinement

### Step 34 — Confirmation modal consumes only the dispatch preview
- **Status:** DONE. `OrderConfirmModal` (`orders.tsx:409`) inputs only payment decision/method; manual selection already removed.
- **Verify:** confirm the button payload stays `{ paymentDecision, paymentMethod, priority }` and nothing else.

### Step 35 — Display all preview fields
- **Status:** PARTIAL (`orders.tsx:507-527` shows machine, material, required vs available, aggregate ink).
- **Do:** surface `netBaseQuantity`, `plannedBaseQuantity`, `approvedScrapQuantity`, `standardWasteMargin`, `maxAllowedScrapLimit` and the per-color ink rows from the Step 30 shape.

### Step 36 — Status sections
- **Status:** TODO.
- **Do:** render four explicit sections: `Sufficient raw material verified` / `Sufficient ink verified` / `Insufficient raw material` / `Insufficient ink stock`, each driven by the preview booleans.

### Step 37 — Disable confirmation while loading/invalid/insufficient
- **Status:** DONE (`dispatchBlocked = !dispatchPreview || !dispatchPreview.canDispatch`; button disabled while `dispatchBlocked` or submitting).

### Step 38 — Re-validate inside `confirmOrderAndIssueJobCard`; never trust preview
- **Status:** PARTIAL. Confirm re-runs `resolveAutoRouting` + `validateDispatchResources`, but job card is created even on insufficient stock (it does not throw when `canDispatch` false).
- **Do:** make confirm **throw** when dispatch resources are insufficient (so a raced/out-of-band confirm cannot create a job card on short stock).

### Step 39 — Reservation step before job insertion
- **Status:** TODO.
- **Do:** add a `reservations` table (`orderId`/`jobCardId`, per-material + per-ink reserved qty, `key` unique per order). Confirm reserves material+ink before inserting `jobCards`; a cron/on-expiry release clears reservations for expired/rejected orders. The `materials` ledger stays the source of truth; reservations are advisory hard-blocks, not ledger movements.

### Step 40 — Create job card only after reservation succeeds
- **Status:** TODO. Wrap confirm so `jobCards` insert happens only after all reservations (material + every ink color) succeed; release on failure/expiry.

---

## 9. Phase 7 — Operator Dashboard Refinement

### Step 41 — Four-zone operator page
- **Status:** PARTIAL. App-router `[machine]/page.tsx` already has machine status, active job card + production/scrap/offcut logging + job queue (machine-status / active-job / logging / queue effectively exist).
- **Do:** formalize into four explicit layout zones and add the BOM-requirements zone (list `jobMaterialRequirements` for the active job).

### Step 42 — `MachineFluidGauge` component
- **Status:** NEW. No gauge exists; `printer.tsx` has only a manual ink/nozzle checkbox.
- **Do:** add `src/components/dashboard/operator/machine-fluid-gauge.tsx` showing per-ink-color remaining mL/L, required for active job, status color, last solvent adjustment, solvent/maintenance state. Feed from a new `api.inventory.listMachineInkStock` query (per machine + operator, `materialFamily: INK` / `SOLVENT`).

### Step 43 — Filter floor stock to current machine + operator
- **Status:** PARTIAL. `api.inventory.listOperatorMachineStock` (`inventory.ts:442`) filters by machine+operator already; frontend further filters to `ACTIVE`.
- **Do:** extend the query to expose `materialFamily` so the UI can separate ink/solvent/raw and drive the gauge.

### Step 44 — Request-modal category presets
- **Status:** TODO. `materialRequests.create` allows free material lines.
- **Do:** in the request modal, add preset tabs: Job BOM materials / Ink bottles & colors / Solvents & maintenance / Other raw materials — pre-filling `packageUnit` + packages per category.

### Step 45 — Live package→base conversion
- **Status:** TODO.
- **Do:** in the request modal, show conversion live (e.g. `2 × 1L ink bottles = 2000mL`, `1 roll × 160 = 160 m²`) using `conversionRatioSnapshot`/`packageSize`.

### Step 46 — Pass machineId + operatorSubStockId to offcut/scrap modals
- **Status:** TODO.
- **Do:** thread `machineId` + the active `operatorSubStockId` into `onOffcut()`/`onScrap()` so movements bind to the correct floor batch.

### Step 47 — Lock completed jobs
- **Status:** TODO.
- **Do:** when `job.status === "Completed"` hide production inputs, completion action, scrap/offcut actions; show a read-only completion summary (totals, waste, overuse flags).

---

## 10. Phase 8 — Data Migration

### Step 48 — Migrate `serviceMaterialRecipes` → `serviceBOM`
- **Status:** TODO.
- **Do:** `normalizeServiceRecipesToBom` migration (map `requirementMode`+`quantity` → `consumptionMode`+`quantityPerUnit`; serviceType+materialId identity; preserve active/waste amounts).

### Step 49 — Normalize duplicate material names & aliases
- **Do:** folded into the Step 12 `materialNormalization` migration; consolidated canonical rows + alias rows.

### Step 50 — Populate machine compatibility fields
- **Do:** backfill `primaryMaterialFamilies`, `associatedInkFamilies`, `compatibleInks`, `solventNames` from `MACHINE_CATALOG` (already the data source for `migrateYtAdvertisementMasterData`; extend to `inkRequirements` from Phase 5).

### Step 51 — Populate ink colors & solvent flags
- **Do:** in `materialNormalization`, set `inkColor` (from ink `specificationValue`) and `materialFamily`, and verify/patch `isSolvent`.

### Step 52 — Backfill numeric order dimensions
- **Do:** for orders with `length/width` missing but a dimension string present, parse via `parseDimensions` (`orders.ts:97`) and patch. Guarded by an idempotent migration key.

### Step 53 — Backfill `jobMaterialRequirements` for active jobs
- **Do:** for open (non-Completed) `jobCards` lacking requirements, regenerate from current `serviceBOM` + dimensions **only where safe** (no pre-existing consumption), mirroring the confirm-time expansion.

### Step 54 — Do not alter historical ledger movements / opening balances
- **Do:** all migrations are additive/backfill-only on catalog & config; **never** patch `stock_movements`, `parentInventory`, `operatorSubStock`, or `materials.quantity`. Extend `clearWorkspaceData` semantics only for forced reseed.

---

## 11. Phase 9 — Verification

### Step 55 — Convex tests
- **Status:** TODO (no handler tests exist).
- **Add:** `convex/bom.test.ts`, `convex/materialNormalization.test.ts`, `convex/materialRequests.test.ts`, `convex/jobs.test.ts`, `convex/inventoryLedger.test.ts`, `convex/orders.test.ts`, `convex/ink.test.ts` covering: routing resolution, BOM calc, ink-shortage rejection, multi-color validation, parent→floor transfer accounting, request issue idempotency, acknowledgement, incremental deduction, completion deduction, solvent exclusion.

### Step 56 — UI tests
- **Status:** TODO (only `.test.ts` logic tests; no `.test.tsx`).
- **Add** (Vitest + React Testing Library): disabled dispatch button; red insufficient indicators; automatic machine/material display; operator fluid gauges; completed-job read-only state.

### Step 57 — Verification commands
```bash
pnpm install --frozen-lockfile
pnpm test
pnpm check
npx tsc --noEmit
npx convex dev --once
NODE_ENV=production pnpm build
```

### Step 58 — Authenticated smoke test
- Walk: receptionist dispatch → storekeeper issue → operator receipt → operator production → ink-shortage block → job completion → ledger reconciliation (spot-check `stock_movements` + `parentInventory` + `operatorSubStock` balances reconcile).

---

## 12. Guardrails

1. **Ledger is truth.** Never patch `stock_movements`-derived balances directly; every write goes through `recordInventoryEvent`.
2. **Do not edit `convex/_generated/`.** Regenerate via `npx convex dev`.
3. **Backend before UI.** Phases 1–5 + 8–9 before 6–7 so the UI consumes stable contracts.
4. **Migration idempotency.** Every new migration keys on `migrations.by_key` and refuses to run twice.
5. **Aliases before deletes.** When consolidating materials, add alias/normalized rows; never delete history.
6. **Preserve running verified behaviors.** Phase 0 tests gate every later refactor.
7. **Validation commands** (§ 11 Step 57) gate each phase before moving on.
