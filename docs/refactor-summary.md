# Architecture Refactor Summary

## Overview

This document summarizes the incremental architecture refactor completed for the YT Advertisement Operations Platform, transitioning from flat role-based routes to a workspace-oriented ERP architecture.

## Completed Phases

### Phase 0: Baseline and Implementation Decision ✅
- Verified clean git status and baseline test/check health (69 tests passing, TypeScript clean)
- ADR documentation created at `docs/adr/0001-workspace-routing-architecture.md`
- Formalized workspace routing architecture decision

### Phase 1: Consolidate Route and Access Contracts ✅
- Consolidated route contracts across `workspace-registry.ts`, `role-routing.ts`, and `access-policy.ts`
- Maintained single source of truth for operator machine mapping (laser, cnc, plotter, printer)
- Strengthened proxy request interception for legacy route rewrites/redirects
- Expanded automated tests in `role-routing.test.ts` and `access-policy.test.ts`
- Tests cover: unauthenticated public routes, role home routes, legacy flat route redirects, operator machine matching, invalid workspace handling

### Phase 2: Make Dashboard Shell Layout-Only ✅
- Audited `dashboard-shell.tsx` - confirmed no eager domain queries
- Shell only holds: profile/session context, company branding, sidebar/topbar layout, global notification inbox, modal context, access-denied/loading boundaries
- Domain queries in `dashboard-action-modals.tsx` are conditional (only execute when modals opened)
- `sidebar.tsx` and `topbar.tsx` are purely layout/navigation

### Phase 3: Migrate Routes One Family at a Time ✅
- Created canonical workspace routes under `/dashboard/[workspace]/...`
- Implemented legacy flat route redirects:
  - `/orders` → `/dashboard/[workspace]/orders`
  - `/inventory` → `/dashboard/[workspace]/inventory/parent` or `/inventory/substock`
  - `/reports` → `/dashboard/[workspace]/reports`
  - `/settings` → `/dashboard/[workspace]/settings`
  - `/reconciliation` → `/dashboard/[workspace]/reconciliation`
- Converted legacy role home pages to redirect pages:
  - `/dashboard/owner` → `/dashboard/owner`
  - `/dashboard/manager` → `/dashboard/manager`
  - `/dashboard/storekeeper` → `/dashboard/storekeeper`
  - `/dashboard/reception` → `/dashboard/receptionist`
- Preserved stable operator routes at `/dashboard/operator/[machine]` and `/dashboard/operator/[machine]/reconciliation`

### Phase 4: Consolidate Feature Boundaries ✅
- Kept domain views and modals in `src/components/dashboard/`, where the active
  workspace routes consume them directly.
- Removed unused `src/features/` facade modules and duplicate ID adapters; they
  added no runtime boundary and were not imported by active routes.
- `src/components/ui` remains domain-neutral with no Convex or role imports

### Phase 5: Refactor Convex Domain Internals ⏸️ DEFERRED
- High-risk phase deferred due to Convex type system complexity (Id<"user"> vs Id<"users"> mismatch in auth system)
- Current Convex structure is reasonably modular with `inventoryLedger.ts` as authoritative writer
- Attempted extraction of inventory conversion helpers encountered type incompatibilities
- All public Convex function signatures remain backward compatible
- Can be revisited when Convex type system provides better cross-table typing support

### Phase 6: Hardening, Cleanup, and Documentation ✅
- Updated `docs/architecture.md` to reflect workspace-oriented routing
- Added feature modules to tech stack documentation
- Documented workspace routing model in architecture section
- All tests passing (69/69), TypeScript clean

## Architecture Changes

### Route Structure
**Before:**
- Flat legacy routes: `/orders`, `/inventory`, `/reconciliation`, `/reports`, `/settings`
- Role-labeled routes: `/dashboard/owner`, `/dashboard/manager`, `/dashboard/storekeeper`, `/dashboard/reception`
- Operator routes: `/dashboard/operator/[machine]`

**After:**
- Canonical workspace routes: `/dashboard/[workspace]/...` where `workspace` ∈ `{owner, manager, admin, storekeeper, receptionist, operator}`
- Legacy routes redirect to canonical workspace routes (backwards compatible)
- Operator routes preserved at stable URLs

### Frontend Structure
**Before:**
- Domain views scattered in `src/components/dashboard/views/`
- No organized feature module structure

**After:**
- Domain views remain organized under `src/components/dashboard/views/` and
  `src/components/dashboard/modals/`
- UI primitives remain domain-neutral

### Key Contracts
- `src/components/dashboard/workspace-registry.ts` - Workspace definitions and capability mappings
- `src/lib/role-routing.ts` - Route contracts, legacy redirects, operator machine mapping
- `src/lib/access-policy.ts` - Capability model with role overrides
- `src/proxy.ts` - Request interception and route authorization

## Invariants Preserved
- Convex is authoritative for all data security, business invariants, and audit logging
- Inventory movements strictly flow through `recordInventoryEvent` in `convex/inventoryLedger.ts`
- Operator machine URLs remain stable at `/dashboard/operator/[machine]`
- All Amharic UI strings preserved (git mv used for any file moves)
- No regression for existing bookmarks or redirects

## Verification
- All 69 tests passing (Vitest)
- TypeScript type checking passes (`pnpm check`)
- Git status shows intentional changes only
- No breaking changes to public Convex functions

## Next Steps
- Phase 5 (Convex domain decomposition) can be pursued as a follow-up when needed
- Consider adding more comprehensive integration tests for workspace routing
- Monitor for any edge cases in legacy route redirects in production
