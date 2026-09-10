# YT Advertising Operations Control
 
YT Advertising Operations Control is an Amharic-first operations dashboard for an advertising-production team. It tracks raw materials, machine assignments, job cards, production activity, reusable offcuts, unusable scrap, and inventory movements in a single workflow.

The application uses the **Next.js App Router** for the web interface, **Convex** for reactive persistence and backend mutations, and **Better Auth** for email/password authentication with optional Google OAuth. The active dashboard is implemented under `src/components/dashboard/`; the older local-state dashboard has been removed.

## Current capabilities

| Area | Current implementation |
|---|---|
| Authentication | Better Auth email/password and optional Google sign-in/linking, Convex session integration, application profiles, owner/manager delegation, and access revocation. |
| Inventory | Materials with purchase units, normalized base units, explicit conversion ratios, stock-in/out movements, insufficient-stock protection, low-stock notifications, and audit records. |
| Job cards | Job creation, machine assignment, queued/in-production/completed states, machine release, and planned-quantity validation. |
| Production | Operator workspaces for laser, CNC, plotter, and printer workflows; production input, good output, waste, operator, machine, and timestamp logging. |
| Machines | Active machine listing, administrator-only creation, unique machine codes, maintenance safeguards, status changes, and activation controls. |
| Offcuts and scrap | Reusable sheet offcuts returned to inventory with rack locations, plus unusable scrap deducted from stock and recorded separately. Off-cut and scrap are also **auto-calculated** from material dimensions and net job size on dispatch and registered atomically with the job. |
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

The calculated allocation is deducted FIFO from operator floor stock and then central stock through auditable `stock_movements`. Ink uses the printed square metres and the governed mL/m² rate, converting mL to litres only at the inventory base-unit boundary. Solvents are periodically adjusted rather than deducted per job.

Reception does not manually allocate raw materials. Machine compatibility, service BOM requirements, owner-configured margin, and scrap limits determine the planned material allocation. Operators may record an optional production log, but standard completion does not require manual intake values.

### Automated Off-Cut & Scrap Registration

Scrap and off-cut values are never entered by hand. When an order is confirmed and a job card is created, the identical deterministic engine in `src/shared/material-calc.ts` (used by both the dispatch preview and the `confirmOrderAndIssueJobCard` mutation) derives them from the material's catalog dimensions and the customer's net job dimensions:

- **Roll stock** — `grossArea = rollWidth × jobLength × qty` is deducted as `PRODUCTION_CONSUMPTION`; `netArea = jobWidth × jobLength × qty` is the product area. Any unused side strip `(rollWidth − jobWidth) × jobLength × qty` becomes a **usable off-cut** (and is returned to inventory with an `OFFCUT_RETURN`) when the strip is ≥ 0.3 m wide, otherwise it is classified as **scrap**. Owner-configured setup margin is added to scrap.
- **Rigid sheets** — the job cutout is nested on the standard sheet, `sheetsNeeded` and total sheet area are computed, and the leftover rectangular section is a reusable off-cut while any non-recoverable trim counts as scrap.

The mutation persists the breakdown on the job card (`grossDeductedQuantity`, `netProductArea`, `offcutArea`, `scrapArea`, `scrapPercentage`), deducts the gross quantity from central inventory, inserts a usable off-cut record + `OFFCUT_RETURN` ledger event, and inserts a scrap record + `SCRAP_LOG` ledger event — all in the same atomic transaction. The dispatch modal renders this as a read-only **Auto-Calculated Production Breakdown** card. Minimum off-cut area and 0.3 m usable-width thresholds come from the owner-configured `systemConfigs`.

## Feature Checklist

- Multiple design uploads per customer order.
- Customer order status updates through payment, job-card, production, completion, and pickup states.
- Telegram payment-request format with order identifiers and payment instructions.
- Role-based audit sidebar and workspace access controls.
- Centralized reorder-warning and stockout forecast system.
- Strict direct stock-out controls with permission, threshold, and audit requirements.
- FIFO floor-stock deduction and central-stock fallback.
- Auditable scrap, offcut, ink, and composite BOM consumption.
- Deterministic, hand-off-free scrap & off-cut calculation (`src/shared/material-calc.ts`) shown in the dispatch preview and registered atomically on job creation.

## Design System Rule

New interface work must use semantic design tokens and theme variables for colors, borders, surfaces, and text. Do not introduce hardcoded hex colors or ad-hoc Tailwind color values in new components. Dark and light themes must remain supported through the shared semantic CSS variables and UI primitives.

## Repository structure

```text
src/app/                     Next.js App Router pages, routes, and Better Auth catch-all
src/components/ui/           Domain-neutral UI primitives (Panel, Button, Badge, Table, ...)
src/components/dashboard/    Live dashboard shell, views, modals, and role workspaces
src/components/public/       Order tracker and Telegram Mini App customer portal
src/lib/                     Shared frontend types, auth clients, routing, and helpers
src/shared/                  Service catalog, material specifications, machine catalog, and the deterministic scrap/off-cut engine (material-calc.ts)
src/telegram/                grammY bot logic, keyboards, sessions, and i18n
src/types/                   Shared TypeScript type definitions
src/hooks/                   Frontend hooks (e.g. useNotification)
src/store/                   Client-side state stores (e.g. useSoundStore)
src/constants/               Frontend constants (e.g. services)
src/proxy.ts                 Next.js 16 edge request interceptor (role-gated routing)
convex/                      Convex schema, queries, mutations, auth, validation, crons
src-tauri/                   Tauri v2 desktop shell (Cargo, capabilities, icons)
docs/                        Architecture, workflows, RBAC, security, and ADR docs
.env.example                 Required local environment variable names
package.json                 Development, test, type-check, and build commands
```

**YT Advertising Operations Control** is an enterprise-grade, Amharic-first ERP and factory operations control system tailored for commercial advertising and large-format printing manufacturing. It tracks raw materials, automated machine assignments, job cards, floor production telemetry, reusable offcuts, unusable scrap, and two-tier event-sourced inventory movements in a single synchronous transactional workflow.

The application is built on **Next.js 16.3.3 App Router** (featuring edge request interception via `src/proxy.ts`), **Convex** for real-time reactive persistence and ACID transactions, **Better Auth** for secure session management, and **Tauri v2** for the cross-platform native desktop shell.

---

## 1. System Architecture Overview

```
                          ┌─────────────────────────────┐
                          │   Next.js 16.3.3 App Router  │
                          │   (Edge Guard: src/proxy.ts) │
                          └──────────────┬──────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     ┌──────────────────────┐                        ┌──────────────────────┐
     │  Role-Gated Routes   │                        │  Telegram Bot / Mini │
     │  (/dashboard/*, etc) │                        │  App Customer Portal │
     └───────────┬──────────┘                        └──────────┬───────────┘
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         │ Reactive WebSocket / JWT
                                         ▼
                          ┌─────────────────────────────┐
                          │    Convex Backend Engine    │
                          │   (Schema, Queries, Mut)    │
                          └──────────────┬──────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌──────────────┐                 ┌──────────────┐                 ┌──────────────┐
│  Tier 1: SK  │                 │  Tier 2: OP  │                 │   Audit &    │
│ Parent Store │  ── Transfer ─▶ │ Floor Stock  │  ── Consume ─▶  │ Stock Events │
│(Rolls/Sheets)│                 │ (m² / m / L) │                 │(Synchronous) │
└──────────────┘                 └──────────────┘                 └──────────────┘
```

---

## 2. Verified Materials Catalog (23 Raw Material Categories across 4 Units)

All raw materials are registered with confirmed purchase units, normalized metric base units, and explicit conversion ratios:

### 1. ROLL MATERIALS (Calculated in m² or Meters)
| Material Name | Purchase Unit | Base Unit | Conversion Ratio | Verified Dimensions & Specifications | Primary Machine |
|---|---|---|---|---|---|
| **Banner Flex** | `roll` | `m²` | 160 / 103.5 | 3.2m × 50m (160 m²), 2.07m × 50m (103.5 m²) | Crystal Jet 7K Series |
| **Frosted Sticker** | `roll` | `m²` | 60 | 1.2m × 50m (60 m²) | Crystc Eco-Solvent |
| **Mesh Sticker** | `roll` | `m²` | 76 / 60 | 1.52m × 50m (76 m²), 1.2m × 50m (60 m²) | Crystal Jet 7K Series |
| **Transparent Sticker** | `roll` | `m²` | 76 / 53.5 | 1.52m × 50m (76 m²), 1.07m × 50m (53.5 m²) | Crystc Eco-Solvent |
| **Reflective Sticker** | `roll` | `m²` | 76 / 53.5 | 1.52m × 50m (76 m²), 1.07m × 50m (53.5 m²) | Crystc Eco-Solvent |
| **DTF Film** | `roll` | `m` | 100 | 60cm × 100m roll (linear running meters) | DTF i3200 |
| **Canvas** | `roll` | `m²` | 45 / 75 / 30 / 50 | 1.50m × 30m (45 m²), 1.50m × 50m, 1m × 30m, 1m × 50m | Ricoh Flatbed UV |

### 2. RIGID SHEETS (Calculated in Pieces / Sheets: 1.22m × 2.44m = 2.977 m²)
| Material Name | Purchase Unit | Base Unit | Dimensions | Thicknesses / Colors | Primary Machines |
|---|---|---|---|---|---|
| **Mica** | `sheet` | `m²` | 1.22m × 2.44m | 3mm, 5mm, 8mm, 10mm, 18mm · White, Red, Black, Blue Light, Blue Dark, Lemmen, Green, Yellow, Orange, Golden, Transparent | Ricoh Flatbed UV, Laser Cutter |
| **Cladding** | `sheet` | `m²` | 1.22m × 2.44m | White, Gray, Black | Ricoh Flatbed UV, CNC Router |
| **Foam Board** | `sheet` | `m²` | 1.22m × 2.44m | 3mm, 5mm, 10mm, 15mm, 18mm | Ricoh Flatbed UV, CNC Router, Laser Cutter |

### 3. INKS & SOLVENTS (Calculated in Liters / Canisters)
| Consumable Name | Packaging Unit | Base Unit | Canister Volume | Associated Machine | Deduction Policy |
|---|---|---|---|---|---|
| **Banner Ink 5L Canister** | `canister` / `liter` | `L` | 5 Liters (Black, Blue, Red, Yellow) | Crystal Jet 7K Series | **Synchronous per job card** |
| **DTF Ink 1L Canister** | `canister` / `liter` | `L` | 1 Liter (White, Yellow, Black, Blue, Red) | DTF i3200 | **Synchronous per job card** |
| **Print & Cut Ink 1L Canister** | `canister` / `liter` | `L` | 1 Liter (Red, Blue, Black, Yellow) | Crystc Eco-Solvent | **Synchronous per job card** |
| **UV Ink 1L Canister** | `canister` / `liter` | `L` | 1 Liter (Red, Blue, Black, Yellow, White) | Ricoh Flatbed UV | **Synchronous per job card** |
| **Solvents** *(Banner, DTF, Print & Cut)* | `canister` / `liter` | `L` | 1L & 5L Canisters | Chemical Store | **Excluded from job cards; adjusted periodically** |

### 4. HARDWARE & COUNTABLE ACCESSORIES
| Hardware Name | Unit | Packaging & Specifications | Application |
|---|---|---|---|
| **Power Supply** | `pcs` | 60W, 100W, 200W, 400W | LED signs and illuminated channel letters |
| **Digital Screen** | `pcs` | A1 (594 × 841 mm), A2 (420 × 594 mm) | Backlit ultra-slim advertising displays |
| **LED Modules** | `pcs` (pack of 20) | White, Warm, Yellow, Red, Blue, Green | Letter illumination & backlighting |
| **Zecolo** | `pcs` / `m` | 6cm, 8cm height | Architectural base & skirting |
| **Neon Light Flex** | `m` (5m roll) | White, Warm, Yellow, Red, Blue, Green, Ice Blue, Pink | Neon signs and decorative accents |
| **Electric Wire** | `m` (100m roll) | 1.5mm Standard, 2.5mm Heavy Duty | Power cabling for signage |
| **T-Shirts** | `pcs` | Cotton (S, M, L, XL, XXL) | DTF textile garment branding |
| **Amire** | `pcs` (pack of 250) | Packets of 250 pieces | Heavy-duty sheet and frame rivets |
| **Roll-Up Stands** | `pcs` | Deluxe, Standard | Exhibition pull-up banner displays |

---

## 3. Machines Fleet & Mapping Architecture

| Machine Name | Code | Equipment Type | Primary Materials | Consumables & Inks | Operator Role |
|---|---|---|---|---|---|
| **Crystal Jet 7K Series** | `CJ7K-01` | Large Format Solvent 3.2m | Banner Flex, Mesh Sticker | Banner Ink 5L Canister + Banner Solvent *(periodic)* | `printer_operator` |
| **Crystc Eco-Solvent Printer** | `CESP-01` | 1.6m Precision Eco-Solvent | Frosted, Transparent, Reflective Stickers, Grayback | Print & Cut Ink 1L Canister + P&C Solvent *(periodic)* | `plotter_operator` |
| **Ricoh Flatbed UV Machine** | `RUV-01` | Industrial UV Flatbed | Mica, Foam Board, Cladding, Canvas | UV Ink 1L Canister (CMYK + White) | `printer_operator` |
| **DTF i3200** | `DTF-01` | Dual Head Roll-to-Roll DTF | DTF Film, T-Shirts | DTF Ink 1L Canister + DTF Solvent *(periodic)* | `printer_operator` |
| **Laser Cutter** | `LAS-01` | CO2 Laser 1325 (1.22 × 2.44m) | Mica, Foam Board | Zero ink (Dry precision laser beam) | `laser_operator` |
| **CNC Router** | `CNC-01` | Heavy Duty 2030 (2.0 × 3.0m) | Foam Board, Cladding, MDF Sheets | Zero ink (3-Axis mechanical routing) | `cnc_operator` |

---

## 4. Synchronous Ink & Material Deduction Logic

In large-format advertising production, printing a square meter of substrate irreversibly consumes both the substrate media and machine ink. 

### Operational Rule:
1. **Simultaneous Depletion**: When a job card completes or logs production on a print machine, the system automatically and atomically deducts:
   $$\text{Substrate } (m^2 \text{ or } m) \quad \text{AND} \quad \text{Ink } (L)$$
   $$\text{Ink Depleted } (L) = \frac{\text{Area } (m^2) \times \text{Ink Consumption Rate } (\text{mL}/m^2)}{1000}$$
2. **Floor Sub-Stock Priority**: Depletions draw first against the active operator floor batch (`operatorSubStock`). Any remainder draws from central store custody with an automated audit log in `stock_movements`.
3. **Solvent Exclusion**: Printhead flushing solvents (`Banner Solvent`, `DTF Solvent`, `Print & Cut Solvent`) are **strictly excluded** from per-job synchronous deduction. Solvents evaporate during maintenance and are tracked via weekly physical audit and periodic maintenance adjustments.

---

## 5. Automated Machine Assignment & Job Card Creation

Manual machine and material selection has been **completely eliminated** from the Receptionist interface to prevent misallocations and unauthorized substitutions.

1. **Automated Routing**: Upon order payment verification (Advance Payment Received / Approved Credit), the system passes `order.serviceType` through the central `SERVICE_ROUTING_MAP`.
2. **Deterministic Resource Assignment**:
   - Automatically selects the optimal machine fleet member.
   - Automatically resolves the required raw material specification and compatible ink.
3. **Owner-Configured Standard Waste Margin & Scrap Limit**:
   $$\text{Planned Usage} = \text{Base Job Dimensions} \times (1 + \text{Owner Waste Margin } [5\%])$$
   $$\text{Max Tolerated Scrap} = \text{Planned Usage} \times \text{Max Scrap Limit } [8-10\%]$$
4. **Receptionist Experience**:
   - The receptionist modal only captures the payment decision (`PAID` / `APPROVED_CREDIT`) and payment method.
   - All machine routing, material BOM calculations, and planned quantities are calculated and rendered as verified read-only authorization cards.

---

## 6. Features Checklist

- [x] **Multiple Design Uploads Per Order**: Support for primary design storage plus multi-file attachments (`attachmentStorageIds`) for multi-page graphics and vector cut lines.
- [x] **Customer Order Status Updates**: Real-time customer tracking portal (`/track?code=...`) and automated Telegram bot push notifications triggered on status progression.
- [x] **Telegram Payment Request Format**: Formatted customer receipts and payment requests including Telebirr and CBE Bank details, verified TIN number, and legal company credentials.
- [x] **Role-Based Audit Sidebar**: Dynamic Next.js 16 route navigation strictly tailored to each of the 7+ authenticated roles (Owner, Manager, Storekeeper, Receptionist, Laser, CNC, Plotter, Printer).
- [x] **Centralized Reorder Warning System**: Proactive multi-role stockout alerts warning staff when central store units cross reorder thresholds (`quantity <= reorderAt`).
- [x] **Strict Direct Stock-Out Controls**: Direct exception stock-outs enforce valid business reasons (`Sample Print`, `Minor Repair`, `Test Cut`, `Internal Maintenance`), mandatory admin PIN verification, and ETB threshold limits.
- [x] **Design System Rules**: 100% adherence to semantic CSS variables (`var(--surface)`, `var(--ink)`, `var(--line)`, `var(--navy)`, `var(--cyan)`) with zero arbitrary hardcoded hex or non-semantic Tailwind values.

---

## 7. Development & Verification Commands

Use the locked package manager and run the complete validation set before committing or deploying:

```bash
# 1. Install locked dependencies
pnpm install --frozen-lockfile

# 2. Run unit & ERP calculation test suite
pnpm test

# 3. Static typecheck (zero TypeScript errors)
pnpm check

# 4. Production Next.js 16.3.3 Turbopack build
NODE_ENV=production pnpm build
```

`pnpm test` runs Vitest, `pnpm check` runs TypeScript without emitting files, and the production build validates Next.js compilation, type checking, route generation, and bundle creation.

## Backend rules

All persistent operations must be performed through Convex handlers rather than the legacy in-memory helpers. Backend mutations enforce active application profiles and role permissions. Owners oversee all operations and company branding; owners, managers, and legacy administrators manage team access; owners, managers, and storekeepers manage inventory and job cards; assigned operators can record production for their machines. Notifications are targeted by recipient and update reactively through Convex subscriptions. The normal material flow remains `Requested → Issued/Partially Issued → Received` without mandatory routine approval or signatures.

Stock-in converts the selected purchase unit into the material’s normalized base unit using `conversionRatio` before updating inventory and recording both entered and normalized quantities. Production logging consumes base units directly, inserts a `productionLogs` record, and creates a corresponding stock-movement audit row. Standard job completion derives material allocation from persisted dimensions, BOM requirements, configured margin, and scrap allowance before releasing the machine. Ink is deducted with mL precision; solvents remain periodic adjustments. Scrap records deduct stock and create an auditable outbound movement. Reusable square-meter offcuts increase material stock and create an `offcut_return` movement.

Each raw-material entity may also define a canonical specification family, a selected specification value, and a strict option list. The current catalog covers Neon Light colors, Banner roll weight/size, Foam and Acrylic thickness, Mica Sheet finish, Canvas roll width/type, Machine Ink type/color configuration, Power Supply wattage, LED Module / Strip colors, and Zocolo height. These definitions are centralized in `src/shared/material-specifications.ts` and are enforced by both the material form and the Convex create validator.

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Public Convex cloud URL used by the browser client. |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex site URL used by the Better Auth Next.js integration. |
| `NEXT_PUBLIC_APP_URL` | Public application base URL. |
| `TELEGRAM_BOT_TOKEN` | Token for the grammY Telegram bot. |
| `TELEGRAM_RECEPTION_CHAT_ID` | Chat ID for receptionist Telegram alerts. |
| `TELEGRAM_OWNER_CHAT_ID` | Chat ID for owner Telegram alerts. |
| `TELEGRAM_ALERT_CHAT_ID` | Chat ID for general alert notifications. |
| `TELEGRAM_WEBHOOK_SECRET` | Secret used to secure the Telegram webhook. |
| `BETTER_AUTH_SECRET` | Secret configured in the Convex deployment for Better Auth. |
| `SITE_URL` | Application site URL configured in the Convex deployment. |
| `GOOGLE_CLIENT_ID` | Optional Google OAuth client ID for sign-in and account linking. |
| `GOOGLE_CLIENT_SECRET` | Optional Google OAuth client secret for sign-in and account linking. |

Do not commit `.env.local` or deployment secrets. Keep `.env.example` limited to variable names and safe documentation.

## Desktop shell (Tauri v2)

The web client can be wrapped as a cross-platform native desktop app with the Tauri v2 shell in `src-tauri/`, loaded via `@tauri-apps/api` and `@tauri-apps/plugin-updater`. The shell loads `http://localhost:3000` in development (window 1280×800 min). `src/components/auto-updater.tsx` is a root-mounted background updater that no-ops outside a Tauri WebView; `src/lib/desktop.ts` exposes `printNative()` and `isDesktopShell()` used by the receptionist receipt-print flow. Desktop scripts (`pnpm tauri:dev`, `pnpm tauri:build`) require the Rust toolchain.

## 8. Role Workspace Route Matrix

Each authenticated role is routed to its role-specific workspace landing (`ROLE_HOME_ROUTE` in `src/lib/role-routing.ts`), enforced by the `src/proxy.ts` edge interceptor:

| Role | Landing route |
|---|---|
| Owner / Admin | `/dashboard/owner` |
| Manager | `/dashboard/manager` |
| Storekeeper | `/dashboard/storekeeper` |
| Receptionist | `/dashboard/receptionist` |
| Laser operator | `/dashboard/operator/laser` |
| CNC operator | `/dashboard/operator/cnc` |
| Plotter operator | `/dashboard/operator/plotter` |
| Printer operator | `/dashboard/operator/printer` |

Workspace routing is defined in `src/lib/role-routing.ts` (`ROUTE_CONTRACTS`), dashboard navigation in `src/components/dashboard/nav-config.ts`, and workspace composition in `src/components/dashboard/workspace-registry.ts`.

The requirement-based seed creates the verified company, machine, and material master data with catalog families, physical dimensions, machine associations, and conversion metadata without inventing operational history. `migrateYtAdvertisementMasterData` updates existing master records without changing quantities or activity. The next product-level improvements are Convex integration tests for authorization and notification targeting, a production Google OAuth configuration, image upload storage for company logos instead of URL-only branding, and continuous integration for the verification commands.
