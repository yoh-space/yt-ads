# Owner Oversight — Loss Prevention & Executive Auditing

> **Scope.** This document explains the surfaces the **Owner** (the managing director of YoTech Digitals / YT Advertisement) sees inside the dashboard, the strict operator-clearance workflow that gates new stock requests, the ETB-denominated leakage bookkeeping that powers the executive view, and the explicit scope boundary the Owner is locked inside.

The Owner is a single-account role (`role: "owner"` in `convex/schema.ts`). There is exactly one Owner per workspace (`users` table). The role's permission set is defined in `convex/authorization.ts:111` and mirrored in `src/lib/permissions.ts:99` — the canonical source of truth.

## 1. Core purpose

The Owner dashboard exists for **one purpose: loss prevention, theft control, and executive auditing.** Every panel, every metric, and every action reachable from the Owner workspace is shaped by that constraint:

- The Owner does not request or issue raw materials to operators. That work belongs to the storekeeper; `convex/authorization.ts:103` explicitly excludes `request.create`, `request.issue`, and `request.acknowledge` from the Owner role.
- The Owner does not place customer orders. Reception staff own the order lifecycle.
- The Owner does not record production. Operators and the store own that.

Instead, the Owner:

1. Reviews ETB-denominated **inventory shortages and variances** surfaced by the two-tier reconciliation engine (`convex/reconciliation.ts` and `convex/reports.ts`) so that any monetary leakage (in ETB) is visible without sorting through raw numbers.
2. Reviews the **operator floor audit** (`ownerSubStock` rows that are awaiting clearance) and signs off on each operator's reconciled consumption before that operator can issue any further material requests.
3. Reviews the **physical count audit history** of central-store reconciliations and resolves them through the `Open → Reviewed → Resolved` lifecycle (`convex/reconciliation.ts:69`).
4. Sets the **operational configuration knobs** that calibrate how ETB value and ink/waste thresholds are calculated (`convex/systemConfigs.ts`).
5. Sees the broad **financial overview** that production staff, storekeepers, and receptionists are scoped out of. ETB `monetaryLoss` fields on shortage rows are gated by `canViewFinancial(role)` — owner-only (`convex/authorization.ts:187`).

The Owner does not "operate" the shop floor. The Owner **observes and decides**.

## 2. Scope boundary — what's explicitly out of the Owner's hands

The Owner role carries **`ALL`** permissions — **minus** three things the Owner never needs (`convex/authorization.ts:103`):

| Permission | Reason for exclusion |
| --- | --- |
| `request.create` | The Owner does not act as a machine operator; new material requests are initiated by the operator whose machine needs the stock. |
| `request.issue` | Issuing material from the central store to a press operator is the storekeeper's job; the Owner never executes handovers. |
| `request.acknowledge` | Acknowledging receipt of an issued batch is done by the operator who received it. |

The result: **the Owner never sees a "New Request" form, an "Issue" button, or an "Acknowledge" action.** The dashboard applies these permission exclusions consistently (e.g. in `src/components/dashboard/operations-dashboard.tsx`, the request drawer / handler buttons only render when `canCreateRequest/canIssueRequest/canAcknowledgeRequest` are true for the role — all of which are false for the Owner).

The Owner *is* granted two permissions that the Owner (and only the Owner + admin) carry, exclusively:

| Permission | Reason |
| --- | --- |
| `reconciliation.clearance` | The Owner is the single gatekeeper that can lift a `PENDING_CLEARANCE` flag on an operator's sub-stock batch (admin also holds it for back-office substitution). |
| `company_settings.update` | The Owner writes the operational configuration (ETB rates, conversion ratios, risk controls). Admin can edit settings too, but the operational `systemConfigs` page is gated to both. |

The privilege set is intentionally narrow at the edges. Every "what does the Owner do?" question is answerable by reading `ROLE_PERMISSIONS.owner` in `convex/authorization.ts:111`.

## 3. The Owner Inventory & Operator Stock Oversight dashboard

The Owner's primary oversight surface is the dedicated two-section page implemented in `src/components/dashboard/views/owner-inventory-oversight.tsx`. The page is mounted when the signed-in profile holds the `reconciliation.clearance` permission (Owner, admin) and the active view is `inventory`; it is rendered alongside (or replaces, for the Owner) the standard storekeeper inventory console.

### 3.1 Section A · Operator Floor Stock Monitor (`የማሽን ኦፕሬተሮች የክምችት ቁጥጥር`)

The Section A surface is the **operator floor audit queue**. It groups every live `operatorSubStock` row (status `ACTIVE` or `PENDING_CLEARANCE`) by operator + machine and answers four questions in real time:

| Question the card answers | Visible metric |
| --- | --- |
| How much raw material does this operator hold right now? | **Current stock holding** (large mono in base units — m², m, L). |
| Of the issued material, how much turned into production output? | **Issued vs. produced** — issued / produced (m² or metres) plus **usage %** and **waste %**. |
| Where is this batch in its lifecycle? | `ACTIVE`, `PENDING_CLEARANCE`, or `CLEARED` badge. |
| Is anything urgently waiting on the Owner? | When the status is `PENDING_CLEARANCE`, the card surfaces **discrepancy metrics** (last physical count vs. system-derived count, ETB-equivalent variance) and a primary **"Approve Clearance"** button. |

The data feed for Section A is the `operatorClearanceAudit` query (`convex/inventory.ts`). It:

- reads every `operatorSubStock` row where `status ∈ {ACTIVE, PENDING_CLEARANCE}`,
- joins the latest `weeklyReconciliations` entry per batch (via `by_reconciled_at` ordering) to surface physical-count discrepancies,
- aggregates per-batch consumption + scrap from `stock_movements` filtered by `eventType ∈ {PRODUCTION_CONSUMPTION, OFFCUT_RETURN, SCRAP_LOG}` and `operatorSubStockId` (the `by_operator_sub_stock` index makes this cheap),
- joins materials, machines, and operator names for display.

The PENDING_CLEARANCE rows are exactly those produced when an operator exhausts their batch or records a weekly reconciliation that the ledger flags as `eventType = RECONCILIATION_ADJUSTMENT` — see Section 4 of `workflows.md` for the exact transition path.

### 3.2 Section B · Central Parent Inventory Oversight (`የዋና ስቶር ኪፐር ዋና መዝገብ`)

The Section B surface is the **central store + shortage ledger**. It is rendered as three stacked Panels inside the second section:

- **Parent inventory grid** — whole packaging units held by the store, each row labelled with the package type (`ROLL`, `SHEET`, `LITER`) and the base-unit conversion (e.g. *≈ 320 m²* beneath the roll count). Data feed: `api.inventory.listParentInventory` which picks up `lengthPerRoll / areaPerSheet / volumePerContainer` from the parent inventory rows and the material's `baseUnit`.
- **Leakage & variance alerts** — a ranked shortage table. Material shortages from the *latest* reconciliation per material are sorted by their `monetaryLoss` (`convex/reconciliation.ts:135`) and displayed with full ETB value gated to the Owner via `canViewFinancial(role)` — the server returns `monetaryLoss: 0` to non-Owner roles. The total audited loss is rendered at the bottom (`totalMonetaryLoss`).
- **Reconciliation history** — the most recent physical-count entries with their `variance` and `monetaryLoss`. When the Owner can review (`reconciliation.review` permission) and the record is still `Open`, two tiny action buttons surface: **Review** (transitions to `Reviewed`) and **Resolve** (transitions to `Resolved`). Both call `convex/reconciliation.ts review` mutation, which is gated by `requireRoles(["owner"])` at line 76.

### 3.3 The dashboard's other Owner surfaces

- **Overview** (`src/components/dashboard/views/overview.tsx`) — the Owner Analytics & Control landing page. Surfaces today's sales, production cost, net profit, and audited loss as the headline KPIs. Cards and charts visualize per-machine output and per-material consumption trends.
- **Reports** (`views/reports.tsx`, with `canSeeFinancial` true) — extended financial range; uses the same `monetaryLoss` calc as Section B.
- **Audit Log** (`views/audit-log.tsx`) — every recorded activity across the workspace, filterable by category.

## 4. The operator clearance workflow (the centerpiece)

This is the workflow the Owner *owns*. Its purpose is to ensure that no operator can keep drawing material off the central store forever. Every operator batch that is exhausted or reconciled must be **cleared** by the Owner before the operator is allowed to request a new batch.

### 4.1 Lifecycle on `operatorSubStock.status`

```
ACTIVE  ──(operator exhausts / records a non-zero reconciliation)──▶  PENDING_CLEARANCE
                                                                      │
                                                       (owner approves via
                                                       approveOperatorClearance)
                                                                      ▼
                                                                   CLEARED
                                                                      │
                                              (production consumption drives
                                              currentRemaining ≤ 0; recordInventoryEvent
                                              flips status automatically)
                                                                      ▼
                                                                 EXHAUSTED
```

The transitions are enforced in three places:

| Transition | Driver | Code |
| --- | --- | --- |
| `ACTIVE → PENDING_CLEARANCE` | Operator exhausts their batch | `convex/inventory.ts exhaustOperatorStock` patches `{status: "PENDING_CLEARANCE", updatedAt: now}`. |
| `ACTIVE → PENDING_CLEARANCE` | Operator records a weekly physical count | `convex/inventory.ts performWeeklyReconciliation` patches the batch to `PENDING_CLEARANCE` if it was `ACTIVE` at reconciliation time. |
| `PENDING_CLEARANCE → CLEARED` | Owner clicks **Approve Clearance** | `convex/inventory.ts approveOperatorClearance` (permission `reconciliation.clearance`) patches `{status: "CLEARED", clearedBy, clearedAt, clearanceNote}`. |
| `* → EXHAUSTED` | Production consumption drives `currentRemaining ≤ 0` | `convex/inventoryLedger.ts recordInventoryEvent` auto-flips at remaining ≤ 0 (`inventoryLedger.ts:117`). |
| `EXHAUSTED → PENDING_CLEARANCE` | The ledger's `SCRAP_LOG` or weekly reconciliation for an exhausted batch | `convex/inventory.ts exhaustOperatorStock` plus the `clearance` button. |

### 4.2 Why PENDING_CLEARANCE exists

It is the **hard stop** at the head of the pipeline:

- It is the status that **blocks an operator from creating a new material request** (`convex/materialRequests.ts:50`, the `materialRequests.create` mutation). The handler queries `operatorSubStock` by `operatorId = identity._id`, filters to `status ∈ {ACTIVE, PENDING_CLEARANCE}`, and refuses with: *“Request Blocked: You have active or un-cleared floor material. Please reconcile your remaining stock and obtain Owner Clearance before requesting new stock.”*
- It is the status that **surfaces in the Owner's dashboard with the highest visual weight**. The PENDING_CLEARANCE cards are rendered with `amber` / `rose` borders and a dedicated `Approvals required` badge at the panel header.
- It is the only status for which the Owner is the single authority for clearing. No other permission can lift it.

### 4.3 Approval semantics

The Owner — or admin, who also holds `reconciliation.clearance` — clicks **Approve Clearance** on a PENDING_CLEARANCE card. The frontend calls `api.inventory.approveOperatorClearance({ subStockId, note? })` (`convex/inventory.ts`). The handler:

1. Requires `reconciliation.clearance` permission (Owner / admin only).
2. Verifies the current status is `PENDING_CLEARANCE` — refuses if any other status.
3. Patches `operatorSubStock` to `{status: "CLEARED", clearedBy: identity._id, clearedAt: now, clearanceNote: args.note?.trim() || undefined, updatedAt: now}`.
4. Pushes a `clearance_granted` notification (`notificationType` literal in `convex/schema.ts:257`) to the **operator** via `notifyUser(ctx, batch.operatorId, …)`, formatted with the material name and an English/Amharic "Owner clearance granted — you can request new stock" message.

Once the operator's notification fires, the operator's next attempt at `materialRequests.create` succeeds because there are no remaining `ACTIVE` / `PENDING_CLEARANCE` batches.

### 4.4 Why two distinct staff roles share this gate

Admin holds the same `reconciliation.clearance` permission as the Owner (`convex/authorization.ts:148`). The intent is not to dilute Owner authority but to keep operations functional if the Owner is unavailable during a weekend shift. The audit trail on the floor batch (`clearedBy`) records who actually pressed **Approve Clearance**, so admin-cleared batches are visible in the Owner overview.

## 5. Monetary leakage — ETB bookkeeping

Loss prevention is meaningless without an ETB number on every shortage. The platform computes ETB value at three points and aggregates them into the Owner's dashboard.

### 5.1 Where `monetaryLoss` is computed

- **Central physical-count reconciliations** (`convex/reconciliation.ts:36`) — at `countMaterial`, when a storekeeper records a physical count, the variance is multiplied by the per-unit ETB value: `monetaryLoss = variance < 0 ? (-variance × etbValue) : 0`. The `etbValue` snapshot is read from the `systemConfigs.materialOverrides` first, falling back to the per-unit ETB rate resolved through `resolveEtbValueFromConfig` (`convex/materialUsage.ts`). The override is captured on the reconciliation row so historical monetary loss stays immutable when the Owner later changes a rate.
- **Floor weekly reconciliations** (passed through `convex/reports.ts:271` and `convex/dashboard.ts:275`) — only negative variances contribute. The expression is the same: `|variance| × etbValue`.
- **Theft / shortage alerts** (`convex/reports.ts`) are constructed by re-running the same `monetaryLoss` formula against the latest reconciliation per material.

The Owner's summary call returns `auditedStockLoss` as `Number(auditedStockLoss.toFixed(2))` and `auditedShortageCount` (count of materials whose latest reconciliation has a negative variance). Both fields are stripped from the response for any non-Owner caller.

### 5.2 Operator-configured ETB rates

ETB valuation comes from the `systemConfigs` table (`convex/schema.ts:628`). The Owner-managed knobs are:

| Rate | Used for |
| --- | --- |
| `etbPerSquareMetre` | Area materials (banner, vinyl, acrylic, foam, …) |
| `etbPerLitre` | Ink materials |
| `etbPerPiece` | Unit hardware (LEDs, electrical parts) |
| `etbPerMetre` | Linear roll materials |
| `etbPerSheet` | Rigid sheet materials |
| `materialOverrides` | Per-material overrides keyed by canonical material name; applied ahead of the unit default. |
| `unitConversionDefaults` | Owner-governed purchase→base conversion ratio defaults applied to new stock handovers (history preserved per `stock_movements.conversionRatio`). |

The configuration page is implemented at `src/components/dashboard/views/operational-config.tsx` and the underlying mutation is `convex/systemConfigs.ts updateSystemConfig`. Only Owner (and admin) can write here (`company_settings.update` permission — explicit exclusion for manager ensures the Owner is the canonical source of truth on rates).

### 5.3 What the Owner sees

- **Audit Log dashboard** — short losses per page and a running ledger of `RECONCILIATION_ADJUSTMENT` events.
- **Reconciliation Overview dashboard** — ranked table of materials with the highest ETB `monetaryLoss` plus the short-form counts.
- **Overview dashboard** — single KPI tile per day (`auditedStockLoss`) and the central-store shortage total. Both are condition-gated on the Owner role.
- **Owner Inventory Oversight (Section B)** — leakage & variance alerts rendered with full ETB numbers because the Owner holds `canViewFinancial`.

> Non-Owner roles see the same rows but with `monetaryLoss` values replaced by `0` and the financial totals hidden. This guarantees the dashboard never leaks ETB figures to the wrong role.

## 6. The Owner's canonical session

The Owner's role gates exactly one workspace (`ROLE_WORKSPACE.owner.view = "overview"`). On the first sign-in the Owner lands on the Overview dashboard; clicking **Inventory** in the left-rail sidebar navigates to the dedicated oversight page (this codebase mounts `OwnerInventoryOversight` at `visibleView === "inventory"` for any role with `canManageClearance`).

## 7. What the Owner does *not* see (deliberate scope boundary)

To preserve the segregation of duties:

- The Owner role does **not** display a request form. The `MaterialRequestsPanel` (`src/components/dashboard/material-requests-panel.tsx`) hides its `New request` header button when `canRequest` is false (Owner).
- The Owner role does **not** display an **Issue** button on the same panel. The store is the issuer.
- The Owner role does **not** display a **Verify payment** receptionist action with auto-confirmation. Owner can review central-reconciliation `Open` entries but **not** `JOB_CARD_CREATED` order transitions.
- The Owner role never auto-receives a "your order is confirmed" Telegram push. The customer push pipeline (`docs/workflows.md`) is gated to the Owner/Manager/Admin/Receptionist transitions.

The deliberate absence of these forms is the structural enforcement of the Owner as a **decision-maker**, never an order-creator.

## 8. Operational hand-offs the Owner owns

Beyond clearance, the Owner is the canonical owner of:

- **Operational configuration** — ETB rates, conversion defaults, risk controls, ink / waste / offcut thresholds.
- **Company settings** — workspace name, address, logo, time-zone.
- **Reconciliation review** — Owner-only review of `reconciliations.status` (`Open → Reviewed / Resolved`).

Every one of those surfaces is exposed through the dashboard's settings + operational config pages (`src/components/dashboard/views/settings/settings-view.tsx`) plus the dedicated `views/financial-operations.tsx` and `views/reconciliation.tsx`. The Owner is the only role that can act on all three together; admin can act on parts of them but never has the same combined authority.

## 9. Failure modes the dashboard protects against

- **A material batch "disappears"** — the operator sub-stock row auto-flips to `EXHAUSTED` when `currentRemaining` hits 0 via `recordInventoryEvent`; the operator is blocked from new requests until they reconcile (auto-promoted to `PENDING_CLEARANCE`) and the Owner clears it.
- **A storekeeper under-records** — every reconciliation's variance is captured as a `RECONCILIATION_ADJUSTMENT` event and the ETB monetary loss is preserved on the row even when rates change.
- **An operator leaves with un-cleared floor stock** — the `materialRequests.create` mutation checks on every request; old `PENDING_CLEARANCE` batches never expire silently.
- **The Owner skips a review** — `reconciliations.review` is the only path to `Reviewed / Resolved`. There's no time-based auto-resolution.

## 10. Summary — the Owner's job, in one sentence

> The Owner watches the floor audit queue, signs off on each operator's cleared consumption in ETB, configures the ETB rate card that powers every shortage figure, and owns the operational knobs that determine what "loss" even means for the rest of the workspace.

That sentence is the contract this codebase is built around.
