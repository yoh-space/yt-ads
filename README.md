# YT Advertising Operations Control

YT Advertising Operations Control is an Amharic-first operations dashboard for an advertising-production team. It tracks raw materials, machine assignments, job cards, production activity, reusable offcuts, unusable scrap, and inventory movements in a single workflow.

The application uses the **Next.js App Router** for the web interface, **Convex** for reactive persistence and backend mutations, and **Better Auth** for email/password authentication with optional Google OAuth. The active dashboard is implemented under `components/dashboard/`; the older local-state dashboard has been removed.

## Current capabilities

| Area | Current implementation |
|---|---|
| Authentication | Better Auth email/password and optional Google sign-in/linking, Convex session integration, application profiles, owner/manager delegation, and access revocation. |
| Inventory | Materials with purchase units, normalized base units, explicit conversion ratios, stock-in/out movements, insufficient-stock protection, low-stock notifications, and audit records. |
| Job cards | Job creation, machine assignment, queued/in-production/completed states, machine release, and planned-quantity validation. |
| Production | Operator workspaces for laser, CNC, plotter, and printer workflows; production input, good output, waste, operator, machine, and timestamp logging. |
| Machines | Active machine listing, administrator-only creation, unique machine codes, maintenance safeguards, status changes, and activation controls. |
| Offcuts and scrap | Reusable sheet offcuts returned to inventory with rack locations, plus unusable scrap deducted from stock and recorded separately. |
| Interface | Responsive desktop/mobile dashboard with Amharic-first labels, role-specific machine workspaces, live company branding, real-time unread notification badge/modal, account settings, loading states, and mutation error feedback. |
| Tests | Vitest unit coverage for conversion and workflow validation. The current suite contains 13 passing tests. |

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

All persistent operations must be performed through Convex handlers rather than the legacy in-memory helpers. Backend mutations enforce active application profiles and role permissions. Owners oversee all operations and company branding; owners, managers, and legacy administrators manage team access; owners, managers, and storekeepers manage inventory and job cards; assigned operators can record production for their machines. Notifications are targeted by recipient and update reactively through Convex subscriptions. The normal material flow remains `Requested → Issued/Partially Issued → Received` without mandatory routine approval or signatures.

Stock-in converts the selected purchase unit into the material’s normalized base unit using `conversionRatio` before updating inventory and recording both entered and normalized quantities. Production logging consumes base units directly, inserts a `productionLogs` record, and creates a corresponding stock-movement audit row. Completing a job records any remaining planned input with zero waste before releasing the machine. Scrap records deduct stock and create an auditable outbound movement. Reusable square-meter offcuts increase material stock and create an `offcut_return` movement.

Each raw-material entity may also define a canonical specification family, a selected specification value, and a strict option list. The current catalog covers Neon Light colors, Banner roll weight/size, Foam and Acrylic thickness, Mica Sheet finish, Canvas roll width/type, Machine Ink type/color configuration, Power Supply wattage, LED Module / Strip colors, and Zocolo height. These definitions are centralized in `shared/material-specifications.ts` and are enforced by both the material form and the Convex create validator.

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Public Convex cloud URL used by the browser client. |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex site URL used by the Better Auth Next.js integration. |
| `BETTER_AUTH_SECRET` | Secret configured in the Convex deployment for Better Auth. |
| `SITE_URL` | Application site URL configured in the Convex deployment. |
| `GOOGLE_CLIENT_ID` | Optional Google OAuth client ID for sign-in and account linking. |
| `GOOGLE_CLIENT_SECRET` | Optional Google OAuth client secret for sign-in and account linking. |

Do not commit `.env.local` or deployment secrets. Keep `.env.example` limited to variable names and safe documentation.

## Current release status

The codebase is buildable and testable locally. A real deployment still requires connecting a Convex project, configuring Better Auth secrets and site URLs, running the Convex development/deployment command, seeding an administrator account if needed, and completing an authenticated smoke test against the deployed backend.

The current requirement-based seed creates one company record, eight machines, 26 materials with confirmed conversion metadata, and 12 staff-context records without inventing operational history. `migrateYtAdvertisementMasterData` updates existing master records without changing quantities or activity. The next product-level improvements are Convex integration tests for authorization and notification targeting, a production Google OAuth configuration, image upload storage for company logos instead of URL-only branding, and continuous integration for the verification commands.
