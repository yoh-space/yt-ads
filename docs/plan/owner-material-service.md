# Owner-Managed Raw Materials, Pricing, Services, and Category-Aware Configuration

**Status:** Proposed design plan for approval. No application code is changed by this plan.

**Repository baseline reviewed:** `yoh-space/yt-ads`, `main` at commit `63acb5f`, with the current working tree synchronized before this review.

## 1. Executive Summary

The codebase already contains the foundation for owner-managed catalogs, but it currently separates **catalog specifications** from **operational material records** and does not yet provide one professional owner workflow for creating raw materials, setting reorder levels, recording price estimates, and maintaining services.

This plan proposes a database-first owner configuration experience built around four principles:

1. **One authoritative catalog workflow.** Owners create and edit material definitions, service definitions, and their category-specific properties from the existing Master Catalogs area.
2. **Clear separation of identity, specification, and operations.** A catalog material describes what a material is. An operational material record describes stock, reorder policy, and current inventory state. Price estimates are maintained as auditable purchase/cost metadata rather than being confused with stock quantity.
3. **Category-driven forms.** The form renders only properties applicable to the selected catalog family and material category. For example, roll/banner materials do not display sheet dimensions or thickness inputs.
4. **Strict server validation.** The UI is a convenience layer. The backend validates category-family compatibility, required fields, units, numerical ranges, uniqueness, references, and optimistic-concurrency versions.

The recommended first implementation should use the existing database-first catalog tables and owner APIs as the primary configuration surface, then add a controlled synchronization path into the operational `materials` table where the production and inventory engines require it.

## 2. Current Architecture Review

### 2.1 Existing owner configuration surface

The owner’s operational configuration page already exposes a **Master Catalogs** section through `DatabaseCatalogSuite`. That suite currently includes tabs and editing flows for service catalog entries, material catalog entries, service routes, roles, permissions, and material category groups. The suite already uses owner-only Convex mutations, optimistic concurrency through `expectedUpdatedAt`, configuration audit logging, and a slide-panel editing pattern.[1]

The current owner configuration page is therefore the correct location for the new workflow. Creating a separate raw-material administration page would duplicate navigation, validation, audit behavior, and catalog concepts.[2]

### 2.2 Existing catalog data model

The database-first schema already defines:

- `serviceCatalog` for owner-managed services with labels, categories, publishability, ordering, and dynamic attributes.
- `materialCatalog` for material identity, category, catalog family, base/purchase units, conversion ratio, roll dimensions, sheet dimensions, thickness, dynamic attributes, storage metadata, and active state.
- `materialAttributeDefinitions` for reusable category-family attribute definitions with string/number value types and applicable catalog families.
- `serviceRoutes` for material, machine, operator, calculation, waste, and scrap routing.
- `serviceSpecFields` for customer-facing service-order fields.[3]

This is a strong base for category-aware configuration. The existing `attributes` records are flexible but currently lack a formal value contract beyond string-or-number and are not yet visibly driven by the attribute-definition table in the owner form.

### 2.3 Existing operational material model

The operational `materials` table remains the source used by inventory, stock movements, material requests, production deduction, low-stock calculations, and reporting. It contains `quantity`, `reorderAt`, unit and conversion fields, material family, ink metadata, storage information, and several legacy specification fields.[4]

The owner API already supports updating an operational material’s `reorderAt` through `convex/owner/materials.ts`. The existing endpoint validates non-negative values and writes a configuration audit row, but the current configuration list exposes only a small summary and does not provide a complete owner material editor.[5]

### 2.4 Existing service model

The database-first `serviceCatalog` API already supports owner upsert, active-state changes, duplicate identity checks, labels, categories, publishability, and dynamic attributes. Service deactivation already checks active route references before allowing the operation.[6]

The application also retains older service-definition and service-route paths. The new plan should avoid creating a third service source of truth. The database-first catalog should become the owner-facing authority, while legacy tables remain compatibility projections until all consumers are migrated.[7]

### 2.5 Existing normalization and audit architecture

The repository contains shared normalizers for catalog family, base unit, purchase unit, text, slugs, group tone, and group icon. The owner catalog mutations already use these normalizers and log configuration changes with field-level diffs.[8]

The implementation should extend these conventions instead of adding form-local normalization or ad hoc string handling. All material and service writes should remain owner-authorized and auditable.

## 3. Design Goals and Non-Goals

### 3.1 Goals

The implementation will allow an owner to:

- Create, edit, archive, restore, and search raw-material catalog items.
- Set a material’s reorder level and choose the unit in which that threshold is measured.
- Record a price estimate suitable for purchasing, valuation, and quote estimation.
- Add and maintain services with category, bilingual labels, publishability, ordering, and service attributes.
- Configure category-specific material properties without displaying irrelevant fields.
- Define reusable attributes for a catalog family or category.
- Preserve active references and prevent unsafe renames, deactivations, and unit changes.
- Maintain a clear audit trail for all owner configuration changes.
- Keep existing inventory, material request, service routing, and customer-order flows operational during migration.

### 3.2 Non-goals for this phase

This phase will not implement:

- The Phase 2 ink deduction engine.
- Supplier purchase-order management.
- Automated market-price feeds.
- Multi-currency accounting or tax computation.
- Full historical price analytics unless required by the approved price model.
- Automatic deletion of catalog records.
- A broad rewrite of the public customer ordering wizard.

## 4. Proposed Domain Model

### 4.1 Material catalog versus operational material

The system should explicitly distinguish two layers:

| Layer | Table | Responsibility | Examples of fields |
| --- | --- | --- | --- |
| Catalog definition | `materialCatalog` | Defines material identity and reusable physical/specification properties | Name, aliases, category, catalog family, base unit, purchase unit, conversion ratio, dimensions, thickness, attributes |
| Operational material | `materials` | Tracks the material consumed by inventory and production workflows | Quantity, reorder level, storage location, material family, ink color, active state, operational conversion snapshot |
| Price record | Recommended new `materialPriceEstimates` table | Stores owner-maintained price estimates with unit, currency, effective date, source, and audit history | Estimated unit price, price basis, currency, effective-from, notes, active/current flag |

A catalog item may map to one or more operational material variants if the same conceptual material has different dimensions, thicknesses, colors, or purchase packaging. The mapping must use stable IDs such as `catalogKey`, `definitionKey`, and `variantKey`, not display-name matching.

### 4.2 Reorder policy

The current `materials.reorderAt` field is a single numeric threshold. The new design should preserve compatibility while making the threshold explicit:

```text
reorderPolicy = {
  enabled: boolean,
  level: number,
  unit: baseUnit | purchaseUnit,
  leadTimeDays?: number,
  safetyStock?: number,
  alertCooldownHours?: number
}
```

The preferred schema approach is to add optional structured fields to the operational material record while retaining `reorderAt` as a compatibility projection during migration. The inventory and low-stock engines should read the structured policy first and fall back to `reorderAt` for legacy rows.

The first UI release should expose `enabled`, `level`, and `unit`. Lead time, safety stock, and per-material cooldown should remain optional follow-up fields unless the owner confirms they are required now.

### 4.3 Price estimate model

“Price estimation” must be defined before implementation because it can mean different business values. The recommended initial interpretation is an owner-maintained estimated acquisition price for one purchase unit, used for inventory valuation and internal estimate calculations.

Recommended fields:

| Field | Purpose | Validation |
| --- | --- | --- |
| `materialId` or `catalogMaterialId` | Stable relation to the material | Required, existing active record |
| `amount` | Estimated purchase price | Finite, greater than or equal to zero |
| `currency` | Currency code | Required, normalized uppercase, workspace-supported currency |
| `purchaseUnit` | Unit to which the amount applies | Must match or convert from the material purchase unit |
| `baseUnitEquivalent` | Optional normalized cost basis | Derived by server when conversion is valid |
| `effectiveAt` | Price’s effective date | Required for versioning |
| `source` | Owner note such as supplier quote or manual estimate | Optional text |
| `notes` | Context for the estimate | Optional text |
| `active` | Whether used as current estimate | Server-managed or owner-controlled under uniqueness rules |

Only one current estimate per material, currency, and purchase-unit basis should be active. Historical estimates should remain immutable after creation; correcting an estimate should create a new version rather than silently rewriting the old financial assumption.

If the user instead means a **customer-facing service price estimate**, that should be a separate service-pricing model and must not be merged with raw-material acquisition cost. The implementation plan below assumes material acquisition price unless approved otherwise.

### 4.4 Service model

Services should remain in `serviceCatalog` as the authoritative owner-managed identity. A service can have:

- Stable slug/id.
- English and Amharic labels.
- Category key and category labels.
- Display ordering and icon.
- Active and publishable state.
- Dynamic service attributes.
- One or more service routes.
- Optional customer-facing specification fields.

The owner form should make the distinction visible:

- **Service definition:** what the customer can order.
- **Service route:** how the business produces it.
- **Service specification:** what information the customer must provide.

Creating a service should not automatically create a production route unless the owner explicitly chooses a guided “create with route” workflow and supplies the required machine/material configuration.

## 5. Category-Family Configuration Architecture

### 5.1 Family and category hierarchy

The catalog currently supports four canonical catalog families. The research-backed proposal adds two additional families for imported lightbox display systems and the profiles used to construct signage frames:

- `ROLL`
- `RIGID_SHEET`
- `INK_SOLVENT`
- `HARDWARE`
- `ILLUMINATED_DISPLAY_SYSTEM`
- `SIGNAGE_FRAME_PROFILE`

The earlier neon-oriented naming is not recommended. Research indicates that a lightbox is normally a display assembly containing a housing, light source, light-transmitting face or screen, and electrical components. Commercial product families include acrylic lightboxes, fabric or SEG lightboxes, ultra-thin lightboxes, soft-film lightboxes, welded lightboxes, and single- or double-sided displays.[9] The catalog should therefore describe the imported “screen light box” by its operational identity as an **illuminated display system**, not by assuming that the imported material is neon, an LED strip, or a particular face material.

The recommended names are based on **procurement and operational behavior**. `ILLUMINATED_DISPLAY_SYSTEM` represents an imported lightbox screen/display assembly or semi-finished illuminated display unit. `SIGNAGE_FRAME_PROFILE` represents aluminum or metal extrusion/profile stock used to construct lightbox and signage frames. It is intentionally named “profile” because these materials are commonly purchased and consumed as linear extrusions or bars, rather than as finished frames.

This naming keeps the catalog extensible. A future `LIGHTING_COMPONENT` family can be added later if the business separately imports LED modules, strips, drivers, or transformers as stock items. Those components should not be forced into `ILLUMINATED_DISPLAY_SYSTEM` when they are purchased independently.

The following aliases should be accepted by the normalizer but stored under the canonical names:

| Canonical family | Accepted aliases | Scope |
| --- | --- | --- |
| `ILLUMINATED_DISPLAY_SYSTEM` | `LIGHTBOX`, `LIGHT_BOX`, `SCREEN_LIGHTBOX`, `SCREEN_LIGHT_BOX`, `FABRIC_LIGHTBOX`, `SEG_LIGHTBOX`, `ILLUMINATED_DISPLAY`, `BACKLIT_DISPLAY` | Imported lightbox screen/display assemblies and semi-finished illuminated display systems |
| `SIGNAGE_FRAME_PROFILE` | `FRAME_PROFILE`, `EXTRUSION`, `EXTRUSIONS`, `FRAME`, `FRAMING`, `METAL_PROFILE`, `LIGHTBOX_FRAME`, `LIGHTBOX_BARS`, `SIGNAGE_BARS`, `ALUMINUM_PROFILE` | Aluminum or steel extrusion/profile stock, rails, bars, frame channels, and compatible joining components |

These are separate from `HARDWARE`. `HARDWARE` should remain the family for general accessories that do not have display-system or profile-stock behavior. An imported screen lightbox should be assigned to `ILLUMINATED_DISPLAY_SYSTEM` when it is purchased as a display assembly or semi-finished system. An aluminum or metal bar/profile should be assigned to `SIGNAGE_FRAME_PROFILE` when it is purchased as profile stock. A separately purchased LED module, strip, driver, or transformer should remain `HARDWARE` until a future dedicated lighting-component family is approved.

The existing `category` field is free text, while `materialCategoryGroups` provide category-group metadata. The recommended model is:

```text
catalogFamily → materialCategory → optional categoryGroup
```

`catalogFamily` controls broad physical behavior and required units. `materialCategory` controls business labeling and category-specific properties. `categoryGroup` controls navigation and display grouping.

Examples:

| Catalog family | Example categories | Typical relevant properties | Typical excluded properties |
| --- | --- | --- | --- |
| `ROLL` | Banner, vinyl, sticker roll, mesh | Roll width, roll length or purchase conversion, media finish, adhesive/backing, color, storage location | Sheet width/length, thickness unless explicitly applicable |
| `RIGID_SHEET` | Acrylic, foam board, PVC, mica, MDF | Sheet width, sheet length, thickness, finish, color, density/grade | Roll width, roll length, liquid volume |
| `INK_SOLVENT` | Ink, solvent, cleaning fluid | Volume unit, container size, ink color, chemistry, compatible machine family, safety/storage notes | Sheet dimensions, roll dimensions, thickness |
| `HARDWARE` | LED module, cable, bracket, accessory | Purchase unit, piece/pack quantity, voltage, wattage, connector, dimensions, compatibility | Roll dimensions, sheet dimensions, ink color unless defined by the category || `ILLUMINATED_DISPLAY_SYSTEM` | Screen lightbox, SEG/fabric lightbox system, acrylic lightbox assembly, ultra-thin lightbox | Display type, face/screen material, display width, display height, display depth, single/double-sided, illumination technology, voltage,
(Content truncated due to size limit. Use line ranges to read remaining content)