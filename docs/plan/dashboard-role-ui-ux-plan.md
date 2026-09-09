# Role & Attribute-Based Dashboard — UI/UX & Implementation Plan

Status: **Proposed** (approved-by-default; no owner changes)
Owners of record: manager, storekeeper, receptionist, admin, operator (laser, cnc, plotter, printer)
Out of scope: **owner** (unchanged)
Primary author: opencode (recommended decisions applied, no clarifying questions asked)

---

## 1. Objective

Unify every non-owner dashboard onto a single, role-aware design system driven by the
existing **capability model** (`src/lib/access-policy.ts`) and **attribute scoping**
(machine / warehouse / material), so that:

- Each role sees exactly the pages and actions its `Capability[]` permits — **no
  hardcoded per-role route soup** in components.
- Layout, data tables, status pills, modals, and empty states are **reused primitives**,
  not per-role reimplementations.
- New roles or capability grants are pure **data** (registry + policy rows), not new UI.
- The desktop shell (Tauri) keeps working unchanged.

---

## 2. Design principles (recommended)

1. **Capability-first rendering.** A module renders if `canAccess(ctx, capability)` is true.
   Nothing is hidden by checking `role === "manager"` inside a component. `WorkspaceModuleGate`
   enforces this at the boundary; per-role nav is derived from `WORKSPACE_REGISTRY` +
   `nav-config.ts`.
2. **Attribute scoping, not role copy-paste.** Operators differ only by `machineType`
   (`laser` | `cnc` | `plotter` | `printer`) and bound `machineId`. One Operator workspace
   parameterized by attribute, four nav labels via `getNavLabel` override.
3. **Semantic tokens only.** All color/spacing come from `bg-surface{,elevated}`,
   `border-border-token`, `text-text-primary/secondary`, `text-green|warning|cyan|danger`.
   No hex literals.
4. **Shared primitives first.** Any new page is composed from: `WorkspaceShell`,
   `WorkspacePageHeader`, `WorkspaceRenderer`, card/table/status-pill/modal/empty-state
   primitives. If a primitive doesn't exist yet, add it once under `components/dashboard/ui/`.
5. **Read the row, present the truth.** Overview/metric cards render live Convex queries.
   No client-side approximations of business numbers that Convex already computes.
6. **Operators are bounded.** Operators see only their machine's substock, job cards,
   and reconciliation lines. Parent inventory, finance, reports, and requisition approvals
   are not surfaced — the policy already blocks these.

---

## 3. Role × view matrix (target state)

`✓` = visible. Derived from `WORKSPACE_REGISTRY[role].navViews` + capability gating.

| View | Manager | Admin | Storekeeper | Receptionist | Operator |
|------|:--:|:--:|:--:|:--:|:--:|
| Overview | ✓ | ✓ | ✓ | ✓ | ✓ |
| Orders Queue | ✓ | ✓ | — | ✓ | — |
| Job Cards | ✓ | ✓ | — | — | ✓ |
| Machines | ✓ | ✓ | — | — | — |
| Inventory | ✓ | ✓ | ✓ | — | substock only |
| Offcuts | ✓ | ✓ | — | — | — |
| Reports | ✓ | ✓ | — | — | — |
| Reconciliation | ✓ | ✓ | ✓ | — | operator lines |
| Requisitions | ✓ | ✓ | ✓ | — | — |
| Financial Ops | — | ✓ | — | — | — |
| Config | — | ✓ | — | — | — |
| Settings | ✓ | ✓ | ✓ | ✓ | ✓ |

> Notes: manager deliberately **lacks** finance/reports/reconciliation.review
> (`ROLE_CAPABILITY_OVERRIDES`); admin has finance + full ops. Storekeeper has no
> `orders.view`, but owns requisition approval + reconciliation.record. Operator only
> sees substock/jobs/reconciliation scoped to machine.

---

## 4. Shared design system (new primitives to build once)

Creates consistency and removes the remaining per-role raw HTML.

1. **`StatCard`** — title, value, delta pill (up/down), icon, `loading`/`empty` state.
   Used on every Overview.
2. **`DataTable`** — column defs + row renderer + footer totals, built on the current
   per-view tables (standardize sorting + empty state).
3. **`StatusPill`** — semantic status → `text-*` token map (e.g., pending=warning,
   in_progress=cyan, completed=green, rejected/scrap=danger, offcut=secondary).
4. **`EmptyState`** — icon + title + hint + optional CTA (standardize the hand-rolled empties).
5. **`ConfirmDialog`/modal wrapper** — lifts the repeated confirm/cancel pattern out of
   `OrderConfirmModal`, `OffcutModal`, `ScrapModal`, `RequisitionModal` into one
   accessible `<Dialog>`.
6. **`MetricSparkline`** (optional) — tiny trend bar on Overview cards using live query data.

**Also standardize:**
- Role workspace overview → a single `<RoleOverview>` wrapper that renders its own
  `StatCard`s, one per capability the role holds.
- Operator workspace tables → replace raw HTML `<table>` with `DataTable` where feasible.

---

## 5. Per-role design & implementation detail

### 5.1 Manager (workspace: `manager`)
Pages: overview, orders, jobs, machines, inventory, settings.

- **Overview** — StatCards: pending orders, active job cards, machine status
  (idle/busy), stock alerts. Live from `convex/manager/*` queries. No finance/report
  widgets per policy.
- **Orders Queue** — read-only triage: confirm orders → `confirmOrderAndIssueJobCard`
  (auto off-cut/scrap breakdown already implemented). Ship with `DataTable`.
- **Job Cards / Machines / Inventory / Settings** — standardize on `DataTable` +
  `StatusPill`; add `EmptyState`.

### 5.2 Admin (workspace: `admin`)
Pages: overview, orders, inventory, jobs, machines, reports, reconciliation, config, settings.

- Full operational surface **plus** finance.view, reports, config. Highest privilege
  after owner.
- **Configuration** page consolidates machine/material/unit setup behind capability
  `machines.manage` + `material.edit`.
- Standardize the currently **custom admin Settings** onto `StatCard`/`EmptyState`/shared
  forms.

### 5.3 Storekeeper (workspace: `storekeeper`)
Pages: overview, inventory, reconciliation, requisitions, settings.

- **Overview** — stock level totals, pending requisitions to approve, reconciliation
  unrecorded count.
- **Inventory** — parent stock only (`inventory.parent.view`); stock-in/dispatch via
  `inventory.stock-in`/`dispatch`.
- **Requisition approval** — leverages `inventory.requisition.approve`. Use shared
  confirm dialog.
- **Reconciliation** — `reconciliation.record`.

### 5.4 Receptionist (workspace: `receptionist`)
Pages: overview, orders, settings. No inventory/finance.

- **Orders Queue** is the primary surface — currently **hardcodes empty machines and
  materials** in the modal. Fix: `OrderConfirmModal` should list selectable machines /
  material options (only when they exist) instead of empty arrays.
- **Overview** — today's order intake stats (count, by status, pending confirmation).
- Minimal: keep surface small; add `EmptyState`.

### 5.5 Operator (workspaces: `laser/cnc/plotter/printer`, all one implementation)
Pages: overview, jobs, settings; inventory (substock only); reconciliation (own lines).

- Single parameterized implementation keyed on `machineType` + bound `machineId` via
  `OPERATOR_MACHINE_MAP` / `ROLE_TO_MACHINE_MAP`.
- **Overview label** from `getNavLabel("overview", role)` override (Amharic machine
  names already present).
- **Jobs** — list only job cards assigned to this machine (`jobs.execute`); start/complete
  the job. Replace raw HTML table with `DataTable` + `StatusPill`.
- **Substock** — `inventory.substock.view`, scoped to machine.
- **Reconciliation** — `reconciliation.operator`; only this operator's lines.
- Offcut/Scrap logging stays as-is (`OffcutModal`/`ScrapModal`) — separate production
  flow, anchored to `material-calc` outputs.

---

## 6. Attribute-based access model (recommended shape)

Current `AccessContext.attributes` already supports `machineId`, `machineType`,
`warehouseId`, `department`. Recommend:

1. Make **attribute scoping a first-class policy input**: add an optional
   `attributes` guard to `canAccess` so e.g. `inventory.substock.view` only resolves for
   the operator's bound machine. Keep signature backward-compatible.
2. Populate `AccessContext.attributes` at the shell/layout boundary from the profile and
   route params (machineId from `[machine]`).
3. Keep the **role → navViews** source of truth in `WORKSPACE_REGISTRY`; do not add
   per-page role switch statements.

---

## 7. Implementation roadmap (ordered, per phase)

**Phase 1 — Primitive foundation (no visual regressions)**
- Add `StatCard`, `DataTable`, `StatusPill`, `EmptyState`, shared `ConfirmDialog` under
  `components/dashboard/ui/`.
- Add capability-guarded `RoleOverview` wrapper.
- Verify `pnpm check` clean + existing 111 tests pass.

**Phase 2 — Workspace standardization**
- Migrate manager, admin, storekeeper tables/empties/status to the primitives.
- Converge admin settings + storekeeper settings headers onto shared patterns.
- Standardize operator job table → `DataTable` + `StatusPill`.
- Fix receptionist `OrderConfirmModal` empty machines/materials (ordered first — it is
  the only functional gap).

**Phase 3 — Attribute-scoped operators**
- Thread `machineId`/`machineType` through `AccessContext` at layout boundary.
- Add attribute guard to `canAccess` for operator-scoped capabilities.
- Confirm operator overview label routing per machine.

**Phase 4 — Validations**
- `pnpm test`, `pnpm check`, `NODE_ENV=production pnpm build`.
- Manual smoke of each role's nav (run `npx convex dev` to sync schema for dispatched
  off-cut fields).
- Desktop shell unaffected (`isTauri()` guards auto-updater).

---

## 8. Deliverable

This plan only. No code changes to the active tree were made for this task; the existing
auto off-cut/scrap implementation and docs refresh stand on `main` (HEAD `d41dd3b`).
Implement Phases in the order above on approval.
