# Validation and release notes

## Current implementation

The live dashboard is the Convex-backed implementation under `components/dashboard/`. It reads reactive state from `convex/dashboard.ts` and sends inventory, job, machine, offcut, scrap, and production actions through Convex mutations. The application supports Better Auth email/password sign-in and sign-up, active application profiles, administrator and storekeeper inventory workflows, assigned operator workspaces, and responsive desktop/mobile layouts.

Production activity is recorded in `productionLogs` and paired with `stockMovements`. Job completion records any remaining planned material input before releasing the machine. Usable square-meter offcuts return material to inventory, while unusable scrap is deducted and recorded in the wastage register. Backend mutations validate quantities and enforce active profiles and role permissions.

## Local verification

The following commands pass in the current repository:

| Check | Result |
|---|---|
| `pnpm test` | Passed: 14 tests across 2 test files. |
| `pnpm check` | Passed: TypeScript completed with no errors. |
| `NODE_ENV=production pnpm build` | Passed: Next.js compiled and generated all application routes. |
| `git diff --check` | Passed: no whitespace errors. |

The test suite covers conversion logic, mock helper behavior retained for utility coverage, and production quantity validation. The build uses safe local Convex placeholders when deployment URLs are not configured; persistent operations still require a real deployment.

## Deployment verification still required

A real Convex deployment must be connected before the application can be used operationally. Configure `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` in the Next.js environment, and configure `BETTER_AUTH_SECRET` and `SITE_URL` in the Convex deployment. Then run an authenticated smoke test with a first administrator account and at least one additional role.

The production smoke test should confirm sign-up, profile creation, administrator-only machine management, storekeeper inventory actions, operator-specific production logging, insufficient-stock rejection, job completion, offcut return, scrap deduction, and machine release. Deployment secrets must remain outside Git.

## Known follow-up work

The codebase is ready for controlled deployment testing, but it does not yet include Convex integration tests, a user-management screen, visible machine maintenance controls, or continuous integration. These are tracked in [`todo.md`](../todo.md).
