# Role Workspace Isolation Plan

Goal: apply the proven owner tri-layer isolation (Convex namespace → dedicated routes → shell) to every remaining role — admin, manager, storekeeper, receptionist, and operator — including role-scoped **mutations**, not just reads.

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
- `workspace-registry.ts` maps roles → workspaces. `admin` shares `route: "/dashboard/owner"` — but owner pages gate to `role === "owner"`, so admin is currently exiled from the isolated console.
- Auth guards live in `convex/users.ts`: `requireRoles`, `requireRoleManager` (owner/manager/admin), `requireOwner`, and a backwards-compatible `requireAdmin` (management roles, NOT admin-only). `MANAGEMENT_ROLES` and `OPERATOR_ROLES` constants already exist (module-private).

## Target pattern (1 role workspace = 3 layers)

### Layer A — Convex namespace `convex/<workspace>/*.ts`

- Gated by a strict role guard. New helpers added in `convex/users.ts` beside `requireOwner`:
  - `requireExactRole(ctx, role)` — strict, no management expansion (needed because `requireRoles` auto-expands `"admin"`).
  - `requireStorekeeper`, `requireReceptionist`, `requireOperator` (operator = any of `OPERATOR_ROLES`).
  - For manager-only: strict `requireManager` (`["manager"]`, distinct from legacy `requireRoleManager`).
  - For admin-only: strict check `profile.role === "admin"` (distinct from backwards-compat `requireAdmin`).
  - Export the role constants (`MANAGEMENT_ROLES`, `OPERATOR_ROLES`, plus per-role lists).
- Purpose-built shapes (DB rows + normalized fields); no client `WithId` gymnastics.
- Owns the role's key **mutations** (strict role check + validation + transactional writes + `stockMovements` audit for production input/scrap/offcut changes).

### Layer B — Routes `src/app/(dashboard)/dashboard/<workspace>/*`

One page per nav item. Each route folder gets a `layout.tsx` rendering the role shell, page components for the rest.

### Layer C — Components `src/components/dashboard/<workspace>/`

Shared, parametrized building blocks created in Phase 0:
- `workspace-shell.tsx` — extracted from `owner-shell.tsx`; accepts `roles`, `navItems`, brand label, Amharic workspace title, console label, icon; gates role + active and falls back to `DashboardAccessDenied`.
- Generic `workspace-page-header.tsx` equivalent of `OwnerPageHeader` (or reuse `OwnerPageHeader` directly — it is already generic).
- Per-role `nav.ts` configs (shape `OwnerNavItem`).

## Shared boundaries (NOT duplicated per role)

- `views/settings/*` — slotted into each role's Settings page (owner precedent).
- `users.getCurrentProfile` / `users.getCompanySettings` — identity + company name.
- `audit` + `notifications` handlers — cross-cutting by nature, stay on the generic surface.
- Generic domain handlers (`jobs.ts`, `orders.ts`, `materials.ts`, `inventory.ts`, …) remain public for seed/crons/tests/legacy views until the legacy collapse phase; role namespaces wrap/read them.

## Per-role surfaces

| Workspace | Routes | Convex files (new under `convex/`) | Key mutations isolated |
|---|---|---|---|
| admin | `/dashboard/admin/{overview,orders,jobs,machines,inventory,reports,reconciliation,config,settings}` | `admin/` overview, orders, machines, inventory, reports, reconciliation, config | read-mostly; admin has no finance write capability per access-policy |
| manager | `/dashboard/manager/{overview,orders,jobs,machines,inventory,settings}` | `manager/` overview, orders, jobs, machines, inventory, requisitions | create material request |
| storekeeper | `/dashboard/storekeeper/{overview,inventory,requisitions,reconciliation,settings}` | `storekeeper/` overview, parentInventory, requisitions, reconciliation, reorder | requisition issue / acknowledge / markShortStock |
| receptionist | `/dashboard/receptionist/{overview,orders,settings}` | `receptionist/` overview, orders, lookup, receipt | order create / setStatus / quote commit (keep `printNative()` desktop flow) |
| operator | `/dashboard/operator/[machine]/{overview,jobs,job/[id],inventory,reconciliation,settings}` | `operator/` common (machine scoping), overview, jobs, substock, reconciliation, machine | job complete / offcut / scrap entry — through `stockMovements` |

Operator granularity decision: one `convex/operator/` namespace machine-scoped per operator role (single workspace, `/dashboard/operator/[machine]`), not four workspaces.

## Routing / deprecation updates

Files: `src/lib/role-routing.ts`, `src/components/dashboard/workspace-registry.ts`, `src/components/dashboard/nav-config.ts`.

- `ROLE_HOME_ROUTE.admin` → `/dashboard/admin`; `WORKSPACE_REGISTRY.admin.route` likewise (fixes exiled admin).
- `ROUTE_DESCRIPTORS` and `ROUTE_CONTRACTS.allowedPrefixes`: orders, inventory, settings, reconciliation, reports point at each new canonical workspace route; `getLegacyRouteRedirect` targets them.
- `[workspace]/page.tsx` shrinks to a redirect shim; flat routes (`/orders`, `/inventory/*`, `/reports`, `/settings`, `/reconciliation`) become redirect shims (owner precedent).
- Operator conflict rule preserved: static `operator/` folder wins over `[workspace]` for `/dashboard/operator/<machine>/*`; operators keep `/inventory/substock` + `/settings` flat (existing comment in `role-routing.ts:400`).

## Phases (each independently green, no behavior regressions)

1. **Phase 0 — Plumbing**: strict role guards + role constants in `convex/users.ts`; parametrized `workspace-shell.tsx` (+ page-header reuse). No behavior change.
2. **Phase 1 — Admin**: smallest surface; un-exiles admin; `dashboard/admin` routes + `convex/admin/` namespace; update role-routing/registry contracts.
3. **Phase 2 — Storekeeper**: sets the isolated-mutation pattern (requisition issue/ack/markShortStock with `stockMovements` audit).
4. **Phase 3 — Manager**: operations-hub read surface + `convex/manager/`.
5. **Phase 4 — Receptionist**: order writes + desktop receipt print.
6. **Phase 5 — Operator `[machine]`**: machine-scoped reads + job-completion mutations.
7. **Phase 6 — Legacy collapse**: `[workspace]` page + flat routes → redirect shims; update contracts; delete orphaned view files (grep imports first); regenerate `convex/_generated/`.

## Conventions / invariants

- Persistent business ops in Convex handlers; mutations validate input, require an active application profile, enforce the relevant role, and write transactional accounting changes; production input/scrap/offcut changes remain auditable through `stockMovements`.
- Do not edit `convex/_generated/` by hand; regenerate via convex CLI after schema/public-function changes.
- Before deleting a file, verify it is not imported by active routes, handlers, tests, configuration, or package scripts; leave `.claude/skills/` untouched.
- Keep legacy `[workspace]`/flat routes working (as redirects) until Phase 6; never break sign-in redirects or role home hops.

## Verification per phase

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm check
NODE_ENV=production pnpm build
```

Plus: `npx convex codegen` after any `convex/*` change, and new authz negative tests (wrong role → refusal, machine scope enforced) mirroring existing `convex/*.test.ts` files.