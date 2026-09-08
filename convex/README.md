# Convex and Better Auth setup

The application uses Convex for the database, reactive queries, and authenticated mutations. Better Auth is mounted through the Convex component and exposed to Next.js through `src/app/api/auth/[...all]/route.ts`.

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
| `materials.ts` | Material creation, purchase-unit to base-unit conversion, validated stock movements, and audit rows. |
| `jobs.ts` | Job creation, machine allocation, production logging, inventory deduction, and completion. |
| `machines.ts` | Administrator-only creation, status changes, activation, and lifecycle safeguards. |
| `offcuts.ts` | Reusable offcut returns and scrap deduction/audit records. |
| `dashboard.ts` | Reactive aggregate state consumed by the live dashboard. |

Backend mutations enforce active profiles. Owners and delegated managers manage administrative surfaces; storekeepers issue stock and manage inventory; assigned operators may record production for their machine role. Authorization is enforced in Convex rather than only by hidden UI controls.

## Data accounting rules

Stock-in uses the material’s `purchaseUnit` and `conversionRatio` to update the normalized `baseUnit` balance. For example, two Banner rolls add `2 × 160 = 320 m²`; three LED packs add `3 × 20 = 60 pcs`. Production input is deducted directly from the selected material in its base unit and recorded in both `productionLogs` and `stockMovements`. A job can receive multiple production logs, but their total input cannot exceed the planned job quantity. Completing a job automatically logs any remaining planned input with zero waste, marks the job completed, and releases the machine.

Reusable sheet offcuts increase square-meter inventory and create an `offcut_return` movement. Unusable scrap decreases material inventory and creates an outbound stock movement with the scrap reason. Stock-outs and scrap records are rejected when the available base-unit balance is insufficient.

## Seeding

`convex/seed.ts` provides separate demo, workspace, migration, and owner-bootstrap paths:

- `seed` inserts the original demo materials, machines, job cards, and offcuts for a controlled demonstration.
- `seedYtAdvertisementWorkspace` inserts the captured YT Advertisement master data: company settings, eight machine records, 26 materials, and 12 staff responsibility records. The four confirmed Crystal machine records are Print and Cut, DTF, Laser Cutter 1325, and UV Flat bed. It intentionally creates no jobs, production logs, stock movements, material requests, scrap, or offcuts because no real historical activity was provided.
- `migrateYtAdvertisementMasterData` safely applies the revised machine capabilities and purchase/base-unit conversion metadata to an existing seeded workspace without deleting operational records or changing current quantities and reorder balances. Machines match by code and materials match by name; missing records are added with zero balances.
- `seedYitbarekOwner` creates or promotes the confirmed real owner account at the approved email, using a password supplied only at invocation time. The password is not stored in source, returned, or written to the application profile. Run it only in the intended local development deployment, then change the temporary password from Account settings.

The requirement-based seed is idempotent by company key and refuses to mix with existing operational records. Use the migration path when preserving activity, and use reset/force only after a reviewed backup. Never place access keys, session identifiers, passwords, or deployment secrets in seed data.

## Owner, profile, and notifications

The application roles now include `owner` and `manager` in addition to the existing operational roles. The owner can manage all operations, assign or revoke roles, deactivate profiles, and update company branding. Owner, manager, and legacy admin accounts can manage team access; managers cannot assign or modify the owner role. Every authenticated user can update their own name and profile image URL, change their password, and start Google account linking from Account settings.

Notifications are persisted per recipient and delivered reactively through Convex subscriptions. The initial targeted events cover material requests, material issues and partial/short-stock issues, received confirmations, low stock, job updates, machine updates, and account role/access updates. The header badge counts unread items; the modal lists newest first and supports marking one item or all items as read.

To enable Google sign-in and account linking, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the Convex deployment environment and configure the OAuth callback URL for the Better Auth site URL. The repository only contains the variable names in `.env.example`, never the credential values.

For the current master-data conversion rules, `purchaseUnit` is one of `roll`, `sheet`, `pack`, `liter`, or `piece`; `baseUnit` is one of `m²`, `m`, `L`, or `pcs`; and `conversionRatio` converts purchase quantity into base quantity. PVC Film remains intentionally unconfigured until its physical roll dimensions are confirmed.

Material records also carry a canonical `specification`, optional `specificationValue`, and the strict `specificationOptions` list used by the creation form and Convex validation. The supported families are: Neon Light color type; Banner roll weight and size; Foam thickness/size in millimeters; Mica Sheet color/finish; Acrylic thickness in millimeters; Canvas roll width/type; Machine Ink type and color configuration; Power Supply wattage; LED Module / Strip color type; and Zocolo height in centimeters. The source of truth is `src/shared/material-specifications.ts`, which also preserves aliases such as `LED`, `Mica`, `Canvas`, and `ZOCOLO` for non-destructive migration.

## Verification

Run these commands from the repository root before deployment:

```bash
pnpm test
pnpm check
NODE_ENV=production pnpm build
```

After connecting a real deployment, create or migrate the workspace master data, verify each conversion with the storekeeper, confirm role restrictions with real accounts, configure Google OAuth if required, and exercise stock-in, stock-out, material request, production logging, completion, offcut return, scrap, notification, and account settings workflows. Do not treat seeded zero balances as physical stock.
