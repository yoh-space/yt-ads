# Owner-Confirmed Catalog vs Project Architecture

## Gap Analysis and Single-Source Remediation Plan

**Repository:** `yoh-space/yt-ads`  
**Latest synchronized commit:** `050c4919a71dbdd2663c93769d147e59e5427515`  
**Scope:** Machines, operator roles, services, raw materials, routing, inventory identity, and catalog drift.  
**Status:** Analysis only; no application source files were modified.

---

## 1. Executive Conclusion

The project does not currently have one authoritative source for machines, services, operator roles, capabilities, and material variants. It has several partially overlapping sources:

| Domain | Current sources |
|---|---|
| Services | `src/shared/services.ts`, Convex schema service union, database `materialTypeCatalog`, route catalogs, service BOMs |
| Machines | `src/shared/machine-catalog.ts`, `convex/seed.ts`, database `machines`, migration backfills, machine administration UI |
| Operator roles | `convex/users.ts`, `src/lib/operations-types.ts`, operator navigation, machine modal constants |
| Materials | `src/shared/material-specifications.ts`, database `materials`, seed records, legacy duplicate definitions, service BOMs |
| Routing | `src/shared/machine-catalog.ts`, `convex/orderAutomation.ts`, database `materialTypeCatalog`, `convex/bomResolver.ts`, service routing map |

This duplication explains why the number of confirmed machines, operator workspaces, service routes, and available materials can diverge.

The highest-risk issue is more serious than a simple count mismatch: the current routing system uses free-text capabilities and multiple route definitions. Correcting the earlier OR-to-AND compatibility bug without first normalizing capabilities could exclude every valid machine because the strings do not match exactly. For example, the route may require `3.2m Print Width`, while the machine catalog stores `3.2m Print Width · Heavy Duty Exterior Banner & Mesh`.

The project should first establish a **canonical production manifest** containing stable IDs for:

- Confirmed machines.
- Operator roles.
- Machine capabilities.
- Services.
- Material families and variants.
- Service-to-machine routes.
- Service-to-material recipes.

The database should store operational state and owner-approved configuration by stable ID. It should not become a second, silently divergent catalog.

---

# 2. Owner-Confirmed Machine Register

The owner confirmed six production machines:

| Owner machine | Confirmed primary work |
|---|---|
| Crystal Jet 7K Series | Banner and sticker |
| Crystc Eco-Solvent Printer | Sticker and gray-back printing |
| Recho Flatbed UV Machine | All applicable UV and flatbed printing |
| DTF I32 | T-shirt production |
| Laser Cut | Mica and foam |
| CNC Router | Foam, cladding, and MDF |

## 2.1 Current project machine catalog

The current `MACHINE_CATALOG` contains eight entries:

1. Crystal Jet 7K Series.
2. Crystc Eco-Solvent Printer.
3. Ricoh Flatbed UV Machine.
4. DTF i3200.
5. Laser Cutter.
6. CNC Router.
7. Pneumatic Heat Press.
8. Paper Guillotine Cutter.

The current project therefore has **eight catalog machines versus six owner-confirmed machines**. The last two are auxiliary equipment and should not be counted as confirmed production machines unless the Owner explicitly confirms them.

The seed path also creates only four machines in one demo seed flow, while migration and catalog flows can create additional records. This creates a second count mismatch between:

- The shared machine catalog.
- Seeded database records.
- Existing database rows.
- Active machines displayed by the UI.

## 2.2 Machine identity gaps

| Owner wording | Current wording | Risk |
|---|---|---|
| `Recho Flat bed UV Machine` | `Ricoh Flatbed UV Machine` | Name/model mismatch can create duplicate machine records. |
| `DTF I32` | `DTF i3200` | Business shorthand and catalog identity are not explicitly linked. |
| `Laser Cut` | `Laser Cutter` | Name matching depends on loose text rather than stable identity. |
| `Crystal Jet 7k Series` | `Crystal Jet 7K Series` | Case is harmless, but stable code should be authoritative. |
| Six confirmed production machines | Six production machines plus heat press and guillotine | Auxiliary equipment can inflate machine counts and routing candidates. |

The machine code is currently the closest thing to a stable identity, but it is not consistently treated as the only identity. Name-based matching remains in migration logic and catalog lookup.

## 2.3 Machine capability gaps

Current capabilities are descriptive free text:

- `3.2m Print Width · Heavy Duty Exterior Banner & Mesh`
- `1.6m Print Width · High Resolution Vinyl, Stickers & Grayback`
- `Direct-to-Rigid Sheet Printing (Mica, Foam Board, Cladding, Canvas)`
- `60cm Textile Films, T-Shirt Direct Transfer`
- `1.22m x 2.44m Bed · Precision Mica, Acrylic & Foam Board Cutting`
- `2.0m x 3.0m Bed · Foam Board, Cladding, MDF Heavy Routing`

Current routes use shorter strings such as:

- `3.2m Print Width`
- `1.6m Width`
- `Direct-to-Rigid Board`
- `0.60m Print Width`
- `1.22m x 2.44m Standard Board`
- `2.0m x 3.0m Bed Size`

Exact capability matching will fail for many valid machines because these values are not equal. Capabilities need stable IDs, not display strings.

Recommended capability IDs include:

| Capability ID | Display label |
|---|---|
| `PRINT_ROLL_3_2M` | 3.2m roll printing |
| `PRINT_ROLL_1_6M` | 1.6m eco-solvent printing |
| `PRINT_ROLL_0_6M_DTF` | 0.60m DTF film printing |
| `PRINT_RIGID_UV_122_244` | 1.22m × 2.44m UV flatbed printing |
| `CUT_RIGID_122_244_LASER` | 1.22m × 2.44m laser cutting |
| `CUT_RIGID_2030_CNC` | 2.0m × 3.0m CNC routing |
| `TRANSFER_TEXTILE` | Heat transfer pressing |
| `TRIM_A3_PLUS` | A3+ trimming |

A machine can have an array of capabilities. A single `capability` string is insufficient for a machine that supports multiple production modes.

## 2.4 Operator role gaps

The project defines four operator roles:

- `laser_operator`
- `cnc_operator`
- `plotter_operator`
- `printer_operator`

The six machines do not imply six operator roles. Multiple machines can share one role, but the project currently uses the role for several unrelated purposes:

- User authorization.
- Operator navigation.
- Machine assignment.
- Routing eligibility.
- Notification recipients.

This creates a conceptual collision. `printer_operator` currently covers:

- Banner printing.
- Eco-solvent printing.
- UV flatbed printing.
- DTF printing.
- Heat pressing.
- Paper trimming.

A role should identify the operational team or account type. A capability should identify what the machine can technically do. The routing engine must use capabilities for production suitability and roles only as a secondary organizational constraint.

The current machine modal and operator navigation also repeat the operator-role list in multiple files. This is a direct single-source violation.

Recommended separation:

| Concept | Example |
|---|---|
| Operator role | `printer_operator` |
| Machine family | `LARGE_FORMAT_SOLVENT`, `ECO_SOLVENT`, `UV_FLATBED`, `DTF` |
| Capability | `PRINT_ROLL_3_2M`, `PRINT_RIGID_UV_122_244` |
| Service | `banner_print`, `dtf`, `uv_print_mica` |
| Machine state | Active, maintenance, unavailable, available, running |

---

# 3. Raw Material Comparison

## 3.1 Roll materials

### Banner

Owner confirmation:

- 3.2m × 50m.
- 2.07m × 50m.

The project has both dimensions in the catalog description, but the canonical definition currently has one conversion ratio of `160`, which represents only the 3.2m roll. The 2.07m roll requires a second variant with a conversion ratio of `103.5m²`.

**Gap:** Roll width is descriptive rather than a first-class material variant. Inventory cannot reliably distinguish the 3.2m and 2.07m rolls using one conversion ratio.

### Sticker variants

Owner confirmation:

| Material | Widths |
|---|---|
| Frosted | 1.2m × 50m |
| Mesh | 1.2m × 50m and 1.52m × 50m |
| Transparent | 1.07m × 50m and 1.52m × 50m |
| Reflective | 1.07m × 50m and 1.52m × 50m |

Current problems:

1. A shared `stickerOptions` array exposes the same three widths to every sticker type.
2. The shared options contain `1.2m`, `1.07m`, and `1.52m`, even though each sticker type supports a different subset.
3. Current `rollWidth` values use `1.27` for several sticker materials, which conflicts with the Owner’s `1.2m` confirmation.
4. `Mesh Sticker` appears twice with different definitions and different conversion ratios.
5. `Frosted Sticker`, `Transparent Sticker`, and `Reflective Sticker` definitions expose incompatible options instead of per-variant options.
6. `Mush Sticker` appears as an additional material name and alias, creating a likely typo/duplicate identity.

**Gap:** A customer or Receptionist can select a physically unavailable width for a material, and inventory can store multiple records for the same conceptual material.

### DTF Film

Owner confirmation:

- 0.60m × 100m.

The project has the correct dimensions and running-metre base unit in one definition, but DTF Film appears more than once in the catalog.

**Gap:** Duplicate definitions can cause `findMaterialSpecification` to prefer the last entry while seed and route logic may use another entry.

### Canvas

Owner confirmation:

- 1.50m × 30m.
- 1.50m × 50m.
- 1.00m × 30m.
- 1.00m × 50m.

The current catalog contains a single Canvas definition with:

- `rollWidth: 1.52`.
- Options `1.4 Meter` and `1.0 Meter`.
- A conversion ratio based on `1.52m × 30m`.

**Gap:** The current Canvas width and available length options do not match the Owner’s confirmed inventory.

---

## 3.2 Inks and solvents

The Owner’s color lists are mostly represented, but color identity and material identity are not consistently modeled.

### Banner Ink

Owner confirmation:

- 5L canisters.
- Black, Blue, Red, Yellow.

The project stores `Banner Ink 5L Canister` with color options. The project uses `Blue (Cyan)` and `Red (Magenta)` labels, which may be acceptable display aliases but should be normalized to business labels with a separate color ID.

### DTF Ink

Owner confirmation:

- 1L canisters.
- White, Yellow, Black, Blue, Red.

The project represents these values, but again uses `Blue (Cyan)` and `Red (Magenta)` labels. Color should be a canonical variant, not just a UI string.

### Print and Cut Ink

Owner confirmation:

- 1L canisters.
- Red, Blue, Black, Yellow.

The project has the correct set with parenthetical color aliases.

### UV Ink

Owner confirmation:

- 1L canisters.
- Red, Blue, Black, Yellow, White.

The project has the same five colors.

### Solvents

Owner confirmation distinguishes:

- Banner Solvent.
- DTF Solvent.
- Print and Cut Solvent.

The project contains both a combined `Solvents` definition and separate solvent definitions later in the same file.

**Gap:** A combined solvent record and separate records can produce duplicate inventory identities, inconsistent compatible-machine mappings, and incorrect stock reporting. Solvents should be separate canonical materials with a shared `SOLVENT` family and a non-job-deduction policy.

---

## 3.3 Rigid sheets and boards

### Mica

Owner confirmation:

- 1.22m × 2.44m.
- Colors: White, Red, Black, Blue Light, Blue Dark, Lemmen, Green, Yellow, Orange, Golden, Transparent Mica.
- Thicknesses: 3mm, 5mm, 8mm, 10mm, 18mm.

The project has multiple conflicting definitions:

- `Acrylic`.
- `Mica Sheet`.
- `Mica`.

Some entries use `baseUnit: pcs`; others use `baseUnit: m²`. Some combine colors and thicknesses into one option list. Some include unsupported colors such as Pink, Ice Blue, Purple, RGB, and fluorescent tones.

**Gap:** The project does not model Mica as a proper variant matrix of:

```text
material family + thickness + color + sheet dimensions
```

This can lead to a 3mm white sheet being treated as equivalent to an 18mm transparent sheet.

### Cladding

Owner confirmation:

- 1.22m × 2.44m.
- White, Gray, Black.
- Used by UV printing and CNC routing.

The project has a correct later Cladding definition, but an earlier Cladding definition incorrectly uses power-supply wattage as its specification options.

**Gap:** Duplicate definitions allow the wrong options to leak into intake, inventory, or seed data.

### Foam

Owner confirmation:

- 3mm.
- 5mm.
- 10mm.
- 15mm.
- 18mm.

The current catalog includes:

- 3mm.
- 5mm.
- 8mm.
- 10mm.
- 18mm.

**Gap:** The project includes unsupported 8mm and omits the Owner-confirmed 15mm.

### MDF

Owner confirmation explicitly says CNC Router is used for MDF.

The current material catalog does not contain MDF as a canonical material and the service catalog does not expose an MDF service.

**Gap:** CNC routing can be assigned to MDF operationally, but there is no canonical inventory identity, specification, or service mapping for MDF.

---

## 3.4 Hardware and accessories

### Power Supply

The project correctly includes:

- 60 Watt.
- 100 Watt.
- 200 Watt.
- 400 Watt.

The remaining gap is recipe linkage: the selected power supply should be determined by the Owner’s LED recipe or explicitly selected as a service specification.

### Digital Screen

The project correctly includes A1 and A2, but the definition appears more than once.

**Gap:** Duplicate records can create inconsistent lookup results and service-specific screen selection errors.

### LED

Owner confirmation:

- White.
- Warm.
- Yellow.
- Red.
- Blue.
- Green.

The project includes multiple overlapping labels:

- Cool White.
- Warm White.
- White (Warm White, Cool White).
- Yellow.
- Red.
- Blue.
- Green.
- RGB.

**Gap:** The catalog mixes product color, color temperature, and multi-color mode as if they were the same dimension. The Owner’s list should be normalized into canonical IDs, with optional display labels such as `WHITE_COOL` and `WHITE_WARM` only if the business confirms that distinction.

### Zecolo

The project correctly includes 8cm and 6cm options. The name has several spelling aliases, which should be normalized to one stable material ID.

### Neon Light

Owner confirmation includes:

- White.
- Warm.
- Yellow.
- Red.
- Blue.
- Green.
- Ice Blue.
- Pink.
- A repeated Yellow entry.

The project includes additional Orange and Purple options. The repeated Yellow in the Owner list should be clarified before treating it as a new variant. Orange and Purple should not be active unless confirmed.

### Electric Wire

The project has two definitions:

- One with 100m roll conversion and 1.5mm/2.5mm options.
- One later duplicate with conversion ratio 1 and no options.

**Gap:** Inventory deduction and package conversion can differ depending on which definition wins lookup.

### T-Shirts

The project includes S, M, L, XL, and XXL and is substantially aligned.

### Amire

The project includes packets of 250 pieces and is substantially aligned.

### Roll-Up

The project includes Standard and Deluxe models and is substantially aligned, although the project contains misspelled names such as `ROLE UP STANDARD` and `ROLE UP DELUX` in routing constants.

---

# 4. Service and Routing Gaps

## 4.1 Service catalog is broader than the confirmed production machine matrix

The current service catalog contains 23 service IDs across:

- Large-format printing and stickers.
- Signage and displays.
- UV printing.
- Cutting and engraving.
- DTF and sublimation.

The Owner’s machine list does not yet explicitly assign every service to a confirmed machine and process.

## 4.2 Missing or ambiguous services

### Gray-back printing

The Owner explicitly confirmed gray-back printing for the Crystc Eco-Solvent Printer. There is no clearly named `gray_back` service ID.

Potentially related current service IDs are:

- `sticker_white`.
- `sticker_frosted`.
- `hq_print_and_cut`.

**Gap:** Gray-back must be represented as either a service variant or a material specification, not left as a machine note.

### MDF

CNC supports MDF, but there is no MDF material or service mapping.

**Gap:** The production capability exists in the owner statement but not in the canonical domain model.

### Sublimation

The project routes `sublimation` through DTF Film and DTF Ink. The Owner’s confirmed inventory lists DTF materials but does not list sublimation paper or sublimation ink.

**Gap:** Either sublimation is not currently active, or its materials and machine recipe are missing. It must not silently consume DTF inventory.

### Light boxes

The project routes `light_box_a1` and `light_box_a2` to the Laser Cutter and uses Digital Screen as the primary material. A light box actually involves multiple components:

- Face material or acrylic/mica.
- Digital screen or display insert.
- LED modules.
- Power supply.
- Wiring.
- Potential frame or hardware.

**Gap:** The current route is likely a single-machine simplification for a multi-stage assembly. The Owner has not explicitly confirmed which of the six machines performs the assembly or cutting stage.

### Neon light

The current route assigns neon work to the CNC route, while the Owner’s CNC description only confirms Foam, Cladding, and MDF.

**Gap:** Neon production capability and machine ownership are not confirmed.

### Roll-up

The current route uses the Crystc printer and Roll-Up Stands, but the print substrate and finishing process are not represented as a complete multi-material recipe.

**Gap:** Roll-up should map to printed roll material plus one Standard or Deluxe stand, with the stand variant determined by the selected service.

## 4.3 Primary machine versus compatible machines

The current system mixes:

- `preferredMachineCode` in `SERVICE_ROUTING_MAP`.
- `machineCapabilities` and `operatorRole` in `MATERIAL_TYPE_CATALOG`.
- `compatibleMachineTypes` in material definitions.
- Actual database machine records.

This makes it unclear whether a route means:

1. One required machine.
2. Any machine with a capability.
3. A preferred machine plus alternatives.
4. A machine family.
5. A multi-stage workflow.

The canonical route model must distinguish:

| Field | Meaning |
|---|---|
| `requiredCapabilities` | Technical capabilities required for the service |
| `preferredMachineId` | Optional default machine |
| `allowedMachineIds` | Owner-approved exceptions or fixed assignments |
| `operatorRole` | Responsible operator team |
| `productionStages` | Multi-machine sequence where applicable |
| `materialRecipeId` | Material requirements |

---

# 5. Critical Single-Source Problems

## 5.1 Duplicate material definitions

The material file contains repeated or overlapping definitions for:

- Mica.
- Acrylic.
- Mica Sheet.
- Mesh Sticker.
- DTF Film.
- Cladding.
- Electric Wire.
- T-Shirts.
- Digital Screen.
- Solvents.

`findMaterialSpecification` currently searches from the end of the array so that the latest matching entry wins. This is a compatibility workaround, not a safe catalog architecture.

It hides duplicates instead of preventing them.

## 5.2 Duplicate machine sources

Machine definitions exist in:

- `src/shared/machine-catalog.ts`.
- `convex/seed.ts`.
- Database rows.
- Migration backfills.
- Machine administration UI.

The seed currently creates a partial four-machine demo set, while the shared catalog contains eight machines. The Owner confirmed six production machines. This alone can explain total machine count discrepancies.

## 5.3 Duplicate routing sources

Routing behavior is distributed across:

- `src/shared/machine-catalog.ts`.
- `SERVICE_ROUTING_MAP`.
- `convex/orderAutomation.ts`.
- Database `materialTypeCatalog`.
- `serviceBOM` records.
- `bomResolver.ts` fallback logic.

A route can therefore have different values for preferred machine, material, capability, operator role, or unit depending on which path is executing.

## 5.4 Duplicate operator-role arrays

Operator roles are repeated in:

- `convex/users.ts`.
- `src/lib/operations-types.ts`.
- Operator navigation.
- Machine create modal.
- Machine edit modal.

A new role can be added to one place and omitted from another, causing mismatched permissions, navigation, and machine assignment.

## 5.5 Free-text capability matching

Machine capability is a singular free-text field, while routes also use free-text capability arrays. This makes matching sensitive to:

- Punctuation.
- Units.
- Capitalization.
- Descriptive suffixes.
- Spelling.
- Naming variants such as `1.6m Width` versus `1.6m Print Width`.

Capabilities should be stable enum-like IDs with display labels maintained separately.

---

# 6. Recommended Canonical Architecture

## 6.1 Create one production manifest

Create one domain manifest that owns definitions for:

```text
operatorRoles
machineCapabilities
machines
services
materialFamilies
materialVariants
serviceRoutes
serviceRecipes
```

The manifest should use stable IDs and should be the source for:

- Mini App service picker.
- Telegram Bot service picker.
- Convex service validation.
- Machine seed data.
- Material seed data.
- Route seed data.
- Owner configuration selectors.
- UI labels.
- Tests.

## 6.2 Use IDs instead of names

Examples:

```text
machineId: crystal_jet_7k
capabilityId: print_roll_3_2m
materialVariantId: banner_flex_3_2m_50m
serviceId: banner_print
operatorRoleId: printer_operator
```

Names such as `Crystal Jet 7K Series` should be display fields. They must not be primary join keys.

## 6.3 Separate catalog from operational state

The canonical manifest should define identity and capabilities. The database should store:

- Active/inactive status.
- Current machine status.
- Current stock.
- Current operator assignment.
- Owner-approved overrides.
- Audit history.

The database should not contain route rows that silently replace canonical definitions without versioning and validation.

## 6.4 Separate materials from material variants

A material family should not be the same as a stock item.

Recommended structure:

| Entity | Example |
|---|---|
| Material family | Banner Flex |
| Material variant | Banner Flex 3.2m × 50m |
| Material variant | Banner Flex 2.07m × 50m |
| Material attribute | Width, length, color, thickness |
| Inventory record | Actual stock balance for the variant |

For Mica:

```text
family: mica
variant: mica_3mm_white
variant: mica_5mm_transparent
variant: mica_18mm_black
```

This is necessary for accurate nesting, stock deductions, and cost valuation.

## 6.5 Make routes multi-stage where required

A light box route should not be represented only as one laser job if it requires multiple stages. A route may contain:

```text
stage 1: cut face material
stage 2: print or prepare digital screen
stage 3: assemble LED and power supply
stage 4: quality check
```

Each stage can have:

- Machine capability.
- Operator role.
- Material recipe.
- Job Card or sub-job type.

---

# 7. Recommended Remediation Phases

## Phase 0 — Owner Catalog Confirmation

Before coding, confirm the unresolved points:

1. Is Recho the business name for the Ricoh flatbed, or is it a different machine?
2. Is the Crystal Jet allowed to print every sticker type, or only Mesh and Banner?
3. Is Crystc Eco-Solvent a `printer_operator` machine or a separate plotter role?
4. Is gray-back a separate service or a material variant?
5. Is sublimation active? If yes, where are sublimation ink and paper defined?
6. Which machine handles light-box cutting and assembly?
7. Which machine handles neon work?
8. Are heat press and paper guillotine confirmed production machines or auxiliary equipment?
9. Does the Owner-confirmed six-machine count include no auxiliary equipment?
10. Is the repeated Neon Yellow line a duplicate typo?
11. Are `Blue` and `Cyan` the same inventory variant for each ink family?
12. Is `Transparent Mica` a color/finish option or a separate material family?

### Exit criteria

The Owner approves a signed catalog matrix before source data is normalized.

## Phase 1 — Canonical Manifest

Create one authoritative manifest for:

- Six confirmed machines.
- Four operator roles, if still approved.
- Stable capability IDs.
- Canonical service IDs.
- Material families and variants.
- Machine-to-capability relationships.
- Service-to-capability relationships.
- Service-to-material recipes.

Add tests that enforce:

- Unique machine IDs.
- Unique material variant IDs.
- Unique service IDs.
- No route references an unknown machine capability.
- No service references a removed operator role.
- No material variant has conflicting dimensions.

## Phase 2 — Catalog Normalization and Migration

Normalize the database:

1. Mark auxiliary machines as inactive or auxiliary if the Owner does not confirm them.
2. Rename or alias machines using stable IDs rather than creating duplicates.
3. Merge duplicate materials into canonical material families and variants.
4. Preserve existing stock through explicit migration mappings.
5. Migrate `materialTypeCatalog` rows to canonical capability IDs.
6. Add data-quality reports for unknown or conflicting records.
7. Do not delete historical inventory or Job Card references.

## Phase 3 — Schema and Validation Hardening

Add structured fields such as:

- `machineCapabilities: string[]`.
- `machineFamilyId`.
- `operatorRoleId`.
- `materialFamilyId`.
- `materialVariantId`.
- `catalogVersion`.
- `routeVersion`.

Keep legacy display fields temporarily for compatibility, but stop using free text for joins and routing decisions.

## Phase 4 — Routing Matrix Rebuild

Replace scattered route definitions with one route matrix derived from the manifest.

Each service route should specify:

- Required capability IDs.
- Optional preferred machine ID.
- Allowed machine IDs.
- Operator role.
- Material recipe.
- Ink and solvent recipe.
- Production stages.
- Whether the service is active.

Then apply the previously planned strict routing rule:

```text
operator role matches
AND all required capabilities match
AND machine is active and operational
```

## Phase 5 — Material Variant and Inventory Reconciliation

Correct the confirmed raw material catalog:

- Add Banner 2.07m variant.
- Correct sticker width variants per material.
- Correct Canvas variants.
- Remove unsupported Foam 8mm and add confirmed Foam 15mm.
- Add MDF.
- Split solvents into separate canonical materials.
- Normalize LED colors.
- Correct duplicate Electric Wire definitions.
- Normalize Mica thickness/color variants.
- Remove or explicitly confirm unsupported Neon colors.

Reconcile each active database material to exactly one canonical variant.

## Phase 6 — UI and Operator Workspace Alignment

Update:

- Owner machine administration.
- Owner material configuration.
- Machine counts and dashboards.
- Operator navigation.
- Reception routing preview.
- Job Card details.
- Storekeeper inventory selectors.
- Mini App service and specification selectors.

All selectors should load from the same manifest-derived query or validated database projection.

## Phase 7 — Tests and Rollout

Add regression tests for:

- Machine count equals Owner-confirmed active production count.
- Every active machine has at least one valid capability.
- Every service route has at least one eligible machine or an explicit disabled status.
- Every active material variant has valid dimensions and unit conversions.
- No duplicate canonical names or IDs.
- Banner routes to Crystal Jet only when capability permits.
- Sticker routes follow the Owner-approved machine matrix.
- DTF routes only to DTF i32.
- CNC services do not reference missing MDF or unsupported materials.
- UV services route only to the confirmed Recho/Ricoh flatbed.

Roll out with a read-only audit report first, then enforce the normalized catalog.

---

# 8. Highest-Priority Gaps

| Priority | Gap | Impact |
|---|---|---|
| P0 | Capability values are free text and do not exactly match route capability strings. | Strict routing fix could reject all valid machines or select incorrectly. |
| P0 | Eight shared machine definitions versus six Owner-confirmed machines, plus partial seed data. | Machine count and operator workspace mismatch. |
| P0 | Multiple independent routing sources. | Same service can resolve to different machines/materials in different flows. |
| P0 | Duplicate material definitions with “last match wins” lookup. | Wrong dimensions, options, units, and stock identities. |
| P1 | Sticker widths are shared across types instead of type-specific. | Customers can select unavailable stock variants. |
| P1 | Canvas catalog does not match confirmed widths and lengths. | Incorrect roll quantity and inventory valuation. |
| P1 | Foam has 8mm instead of confirmed 15mm. | Invalid material selection and production requirement. |
| P1 | MDF is used by CNC operationally but absent from the catalog. | CNC jobs cannot calculate or deduct MDF correctly. |
| P1 | Sublimation consumes DTF materials while sublimation materials are absent. | Wrong stock deduction and COGS. |
| P1 | Light box, neon, and roll-up are modeled as incomplete single-machine routes. | Missing components and incorrect Job Card structure. |
| P1 | Operator role constants are duplicated across backend and UI. | Permission and navigation drift. |
| P2 | Machine names differ between Owner wording and catalog. | Duplicate or misidentified machines. |
| P2 | Ink color labels mix business colors with CMYK terminology. | Ambiguous stock records and reporting. |
| P2 | Auxiliary machines are included in production catalog. | Inflated machine count and unsafe routing candidates. |

---

# 9. Recommended Immediate Action

Do not begin by editing the OR-to-AND predicate alone. First create the Owner-approved catalog audit and capability-ID design.

The correct order is:

1. Confirm the unresolved Owner decisions in Phase 0.
2. Freeze the six-machine production register.
3. Define stable machine, capability, service, role, material-family, and material-variant IDs.
4. Produce a read-only drift report against the existing database.
5. Normalize duplicate material and machine records through a migration.
6. Rebuild the route matrix from the canonical manifest.
7. Apply strict capability-and-role routing.
8. Add Reception manual override only after the candidate list is reliable.
9. Validate all Job Card, inventory, and operator workflows against the normalized catalog.

This order prevents a new manual override from masking incorrect master data and prevents the routing fix from creating a different class of “no compatible machine” failures.

---

## References

[1]: /home/ubuntu/yt-ads/src/shared/machine-catalog.ts "Current shared machine catalog and service routing map"

[2]: /home/ubuntu/yt-ads/src/shared/material-specifications.ts "Current shared raw-material and consumable catalog"

[3]: /home/ubuntu/yt-ads/src/shared/services.ts "Canonical service IDs and service categories"

[4]: /home/ubuntu/yt-ads/convex/orderAutomation.ts "Current service route catalog and machine compatibility logic"

[5]: /home/ubuntu/yt-ads/convex/bomResolver.ts "Database route resolution, machine candidate selection, and BOM expansion"

[6]: /home/ubuntu/yt-ads/convex/seed.ts "Current demo machine and material seed data"

[7]: /home/ubuntu/yt-ads/convex/migrations.ts "Machine compatibility backfill and catalog migration logic"

[8]: /home/ubuntu/yt-ads/convex/schema.ts "Machine, material, service BOM, and route table schema"

[9]: /home/ubuntu/yt-ads/src/lib/operations-types.ts "Frontend role, machine, material, and service-related types"
