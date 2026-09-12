# YT Advertisement seed-data and conversion note

## Purpose

The requirement-based seed provides a safe starting point for the YT Advertisement operations workspace. It loads confirmed and captured **master data only**: company settings, workshop machines, materials, and non-authenticated staff responsibility records.

> The seed does not claim to represent historical operations. It creates no jobs, stock movements, material requests, production logs, offcuts, scraps, or fake Better Auth users.

## Seeded records

| Record type | Count | Source treatment |
|---|---:|---|
| Company settings | 1 | YT Advertisement identity, address, phone, and reporting preferences |
| Machines | 8 | Captured workshop equipment with revised models and capabilities |
| Materials | 26 | Captured requirement list with dual-unit metadata |
| Staff responsibility records | 12 | Eleven captured staff-context records plus Yitbarek’s owner-context record |
| Operational history | 0 | Deliberately excluded because no verified historical activity was supplied |

The administrator-protected Convex mutation is `seedYtAdvertisementWorkspace` in `convex/seed.ts`. It is idempotent using the `companySettings` key `yt-advertisement` and refuses to mix with existing operational data unless the explicit force/reset path is used.

For an existing seeded workspace, use `migrateYtAdvertisementMasterData`. It matches machines by provisional code and materials by name, applies the revised master fields, inserts missing master records with zero balances, and preserves existing quantities, reorder levels, stock movements, jobs, production logs, requests, offcuts, and scraps.

The separate `seedYitbarekOwner` mutation creates or promotes the real confirmed owner account at `ytadvert@admin.org`. Its temporary password is accepted only at runtime and is never stored in source, returned, or documented. Change it immediately after first sign-in.

## Machines

The seed includes the following six confirmed production machines. The manufacturer `Crystal` is set for the Crystal Jet, Crystc Eco-Solvent, Ricoh Flatbed UV, and DTF machines.

| Machine | Seed code | Manufacturer | Model | Capability | Base/display unit | Operator role |
|---|---|---|---|---|---|---|
| Crystal Jet 7K Series | `CJ7K-01` | Crystal | `3.2m Eco-Solvent / Solvent Printer` | `3.2m Print Width` | `m²` | `crystal_jet_operator` |
| Crystc Eco-Solvent Printer | `CESP-01` | Crystal | `1.6m Print & Cut Plotter` | `1.6m Print Width` | `m²` | `crystek_operator` |
| Ricoh Flatbed UV Machine | `RUV-01` | Crystal | `Industrial UV Flatbed` | `Direct-to-Rigid Board` | `m²` | `ricoh_uv_operator` |
| DTF i3200 | `DTF-01` | Crystal | `60cm Roll-to-Roll DTF` | `0.60m DTF Film Printing` | `m` | `dtf_operator` |
| Laser Cutter 1325 | `LAS-01` | Not supplied | `1300mm x 2500mm CO2 Laser` | `1.22m x 2.44m Standard Board` | `m²` | `laser_operator` |
| CNC Router 2030 | `CNC-01` | Not supplied | `2000mm x 3000mm Heavy Duty` | `2.0m x 3.0m Bed Size` | `m²` | `cnc_operator` |

The seed initializes all machines as `Available` and active because no historical operating or maintenance status was supplied. The codes are provisional application identifiers, not manufacturer serial numbers. Exact serial numbers, maintenance data, and final staff assignments remain onboarding tasks.

## Dual-unit inventory model

The revised inventory model separates the unit used when purchasing or receiving stock from the normalized unit used by production and accounting:

| Field | Meaning |
|---|---|
| `purchaseUnit` | `roll`, `sheet`, `pack`, `liter`, or `piece`; used by the storekeeper during stock-in |
| `baseUnit` | `m²`, `m`, `L`, or `pcs`; used for balances, production consumption, and reporting |
| `conversionRatio` | Multiplier that converts one purchase unit into the base unit |
| `displayUnit` | Original workshop wording such as `ሮል`, `ቁጥር`, or `ሊትር` |
| `quantity` | Current balance in the normalized base unit |

For example, receiving two Banner rolls applies `2 × 160 = 320 m²` to the material balance. Receiving three LED packs applies `3 × 20 = 60 pcs`. Production consumption is entered and deducted directly in the material’s base unit.

### Confirmed conversion rules

| Material group | Purchase unit | Base unit | Ratio | Physical basis |
|---|---|---|---:|---|
| Banner | `roll` | `m²` | 160 | `3.2m × 50m` |
| DTF Film | `roll` | `m` | 100 | `0.60m × 100m`; running metres |
| Acrylic | `sheet` | `m²` | 2.977 | `1.22m × 2.44m` |
| Normal/Frosted/Transparent/Reflective/Mush Sticker | `roll` | `m²` | 63.5 | `1.27m × 50m` |
| Canvas | `roll` | `m²` | 45.6 | `1.52m × 30m` |
| Foam board | `sheet` | `m²` | 2.977 | `1.22m × 2.44m` |
| LED | `pack` | `pcs` | 20 | Pack of 20 modules |
| Neon Light | `roll` | `m` | 5 | Roll of 5m |
| Inks | `liter` | `L` | 1 | Direct litre count |
| Mica, Power Supply, finished/display components | `piece` | `piece` or `pcs` | 1 | Direct piece count |

### Material records

| Material | Category | Purchase unit | Base unit | Ratio | Display label | Note |
|---|---|---|---|---:|---|---|
| Banner | Banner | `roll` | `m²` | 160 | `ሮል` | 3.2m × 50m |
| DTF Film | Film | `roll` | `m` | 100 | `ሮል` | Store; customer-requirement usage note |
| Acrylic | Rigid sheet | `sheet` | `m²` | 2.977 | `ቁጥር` | 1.22m × 2.44m |
| DTF Ink | Ink | `liter` | `L` | 1 | `ሊትር` | Direct count |
| Banner Ink | Ink | `liter` | `L` | 1 | `ሊትር` | Direct count |
| Print and Cut INK | Ink | `liter` | `L` | 1 | `ሊትር` | Direct count |
| UV Flat bed Ink | Ink | `liter` | `L` | 1 | `ሊትር` | Direct count |
| LED Module / Strip | Electrical | `pack` | `pcs` | 20 | `ቁጥር` | Pack of 20; color options are defined in the structured specification catalog |
| Normal Sticker | Sticker roll | `roll` | `m²` | 63.5 | `ሮል` | 1.27m × 50m |
| Frosted Sticker | Sticker roll | `roll` | `m²` | 63.5 | `ሮል` | 1.27m × 50m |
| Transparent Sticker | Sticker roll | `roll` | `m²` | 63.5 | `ሮል` | 1.27m × 50m |
| Reflective Sticker | Sticker roll | `roll` | `m²` | 63.5 | `ሮል` | 1.27m × 50m |
| Mush Sticker | Sticker roll | `roll` | `m²` | 63.5 | `ሮል` | Source name retained; supplied prompt calls this Mesh in the rule description |
| Mica Sheet | Rigid sheet | `piece` | `pcs` | 1 | `ቁጥር` | Color/finish options are defined in the structured specification catalog |
| PVC Film | Film | `roll` | `m²` | — | `ሮል` | Roll dimensions not confirmed; stock-in roll conversion is intentionally blocked |
| Canvas (Canva) | Fabric roll | `roll` | `m²` | 45.6 | `ሮል` | 1.52m × 30m; width/type options are defined in the structured specification catalog |
| Neon Light | Electrical | `roll` | `m` | 5 | `ሜትር` | Roll of 5m |
| Power Supply | Electrical | `piece` | `pcs` | 1 | `ቁጥር` | Direct count |
| Foam | Foam board | `sheet` | `m²` | 2.977 | `ቁጥር` | 1.22m × 2.44m |
| AMIR | Finished component | `piece` | `pcs` | 1 | `ቁጥር` | Direct count |
| ROLE UP DELUX | Finished component | `piece` | `pcs` | 1 | `ቁጥር` | Direct count |
| ROLE UP STANDARD | Finished component | `piece` | `pcs` | 1 | `ቁጥር` | Direct count |
| VINNER | Finished component | `piece` | `pcs` | 1 | `ቁጥር` | Direct count |
| Zocolo (Base / Skirting) | Finished component | `piece` | `pcs` | 1 | `ቁጥር` | Height options: 8 cm or 6 cm |
| LED LIGHT BOX A1 | Display hardware | `piece` | `pcs` | 1 | `ቁጥር` | Direct count |
| LED LIGHT BOX A2 | Display hardware | `piece` | `pcs` | 1 | `ቁጥር` | Direct count |

All requirement-seed material balances and reorder thresholds remain `0`. These are neutral placeholders, not claims about physical stock. The storekeeper must enter verified opening balances and reorder thresholds before live stock control.

## Staff handling and ownership

The seed stores staff as business-context records. It does not automatically create Better Auth accounts for every person named in the original capture.

| Person | Context/role | Current seed treatment |
|---|---|---|
| Yitbarek | Owner | `owner` context; linked to the real owner account after bootstrap |
| Yordanos | Manager / management | `manager` application-role context |
| Zewuditu | Storekeeper | `storekeeper` application-role context |
| Debas Melaku | Print and Cut operator | `crystek_operator` application-role context |
| Surafel | UV Flatbed operator | `ricoh_uv_operator` application-role context |
| Samuel Gete | Banner machine operator | `crystal_jet_operator` application-role context |
| Addisu | CNC and Laser operator | Both `cnc_operator` and `laser_operator` application-role context |
| Niguse, abriham, haymanot, Yohannes | Relief coordination/staff | Business context only; final application role pending |
| Emebet | Direct sales / customer services | Business context only; dedicated customer-service role pending |

Application accounts must be created through Better Auth and then assigned by the owner or delegated manager. The owner can assign/revoke roles and activate/deactivate profiles; a manager may manage delegated team access but cannot assign or modify the owner role.

## Workflow boundaries

The normal material workflow remains:

```text
Requested → Issued / Partially Issued → Received
```

`Short Stock` and `Discrepancy` remain exception states. Normal material issues do not require mandatory approval, digital signature, or recipient-signature evidence.

Operators may log reusable offcuts with dimensions and a location. A reusable offcut returns its area to base-unit inventory separately from scrap. Scrap decreases base-unit inventory and records a reason.

## Post-seed onboarding checklist

Before using the workspace for live stock control:

1. Run the requirement seed only in the intended development or clean deployment.
2. If the workspace was already seeded, run the non-destructive master-data migration instead of resetting operational records.
3. Verify each machine code, exact serial/model details, final manufacturer, and operator assignment.
4. Confirm the interpretation of the Conca equipment and whether its paper-work description is complete.
5. Verify the DTF production unit choice (`m` versus `m²`) with the workshop; the current prompt maps DTF Film to running metres.
6. Verify PVC Film roll dimensions before enabling roll stock-in for that material.
7. Confirm storage locations, opening balances, reorder thresholds, average-use guidance, and scrap rules for every material.
8. Create real staff accounts through Better Auth and assign application roles from the owner controls.
9. Configure Google OAuth credentials only if Google sign-in/linking is required.
10. Exercise stock-in with a test Banner roll, LED pack, rigid sheet, and DTF Film roll, then verify the resulting base balances.

## Running and validating

The normal local verification sequence is:

```bash
pnpm test
pnpm check
NODE_ENV=production pnpm build
git diff --check
```

The requirement seed and migration mutations are exposed from `convex/seed.ts`. Authenticated Convex deployment access is required to run them against the remote deployment. Never place deployment secrets, access keys, session identifiers, or passwords in Git, source code, seed data, or documentation.

## Structured material specifications

The material seed now persists `specification`, `specificationOptions`, and an optional `specificationValue`. The material creation form uses the same catalog and the Convex create mutation validates selected values against the canonical options.

| Material | Specification | Standard options |
|---|---|---|
| Neon Light | Color Type | White (Warm White, Cool White), Red, Blue, Green, Yellow, Orange, Pink, Purple, RGB (Color-Changing), Neon Spot/Fluorescent Tones (Pink, Yellow, Orange, Green) |
| Banner | Roll Weight & Size | 2 Meter Roll Weight; 3 Meter Roll Weight |
| Foam | Thickness / Size (in millimeters) | 18mm; 10mm; 8mm; 5mm; 3mm |
| Mica Sheet | Color Type / Finish | White; Black; Red; Blue; Green; Yellow; Clear/Transparent; Translucent; Silver Metallic; Gold Metallic; Mirror/Frosted |
| Acrylic | Thickness (in millimeters) | 18mm; 10mm; 8mm; 5mm; 3mm |
| Canvas (Canva) | Roll Width / Type (in meters) | 1.4 Meter; 1.0 Meter |
| Machine Ink records | Ink Type & Color Config | CMYK; Expanded Gamut / Light Inks; Specialty Inks; Eco-Solvent, Solvent, UV-Curing Ink, Sublimation Ink |
| Power Supply | Wattage | 60 Watt; 400 Watt |
| LED Module / Strip | Color Type | Cool White (6000K-6500K); Warm White (3000K); Red; Green; Blue; Yellow; Amber; RGB (Multi-Color); RGBW |
| Zocolo (Base / Skirting) | Height (in centimeters) | 8 cm; 6 cm |

The canonical definitions live in `src/shared/material-specifications.ts`. Earlier names such as `LED`, `Mica`, `Canvas`, and `ZOCOLO` are treated as migration aliases and are normalized to the new canonical names. PVC Film intentionally has no conversion ratio until its physical roll dimensions are verified.

## Applying the revised master data

For a fresh workspace, run `seedYtAdvertisementWorkspace`. For an already seeded workspace with operational records, run `migrateYtAdvertisementMasterData`; this updates material definitions by canonical name or known alias without deleting history, changing current balances, or creating historical movements. Verify the selected specification variant with the storekeeper before live stock receipts.
