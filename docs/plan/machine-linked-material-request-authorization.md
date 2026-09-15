# Machine-to-Material Link System — Operator Loop Implementation Plan

**Status:** Active implementation planning
**Repository:** `yoh-space/yt-ads`
**Production Convex:** `glad-ibis-568`

## Objective

Define and implement the **full machine→material link loop for machine operators**: the end-to-end path by which an owner links an exact operational material record to a machine, and a machine operator then consumes it through a production job — request → issuance → floor custody (`operatorSubStock`) → substrate pre-flight on the job ticket → consumption → waste/offcut enforcement → reconciliation/clearance.

The `machineMaterialLinks` table is the single source of truth for **which exact material a machine is authorized to request and consume**. Every downstream step (eligibility, issuance, custody, offcut) must honor it.

---

## 0. Scope & Non-Goals

### In scope
- Owner authoring of machine→material links (the link lifecycle).
- Operator material-request eligibility that **intersects job-required materials with active links**.
- Storekeeper issuance into `operatorSubStock` bound to the linked material.
- Substrate pre-flight on the machine operator's job ticket (substrate matching).
- Floor custody lifecycle, consumption, waste/offcut enforcement by owner-set limits.
- Reconciliation and clearance gate.
- Operator UI consuming **only server-scoped eligibility**.
- Authorization enforcement at every layer.
- Database-first alignment (the link becomes the runtime source; no static fallback).

### Out of scope
- Service BOM routing redesign (separate `machineServiceRoutes` / `serviceDefinitions`).
- Historical restatement of past requests/stock records.
- Re-architecting the ledger accounting model (`inventoryLedger`, `stockMovements`).
- Non-operator roles' independent material flows (reception/owner pricing).

---

## 1. The Loop (end-to-end)

```
OWNER CONFIG
  ├─ 1. Owner links exact operational material → machine
  │      (machineMaterialLinks: active, relationshipType, productionType,
  │       conversionRatioOverride, wasteMarginPercent, required)
  │
  └─ 2. Owner sets waste limits per material / sub-stock
         (maxScrap, minOffcutWidth, minOffcutLength, wasteLimitPolicy)
         │
OPERATOR FLOW
  ├─ 3. Operator opens a job card → substrate pre-flight resolves
  │      the job's material against floor stock (MATCHED /
  │      ROLL_CHANGE_REQUIRED / NO_STOCK)
  │
  ├─ 4. Operator requests material → eligibility intersects job-required
  │      materials with ACTIVE links for the machine. Unlinked = blocked.
  │
  ├─ 5. Storekeeper issues → creates operatorSubStock (ACTIVE) for
  │      the linked operational material on that machine, preserving
  │      the exact materials ID and conversion snapshot.
  │
  ├─ 6. Operator consumes on the machine → production logging (input,
  │      good output, waste), offcut logging, scrap enforcement
  │      against owner-set limits.
  │
  └─ 7. Reconciliation & clearance → operatorSubStock PENDING_CLEARANCE
         → owner clears → CLEARED. If linked material runs short,
           clearance gate blocks new requests.
```

> **Rule:** Owner configuration (machine-material link + waste limits) determines **what a machine may request and consume**. Job configuration determines **which of those linked materials are needed right now**. Both conditions must be satisfied.

---

## 2. Data Model

### 2.1 `machineMaterialLinks` (owner authoring)

Defined in `convex/schema.ts`. Fields:

```ts
machineMaterialLinks: defineTable({
  machineId:            v.id("machines"),
  materialId:           v.id("materials"),
  relationshipType:     machineMaterialRelationship,  // primary | supported | ink | solvent | accessory | consumable
  productionType:       v.optional(productionType),
  conversionRatioOverride: v.optional(v.number()),   // machine-specific rate
  wasteMarginPercent:   v.optional(v.number()),      // 0–100
  required:             v.boolean(),
  notes:                v.optional(v.string()),
  active:               v.boolean(),                 // request-authorizing when true
  effectiveFrom:        v.optional(v.number()),
  effectiveTo:          v.optional(v.number()),
  createdAt:            v.number(),
  updatedAt:            v.number(),
  createdBy:            v.string(),
  updatedBy:            v.string(),
})
  .index("by_machine", ["machineId"])
  .index("by_material", ["materialId"])
  .index("by_machine_material", ["machineId", "materialId"]);
```

Index `by_machine_material` makes operator-eligibility lookups efficient.

### 2.2 `materials` (operational entity)

Waste-limit fields live here (recently added):

```ts
materials: defineTable({
  // ... existing fields ...
  maxScrap:            v.optional(v.number()),
  minOffcutWidth:      v.optional(v.number()),      // m² materials only
  minOffcutLength:     v.optional(v.number()),      // m² materials only
  wasteLimitPolicy:    v.optional(wasteLimitPolicy), // "warn" | "block"
  // ...
})
```

`machineMaterialLinks.conversionRatioOverride` and `wasteMarginPercent` allow machine-specific overrides of the operational material's base conversion and waste margin.

### 2.3 `operatorSubStock` (floor custody)

Issued stock on the machine floor, per operator + machine + material:

```ts
operatorSubStock: defineTable({
  parentInventoryId:   v.id("parentInventory"),
  materialId:          v.id("materials"),
  operatorId:          v.string(),
  machineId:           v.id("machines"),
  issuedUnits:         v.number(),
  issuedQuantity:      v.number(),
  currentRemaining:    v.number(),
  status:              operatorStockStatus, // ACTIVE | PENDING_CLEARANCE | CLEARED | EXHAUSTED | DEPLETED | VOIDED
  issuedBy, issuedAt, updatedAt,
  packageUnit, issuedPackages, remainingPackages,
  baseUnit, conversionRatioSnapshot,
  consumedBaseQuantity,
})
  .index("by_machine", ["machineId"])
  .index("by_operator_machine_material", ["operatorId","machineId","materialId"]);
```

### 2.4 `jobMaterialRequirements` (job demand)

Job-driven demand; the operator request must be a subset of job-required materials intersected with active links.

### 2.5 Related tables consumed by the loop

| Table | Role in loop |
|---|---|
| `machineMaterialLinks` | Authorization boundary |
| `materials` | Operational entity + waste limits |
| `parentInventory` | Central store packaging units |
| `operatorSubStock` | Floor custody |
| `jobMaterialRequirements` | Job demand |
| `jobCards` | Production task + machine binding |
| `machineInkConsumptionRules` | Machine-specific ink rates |
| `machineServiceRoutes` | Service→machine routes |
| `reconciliations` | Custody variance & clearance gate |

---

## 3. Owner Configuration — Link Author

### 3.1 Backend (already implemented)

`convex/owner/machineMaterialLinks.ts` exposes:
- `list` — query links by machine/material, filter inactive.
- `upsert` — create or patch a link; enforces single active link per `(machineId, materialId, relationshipType)`, validates machine & material are active, validates `wasteMarginPercent ∈ [0, 100]`.
- `archive` / `restore` — lifecycle without deleting history.

Owner mutation flow (`upsert`) records `createdBy` / `updatedBy` from `requireOwner(ctx)`.

### 3.2 Owner UI (already implemented)

`src/app/(dashboard)/dashboard/owner/machines/configure/[machineId]/page.tsx` shows the machine configuration page with tabs including a **Raw Materials / Links** tab. It queries:
- `api.owner.machineMaterialLinks.list`
- `api.owner.machineInkRules.list`
- `api.owner.machineServiceRoutes.list`

and invokes `archive`, `restore`, `upsert`.

**Planned owner UX clarifications** (to add):
- Clear "Allow operator requests from main store" indicator derived from active link state.
- Show `relationshipType` and `required` on each link row.
- Warn on: archived link, link to archived material, duplicate active relationship, linked material not present in any active job requirement, required link with no valid conversion contract.
- Material selector shows only active owner-configured operational materials.

### 3.3 Catalog-side link management

`convex/catalog.ts` also manages `machineMaterialLinks` (bulk import from catalog, duplicate detection on `by_machine_material`). This is the catalog seed path and must stay consistent with the owner upsert path.

---

## 4. Operator Material-Request Eligibility — THE GAP TO CLOSE

### 4.1 Current state

`convex/materialRequests.ts` contains `getMaterialRequestEligibilityInternal` and `createMaterialRequestInternal`. They validate:
- Machine exists and is assigned to the operator's role.
- Job belongs to the machine and is active.
- Materials are in the job's primary + `jobMaterialRequirements`.
- Custody, shortage, pending-clearance, active-stock blocks.
- Conversion ratios and unit/package contracts.

**They do NOT consult `machineMaterialLinks`.** An owner-authored link is currently advisory only; an unlinked job material is still requestable if it appears in the job requirements. This is the central gap this plan closes.

`convex/operator/requests.ts` exposes `getEligibility` and `create`, delegating to the same internal functions — no link check there either.

### 4.2 Target behavior

Eligibility must **intersect** job-required material IDs with **active links** for the selected machine:

```
candidateIDs = { job.materialId } ∪ { jobMaterialRequirements[].materialId }
activeLinks  = machineMaterialLinks where machineId = machine._id AND active = true
allowed      = candidateIDs ∩ { link.materialId for link in activeLinks }
```

Every line in a new request must revalidate against the shared resolver.

### 4.3 Shared authorization helper

Create a reusable helper (e.g. `convex/machineMaterialAuthorization.ts` or inline in `materialRequests.ts`) that:
1. Accepts a `machineId` and a set of `materialId`s.
2. Queries `machineMaterialLinks` via `by_machine_material`.
3. Filters `active === true` and `effectiveFrom/To` window.
4. Resolves each linked `materials` record (must be active).
5. Returns link metadata per allowed material: `linkId`, `relationshipType`, `productionType`, `required`, `conversionRatioOverride`, `wasteMarginPercent`.
6. Excludes missing/archived material records.
7. Never name-matches or falls back to static catalogs.

The helper must be called by **both** eligibility and mutation so read/write behavior cannot drift.

### 4.4 Update `getMaterialRequestEligibilityInternal`

1. Resolve machine and job as today.
2. Build candidate set from `job.materialId` + `jobMaterialRequirements`.
3. Resolve active links for the selected machine and candidate IDs.
4. Intersect → `allowedMaterials`.
5. Enrich each allowed material with link metadata + link-level overrides.
6. Distinguish these operator states:

| State | Operator result |
|---|---|
| Active & linked & job-required | Selectable (subject to custody/shortage) |
| Active & linked but NOT job-required | Not selectable for this job |
| Active link, material archived/inactive | Not selectable; show inactive-material reason |
| Link archived | Not selectable; show inactive-link reason |
| Link missing (unlinked material) | Not selectable; show configuration error |
| Material linked but absent from job requirements | Not selectable for that job |

Return `blockingReasons` + a clear message when a job-required material is not linked to the machine.

### 4.5 Update `createMaterialRequestInternal`

For every request line, before any insert, validate against the same shared helper:
- Material is an active operational record.
- Material belongs to the job's requirement set.
- An **active** `machineMaterialLinks` row exists for the selected machine.
- The submitted unit/package match the operational material / owner link contract.
- If a `conversionRatioOverride` exists on the link and the owner permits it for issuance, apply it; otherwise keep the operational material conversion snapshot for store issuance (see § 7 policy below).
- Tampered material IDs, link IDs, relationship types, units, package units, and conversion ratios cannot broaden permission.
- Validation runs **before** the first `materialRequests` / `materialRequestLines` insert.

### 4.6 `operator/requests.ts` contract

`getEligibility` and `create` already delegate correctly. No changes needed there beyond the internal functions they call. The operator request modal must consume only this response.

---

## 5. Issuance & Floor Custody (`operatorSubStock`)

### 5.1 Issuance flow (`issueMaterialRequestInternal`)

Storekeeper issuance must continue to use the **exact `materials` ID** from the request. The issued `operatorSubStock` row must retain:
- `materialId` (exact operational ID),
- `machineId` (the linked machine),
- `operatorId`,
- `parentInventoryId`,
- `conversionRatioSnapshot`,
- `packageUnit` / `issuedPackages`,
- `baseUnit`,
- `status: "ACTIVE"`.

No name-based or catalog-ID substitution is permitted.

### 5.2 Link-aware issuance

When issuing against a request created under a machine-material link, the issued batch should record the `machineMaterialLinks._id` (`machineMaterialLinkId`) so downstream consumption and offcut can read the machine-specific `conversionRatioOverride` and `wasteMarginPercent`. This keeps machine-specific production behavior separate from central-store issuance.

### 5.3 Batch lifecycle

`operatorSubStock.status` progresses: `ACTIVE` → `PENDING_CLEARANCE` (when owner flags clearance) → `CLEARED` / `EXHAUSTED` / `DEPLETED` / `VOIDED`.

- Depleted batches are auto-transitioned to `EXHAUSTED`.
- A `PENDING_CLEARANCE` batch blocks new requests for the same material on the same machine (see `requireNoUnresolvedShortage`).
- An `ACTIVE` batch with `currentRemaining > 0.0001` blocks a new request (active custody exists — consume/reconcile first).

### 5.4 Machine-scoped custody check

Every material request is scoped to `operatorSubStock` rows where `machineId = scopeMachine._id` AND `(operatorId = caller OR operatorId = caller.role)`. This is already implemented.

---

## 6. Substrate Pre-Flight on the Job Ticket

### 6.1 Machine overview (`convex/operator/overview.ts`)

`getMachineOverview` builds `machineJobs[]` and an `enrichedDisplayedJob` with `substrateMatch: SubstrateMatchInfo`. `SubstrateMatchInfo` is:

```ts
type SubstrateMatchInfo =
  | { status: "MATCHED";        materialId, materialName, remaining, unit }
  | { status: "ROLL_CHANGE_REQUIRED"; materialId, requiredMaterialName, loadedMaterialName, loadedRemaining, unit }
  | { status: "NO_STOCK";       materialId, requiredMaterialName };
```

### 6.2 Link-aware substrate matching (proposed enhancement)

Currently substrate matching uses floor stock (`operatorSubStock` active/PENDING_CLEARANCE non-ink batches). To make the machine-material link authoritative for substrate pre-flight, the matcher should **prefer the linked material** when resolving which substrate to mount:

1. For the job's primary material, find active floor stock for that exact `materials` ID → `MATCHED`.
2. If absent but the machine has an **active** `machineMaterialLinks` row for the job's material, surface `MATCHED (pending load)` / `ROLL_CHANGE_REQUIRED` with the link's `required` flag, so the operator knows the linked substrate must be loaded.
3. If the material is **not linked** to the machine, surface a configuration-error state on the job ticket: "Material is not linked to this machine — owner must configure the link."

This ensures the operator sees, at a glance, whether the job's material is authorized for the machine and whether the correct substrate is on the floor.

### 6.3 Job ticket hero (`src/components/dashboard/roles/operator/job-ticket-hero.tsx`)

The operator's job-ticket hero already renders the substrate pre-flight banner. It receives `job.substrateMatch` from the overview query. The planned enhancement (§ 6.2) makes `substrateMatch` link-aware; no UI structural change is required beyond showing the configuration-error state.

---

## 7. Consumption, Waste & Offcut Enforcement

### 7.1 Owner-set waste limits

Each `materials` row carries owner-set limits (recently added):
- `maxScrap` — maximum scrap as a percent of input (used in production logging).
- `minOffcutWidth`, `minOffcutLength` — minimum offcut dimensions (m² materials only).
- `wasteLimitPolicy` — `"warn"` (notify) or `"block"` (reject).

These are validated in `convex/owner/materials.ts` (`validateWasteLimits`) at create/update and enforced during production logging in `convex/operator/offcuts.ts`.

### 7.2 Production logging & offcut enforcement (`convex/operator/offcuts.ts`)

`enforceScrapBounds` and the production-logging path enforce owner limits:
- Offcuts below `minOffcutWidth × minOffcutLength` are rejected for logging as offcuts and redirected to scrap.
- Production gains are capped by `maxScrap` (the scrap % cannot exceed the owner limit without owner clearance).
- `wasteMarginPercent` on `machineMaterialLinks` provides a machine-specific override when the owner permits it for consumption (separate from issuance).

### 7.3 Conversion & waste override policy

| Context | Conversion used | Waste margin |
|---|---|---|
| Store issuance (central → floor) | Operational material `conversionRatio` (request snapshot) | n/a |
| Machine production consumption | `machineMaterialLinks.conversionRatioOverride` when owner permits | `machineMaterialLinks.wasteMarginPercent` |
| Offcut logging | Operational material base | Owner `maxScrap` / `wasteLimitPolicy` |

This prevents a machine-specific production rate from incorrectly changing how the storekeeper converts rolls/sheets during issuance.

---

## 8. Reconciliation & Clearance Gate

### 8.1 Reconciliation (`convex/reconciliation.ts`)

Reconciliations track `operatorSubStock` variance. A reconciliation with `variance < 0` and `status !== "Resolved"` constitutes an unresolved shortage.

### 8.2 Clearance gate

When an operator's floor batch moves to `PENDING_CLEARANCE`, `requireNoUnresolvedShortage` blocks new requests for that material on that machine until the owner clears it. The operator's `uncleared` query (`convex/operator/inventory.ts`) exposes `hasPendingClearance`, which the UI surfaces as a gate.

### 8.3 Link interaction

An **archived** machine-material link does **not** retroactively clear an active `PENDING_CLEARANCE` batch. The operator must still obtain owner clearance. The link state only gates **new** requests.

---

## 9. Operator UI Contract

The operator request modal and job ticket must consume **only** server-scoped eligibility — no static catalog fallback, no `api.materials.list` fallback, no name-based matching.

### 9.1 Request modal (`src/components/dashboard/modals/material-request-modal.tsx`)

1. Open with no global material list.
2. Load eligibility for the selected job + machine via `getEligibility`.
3. Show only active-linked materials required by the job, with `relationshipType` and `required` visible.
4. Display a clear configuration error when a job material is not linked to the machine.
5. Disable submission while loading.
6. Refresh on job change or link lifecycle change.
7. Submit exact material IDs and quantities.

### 9.2 Job ticket hero

Render substrate pre-flight (link-aware per § 6.2), production controls, offcut/scrap actions, and waste-limit warnings (`wasteLimitPolicy: "warn"`).

### 9.3 Floor stock view

Show `operatorSubStock` batches with status, consumed %, and clearance gate indicator. Link metadata (relationship, required) is shown where relevant.

---

## 10. Authorization & Security

All checks remain mandatory:
1. Caller is authenticated with an operator role.
2. Machine is within the caller's assigned machine scope (`profile.assignedMachineIds`).
3. Job belongs to the selected machine.
4. Material is allowed by the job.
5. **Material is actively linked to the machine** (`machineMaterialLinks.active === true`).
6. Material is active.
7. Custody and reconciliation rules permit a new request.

Frontend visibility is **not** an authorization mechanism — every rule is enforced in Convex mutations.

---

## 11. Database-First Alignment

Per `docs/plan/database-first-migration.md`, the `machineMaterialLinks` table is already database-backed (not static). To complete alignment:

- `machineMaterialLinks` remains the runtime source for machine→material authorization (no static fallback).
- If a future `materialCatalog` migration consolidates material identity, `machineMaterialLinks.materialId` must still reference the operational `materials` row (exact ID, no alias/name matching).
- Owner UI CRUD for links is the only write path; no code redeploy needed to create/archive/restore links.
- Add `assertMachineMaterialLinksSync()` drift diagnostics at seed time (optional; see database-first plan).

---

## 12. Implementation Sequence

### Phase 1: Shared authorization helper
- Create `convex/machineMaterialAuthorization.ts` (or equivalent).
- Add `by_machine_material` index if missing (already present).
- Add diagnostics for duplicate/invalid active links.

### Phase 2: Eligibility integration
- Update `getMaterialRequestEligibilityInternal` to intersect candidates with active links.
- Return link metadata and blocking reasons per state table (§ 4.4).
- Update `operator/requests.ts` `getEligibility` (delegates — no change needed).
- Add focused tests for link-based eligibility.

### Phase 3: Mutation enforcement
- Update `createMaterialRequestInternal` to revalidate every request line against the shared helper.
- Record `machineMaterialLinkId` on issued `operatorSubStock` batches.
- Preserve conversion/waste contracts per § 7.3.
- Add focused tests for link enforcement and tamper resistance.

### Phase 4: Substrate pre-flight enhancement
- Make `getSubstrateMatch` in `convex/operator/overview.ts` link-aware (§ 6.2).
- Add configuration-error state to job ticket.
- Add tests.

### Phase 5: Owner UX clarification
- Update machine configuration page labels/warnings (§ 3.2).
- Add link-state indicators to the Raw Materials tab.
- Add configuration-error visibility in operator request flows.

### Phase 6: Reconciliation diagnostics
- Run idempotent diagnostics for missing/invalid links, duplicate active relationships, and linked materials without parent inventory.
- Owner-reviewed remediation only; no automatic link creation from names.

### Phase 7: Regression verification
- Focused tests, full test suite (`pnpm test`), `pnpm check` (`tsc --noEmit`), and `NODE_ENV=production pnpm build`.
- Manual role-matrix walkthrough (§ 14).

---

## 13. Acceptance Criteria

1. Owner can link an exact active operational material record to a machine.
2. Operator on that machine can request the linked material **only when** the selected job requires it.
3. Operator cannot request the material when the link is archived or absent.
4. A linked material not required by the selected job is not selectable for that job.
5. Every request line is server-side revalidated against the active machine-material link.
6. No request flow uses a global material fallback, static catalog fallback, or name-based lookup.
7. Storekeeper issuance preserves the exact operational material ID and records the link ID.
8. Floor custody (`operatorSubStock`) retains machine + operator + material + conversion snapshot.
9. Substrate pre-flight on the job ticket is link-aware and shows configuration errors.
10. Owner-set waste limits (`maxScrap`, `minOffcutWidth/Length`, `wasteLimitPolicy`) are enforced on offcut logging and production gains.
11. Machine-specific `conversionRatioOverride` / `wasteMarginPercent` apply to consumption, not issuance.
12. Unresolved shortage / `PENDING_CLEARANCE` blocks new requests regardless of link state.
13. Archived links do not retroactively clear existing floor custody or clearance gates.
14. Historical requests remain readable after a link is archived.
15. All focused tests, full tests, `pnpm check`, and production build pass.

---

## 14. Testing Plan

### Backend tests (add/extend in `convex/test/`)

- Active owner link makes a job-required material eligible.
- Missing link blocks eligibility; clear `blockReason`.
- Archived link blocks eligibility.
- Inactive material blocks eligibility even when link is active.
- Linked-but-job-unrequired material is excluded.
- Multi-line requests require an active link for **every** line.
- Tampered material IDs / link IDs / relationship types / units / package units / conversion ratios cannot broaden permission.
- Duplicate active `(machineId, materialId, relationshipType)` relationships are rejected.
- Restored links become eligible for future requests.
- Historical requests remain readable after link archival.
- Store issuance retains the exact operational material ID and records `machineMaterialLinkId`.
- Floor custody `operatorSubStock` carries machine + operator + material + snapshot.
- Offcut below `minOffcutWidth × minOffcutLength` is redirected to scrap.
- Production waste capped by `maxScrap` / owner policy.
- `PENDING_CLEARANCE` blocks new requests.
- Substrate pre-flight reflects link state (MATCHED / ROLL_CHANGE_REQUIRED / configuration-error).

### Frontend tests

- No `api.materials.list` fallback in operator request flows.
- Only server eligibility options appear in the selector.
- Unlinked job materials display a configuration error.
- Loading eligibility disables submission.
- Job changes remove options from the previous job.
- Relationship type and `required` status are visible.
- Substrate banner reflects link-aware state.

### Manual role-matrix

| Actor | Expected behavior |
|---|---|
| Owner | Links exact materials to machines, archives/restores, sets waste limits |
| Machine operator | Requests only active linked materials required by the job; sees substrate pre-flight; logs production/offcut within owner limits |
| Storekeeper | Issues the exact operational material; records link ID; respects custody gates |
| Manager/admin | Reviews request history, configuration errors, and reconciliation without bypassing material-identity rules |

---

## 15. References

- [1]: ../../convex/owner/machineMaterialLinks.ts — Owner machine-material link mutations (list/upsert/archive/restore)
- [2]: ../../convex/materialRequests.ts — `getMaterialRequestEligibilityInternal` / `createMaterialRequestInternal` (the gap)
- [3]: ../../convex/operator/requests.ts — Operator-scoped request surface (delegates to materialRequests)
- [4]: ../../convex/operator/overview.ts — `getMachineOverview` + `SubstrateMatchInfo` (substrate pre-flight)
- [5]: ../../convex/operator/common.ts — `resolveOperatorMachine` / `collectFloorStock`
- [6]: ../../convex/operator/inventory.ts — `listStock` / `uncleared` (floor custody + clearance gate)
- [7]: ../../convex/owner/materials.ts — Owner material CRUD + waste-limit validation
- [8]: ../../convex/schema.ts — `machineMaterialLinks`, `materials`, `operatorSubStock` table definitions
- [9]: ../../docs/plan/database-first-migration.md — Database-first migration conventions
- [10]: ../../src/app/(dashboard)/dashboard/owner/machines/configure/[machineId]/page.tsx — Owner machine configuration UI (link tab)
- [11]: ../../src/components/dashboard/modals/material-request-modal.tsx — Operator material request modal
- [12]: ../../src/components/dashboard/roles/operator/job-ticket-hero.tsx — Operator job-ticket hero (substrate pre-flight banner)
- [13]: ../../convex/catalog.ts — Catalog-side machine-material link management
