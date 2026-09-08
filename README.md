# YT Advertising Operations Control & ERP System Architecture

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

# 2. Run unit & ERP calculation test suite (51 passing tests)
pnpm test

# 3. Static typecheck (zero TypeScript errors)
pnpm check

# 4. Production Next.js 16.3.3 Turbopack build
NODE_ENV=production pnpm build
```

---

## 8. Role Workspace Route Matrix

| System Role | Landing Route | Authorized Sub-Routes | Primary Functionality |
|---|---|---|---|
| **Owner** | `/dashboard/owner` | All routes + Financials | Executive KPIs, ETB revenue, reconciliation approvals, audit ledger |
| **Manager** | `/dashboard/manager` | `/dashboard/manager`, `/inventory/*`, `/orders`, `/reports` | Fleet dispatch, throughput monitoring, operational oversight |
| **Storekeeper** | `/dashboard/storekeeper` | `/inventory/parent`, `/dashboard/storekeeper` | Central store custody strictly in packaging units (`ROLLS`, `SHEETS`, `CANISTERS`) |
| **Receptionist** | `/dashboard/reception` | `/orders`, `/dashboard/reception` | Order intake, payment verification, Telegram dispatch (zero POS invoice buttons) |
| **Laser Operator** | `/dashboard/operator/laser` | `/inventory/substock`, workstation | CO2 laser queue, Mica and Foam Board cutting telemetry |
| **CNC Operator** | `/dashboard/operator/cnc` | `/inventory/substock`, workstation | Heavy router queue, Cladding and Foam 3D engraving telemetry |
| **Plotter Operator** | `/dashboard/operator/plotter`| `/inventory/substock`, workstation | Crystc Eco-Solvent sticker print & cut queue |
| **Printer Operator** | `/dashboard/operator/printer`| `/inventory/substock`, workstation | Crystal Jet banner, Ricoh UV, and DTF textile queues |
