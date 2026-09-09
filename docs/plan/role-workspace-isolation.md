# Role Workspace Isolation Plan

Goal: complete the owner-style tri-layer isolation (Convex namespace -> dedicated routes -> shell) for every role while moving all canonical reads and writes behind role-owned, capability-oriented APIs. The target is not duplicated table CRUD: it is a small command surface that preserves business invariants, ownership checks, and auditable transactions.

## Current implementation status

The route and namespace scaffolding is substantially present. The remaining work is boundary completion, not a greenfield rewrite.

| Area | Current state | Completion rule |
|---|---|---|
| Shells and routes | Dedicated layouts exist for owner, admin, manager, storekeeper, receptionist, and operator machine routes. | Every canonical page stays inside its role shell and uses the role's namespace only. |
| Convex namespaces | Most namespaces provide purpose-built reads; manager, storekeeper, and receptionist have selected mutations; operator has selected production mutations. | Every canonical workflow mutation gets a strict namespace entry point. |
| Generic handlers | Still called directly by canonical pages for machines, jobs, orders, inventory, reconciliation, and production. | Generic public handlers become legacy adapters or internal transaction modules, never the canonical client API. |
| Authorization | Strict role helpers and role constants exist; generic handlers still use broader capability permissions. | Namespace wrappers enforce exact role, active profile, resource ownership, and workflow state before delegation. |
| Tests | Pure helper tests are strong; public Convex boundary tests are sparse. | Each namespace has wrong-role, inactive-user, invalid-state, and ownership tests before migration is marked complete. |

### Non-goals

- Do not create one copy of every database table per role.
- Do not expose generic database-shaped CRUD merely to make an API look complete.
- Do not remove generic handlers until cron jobs, public tracking, Telegram flows, tests, and legacy redirects have been migrated or explicitly classified as internal compatibility callers.

## Reference template: the owner isolation

The owner workspace is the pattern to replicate.

| Layer | Location | What it provides |
|---|---|---|
| Convex namespace | `convex/owner/*.ts` | Role-gated (`requireOwner`) purpose-built queries returning simplified everyday shapes |
| Routes | `src/app/(dashboard)/dashboard/owner/*` | One page per nav item (overview, revenue, orders, machines, inventory, reconciliation-clearance, reports, audit-logs, operational-configuration, team, settings) |
| Layout + shell | `owner/layout.tsx` → `OwnerShell` | Renders its own full shell; gates `profile.role === "owner"` + `profile.active` |
| Perm-page header | `OwnerPageHeader` | Kicker / title / subtitle / optional action |

Pages are composed as: `layout.tsx` renders `OwnerShell({ children })`; each `page.tsx` renders `OwnerPageHeader` + content. Authorization is enforced again inside every Convex query via the role guard.

## Current shared/generic world (to be replaced)

- `src/app/(dashboard)/dashboard/[workspace]/page.tsx` dispatches to `ManagerWorkspace`, `StorekeeperWorkspace`, `ReceptionWorkspace`, `OwnerWorkspace` via hardcoded `if` chains and redirects operator → `/dashboard/operator/[machine]`.
- `manager-workspace.tsx`, `storekeeper-workspace.tsx`, `reception-workspace.tsx` call the **generic** Convex surface directly (`api.inventory.*`, `api.materialRequests.*`, `api.machines.*`, `api.materials.*`, `api.orders.*`, `api.dashboard.*`, `api.reconciliation.*`) with client-side `WithId` casting and capability guards.
- `workspace-registry.ts` and `role-routing.ts` now identify separate admin and owner homes, but route descriptors still point several non-owner workflows at flat or legacy pages.
- Auth guards and strict role constants exist in `convex/users.ts`. The legacy permission matrix remains broader than the isolated workspace policy, so it must not be treated as sufficient authorization for canonical namespace commands.
- Current canonical generic calls include manager machine/job/order operations, receptionist order confirmation, storekeeper reconciliation, and operator production/reconciliation. These are the first migration targets.

## Target pattern (1 role workspace = 3 layers)

### Layer A — Convex namespace `convex/<workspace>/*.ts`

- Gated by a strict role guard. The existing helpers in `convex/users.ts` beside `requireOwner` must remain strict and explicit:
  - `requireExactRole(ctx, role)` — strict, no management expansion (needed because `requireRoles` auto-expands `"admin"`).
  - `requireStorekeeper`, `requireReceptionist`, `requireOperator` (operator = any of `OPERATOR_ROLES`).
  - For manager-only: strict `requireManager` (`["manager"]`, distinct from legacy `requireRoleManager`).
  - For admin-only: strict check `profile.role === "admin"` (distinct from backwards-compat `requireAdmin`).
  - Export the role constants (`MANAGEMENT_ROLES`, `OPERATOR_ROLES`, plus per-role lists).
- Every exported handler starts with `requireActiveProfile` plus an exact role/workspace guard. Operator handlers additionally resolve the machine from the route argument and verify the caller's machine role and assignment.
- Namespace APIs are capability-oriented commands, not table mirrors: `receptionist.orders.confirm`, `storekeeper.requisitions.issue`, and `operator.jobs.recordProduction` are preferred over generic `orders.update` or `inventory.patch`.
- Queries return purpose-built, stable view models. Mutations return the resulting resource or a small command result, never raw internal rows when the client does not need them.
- Shared transaction bodies live in domain modules such as `orders`, `jobs`, `materialRequests`, and `inventoryLedger`. They must be named `*Internal`, accept typed contexts, and document that authorization has already happened. Only namespace handlers and approved internal jobs may call them.
- Every mutation validates input, checks current state and ownership inside the transaction, writes all related projections atomically, and records `stock_movements` for stock-affecting production, receipt, issue, scrap, offcut, and reconciliation commands.
- Namespace files must not import UI types, cast client `WithId` values, or trust client-supplied role/operator identity.

### Layer B — Routes `src/app/(dashboard)/dashboard/<workspace>/*`

One page per nav item. Each route folder gets a `layout.tsx` rendering the role shell, page components for the rest.

### Layer C — Components `src/components/dashboard/<workspace>/`

Shared, parametrized building blocks created in Phase 0:
- `workspace-shell.tsx` — extracted from `owner-shell.tsx`; accepts `roles`, `navItems`, brand label, Amharic workspace title, console label, icon; gates role + active and falls back to `DashboardAccessDenied`.
- Generic `workspace-page-header.tsx` equivalent of `OwnerPageHeader` (or reuse `OwnerPageHeader` directly — it is already generic).
- Per-role `nav.ts` configs (shape `OwnerNavItem`).

### API contract for every namespace

Each namespace should expose four explicit categories where the role needs them:

1. `list` / `get` queries with role-scoped view models.
2. `create` commands for resources the role originates.
3. `transition` commands for workflow state changes; no free-form status patching.
4. `record` / `issue` / `approve` commands for accounting, custody, or audit events.

For every command, document: allowed role(s), resource ownership rule, allowed prior states, ledger/audit side effects, idempotency behavior, and notification side effects. A command is complete only when its negative cases are tested.

## Shared boundaries (NOT duplicated per role)

- `views/settings/*` — slotted into each role's Settings page (owner precedent).
- `users.getCurrentProfile` / `users.getCompanySettings` — identity + company name.
- `audit` + `notifications` handlers — cross-cutting by nature, stay on the generic surface.
- Generic domain handlers (`jobs.ts`, `orders.ts`, `materials.ts`, `inventory.ts`, …) remain temporarily available for seed, crons, public tracking, and compatibility. Canonical dashboard clients must stop importing their mutations before any generic handler is deleted or narrowed.
- `notifications` and `audit` remain cross-cutting, but notification creation is an internal side effect of commands, not a client-controlled write.
- The inventory ledger remains the only stock-accounting write boundary. Namespace commands may orchestrate it; they may not patch balance projections directly.

## Per-role surfaces

| Workspace | Canonical namespace commands to finish | Key ownership/invariant |
|---|---|---|---|
| admin | `/dashboard/admin/{overview,orders,jobs,machines,inventory,reports,reconciliation,config,settings}`; reads plus explicitly approved operational configuration commands only | Exact `admin`; no finance approval or hidden escalation through generic permissions. |
| manager | `manager.orders` transitions, `manager.jobs` commands, `manager.machines` CRUD/status, `manager.requisitions.create` | Exact `manager`; no owner-only finance/reconciliation clearance. Machine commands validate assignment and active state. |
| storekeeper | `storekeeper.inventory.receive/adjust`, `storekeeper.requisitions.issue/acknowledge/markShortStock`, `storekeeper.reconciliation.count`, `storekeeper.reorder.create` | Exact `storekeeper`; central custody only; every stock change uses the ledger and packaging conversion snapshot. |
| receptionist | `receptionist.orders.createWalkIn/price/confirm/reject/setStatus`, `receptionist.receipt.get` | Exact `receptionist`; only valid order transitions; payment and job-card creation remain one transaction. Desktop printing stays client-side after receipt data is returned. |
| operator | `operator.jobs.complete/recordProduction`, `operator.offcuts.create`, `operator.scrap.record`, `operator.reconciliation.submit`, `operator.inventory.exhaust`, `operator.requisitions.create` | Any operator role, but machine-scoped. Verify machine role, assignment/custody, job access, remaining stock, and ledger event type in the same mutation. |

Admin is intentionally read-mostly. "CRUD complete" means every supported admin workflow has a namespace API and every unsupported write is rejected, not that admin receives unrestricted database CRUD.

### Mutation ownership matrix

| Business operation | Canonical owner | Shared transaction module | Audit / ledger requirement |
|---|---|---|---|
| Walk-in order and customer intake | Receptionist | `orders.ts` | Order history and notification; no direct status patch. |
| Price, payment decision, and job-card issuance | Receptionist or explicitly allowed management role | `orders.ts` | Atomic order, payment, job-card, and notification changes. |
| Machine setup/status/assignment | Manager | `machines.ts` | Validate operator role and active machine; audit assignment changes. |
| Material request creation | Manager/operator | `materialRequests.ts` | Request state transition and notification. |
| Central receipt, issue, short stock, reconciliation | Storekeeper | `inventoryLedger.ts`, `materialRequests.ts`, `reconciliation.ts` | Immutable `stock_movements`; conversion snapshots and discrepancy history. |
| Production completion, scrap, offcut, floor reconciliation | Operator | `jobs.ts`, `offcuts.ts`, `inventoryLedger.ts` | Machine/job ownership plus immutable ledger event. |
| Clearance/review and operational configuration | Owner, with narrowly documented admin reads | Existing owner/config modules | Owner-only approval and audit trail. |

Operator granularity decision: one `convex/operator/` namespace machine-scoped per operator role (single workspace, `/dashboard/operator/[machine]`), not four workspaces.

## Routing / deprecation updates

Files: `src/lib/role-routing.ts`, `src/components/dashboard/workspace-registry.ts`, `src/components/dashboard/nav-config.ts`.

- `ROLE_HOME_ROUTE.admin` → `/dashboard/admin`; `WORKSPACE_REGISTRY.admin.route` likewise (fixes exiled admin).
- `ROUTE_DESCRIPTORS` and `ROUTE_CONTRACTS.allowedPrefixes`: orders, inventory, settings, reconciliation, reports point at each new canonical workspace route; `getLegacyRouteRedirect` targets them.
- `[workspace]/page.tsx` shrinks to a redirect shim; flat routes (`/orders`, `/inventory/*`, `/reports`, `/settings`, `/reconciliation`) become redirect shims (owner precedent).
- Operator conflict rule preserved: static `operator/` folder wins over `[workspace]` for `/dashboard/operator/<machine>/*`; operators keep `/inventory/substock` + `/settings` flat (existing comment in `role-routing.ts:400`).

## Delivery phases and exit gates

1. **Phase 0 - Contract and inventory:** freeze the role capability matrix; list every `api.*` call in canonical routes; classify each generic handler as namespace-owned, cross-cutting, internal, public, or legacy. Add strict guard helpers and typed internal context contracts. **Gate:** no unclassified canonical mutation call remains.
2. **Phase 1 - Shared command infrastructure:** extract/normalize `requireExactRole`, `requireActiveProfile`, machine ownership, resource ownership, transition validation, idempotency keys where retries are possible, and audit/ledger helpers. Add a standard namespace test harness. **Gate:** wrong-role and inactive-profile tests pass for one representative command per role.
3. **Phase 2 - Storekeeper custody:** finish parent inventory receive/adjust, reconciliation count, reorder, and requisition commands. Migrate storekeeper pages and verify ledger projections. **Gate:** no storekeeper page imports generic mutation APIs; stock movement and insufficient-stock tests pass.
4. **Phase 3 - Receptionist intake:** finish order pricing, confirmation/job-card issuance, rejection, status transitions, lookup, and receipt commands. Preserve `printNative()` as a post-command client action. **Gate:** invalid transitions cannot create jobs or send customer notifications.
5. **Phase 4 - Manager operations:** add manager-owned machine CRUD/status/assignment, job commands, order transitions, and requisition creation. **Gate:** manager cannot invoke owner-only finance/clearance commands and machine assignments are validated server-side.
6. **Phase 5 - Operator production:** finish machine-scoped production, completion, stock exhaustion, offcut/scrap, reconciliation, and requisition commands. Decide and document whether custody is individual-user or role/machine based, then remove the legacy fallback. **Gate:** wrong machine, wrong job, wrong stock batch, and insufficient stock are rejected.
7. **Phase 6 - Admin boundary:** keep admin read-mostly; add only explicitly approved configuration or operational commands. Remove accidental admin writes from canonical paths and reconcile the generic permission matrix with the workspace policy. **Gate:** admin negative tests prove finance approval and unsupported writes are refused.
8. **Phase 7 - Route and client collapse:** migrate all canonical pages to namespaces, turn `[workspace]` and flat pages into redirect shims, remove client `WithId` casts, and delete orphaned role views only after import/config/script checks. **Gate:** static search finds no canonical role page importing a generic mutation.
9. **Phase 8 - Backend retirement:** regenerate Convex API; narrow or remove generic public mutations only after cron, Telegram, public tracking, seed, tests, and compatibility callers are migrated. **Gate:** full validation and a documented rollback path are green.

## Conventions / invariants

- Persistent business ops in Convex handlers; mutations validate input, require an active application profile, enforce the relevant role, and write transactional accounting changes; production input/scrap/offcut changes remain auditable through `stock_movements`.
- Authorization is defense in depth: route guards improve UX, namespace guards enforce workspace policy, and resource/state checks protect the transaction. Client capability checks are never security boundaries.
- State transitions are explicit commands. Do not accept arbitrary `status` or `role` values from clients when the server can derive the next state from the current record and command.
- Idempotent commands must use a stable request/event key or current-state check so websocket retries, double clicks, and desktop reconnects cannot duplicate orders, stock events, payments, or notifications.
- Observability is part of each command: log the command name, actor, resource id, result, and rejection reason without logging secrets or unnecessary customer PII.
- Do not edit `convex/_generated/` by hand; regenerate via convex CLI after schema/public-function changes.
- Before deleting a file, verify it is not imported by active routes, handlers, tests, configuration, or package scripts; leave `.claude/skills/` untouched.
- Keep legacy `[workspace]`/flat routes working (as redirects) until Phase 7; never break sign-in redirects or role home hops.

## Verification per phase

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm check
NODE_ENV=production pnpm build
```

Plus: `npx convex codegen` after any `convex/*` change, and new authz negative tests (wrong role → refusal, machine scope enforced) mirroring existing `convex/*.test.ts` files.

### Required test matrix

Every namespace command gets at least:

- happy path with the intended active role;
- wrong exact role and inactive profile rejection;
- missing/nonexistent resource rejection;
- invalid workflow transition rejection;
- ownership or machine-scope rejection where applicable;
- duplicate/retry behavior;
- projection, ledger, audit, and notification assertions for side effects.

Cross-role contract tests should also prove that a manager, storekeeper, receptionist, operator, and admin cannot call another role's namespace command merely because the legacy permission matrix grants a similar capability. Keep pure domain tests, but add public Convex boundary tests so authorization is exercised through the actual exported handler.