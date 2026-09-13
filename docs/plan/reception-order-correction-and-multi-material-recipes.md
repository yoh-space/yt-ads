# Reception Order Correction and Multi-Material Job Card Recipes

## Focused Codebase Review and Minimal Implementation Plan

**Repository:** `yoh-space/yt-ads`  
**Reviewed branch:** `main` at `c3a3cdd`  
**Scope:** Correct customer-order data at Reception before Job Card creation and generate accurate multi-material recipes for the seeded services.  
**Explicit non-goals:** No advanced workflow engine, no assembly-worker accounts, no lamination/contour-cutting/weeding/mounting assumptions, no automatic stock deduction at order creation, no Reception ink configuration or ink usage entry, and no new operational process beyond raw-material control.

---

# 1. Executive Summary

The project already contains much of the required foundation:

- Customer orders and reception review states.
- A payment-gated Job Card confirmation mutation.
- A canonical `serviceBOM` table for multiple raw materials per service.
- `resolveJobBOM()` for expanding service recipes into Job Card material requirements.
- Owner APIs for creating and updating service BOM rows.
- Operator Job Card queries that already read multiple `jobMaterialRequirements` rows.
- Operator sub-stock and direct inventory flows.

However, the current Reception-to-Job-Card path is still effectively **single-material at dispatch time**. The most important problem is not that the project lacks a BOM table; it is that the Reception UI and confirmation mutation do not present, validate, and snapshot the complete recipe clearly enough before creating the Job Card.

Ink is a special exception to the normal recipe review. The existing operator completion path already calculates ink from the completed printed area, machine ink mapping, and Owner/system ink-rate configuration, then deducts it from operator sub-stock. Therefore, Reception must not select, configure, review, or manually record ink consumption. Ink must not be added as a normal `serviceBOM` row for printed services unless the existing automatic deduction is first changed to avoid double deduction.

The minimal target is:

```text
Reception reviews/corrects customer order
    ↓
System resolves the service recipe from serviceBOM
    ↓
Reception sees the complete planned non-ink material list
    ↓
Reception confirms payment and Job Card
    ↓
Job Card stores all material requirements
    ↓
Operator sub-stock or direct main-store source is tracked per material row
```

The system should control raw-material quantities, not automate all production operations.

---

# 2. Current Codebase Findings

## 2.1 Receptionist page

File:

```text
src/app/(dashboard)/dashboard/receptionist/orders/page.tsx
```

Current behavior:

1. Loads the Reception profile.
2. Loads `api.receptionist.orders.list`.
3. Opens review-lock, price, and confirmation modals.
4. Calls `api.orders.confirmOrderAndIssueJobCard` after payment confirmation.
5. Passes `machines={[]}` and `materials={[]}` to `OrdersView` and `OrderConfirmModal`.
6. Sends only payment-related fields and priority from the modal to the confirmation mutation.

Current confirmation payload:

```text
orderId
paymentDecision
paymentMethod
advancePaidAmount
priority
```

This means the receptionist page currently has no usable path to select, correct, or explicitly review machine/material assignment. The current empty arrays also make the existing `machines` and `materials` props misleading.

## 2.2 Confirmation modal

File:

```text
src/components/dashboard/roles/common/orders.tsx
```

The modal:

- Calls `api.orders.previewAutoRouting`.
- Displays one routed machine and one primary material.
- Displays one calculated quantity/unit and one material/ink resource check.
- Labels the decision as “Auto-Calculated.”
- States that manual allocation is disabled.
- Blocks confirmation when the preview errors.
- Does not display all `jobMaterialRequirements` or BOM materials.
- Does not pass `machineId`, `materialId`, `quantity`, or `unit` through `onSave`.

The preview is useful for the primary routed production assignment, but it is not currently a complete multi-material recipe preview.

## 2.3 Confirmation mutation

File:

```text
convex/orders.ts
```

Mutation:

```text
confirmOrderAndIssueJobCard
```

Current behavior:

1. Requires order-management permission.
2. Requires the customer edit lock.
3. Requires an order under Reception review or awaiting payment.
4. Verifies payment/credit decision.
5. Resolves one machine/material route or accepts explicit legacy assignment.
6. Creates one primary material reservation.
7. Inserts one `jobCards` row with `materialId`, `quantity`, and `unit`.
8. Calls `resolveJobBOM()` afterward.
9. Inserts multiple `jobMaterialRequirements` rows from the BOM.
10. Adds the primary material as a fallback requirement if the BOM did not include it.

This is close to the desired model, but there are important correctness gaps:

- The primary reservation is created before the complete BOM is resolved, so only one material is reserved at this point.
- The Job Card’s top-level `materialId` is still treated as the main material even for multi-material services.
- BOM requirements are created after the Job Card, but the Reception UI did not show the full result before confirmation.
- The BOM calculation uses service dimensions and quantity but does not clearly use every selected order specification to resolve material variants.
- There is no explicit source/purpose snapshot on each requirement to distinguish operator sub-stock from direct main-store issue.
- There is no explicit correction checkpoint immediately before confirmation.

## 2.4 Canonical BOM table

File:

```text
convex/schema.ts
```

The canonical table is:

```text
serviceBOM
```

It supports:

- `serviceType`
- `materialId`
- Optional `machineServiceRouteId`
- `consumptionMode`: `area_rate`, `linear_rate`, `quantity_rate`, or `fixed`
- `quantityPerUnit`
- Optional waste allowance
- Required flag
- Note
- Active status

This table is suitable for the requested multi-material recipes. It should remain the single source of truth for service recipes.

## 2.5 Duplicate legacy recipe table

The schema also contains:

```text
serviceMaterialRecipes
```

But the current resolver uses `serviceBOM`, while migration code describes `serviceMaterialRecipes` as legacy and migrates it into `serviceBOM`.

The plan should therefore treat `serviceBOM` as canonical and avoid adding more recipe tables. `serviceMaterialRecipes` should be read only for migration/compatibility and eventually retired after existing data is migrated and verified.

## 2.6 BOM resolver

File:

```text
convex/bomResolver.ts
```

`resolveJobBOM()` already supports multiple rows and calculates each row using:

- Fixed quantity.
- Area rate.
- Linear rate.
- Quantity rate.
- Waste allowance.
- Material conversion ratio.
- Package unit.
- Suggested package count.

This is the correct engine to reuse. It should be strengthened rather than replaced.

Current limitations:

1. It matches service BOM rows by `serviceType` and optional route, but does not yet make order-specific material variant selection explicit.
2. It calculates area from `length × width`, with a default of `1` when dimensions are absent.
3. It uses the order quantity string for service units.
4. It silently skips inactive or missing BOM materials instead of returning a clear recipe error.
5. It has a legacy single-material fallback when no BOM exists, which can hide missing Owner recipes.
6. It does not return source policy such as operator sub-stock versus direct main-store issue.

## 2.7 Owner BOM API

File:

```text
convex/owner/serviceBOM.ts
```

The Owner already has:

- `list`
- `upsert`
- `archive`
- `restore`
- `bulkUpsert`

The API validates material existence, active state, route-service consistency, quantity, waste allowance, and duplicate active rows.

This is sufficient for configuring multi-material recipes. The immediate missing feature is not another Owner API; it is making the Reception preview and Job Card snapshot consume this configuration correctly.

---

# 3. Seeded-Service Recipe Scope

Use only the confirmed seeded service IDs. Do not introduce unconfirmed finishing activities.

## 3.1 Roll and ink services

```text
banner_print
sticker_white
sticker_transparent
sticker_reflective
sticker_mesh
sticker_frosted
hq_print_and_cut
dtf
uv_print_canvas
```

Typical recipe rows should be configured only with confirmed catalog materials such as:

- Correct roll media variant.
- DTF Film for `dtf`.

Ink is intentionally excluded from this Reception-visible recipe. The operator completion path calculates ink from completed printed area, machine ink mapping, and Owner/system ink-rate configuration, then deducts it from operator sub-stock. Solvent is also outside this change unless a separate Owner-confirmed automatic control exists. The first implementation should calculate planned non-ink quantities and record usage. It should not add lamination, weeding, mounting, or other unconfirmed process rows.

## 3.2 Rigid-material services

```text
uv_print_mica
uv_print_foam
uv_print_cladding
foam_cutout
foam_engrave
mica_cutout
mica_engrave
```

Typical recipe rows should use only confirmed:

- Mica variants.
- Foam thickness variants.
- Cladding variants.

The machine operator’s sub-stock remains the source for machine-consumed rigid materials unless Owner configuration explicitly marks a row as direct main-store issue. Ink for printed work remains automatic at operator completion and is not configured by Reception.

## 3.3 Roll-up services

```text
roll_up_standard
roll_up_deluxe
```

The recipe may contain:

- Print media.
- Standard or Deluxe Roll-Up Stand.

The printed media can follow operator sub-stock. Ink is automatically deducted when the operator completes the printed Job Card. The stand can be a direct main-store Job Card issue. The material recipe must show the media and stand rows without creating a second ink deduction.

## 3.4 Sublimation

```text
sublimation
```

Only configure materials that actually exist in the confirmed catalog and that the Owner approves for this service. Do not invent blanks, paper, or accessories. If a material is not configured, the recipe is incomplete and confirmation should show that clearly.

## 3.5 Light box and neon

```text
light_box_a1
light_box_a2
neon_light
```

These may use multiple confirmed materials, for example:

- Mica/acrylic.
- Digital Screen A1/A2 where applicable.
- LED or Neon Light.
- Power Supply.
- Electrical wire.

For this plan, they remain **multi-material recipe records**, not complex assembly workflows. The system only controls planned, issued, consumed, waste, and returned quantities.

---

# 4. Minimal Target Data Model

Do not add a general workflow engine or separate assembly system.

## 4.1 Keep `serviceBOM` as the recipe source

Each active recipe row should describe one material used by one seeded service:

```text
serviceType
materialId
consumptionMode
quantityPerUnit
wasteAllowancePercent
required
note
active
```

## 4.2 Add source policy to the recipe

The current `serviceBOM` table does not say whether a row is fulfilled from operator sub-stock or direct main-store issue. Add one small field:

```text
sourcePolicy:
  OPERATOR_SUB_STOCK
  MAIN_STORE_DIRECT
```

Default policy examples:

| Material type | Default source |
|---|---|
| Banner roll used by printer | `OPERATOR_SUB_STOCK` |
| Sticker roll used by printer | `OPERATOR_SUB_STOCK` |
| Mica used by laser operator | `OPERATOR_SUB_STOCK` |
| Foam used by cutter | `OPERATOR_SUB_STOCK` |
| Roll-Up stand | `MAIN_STORE_DIRECT` |
| T-Shirt blank, if Owner approves tracking | `MAIN_STORE_DIRECT` |
| Power supply or wire for a configured service | `MAIN_STORE_DIRECT` |

This is a control field, not a workflow assignment.

## 4.3 Snapshot source on Job Card requirements

When `resolveJobBOM()` creates `jobMaterialRequirements`, copy:

```text
sourcePolicy
```

The snapshot is important because Owner recipe configuration may change after a Job Card is created.

The requirement row should then contain:

```text
jobCardId
materialId
plannedBaseQuantity
approvedScrapQuantity
consumedBaseQuantity
sourcePolicy
status
conversionRatioSnapshot
createdAt
updatedAt
```

## 4.4 Track simple usage quantities

If the current `jobMaterialRequirements` schema does not already contain them, add:

```text
issuedBaseQuantity
wastedBaseQuantity
returnedBaseQuantity
recordedBy
recordedAt
```

Do not add separate tables until the existing requirement and stock-movement model is proven insufficient.

---

# 5. Reception Order Correction Design

## 5.1 Correction must happen before Job Card creation

The order is currently locked before confirmation. That is correct for customer editing, but Reception needs a controlled internal correction path before the Job Card is generated.

Add a small Reception correction step after customer edit lock and before payment confirmation/Job Card issuance.

The correction panel should allow authorized Reception staff to correct only fields that affect material calculation:

- Service ID/type.
- Dimensions.
- Quantity.
- Structured service specifications.
- Selected material variant/specification values.
- Uploaded artwork or reference attachment.
- Due date if it affects the production record.

It should not silently modify the original customer submission. Store:

```text
customer-submitted values
reception-corrected values
correction note
corrected by
corrected at
```

If the existing order schema already has an audit/change mechanism, use it. Otherwise add a compact order-correction log rather than overwriting without traceability.

## 5.2 Correction rules

The correction UI should:

1. Load the current order.
2. Display customer values and current internal values.
3. Allow Reception to fix obvious data errors.
4. Recalculate the recipe preview when dimensions, quantity, or specifications change.
5. Require a note when a material-affecting value changes.
6. Save the corrected order before price/confirmation.
7. Prevent Job Card creation from using stale preview data.

The server must recalculate the recipe during confirmation. The client preview is informative only.

## 5.3 Avoid editing after payment confirmation

Once the advance is verified and the Job Card is created, corrections should not mutate the original recipe silently. Use a separate controlled adjustment later if necessary.

For the first release:

```text
Customer edit
→ Reception correction
→ Price
→ Payment confirmation
→ Job Card creation
```

---

# 6. Reception Multi-Material Preview

## 6.1 Replace single-material preview with a recipe preview

The confirmation modal should show:

```text
Recommended machine
Primary production material
Complete material recipe
```

The complete recipe table should include:

| Material | Planned quantity | Unit | Source | Required? | Waste allowance |
|---|---:|---|---|---:|---:|
| Banner Flex 3.2m | 12.00 | m² | Operator sub-stock | Yes | 5% |
| DTF Film or other confirmed non-ink material | calculated | m/m²/pcs | Operator sub-stock or main store | Yes | configured |

For `roll_up_standard`, for example:

| Material | Planned quantity | Unit | Source |
|---|---:|---|---|
| Print media | calculated | m² | Operator sub-stock |
| Standard Roll-Up Stand | 1 | piece | Main store direct |

The preview should show an informational note for printed services: **ink is calculated and deducted automatically from the assigned operator machine sub-stock when the job is completed; it is not a Reception-configured recipe row.**

## 6.2 Add a recipe preview query

Create a query such as:

```text
api.orders.previewJobMaterialRecipe
```

Arguments:

```text
orderId
```

The query should:

1. Load the order.
2. Resolve the routed machine/service route.
3. Resolve active `serviceBOM` rows.
4. Resolve selected material variants from order specifications.
5. Calculate every material quantity.
6. Return source policy and warnings.
7. Return a blocking error only when a required recipe is missing or invalid.

The existing `previewAutoRouting` can remain for machine recommendation, but the Reception UI should consume a combined dispatch-and-recipe response to avoid two inconsistent calculations.

## 6.3 Missing recipe behavior

Do not silently fall back to a single material when the service is expected to use multiple materials.

Recommended behavior:

- If the service has active `serviceBOM` rows: use them.
- If the service has no BOM rows but a legacy route exists: show `RECIPE_NOT_CONFIGURED` and allow Owner configuration before confirmation.
- Keep the legacy single-material fallback only behind an explicit compatibility flag during migration.

This prevents Job Cards from being created with incomplete material control.

---

# 7. Job Card Creation Correction

## 7.1 Resolve the complete recipe before inserting the Job Card

Current order:

```text
Create primary reservation
→ Insert Job Card
→ Resolve BOM
→ Insert requirements
```

Recommended order:

```text
Resolve route
→ Resolve complete BOM
→ Validate every material
→ Calculate every requirement
→ Validate required recipe completeness
→ Insert Job Card
→ Insert all requirement snapshots
→ Create reservations or issue records according to source policy
→ Update order/payment state
```

This prevents partial Job Cards with incomplete material requirements.

## 7.2 Keep one primary material for compatibility

Existing dashboards and machine operations may rely on `jobCards.materialId`, `quantity`, and `unit`. Keep those fields temporarily as the primary routed machine material.

But treat the complete `jobMaterialRequirements` rows as authoritative for raw-material control.

Document the distinction:

```text
jobCards.materialId
  = primary machine-routing material for legacy UI compatibility

jobMaterialRequirements
  = complete raw-material recipe for the Job Card
```

## 7.3 Create all requirement snapshots atomically

For each BOM row, snapshot:

- Material ID and name through relation.
- Planned base quantity.
- Approved scrap quantity.
- Conversion ratio.
- Package unit.
- Suggested packages.
- Source policy.
- Required flag.
- Recipe note.
- Recipe version timestamp or configuration version.

Do not calculate these later from live Owner configuration. A Job Card must retain the recipe that was valid when it was created.

## 7.4 Handle multiple material reservations correctly

The current reservation path creates one reservation for the primary material. Decide explicitly:

- If reservations are only used for operator start checks, create reservations for every `OPERATOR_SUB_STOCK` requirement.
- If direct main-store materials are issued later, do not reserve them at Reception; create the direct Job Card issue when the Storekeeper confirms issuance.
- If the reservation system cannot support multiple rows safely, do not fake a single reservation. Extend it with one reservation per requirement.

Recommended minimal policy:

```text
OPERATOR_SUB_STOCK requirement
  → operator stock availability/start guard

MAIN_STORE_DIRECT requirement
  → Storekeeper direct Job Card issue
```

Reception Job Card creation should not deduct or consume either source.

---

# 8. Material Usage Control After Job Card Creation

## 8.1 Operator sub-stock rows

For requirements marked `OPERATOR_SUB_STOCK`:

- The operator sees the material in the Job Card requirement list.
- Operator stock is checked when production starts.
- Actual consumption is recorded against that requirement.
- Waste/off-cut can be recorded where relevant.
- The system updates the operator’s sub-stock through the existing controlled consumption path.

The Storekeeper does not reissue these materials per Job Card.

### 8.1.1 Automatic ink consumption for printed services

Ink is not entered by Reception and is not manually recorded as a Job Card recipe requirement. When the operator completes a printed Job Card, the existing completion transaction calculates ink from the completed area and the Owner/system ink-rate configuration, resolves the compatible ink for the assigned machine, and deducts the calculated quantity from that machine operator’s sub-stock. Any shortage remainder follows the existing inventory event path.

This path must remain separate from normal `serviceBOM` rows. Adding Banner Ink, DTF Ink, Print-and-Cut Ink, or UV Ink as an ordinary BOM row while the automatic completion logic remains enabled would double-deduct ink. If the application later needs ink recipe overrides, introduce an explicit `AUTO_INK` mode and make the completion transaction choose exactly one deduction path.

## 8.2 Direct main-store rows

For requirements marked `MAIN_STORE_DIRECT`:

- The Storekeeper sees the required rows.
- The Storekeeper confirms the quantity issued to the Job Card.
- Main store stock decreases at issuance.
- The requirement records issued quantity and issuer.
- Reception is not responsible for this deduction.

This is the direct Job Card stock-out path, but it remains linked to the complete recipe.

## 8.3 No automatic consumption at Job Card creation

Job Card creation must only create planned requirements and reservations/supply tasks. It must not mark materials consumed.

The raw-material lifecycle is:

```text
Planned
→ Issued or available in operator sub-stock
→ Consumed
→ Waste/off-cut or returned
```

---

# 9. Validation Rules

## 9.1 Order correction validation

Reject confirmation when:

- Required dimensions are missing.
- Quantity is invalid.
- Selected specification does not match the service.
- Selected material variant is inactive or unavailable.
- The corrected service is not a seeded service.
- Required artwork/specification data is absent for the service.

## 9.2 Recipe validation

Reject or clearly block confirmation when:

- A required service recipe has no active BOM rows.
- A required BOM material is missing or inactive.
- A BOM row has an invalid quantity or unit.
- A selected material variant cannot be resolved.
- A recipe row uses an unconfirmed material.
- A route-specific recipe belongs to another service.
- A required material has no source policy.

## 9.3 Inventory behavior

Do not block Reception because operator sub-stock or main-store stock is empty. Show a warning and let the Job Card be created, unless the Owner explicitly chooses a future policy that requires stock confirmation.

The operator start guard and Storekeeper issue flow remain responsible for actual availability.

---

# 10. Smallest Safe Implementation Phases

## Phase 1 — Canonical recipe cleanup

1. Declare `serviceBOM` the only active recipe source.
2. Audit the 22 seeded services for active BOM completeness.
3. Migrate or verify legacy `serviceMaterialRecipes` rows.
4. Add `sourcePolicy` to service BOM rows.
5. Add tests for multiple materials per service.
6. Keep machine-compatible inks out of ordinary Reception BOM rows and document the automatic completion path.

### Exit criteria

Every included service is either configured with a complete confirmed recipe or explicitly marked as not configured. No silent fallback is used for a configured service.

## Phase 2 — Recipe resolver hardening

1. Extend `ResolvedJobBOMItem` with source policy, required flag, and recipe note.
2. Resolve all active BOM rows before Job Card insertion.
3. Return clear missing/inactive-material errors.
4. Use selected order specifications to resolve material variants.
5. Add tests for fixed, area, linear, and quantity rates.
6. Add an invariant that printed-service ink is not resolved as a second ordinary BOM deduction.

### Exit criteria

The resolver returns a complete, deterministic material recipe for a corrected order.

## Phase 3 — Reception correction and preview

1. Add a Reception correction panel before final payment confirmation.
2. Add a combined dispatch-and-recipe preview query.
3. Replace the single-material preview area with a recipe table.
4. Remove the misleading empty `machines`/`materials` props or replace them with real server options.
5. Show source policy for every material row.
6. Show the automatic-ink informational note without offering ink configuration or manual usage entry.

### Exit criteria

Reception can correct dimensions/specifications and review every planned raw material before Job Card creation.

## Phase 4 — Atomic Job Card recipe snapshot

1. Resolve the complete recipe before insertion.
2. Insert all `jobMaterialRequirements` rows as snapshots.
3. Keep top-level primary material fields for compatibility.
4. Create per-material operator reservations only where needed.
5. Create direct-store issue tasks without consuming inventory.

### Exit criteria

Every new Job Card contains the full raw-material recipe that was approved at creation time.

## Phase 5 — Usage control and reporting

1. Connect operator sub-stock usage to requirement rows.
2. Connect direct Storekeeper issues to requirement rows.
3. Record consumed, waste, and returned quantities.
4. Add Owner reports for planned versus actual usage.
5. Add warnings for missing usage or excessive variance.
6. Report automatic ink deductions separately by completed printed Job Card and machine/operator sub-stock.

### Exit criteria

Owner can trace important raw-material usage from service → Job Card → material row → source → actual usage.

---

# 11. Test Plan

Add focused tests for:

1. Reception correction changes dimensions and recalculates every BOM row.
2. Reception correction changes service specifications and resolves the correct material variant.
3. A multi-material service creates multiple Job Card requirements.
4. A service with fixed, area, linear, and quantity BOM rows calculates each correctly.
5. Waste allowance is applied per recipe row.
6. Missing required BOM material blocks confirmation with a clear error.
7. Inactive BOM material blocks confirmation.
8. No active BOM does not silently create a fake single-material recipe after migration mode is disabled.
9. `OPERATOR_SUB_STOCK` rows do not create direct Storekeeper deductions.
10. `MAIN_STORE_DIRECT` rows create a Storekeeper issue task without marking consumption.
11. Empty operator sub-stock does not block Reception Job Card creation.
12. Job Card creation snapshots recipe values even if Owner changes the recipe later.
13. The top-level primary material remains compatible with existing operator pages.
14. Duplicate BOM rows are rejected.
15. Legacy recipe rows migrate into canonical `serviceBOM` without duplicate active rows.
16. The receptionist page no longer supplies empty machine/material data to a component that requires real options.
17. Reception does not configure or manually record ink consumption.
18. Completing a printed Job Card deducts the configured ink quantity from operator sub-stock exactly once.
19. An ordinary BOM containing an automatic ink material is rejected or flagged to prevent double deduction.

---

# 12. Final Architecture in Simple Terms

```text
Owner configures service recipe
    ↓
Reception corrects customer order if needed
    ↓
System calculates all confirmed raw materials
    ↓
Reception reviews the material list and confirms payment
    ↓
Job Card stores the complete recipe snapshot
    ↓
Operator uses operator sub-stock for machine materials
    ↓
Storekeeper directly issues non-sub-stock materials to the Job Card
    ↓
Actual usage, waste, and return are recorded
    ↓
Operator completion automatically deducts ink from operator sub-stock
    ↓
Owner reviews substrate/direct-material usage plus automatic ink cost
```

The key design rule is:

> **The routed machine material is not the complete recipe. The complete `serviceBOM` snapshot on the Job Card is the source of truth for raw-material control.**

This solves the current Reception gap without turning the application into a complex operations-management system.
