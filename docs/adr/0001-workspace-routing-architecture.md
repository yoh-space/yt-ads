# ADR 0001: Workspace-Oriented Routing Architecture and Canonical Route Decision

## Status
Accepted

## Context
The YT Advertisement Operations Platform previously used a mix of:
1. Flat legacy routes: `/orders`, `/inventory`, `/reconciliation`, `/reports`, `/settings`
2. Role-labeled dashboard sub-routes: `/dashboard/owner`, `/dashboard/manager`, `/dashboard/storekeeper`, `/dashboard/reception`
3. Operator-specific machine sub-routes: `/dashboard/operator/[machine]` and `/dashboard/operator/[machine]/reconciliation`

As the ERP capabilities grow, organizing routes around workspaces rather than raw database roles or flat global views provides clearer boundary isolation, modular feature loading, and scoped layout ownership.

## Decision

1. **Canonical Model: WorkspaceId**
   - The authoritative frontend concept is `WorkspaceId` (`owner`, `manager`, `admin`, `storekeeper`, `receptionist`, `operator`), defined in `src/components/dashboard/workspace-registry.ts`.
   - Workspaces represent functional operational domains, not merely permission strings.

2. **Route Hierarchy**:
   - Operator routes remain permanently stable at `/dashboard/operator/[machine]` and `/dashboard/operator/[machine]/reconciliation` (for `laser`, `cnc`, `plotter`, and `printer`).
   - Feature routes within workspaces are canonicalized under `/dashboard/[workspace]/...` (e.g., `/dashboard/owner/orders`, `/dashboard/storekeeper/inventory`, `/dashboard/manager/jobs`).
   - Global flat routes (`/orders`, `/inventory`, `/reconciliation`, `/reports`, `/settings`) and the legacy reception route (`/dashboard/reception`) will be preserved as backwards-compatible redirects. Owner, manager, and storekeeper roots are served directly by the dynamic workspace route because their URL is already canonical.

3. **Authorization Authority**:
   - Route path names and proxy cookies are UX and temporal navigation aids only.
   - Convex queries and mutations remain the sole authority on authentication, role permissions, active profile status, machine/warehouse scoping, and business invariants.
   - Inventory movements must strictly use the event-sourced ledger in `convex/inventoryLedger.ts`.

4. **Migration Strategy**:
   - Incremental migration one route family at a time with zero broken states.
   - Every phase verified with `pnpm test` and `pnpm check`.

## Consequences
- Clean separation between global dashboard shell (identity, layout, modals) and feature route data loading.
- Stable URLs for operators on the factory floor.
- No regression for existing bookmarks or redirects.
