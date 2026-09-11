# YT Advertising Operations Control

YT Advertising Operations Control is an enterprise-grade, Amharic-first ERP and factory operations platform tailored for commercial advertising and large-format print manufacturing. It synchronizes raw materials, machine assignments, job cards, floor production telemetry, reusable off-cuts, unusable scrap, and two-tier event-sourced inventory movements in a single transactional workflow.

The platform is built on **Next.js 16 App Router** (with edge request interception via `src/proxy.ts`), **Convex** for real-time reactive persistence and ACID transactions, **Better Auth** for email/password authentication with optional Google OAuth, and **Tauri v2** for a cross-platform desktop shell.

---

## 1. System Architecture Overview

```
                          ┌─────────────────────────────┐
                          │   Next.js 16 App Router     │
                          │  (Edge Guard: src/proxy.ts) │
                          └──────────────┬──────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     ┌──────────────────────┐                        ┌──────────────────────┐
     │  Role-Gated Routes   │                        │  Telegram Bot / Mini │
     │ (/dashboard/*, etc.) │                        │  App Customer Portal │
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

### Core Architecture Highlights

- **Edge Role Routing**: `src/proxy.ts` inspects session state at the network edge and enforces strict role landing pages without flash-of-unauthorized-content.
- **ACID Financial & Stock Ledger**: All material deductions, transfers, returns, and scrap events run inside Convex transactions and append to `stockMovements` and `orderEvents`.
- **Two-Tier Inventory**: Bulk whole units (rolls, sheets, canisters) stay under Storekeeper custody (`parentInventory`), while operational floor quantities (`operatorSubStock`) are tracked in base metric units (`m²`, `m`, `L`).
- **Telegram Native Integration**: Embedded Telegram Mini App portal for customer self-service intake, live order tracking, and payment instruction workflows with HMAC-SHA256 authenticated verification.

---

## 2. Role Workspace Route Matrix

Each authenticated role is automatically routed to its dedicated workspace landing route, defined in `src/lib/role-routing.ts` (`ROUTE_CONTRACTS`), configured in `src/components/dashboard/nav-config.ts`, and rendered via `src/components/dashboard/workspace-registry.ts`:

| Role | Landing Route | Key Capabilities |
|---|---|---|
| **Owner / Admin** | `/dashboard/owner` | Loss-prevention metrics, company settings, operational policy configuration, user role delegation, and audit trails. |
| **Manager** | `/dashboard/manager` | Operations overview, production throughput, staff delegation, and exception approvals. |
| **Storekeeper** | `/dashboard/storekeeper` | Central warehouse inventory, stock-in conversions, material request fulfillment, and reorder alerts. |
| **Receptionist** | `/dashboard/receptionist` | Order review locking, pricing approval, advance payment / credit confirmation, and automated dispatch. |
| **Laser Operator** | `/dashboard/operator/laser` | CO2 laser cutting and engraving job queues (Mica, Foam Board), machine timers, and production logging. |
| **CNC Operator** | `/dashboard/operator/cnc` | 3-axis CNC router job queues (Foam Board, Cladding, MDF), toolpath monitoring, and floor consumption. |
| **Plotter Operator** | `/dashboard/operator/plotter` | Eco-solvent print & cut sticker jobs (Frosted, Transparent, Reflective media), blade calibration, and log entries. |
| **Printer Operator** | `/dashboard/operator/printer` | Large-format solvent banner and roll printing (Crystal Jet), UV flatbed, and DTF textile runs. |

---

## 3. Customer Onboarding & Order Lifecycle

The Telegram Mini App portal (`src/components/public/mini-app/`) provides an interactive customer experience:

1. **Guided Multi-Step Wizard (`OrderWizard`)**:
   - **Phone Verification & Profile**: Validates Ethiopian phone formats (`09...`, `07...`, `+2519...`) with Telegram verification binding.
   - **Account Type Classification**: Distinguishes `individual`, `corporate`, and `government` accounts.
   - **Conditional Business Verification**: Automatically skips TIN/Company fields for individuals, while enforcing a verified legal entity name and a 10-digit TIN for Corporate and Government accounts.
   - **Catalog-Driven Service Picker**: Dynamically loads services across Large Format Printing, Signage & Displays, Flatbed UV, CNC & Laser, and Textile/DTF.
   - **Service Specifications**: Dynamically renders and validates material options against canonical specifications (roll sizes, mica thicknesses, LED modules, power supply wattages).
   - **Metric Dimensions & Presets**: Live area calculation (`m²`), quantity stepper, and quick dimension presets (`1m × 1m`, `1.5m × 2m`, `2m × 3m`, `3m × 5m`, `A1`, `RollUp`).
   - **Artwork Upload & Notes**: Uploads customer files directly to secure Convex file storage.
2. **Review Lock & Concurrency Control**:
   - **Customer Self-Service Editing**: Customers can update pending orders from the "My Orders" tab.
   - **Atomic Review Lock**: When Reception opens an order for review, `lockOrderForReview` executes atomically, locking the order and preventing stale customer edits.
   - **Optimistic Concurrency**: `updateCustomerOrder` requires the active `editRevision` number to eliminate race conditions.
   - **Immutable Event Log**: State transitions, locks, and edits append immutable audit records to `orderEvents`.

---

## 4. Verified Materials Catalog (23 Categories across 4 Base Units)

All materials carry validated purchase units, normalized metric base units, conversion ratios, and physical dimensions in `src/shared/material-specifications.ts`:

### 1. Roll Materials (Calculated in m² or Running Metres)

| Material Name | Purchase Unit | Base Unit | Conversion Ratio | Verified Dimensions & Specifications | Primary Machine |
|---|---|---|---|---|---|
| **Banner Flex** | `roll` | `m²` | 160 / 103.5 | 3.2m × 50m (160 m²), 2.07m × 50m (103.5 m²) | Crystal Jet 7K Series |
| **Frosted Sticker** | `roll` | `m²` | 60 | 1.2m × 50m (60 m²) | Crystc Eco-Solvent |
| **Mesh Sticker** | `roll` | `m²` | 76 / 60 | 1.52m × 50m (76 m²), 1.2m × 50m (60 m²) | Crystal Jet 7K Series |
| **Transparent Sticker** | `roll` | `m²` | 76 / 53.5 | 1.52m × 50m (76 m²), 1.07m × 50m (53.5 m²) | Crystc Eco-Solvent |
| **Reflective Sticker** | `roll` | `m²` | 76 / 53.5 | 1.52m × 50m (76 m²), 1.07m × 50m (53.5 m²) | Crystc Eco-Solvent |
| **DTF Film** | `roll` | `m` | 100 | 60cm × 100m roll (linear running meters) | DTF i3200 |
| **Canvas** | `roll` | `m²` | 45 / 75 / 30 / 50 | 1.50m × 30m, 1.50m × 50m, 1m × 30m, 1m × 50m | Ricoh Flatbed UV |

### 2. Rigid Sheets (1.22m × 2.44m = 2.977 m² Footprint)

| Material Name | Purchase Unit | Base Unit | Standard Sheet Size | Available Thicknesses & Variants | Primary Machines |
|---|---|---|---|---|---|
| **Mica** | `sheet` | `m²` | 1.22m × 2.44m | 3mm, 5mm, 8mm, 10mm, 18mm · Colors: White, Red, Black, Blue Light, Blue Dark, Lemmen, Green, Yellow, Orange, Golden, Transparent | Ricoh Flatbed UV, Laser Cutter |
| **Cladding** | `sheet` | `m²` | 1.22m × 2.44m | White, Gray, Black | Ricoh Flatbed UV, CNC Router |
| **Foam Board** | `sheet` | `m²` | 1.22m × 2.44m | 3mm, 5mm, 10mm, 15mm, 18mm | Ricoh Flatbed UV, CNC Router, Laser Cutter |

### 3. Inks & Solvents (Calculated in Liters / Canisters)

| Consumable Name | Packaging Unit | Base Unit | Canister Volume | Associated Equipment | Deduction Policy |
|---|---|---|---|---|---|
| **Banner Ink 5L** | `canister` | `L` | 5 Liters (Black, Blue, Red, Yellow) | Crystal Jet 7K Series | **Synchronous per printed job** |
| **DTF Ink 1L** | `canister` | `L` | 1 Liter (White, Yellow, Black, Blue, Red) | DTF i3200 | **Synchronous per printed job** |
| **Print & Cut Ink 1L** | `canister` | `L` | 1 Liter (Red, Blue, Black, Yellow) | Crystc Eco-Solvent | **Synchronous per printed job** |
| **UV Ink 1L** | `canister` | `L` | 1 Liter (Red, Blue, Black, Yellow, White) | Ricoh Flatbed UV | **Synchronous per printed job** |
| **Solvents** | `canister` | `L` | 1L & 5L (Banner, DTF, P&C) | Chemical Store | **Excluded from per-job deduction; audited periodically** |

### 4. Hardware & Signage Accessories

| Hardware Component | Base Unit | Packaging & Specifications | Application |
|---|---|---|---|
| **Power Supply** | `pcs` | 60W, 100W, 200W, 400W | LED signs and illuminated channel letters |
| **Digital Screen** | `pcs` | A1 (594 × 841 mm), A2 (420 × 594 mm) | Backlit ultra-slim advertising displays |
| **LED Modules** | `pcs` | Pack of 20 (White, Warm, Yellow, Red, Blue, Green) | Channel letter backlighting |
| **Zecolo** | `pcs` / `m` | 6cm, 8cm height profile | Architectural skirting & base structures |
| **Neon Light Flex** | `m` | 5m rolls (White, Warm, Yellow, Red, Blue, Green, Ice Blue, Pink) | Neon typography and artistic accents |
| **Electric Wire** | `m` | 100m rolls (1.5mm Standard, 2.5mm Heavy Duty) | Low-voltage and mains wiring |
| **T-Shirts** | `pcs` | 100% Cotton (S, M, L, XL, XXL) | DTF textile apparel branding |
| **Amire** | `pcs` | Packets of 250 pieces | Heavy-duty structural rivets |
| **Roll-Up Stands** | `pcs` | Standard & Deluxe base models | Portable trade exhibition banners |

---

## 5. Automated Machine Routing & Dispatch Engine

Manual resource selection is removed from the Receptionist flow to guarantee consistent production:

1. **Deterministic Service Routing**:
   Upon advance payment confirmation (`ADVANCE_PAID` or `APPROVED_CREDIT`), `confirmOrderAndIssueJobCard` passes the service through `SERVICE_ROUTING_MAP` to resolve the machine and material family.
2. **Deterministic Scrap & Off-Cut Calculation (`src/shared/material-calc.ts`)**:
   - **Roll Stock**:
     - Gross deduction: $\text{grossArea} = \text{rollWidth} \times \text{jobLength} \times \text{quantity}$
     - Net product: $\text{netArea} = \text{jobWidth} \times \text{jobLength} \times \text{quantity}$
     - Unused side strip: $(\text{rollWidth} - \text{jobWidth}) \times \text{jobLength} \times \text{quantity}$
     - Strip $\ge 0.3\,\text{m}$ wide is registered as **usable off-cut** (`OFFCUT_RETURN`).
     - Strip $< 0.3\,\text{m}$ wide is classified as **scrap** (`SCRAP_LOG`).
     - Owner-configured setup bleed margin is added to scrap.
   - **Rigid Sheets**:
     - Computes the minimum whole sheets needed (`sheetsNeeded`), calculates the remaining contiguous rectangular off-cut, and classifies unusable remnants as scrap.
3. **Atomic Production Snapshot**:
   The Job Card stores `grossDeductedQuantity`, `netProductArea`, `offcutArea`, `scrapArea`, `scrapPercentage`, and customer `specifications`. The inventory reservation and ledger events execute within the same atomic mutation.

---

## 6. Development & Verification Workflow

This repository enforces strict verification checks. Always run the full validation set before committing:

```bash
# 1. Install locked dependencies
pnpm install --frozen-lockfile

# 2. Run unit and ERP calculation test suite (Vitest)
pnpm test

# 3. Static type check (TypeScript compiler without emitting files)
pnpm check

# 4. Production Next.js build
NODE_ENV=production pnpm build
```

---

## 7. Desktop Shell (Tauri v2)

The web application is packaged for cross-platform desktop usage via Tauri v2 in `src-tauri/`:

- **Desktop Shell Detection**: `src/lib/desktop.ts` provides `isDesktopShell()` to detect the native Tauri runtime environment.
- **Auto-Updater**: `src/components/auto-updater.tsx` checks `@tauri-apps/plugin-updater` and notifies users of updates without blocking web clients.
- **Commands**:
  ```bash
  pnpm tauri:dev   # Launch Next.js dev server + native desktop window
  pnpm tauri:build # Produce production native desktop installer
  ```

---

## 8. Documentation Directory

Detailed technical and operational references are maintained under [`docs/`](./docs/README.md):

| Documentation Link | Scope & Topic |
|---|---|
| [System Architecture](./docs/architecture.md) | Database schema, inventory ledger, and integration contracts. |
| [Operational Workflows](./docs/workflows.md) | Order journeys, status progression, payment gates, and notification pipelines. |
| [RBAC & Security Guide](./docs/rbac-security.md) | Role permissions matrix, Telegram HMAC validation, and ABAC policies. |
| [Owner Oversight & Loss Prevention](./docs/owner-oversight.md) | Floor clearance, ETB leakage monitoring, and executive controls. |
| [Owner Operational Configuration](./docs/owner-operational-configuration-plan.md) | Policy resolution, waste thresholds, and reorder alerts. |
| [Feature Implementation Plan](./docs/plan/newFeature.md) | Customer Onboarding Wizard, Review Lock, and Production Mapping. |
| [Role Dashboard UI/UX Plan](./docs/plan/dashboard-role-ui-ux-plan.md) | Multi-role workspace design, telemetry, and Amharic typography. |
| [Master Seed Data Specification](./docs/yt-advertisement-seed-data.md) | Official 23 materials, 6 machine records, and business parameters. |
| [Workspace Routing ADR](./docs/adr/0001-workspace-routing-architecture.md) | Architectural decision record for edge-intercepted role routing. |
| [Design System Tokens](./DESIGN_SYSTEM.md) | Visual language, semantic colors, surface tokens, and UI primitives. |
| [Developer Guidelines](./AGENTS.md) | Repository conventions, branch rules, and Convex best practices. |
