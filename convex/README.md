# Convex and Better Auth setup

The application uses Convex for the database, reactive queries, and authenticated mutations. Better Auth is mounted through the Convex component and exposed to Next.js through `app/api/auth/[...all]/route.ts`.

## Required deployment configuration

Create or connect a Convex deployment and provide these values:

| Variable | Where it is used |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Next.js browser client and server-side route protection. |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Better Auth’s Next.js integration. |
| `BETTER_AUTH_SECRET` | Convex deployment secret for signing Better Auth sessions. |
| `SITE_URL` | Convex deployment site URL used by Better Auth callbacks. |

The public URLs are normally written to `.env.local` by the Convex CLI or copied from the deployment dashboard. Deployment secrets must be set in Convex and must not be committed to Git.

## Local setup

From the repository root:

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm exec convex dev
```

The Next.js application can render its sign-in and sign-up routes before a real Convex URL is attached. Without `NEXT_PUBLIC_CONVEX_URL`, the app uses a placeholder client and persistent operations are not available. With a real deployment configured, the dashboard queries Convex reactively and Better Auth protects the application entry route.

## Data model and operations

The schema contains application profiles, materials, machines, stock movements, job cards, production logs, reusable offcuts, and unusable scrap. The principal backend modules are:

| Module | Responsibility |
|---|---|
| `users.ts` | Application profiles, active-profile checks, role changes, and administrator guards. |
| `materials.ts` | Material creation, base-unit conversion, validated stock movements, and audit rows. |
| `jobs.ts` | Job creation, machine allocation, production logging, inventory deduction, and completion. |
| `machines.ts` | Administrator-only creation, status changes, activation, and lifecycle safeguards. |
| `offcuts.ts` | Reusable offcut returns and scrap deduction/audit records. |
| `dashboard.ts` | Reactive aggregate state consumed by the live dashboard. |

Backend mutations enforce active profiles. Administrators manage machines and users; administrators and storekeepers manage inventory and job cards; assigned operators may record production for their machine role.

## Data accounting rules

Production input is deducted from the selected material in the material’s base unit and recorded in both `productionLogs` and `stockMovements`. A job can receive multiple production logs, but their total input cannot exceed the planned job quantity. Completing a job automatically logs any remaining planned input with zero waste, marks the job completed, and releases the machine.

Reusable sheet offcuts increase square-meter inventory and create an `offcut_return` movement. Unusable scrap decreases material inventory and creates an outbound stock movement with the scrap reason. Stock-outs and scrap records are rejected when the available base-unit balance is insufficient.

## Seeding

`convex/seed.ts` provides an administrator-only demo-data mutation. It inserts sample materials, machines, job cards, and offcuts only when the materials table is empty. Use seed data only for development or a controlled demonstration; production data should be created through the application workflows.

## Verification

Run these commands from the repository root before deployment:

```bash
pnpm test
pnpm check
NODE_ENV=production pnpm build
```

After connecting a real deployment, create an account, confirm the first profile receives administrator access, verify role restrictions with additional accounts, seed or create test data, and exercise stock movement, production logging, completion, offcut return, and scrap workflows.
