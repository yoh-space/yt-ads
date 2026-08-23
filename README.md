# YT Advertising Operations Control

YT Advertising Operations Control is an Amharic-first operations dashboard for an advertising-production team. It tracks raw materials, machine assignments, job cards, production activity, reusable offcuts, unusable scrap, and inventory movements in a single workflow.

The application uses the **Next.js App Router** for the web interface, **Convex** for reactive persistence and backend mutations, and **Better Auth** for email/password authentication. The active dashboard is implemented under `components/dashboard/`; the older local-state dashboard has been removed.

## Current capabilities

| Area | Current implementation |
|---|---|
| Authentication | Better Auth email/password sign-in and sign-up, Convex session integration, and application profiles with admin, storekeeper, and machine-operator roles. |
| Inventory | Materials with base units, reorder levels, roll/sheet conversions, stock-in and stock-out movements, insufficient-stock protection, and audit records. |
| Job cards | Job creation, machine assignment, queued/in-production/completed states, machine release, and planned-quantity validation. |
| Production | Operator workspaces for laser, CNC, plotter, and printer workflows; production input, good output, waste, operator, machine, and timestamp logging. |
| Machines | Active machine listing, administrator-only creation, unique machine codes, maintenance safeguards, status changes, and activation controls. |
| Offcuts and scrap | Reusable sheet offcuts returned to inventory with rack locations, plus unusable scrap deducted from stock and recorded separately. |
| Interface | Responsive desktop/mobile dashboard with Amharic-first labels, role-specific machine workspaces, loading states, and mutation error feedback. |
| Tests | Vitest unit coverage for conversion and workflow validation. The current suite contains 14 passing tests. |

## Repository structure

```text
app/                         Next.js App Router pages and Better Auth route
components/dashboard/        Live dashboard, views, modals, and operator workspaces
convex/                      Convex schema, queries, mutations, auth, and validation
lib/                         Shared frontend types, auth clients, and conversion helpers
docs/                        Project validation and operational notes
.env.example                 Required local environment variable names
package.json                 Development, test, type-check, and build commands
```

## Local development

Install the locked dependency set and start the development server:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

The interface can render without a connected Convex deployment. In that mode it uses a local placeholder client and does not persist operations. To enable authentication, realtime queries, and mutations, copy `.env.example` to `.env.local` and provide the real URLs from the Convex deployment.

```bash
cp .env.example .env.local
pnpm exec convex dev
```

The Convex setup requirements are documented in [`convex/README.md`](./convex/README.md).

## Verification commands

Run the same checks used before merging changes:

```bash
pnpm test
pnpm check
NODE_ENV=production pnpm build
```

`pnpm test` runs Vitest, `pnpm check` runs TypeScript without emitting files, and the production build validates Next.js compilation, type checking, route generation, and bundle creation.

## Backend rules

All persistent operations must be performed through Convex handlers rather than the legacy in-memory helpers. Backend mutations enforce active application profiles and role permissions. Administrators manage machines and user profiles; administrators and storekeepers manage inventory and job cards; assigned operators can record production for their machines.

Production logging deducts material input from inventory, inserts a `productionLogs` record, and creates a corresponding stock-movement audit row. Completing a job records any remaining planned input with zero waste before releasing the machine. Scrap records deduct stock and create an auditable outbound movement. Reusable square-meter offcuts increase material stock and create an `offcut_return` movement.

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Public Convex cloud URL used by the browser client. |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex site URL used by the Better Auth Next.js integration. |
| `BETTER_AUTH_SECRET` | Secret configured in the Convex deployment for Better Auth. |
| `SITE_URL` | Application site URL configured in the Convex deployment. |

Do not commit `.env.local` or deployment secrets. Keep `.env.example` limited to variable names and safe documentation.

## Current release status

The codebase is buildable and testable locally. A real deployment still requires connecting a Convex project, configuring Better Auth secrets and site URLs, running the Convex development/deployment command, seeding an administrator account if needed, and completing an authenticated smoke test against the deployed backend.

The next product-level improvements are integration tests for Convex authorization and accounting, an administrator UI for managing user roles and active status, a UI for machine maintenance/activation controls, and continuous integration for the verification commands.
