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
| Tests | Vitest unit coverage for conversion, workflow validation, catalog metadata, routing, and access policy. |

## Verified Material Catalog

The master catalog is organized into four operational families. Each material record carries a normalized base unit, purchase/package unit, conversion ratio, optional catalog family/variant metadata, physical dimensions, production type, and compatible machine types.

### Roll Materials

| Material | Verified dimensions | Base tracking |
|---|---|---|
| Banner Flex | 3.2 × 50m and 2.07 × 50m | m² or metres |
| Frosted Sticker | 1.2 × 50m | m² |
| Mesh Sticker | 1.2 × 50m and 1.52 × 50m | m² |
| Transparent Sticker | 1.07 × 50m and 1.52 × 50m | m² |
| Reflective Sticker | 1.07 × 50m and 1.52 × 50m | m² |
| DTF Film | 0.60 × 100m | metres |
| Canvas | 1.50 × 30m/50m and 1.00 × 30m/50m | m² |

### Rigid Sheets

All rigid sheets use the standard 1.22m × 2.44m sheet footprint and are tracked as pieces with dimensional specifications.

- Mica: White, Red, Black, Blue Light, Blue Dark, Lemmen, Green, Yellow, Orange, Golden, Transparent; 3mm, 5mm, 8mm, 10mm, and 18mm.
- Cladding: White, Gray, and Black.
- Foam Board: 3mm, 5mm, 10mm, 15mm, and 18mm.

### Inks and Solvents

- Banner Ink: 5L canisters, Black, Blue, Red, and Yellow.
- DTF Ink: 1L canisters, White, Yellow, Black, Blue, and Red.
- Print & Cut Ink: 1L canisters, Red, Blue, Black, and Yellow.
- UV Ink: 1L canisters, Red, Blue, Black, Yellow, and White.
- Solvents: Banner Solvent, DTF Solvent, and Print & Cut Solvent.

Inks are deducted synchronously with the printed material in the same job completion transaction. Solvents are excluded from per-job automated consumption and are adjusted through periodic stock movements.

### Hardware and Countable Accessories

- Power Supply: 60W, 100W, 200W, and 400W.
- Digital Screen: A1 and A2.
- LED Modules: White, Warm, Yellow, Red, Blue, and Green.
- Zecolo: 6cm and 8cm.
- Neon Light Flex: White, Warm, Yellow, Red, Blue, Green, Ice Blue, and Pink.
- Electric Wire: metres.
- T-Shirts: pieces.
- Amire: packets of 250 pieces.
- Roll-Up Stands: Deluxe and Standard.

## Verified Machine Map

| Machine | Primary materials | Associated ink/solvent |
|---|---|---|
| Crystal Jet 7K Series | Banner Flex and heavy stickers | Banner Ink 5L and Banner Solvent |
| Crystc Eco-Solvent Printer | Stickers and grayback media | Print & Cut Ink 1L and Print & Cut Solvent |
| Ricoh Flatbed UV Machine | Rigid sheets and specialty media | UV Ink 1L |
| DTF i3200 | T-shirts and textile films | DTF Ink 1L and DTF Solvent |
| Laser Cutter | Mica and Foam Board | None |
| CNC Router | Foam Board, Cladding, and MDF sheets | None |

Machine records support `primaryMaterialFamilies` and `associatedInkFamilies` so assignment and material compatibility can be validated without relying on display labels.

## Production and Deduction Rules

Reception creates an order with both the display dimensions and parsed numeric `length`/`width` values. Confirmation creates the job card with those dimensions, service type, and machine assignment. Active `serviceBOM` rows create immutable per-job material requirements for Flex, frame, ink, hardware, and other components.

For standard area-based completion, the automatic allocation formula is:

```text
allocated area = (length × width + configured margin m²) × (1 + scrap allowance %)
```

The calculated allocation is deducted FIFO from operator floor stock and then central stock through auditable `stockMovements`. Ink uses the printed square metres and the governed mL/m² rate, converting mL to litres only at the inventory base-unit boundary. Solvents are periodically adjusted rather than deducted per job.

Reception does not manually allocate raw materials. Machine compatibility, service BOM requirements, owner-configured margin, and scrap limits determine the planned material allocation. Operators may record an optional production log, but standard completion does not require manual intake values.

## Feature Checklist

- Multiple design uploads per customer order.
- Customer order status updates through payment, job-card, production, completion, and pickup states.
- Telegram payment-request format with order identifiers and payment instructions.
- Role-based audit sidebar and workspace access controls.
- Centralized reorder-warning and stockout forecast system.
- Strict direct stock-out controls with permission, threshold, and audit requirements.
- FIFO floor-stock deduction and central-stock fallback.
- Auditable scrap, offcut, ink, and composite BOM consumption.

## Design System Rule

New interface work must use semantic design tokens and theme variables for colors, borders, surfaces, and text. Do not introduce hardcoded hex colors or ad-hoc Tailwind color values in new components. Dark and light themes must remain supported through the shared semantic CSS variables and UI primitives.

## Repository structure

```text
src/app/                     Next.js App Router pages and Better Auth route
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

Stock-in converts the selected purchase unit into the material’s normalized base unit using `conversionRatio` before updating inventory and recording both entered and normalized quantities. Production logging consumes base units directly, inserts a `productionLogs` record, and creates a corresponding stock-movement audit row. Standard job completion derives material allocation from persisted dimensions, BOM requirements, configured margin, and scrap allowance before releasing the machine. Ink is deducted with mL precision; solvents remain periodic adjustments. Scrap records deduct stock and create an auditable outbound movement. Reusable square-meter offcuts increase material stock and create an `offcut_return` movement.

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

The requirement-based seed creates the verified company, machine, and material master data with catalog families, physical dimensions, machine associations, and conversion metadata without inventing operational history. `migrateYtAdvertisementMasterData` updates existing master records without changing quantities or activity. The next product-level improvements are Convex integration tests for authorization and notification targeting, a production Google OAuth configuration, image upload storage for company logos instead of URL-only branding, and continuous integration for the verification commands.
