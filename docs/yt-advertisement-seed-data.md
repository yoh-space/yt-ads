# YT Advertisement seed-data note

## Purpose

The requirement-based seed provides a safe starting point for the YT Advertisement operations workspace. It loads confirmed and captured **master data only**: company settings, workshop machines, materials, and non-authenticated staff responsibility records.

> The seed does not claim to represent historical operations. It creates no jobs, stock movements, material requests, production logs, offcuts, scraps, or fake Better Auth users.

## Seeded records

| Record type | Count | Source treatment |
|---|---:|---|
| Company settings | 1 | YT Advertisement identity and reporting preferences captured from the workspace requirements |
| Machines | 8 | Captured workshop equipment; four Crystal machines explicitly confirmed by the user |
| Materials | 26 | Captured requirement list |
| Staff responsibility records | 12 | Eleven captured staff-context records plus Yitbarek’s owner-context record |
| Operational history | 0 | Deliberately excluded because no verified historical activity was supplied |

The administrator-only Convex mutation is `seedYtAdvertisementWorkspace` in `convex/seed.ts`. It is idempotent using the `companySettings` key `yt-advertisement`. It also refuses to seed when operational tables already contain data, so it cannot silently mix the requirement dataset with the older demo dataset. The separate `seedYitbarekOwner` mutation creates or promotes the real confirmed owner account at `ytadvert@admin.org`; its temporary password is accepted only at invocation time and is never stored in source, returned, or documented.

## Machines

The seed includes **Banner Printer**, **DTF**, **Print and Cut**, **CNC Router**, **Laser Cutter 1325**, **Heat press**, **Conca**, and **UV Flat bed**. The manufacturer `Crystal` is set only for the four confirmed machines: Print and Cut, DTF, Laser Cutter 1325, and UV Flat bed. The captured capabilities are retained for DTF (`0.6m`) and Laser Cutter 1325 (`1.20 × 2.44m`).

The application currently supports operator roles for laser, CNC, plotter, and printer operators. Therefore, Print and Cut is mapped temporarily to `plotter_operator`, while DTF and UV Flat bed are mapped to `printer_operator`. Heat press and Conca use compatible temporary defaults and are marked with configuration notes; their final operator mapping should be confirmed during onboarding.

The machine codes are provisional seed identifiers, not claimed manufacturer serial numbers:

| Machine | Seed code | Temporary mapping or note |
|---|---|---|
| Banner Printer | `BAN-01` | Printer operator; captured size context is 3m |
| DTF | `DTF-01` | Crystal; 0.6m capability |
| Print and Cut | `PAC-01` | Crystal; temporary plotter-operator mapping |
| CNC Router | `CNC-01` | CNC operator |
| Laser Cutter 1325 | `LAS-01` | Crystal; 1.20 × 2.44m capability |
| Heat press | `HPR-01` | Configuration pending; piece-oriented display unit |
| Conca | `CON-01` | Configuration pending; captured paper-work note |
| UV Flat bed | `UVF-01` | Crystal; temporary printer-operator mapping |

## Materials and unit policy

The seed includes the captured list: Banner, DTF Film, Acrylic, DTF Ink, Banner Ink, Print and Cut INK, UV Flat bed Ink, LED, Normal Sticker, Frosted Sticker, Transparent Sticker, Reflective Sticker, Mush Sticker, Mica, PVC Film, Canvas, Neon Light, Power Supply, Foam, AMIR, ROLE UP DELUX, ROLE UP STANDARD, VINNER, ZOCOLO, LED LIGHT BOX A1, and LED LIGHT BOX A2.

The current schema does not have a native `roll` base unit and no roll-length conversion was confirmed. The seed therefore preserves the captured Amharic display label `ሮል` and tracks roll-style materials using a conservative base unit without inventing a conversion. In particular, sticker, film, canvas, banner, and DTF Film records use `m²` for the application base-unit compatibility, but their opening quantity is `0` and their display unit remains `ሮል`. Operators must confirm the actual stock-counting method and conversion before entering live balances.

| Captured unit label | Seed treatment |
|---|---|
| `ሮል` | Preserved as `displayUnit`; no roll-length or area conversion is seeded |
| `ቁጥር` | Mapped to `piece` |
| `ሊትር` | Mapped to `L` |
| `ሜትር` | Mapped to `m`; used for Neon Light |

Acrylic and Mica are tracked as pieces because the captured requirement used `ቁጥር`; actual sheet dimensions and area conversion remain an onboarding task. Finished components and electrical components are also tracked as pieces. No material receives an opening quantity, reorder threshold, average-use value, storage location, or scrap rule unless it was explicitly captured; the seed uses zero quantities and zero reorder thresholds as safe placeholders.

## Staff handling and ownership

The 12 staff records are business-context master data, with Yitbarek’s owner-context record linked to his real account when the owner bootstrap has run. They do not contain passwords, Better Auth identities, access keys, session identifiers, or deployment secrets. Yitbarek is the exception because the owner explicitly authorized a real owner-account bootstrap at `ytadvert@admin.org`; he should change the temporary password immediately after the first sign-in.

The `owner` role has full operational oversight, role assignment, profile revocation, and company-branding permissions. The owner can delegate team-access management to a `manager`; managers cannot assign or modify the owner role. Other staff should sign up through the normal authentication flow and then receive their application role from the owner or delegated manager.

The normal operator material workflow remains intentionally small: **Request → Issue → Received**, with `Short Stock` and `Discrepancy` available as exceptions. Normal requests do not require a mandatory approval, signature, or recipient-signature evidence step.

## Post-seed onboarding checklist

Before using the workspace for live stock control, an administrator should confirm each provisional machine code, final machine role, machine serial/model details, and the meaning of Conca. Store staff should then enter verified storage locations, opening balances, counting units, reorder rules, average-use guidance, and scrap rules for each material. Finally, real staff should sign in through Better Auth and receive application roles; the seeded staff context should not be converted automatically into accounts.

## Running the seed

Run the mutation from an authenticated administrator context after reviewing the deployment and backing up any existing data. If the database still contains the legacy demo dataset or other operational rows, the mutation will return a no-op safety response rather than mixing datasets. A reviewed migration or a clean development deployment is required before loading this requirement-based dataset.
