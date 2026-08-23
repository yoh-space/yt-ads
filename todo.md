# Project TODO

The core operations-control workflow is implemented in the current codebase. Completed items are retained as a release record; open items are limited to deployment hardening and future product improvements.

## Completed

- [x] Initialize the Next.js App Router application foundation.
- [x] Configure Convex schema and reactive state for users, materials, machines, stock movements, job cards, production logs, offcuts, and scrap.
- [x] Configure Better Auth email/password sign-in and sign-up with Convex integration.
- [x] Create application profiles with admin, storekeeper, and machine-operator roles.
- [x] Enforce active-profile and role checks in backend mutations.
- [x] Build an Amharic-first executive dashboard with inventory, production, wastage, and discrepancy metrics.
- [x] Build raw-material setup and stock-in/stock-out workflows with roll, sheet, meter, and square-meter conversion rules.
- [x] Add stock-out and scrap insufficiency protection with audit records.
- [x] Build job-card creation, machine assignment, production logging, material deduction, and completion workflows.
- [x] Build dedicated laser, CNC, plotter, and large-format printer workspaces.
- [x] Add operator capture for production input, good output, and waste.
- [x] Add machine creation, unique-code validation, maintenance safeguards, status changes, and activation controls.
- [x] Add reusable offcut return workflows with rack locations and inventory audit movements.
- [x] Add unusable scrap logging with inventory deduction and a separate wastage register.
- [x] Add responsive mobile operator interfaces and loading/error states.
- [x] Fix TypeScript, Vitest alias resolution, and production-build blockers.
- [x] Add unit and production-validation tests; the current suite contains 14 tests.
- [x] Add local environment documentation and current architecture documentation.

## Remaining release and product work

- [ ] Connect a real Convex deployment and configure `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `BETTER_AUTH_SECRET`, and `SITE_URL`.
- [ ] Run an authenticated production smoke test covering sign-up, role assignment, inventory, production, completion, offcuts, scrap, and machine lifecycle actions.
- [ ] Add Convex integration tests for authentication, role authorization, inventory accounting, and concurrent stock operations.
- [ ] Add an administrator UI for listing users and changing roles or active status.
- [ ] Add visible administrator controls for machine maintenance and activation actions.
- [ ] Add continuous integration to run `pnpm test`, `pnpm check`, and `NODE_ENV=production pnpm build` on pull requests.
