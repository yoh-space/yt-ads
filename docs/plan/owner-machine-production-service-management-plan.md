# Owner Machine Dashboard: Production Consumption, Material Linkage, and Service Catalog Plan

## Repository Context

**Repository:** `yoh-space/yt-ads`  
**Branch:** `main`  
**Latest synchronized commit:** `a10f9ee` (`feat(config): overhaul operational configuration UI and structure`)  
**Plan status:** Planning only. This document defines the next implementation phase and does not modify runtime behavior.

## Objective

Create a complete owner-only machine configuration workspace where production consumption rules, raw-material compatibility, and machine-supported services are managed through full create, read, update, and archive operations.

The same active service records must drive all service displays, including the public customer landing page, customer order wizard, Telegram/Mini App flows, dashboard order forms, order validation, service specifications, BOM resolution, and production routing.

The owner dashboard must become the operational source of truth. Existing static catalogs and seed definitions remain useful as migration and seed input, but they must no longer be independent runtime authorities after rollout.

## Expected Result

After implementation, an owner should be able to open the machine dashboard, select a machine, and manage the complete production contract for that machine:

| Configuration area | Owner operations |
|---|---|
| Machine identity | Create, edit, activate, archive, restore, and inspect machine metadata |
| Ink consumption | Define ink material, color/channel, measurement unit, consumption rate, waste allowance, and active period |
| Raw-material linkage | Link exact material variants to a machine, define relationship type, production mode, conversion override, and required status |
| Service support | Add or remove services produced by the machine, define priority, capacity, pricing visibility, and routing constraints |
| Service BOM | Define required raw materials and consumables per service, including quantity, unit, waste, and optional/required status |
| Operational health | See active jobs, queued jobs, linked material count, linked service count, and missing configuration warnings |
| Audit and lifecycle | Review who changed a configuration, when it changed, what changed, and whether the record is active or archived |

The customer-facing service list must show only active, publishable services. A service that is not backed by an active machine route and valid material/BOM configuration must not be presented as orderable unless the owner deliberately enables a controlled “quote required” state.

## Current-State Findings

The latest code has useful foundations but still distributes responsibility across multiple sources.

| Area | Current state | Problem to solve |
|---|---|---|
| Owner machine dashboard | `/dashboard/owner/machines` shows status, active jobs, and queue counts | It is read-only and does not manage machine production configuration. |
| Owner operational configuration | `/dashboard/owner/operational-configuration` manages global conversion, ink default, waste, scrap, and valuation settings | Global defaults are not enough for machine-specific ink and material rules. |
| Machine records | `machines` contains legacy arrays such as `primaryMaterials`, `compatibleInks`, `solventNames`, and `inkRequirements` | Text arrays and embedded objects are difficult to validate and can drift from inventory identities. |
| Normalized foundations | `machineMaterialLinks`, `capabilities`, `machineCapabilities`, `operatorRoles`, and `operatorMachineAssignments` now exist | They need a full owner UI and runtime adoption. |
| Service catalog | `src/shared/services.ts` and `src/constants/services.ts` provide static grouped service lists | The public wizard still depends on code-defined services instead of owner-managed active records. |
| Service routing | `materialTypeCatalog`, `serviceBOM`, `serviceMaterialRecipes`, and `CANONICAL_SERVICE_ROUTES` coexist | Routing and display can disagree, and legacy fallback paths remain. |
| Consumption | `jobConsumption.ts` deducts material and ink using material fields and global fallback configuration | It does not snapshot and enforce a machine-specific consumption rule. |
| Seed data | `seed.ts`, `production-manifest.ts`, and material master data seed machines and materials | Seed records need stable keys and explicit creation of consumption, links, services, and BOM rows. |

## Architectural Decision

Use the database as the runtime source of truth for **machines, material variants, machine-material links, ink rules, service definitions, machine-service routes, and service BOMs**.

Static TypeScript catalogs remain in the repository for the following limited purposes:

1. Initial seed data for a fresh workspace.
2. Idempotent migration input for existing deployments.
3. Tests and fixture generation.
4. Compatibility aliases for legacy service IDs and material names.

Runtime UI and routing code must query active database records. It must not import static service arrays to decide which services are orderable.

## Target Data Model

### 1. Machine production profile

Retain `machines` as the physical asset table. Add or complete the following profile fields:

| Field | Purpose |
|---|---|
| `catalogKey` | Immutable seed identity, such as `crystal_jet_7k` |
| `isProductionFleet` | Distinguishes production machines from auxiliary equipment |
| `configurationStatus` | `draft`, `ready`, `blocked`, or `archived` |
| `defaultCalculationUnit` | Default unit for production requirements |
| `defaultWasteMarginPercent` | Machine fallback only; service rules may override it |
| `maxAllowedScrapLimitPercent` | Safety threshold for machine output |
| `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | Audit metadata |
| `archivedAt`, `archivedBy`, `archiveReason` | Safe lifecycle handling |

A machine is `ready` only when it has at least one active capability, one active service route when it is production fleet equipment, and valid material configuration for every required route.

### 2. Machine raw-material links

Use the existing `machineMaterialLinks` table as the single compatibility relationship. Extend it where necessary to support exact production behavior:

| Field | Purpose |
|---|---|
| `machineId` | Physical machine |
| `materialId` | Exact stock-tracked material variant |
| `relationshipType` | `primary`, `supported`, `ink`, `solvent`, `accessory`, or `consumable` |
| `productionType` | `area`, `linear`, `ink`, or `unit` |
| `isDefault` | Preferred material for automatic route selection |
| `requiredForService` | Indicates that a route cannot run without the material |
| `conversionRatioOverride` | Machine-specific package-to-base conversion override |
| `wasteMarginPercent` | Machine-material default waste |
| `minimumStockThreshold` | Optional machine-specific operational warning threshold |
| `active`, effective dates | Lifecycle and future-dated configuration |
| audit fields | Change attribution |

The exact material variant ID must be used. Display names, family names, and aliases may assist search but must not be persisted as compatibility keys.

### 3. Ink consumption rules

Create a dedicated `machineInkConsumptionRules` table rather than relying on `machines.inkRequirements` or `materials.consumptionRate` alone.

Recommended fields:

| Field | Purpose |
|---|---|
| `machineId` | Machine using the ink |
| `materialId` | Exact ink material variant |
| `inkColor` | Channel or color, such as `CMYK`, `WHITE`, `CLEAR`, or a specific color |
| `consumptionUnit` | `ml_per_sqm`, `ml_per_linear_m`, `ml_per_piece`, or `fixed_per_job` |
| `rate` | Consumption quantity in the declared unit |
| `wasteAllowancePercent` | Ink-specific waste allowance |
| `isDefault` | Default rule when multiple compatible ink variants exist |
| `active`, effective dates | Lifecycle control |
| `notes` | Operator instruction or calibration note |
| audit fields | Owner/admin change history |

The rule must reference a material whose production type is `ink` and whose base unit supports a volume conversion. A machine cannot have two active default rules for the same color and consumption unit.

### 4. Service definitions

Create or evolve a database-backed `serviceDefinitions` table. It should represent the customer-facing service identity and display content.

Recommended fields:

| Field | Purpose |
|---|---|
| `serviceKey` | Stable identifier such as `banner_print` |
| `categoryKey` | Owner-managed grouping, such as `LARGE_FORMAT_PRINTING` |
| `nameEn`, `nameAm` | Customer-facing labels |
| `shortDescriptionEn`, `shortDescriptionAm` | Landing-page description |
| `iconKey` | Safe UI icon identifier, not executable code |
| `sortOrder` | Display ordering |
| `active` | Internal availability |
| `publishable` | Whether it can appear on public customer surfaces |
| `requiresQuote` | Allows a visible service that cannot be instantly priced |
| `specificationSchema` | Structured fields/options required by the order wizard |
| `createdAt`, `updatedAt`, and audit fields | Ownership and history |

Stable service keys must remain compatible with existing orders. If a label changes, historical orders continue to display their service key with a snapshot label where required.

### 5. Machine-service routes

Create a `machineServiceRoutes` table connecting services to machines and capabilities.

Recommended fields:

| Field | Purpose |
|---|---|
| `machineId` | Machine capable of producing the service |
| `serviceId` | Database service definition |
| `capabilityId` | Capability required for this route |
| `priority` | Preferred route ordering |
| `active` | Whether the route is selectable |
| `requiresManualReview` | Prevents automatic confirmation when needed |
| `calculationUnit` | Area, length, pieces, or another production unit |
| `defaultWasteMarginPercent` | Route-specific waste |
| `maxScrapLimitPercent` | Route-specific guardrail |
| `customerVisible` | Whether the route contributes to publishability |
| effective dates and audit fields | Versioned lifecycle |

A service is **orderable** only when it has at least one active customer-visible route and every required BOM material is active and compatible with that route’s machine.

### 6. Service BOM and consumption profile

Use `serviceBOM` as the authoritative multi-material production recipe. Extend it with `machineServiceRouteId` when consumption differs by machine route. Keep service-level BOM rows for common requirements and route-level overrides for machine-specific requirements.

Each BOM row must support:

- Exact material variant ID.
- Consumption mode: fixed, area rate, linear rate, quantity rate, or ink rate.
- Quantity per service unit.
- Waste allowance percentage.
- Required versus optional state.
- Package/base-unit conversion snapshot.
- Customer-visible or internal-only description.
- Active lifecycle and audit metadata.

The existing `serviceMaterialRecipes` table should become a compatibility layer during migration and then be read-only. New owner dashboard edits should write to `serviceBOM` and route-level consumption tables.

## Owner Machine Dashboard Design

Expand `/dashboard/owner/machines` into a master-detail configuration workspace. The list remains a status overview, while selecting a machine opens the configuration detail view.

### Machine list

The list should provide search, status filtering, active/archived filtering, configuration readiness, linked service count, linked material count, and current production status. Each row should show warnings such as “No ink rule,” “No active service,” “Missing required material,” or “Unresolved legacy configuration.”

### Machine detail tabs

| Tab | Required content and CRUD behavior |
|---|---|
| Overview | Machine identity, status, capability summary, active jobs, readiness warnings, archive/restore actions |
| Raw materials | Add, edit, archive, restore machine-material links; choose exact material variant; configure production type, defaults, waste, and required state |
| Ink consumption | Add, edit, archive, restore ink rules; select ink material and color; define rate and unit; mark one default per channel |
| Services | Add, edit, archive, restore service routes; select service, capability, priority, calculation unit, and customer visibility |
| Service BOM | Manage raw materials, inks, accessories, and consumables required for each selected service route |
| Operators | View compatible operator assignments and missing capability issues |
| Audit | View configuration changes and effective dates |

All mutations must be owner-only initially. If delegation is later enabled, use explicit permissions such as `machine.config.manage`, `machine.consumption.manage`, and `service.catalog.manage`; never rely only on frontend visibility.

### Validation behavior

The interface should prevent invalid configuration before save and the backend must repeat all validation.

| Invalid state | Expected behavior |
|---|---|
| Ink rule references a non-ink material | Reject with a material-family error |
| Two active default ink rules share machine/color | Reject the second default |
| Service route references an archived machine or capability | Reject save |
| Required BOM material is not linked to the route machine | Reject activation and show the missing link |
| Machine has no active route but is marked production-ready | Reject readiness change |
| Published service has no valid customer-visible route | Block publication |
| Archived material is used by a new BOM row | Reject new row; preserve historical rows |
| Existing job references an archived rule | Preserve immutable snapshot and allow historical reporting |

## Customer Landing Page and Order Wizard Integration

The public landing page, service picker, order wizard, Telegram Mini App, dashboard order modal, and order validation must use one public service query, for example `publicCatalog.listPublishedServices`.

The query should return:

- Service key and localized labels.
- Category and display order.
- Description and icon key.
- Supported specification fields and options.
- Availability status.
- Whether the service requires a quote.
- Optional customer-facing material or finish choices.

The customer wizard should stop importing `SERVICE_CATEGORIES` to determine the available service set. It may retain a local icon map and presentation fallback, but the service identity and labels must come from Convex.

The server must validate submitted service IDs against the active database service definition. It must reject inactive or unpublished services even if a stale client submits the old key.

Existing orders must remain readable. When a service is renamed or archived, historical order views should use the stored service key and a display snapshot captured at order creation.

## Production Consumption Integration

Update `jobConsumption.ts` and job-card creation so each material requirement snapshots the selected configuration:

- Machine ID.
- Machine-service route ID.
- Material variant ID.
- Machine-material link ID.
- Ink rule ID where applicable.
- Consumption mode and rate.
- Waste allowance.
- Conversion ratio.
- Source configuration version or updated timestamp.

Incremental production logging must use the job snapshot, not current mutable machine settings. This prevents a later owner edit from changing the meaning of historical consumption.

Ink deduction should calculate from the selected route’s ink rule. The global `systemConfigs.inkMlPerSquareMetre` value remains a fallback only for legacy jobs and should produce a configuration warning when used for a new job.

Solvents and accessories should remain explicitly modeled. If a material is not automatically consumed, its relationship must be marked as non-automatic rather than inferred from a name containing “solvent.”

## Seed and Migration Instructions

### Fresh workspace seed

Extend the workspace seed to create the following records in a deterministic order:

1. Material categories and material definitions.
2. Exact raw-material variants, including current roll, sheet, ink, solvent, lighting, electrical, hardware, apparel, and display items.
3. Digital Screen A1/A2 and Neon Light variants where absent.
4. Machine records with stable `catalogKey` values.
5. Capability records from `CAPABILITY_REGISTRY`.
6. Machine-capability links.
7. Machine-material links for primary materials, inks, solvents, accessories, and consumables.
8. Ink consumption rules using the canonical machine ink names and rates.
9. Service definitions using the current 22 canonical service IDs and localized labels.
10. Machine-service routes using `CANONICAL_SERVICE_ROUTES` as seed input.
11. Service BOM rows using the existing service BOM/material recipe definitions.
12. Publishability and readiness status after validating routes and required materials.

The seed must be idempotent. It must match by stable key and preserve owner edits. A re-run must not duplicate services, links, ink rules, or BOM rows.

### Existing workspace migration

Add a one-shot migration with a clear report. The migration must:

- Match machines by `catalogKey`, code, and approved aliases.
- Match materials by `variantKey`, catalog key, SKU, and approved aliases.
- Convert embedded machine ink requirements into `machineInkConsumptionRules`.
- Convert machine material arrays into `machineMaterialLinks`.
- Convert `CANONICAL_SERVICE_ROUTES` and `materialTypeCatalog` rows into machine-service routes.
- Convert `serviceMaterialRecipes` into `serviceBOM` rows.
- Detect duplicate or ambiguous matches and report them without guessing.
- Preserve all operational history and existing job requirements.
- Write a migration checkpoint into `migrations`.

The owner must review unresolved material names, missing machines, unsupported service routes, and missing consumption rates before public services are switched to database-backed publication.

### Seed data table requirements

The owner configuration UI should expose table views for all seedable master data. Each row should have a stable key, display name, active state, source label (`seeded` or `owner-created`), and last update metadata.

| Seed table | Minimum columns |
|---|---|
| Materials | Key, name, category, variant attributes, base unit, purchase unit, conversion, active |
| Machines | Key, code, name, type, capability count, service count, status, readiness |
| Machine materials | Machine, material variant, relationship, production mode, default, required, active |
| Ink rules | Machine, ink material, color, rate, unit, default, active |
| Services | Key, English label, Amharic label, category, published, route count, BOM readiness |
| Machine services | Machine, service, capability, priority, customer-visible, quote-required, active |
| Service BOM | Service/route, material, mode, quantity, waste, required, active |

These tables are not merely reporting views. They are the owner’s editing surface for the database-backed configuration.

## API and Module Boundaries

Create a dedicated catalog module, or extend the existing `convex/catalog.ts`, with separate functions for:

- Owner machine configuration overview.
- Machine-material CRUD.
- Machine ink consumption CRUD.
- Service definition CRUD.
- Machine-service route CRUD.
- Service BOM CRUD.
- Readiness validation.
- Published public service query.
- Seed reconciliation and migration report.

Keep public queries read-only and return only publishable records. Keep owner mutations permission-protected and audited. Avoid exposing internal conversion details or unpublished machine configuration to the public client.

## Testing Strategy

Add tests before switching runtime consumers.

| Test area | Required coverage |
|---|---|
| Ink rules | Valid rate/unit, ink-material enforcement, duplicate defaults, archive behavior |
| Material links | Exact variant identity, duplicate active links, compatibility, required/default rules |
| Service routes | Active machine/capability validation, priority, customer visibility, archive behavior |
| Service publication | Only services with valid active routes and BOMs are public |
| BOM | Required material validation, route-specific overrides, quantity and waste validation |
| Seed reconciliation | Idempotence, no duplication, owner edits preserved, unresolved aliases reported |
| Production snapshots | Job requirements retain old rates after owner edits |
| Public wizard | Database services render in category order, inactive services disappear, stale submissions reject |
| Legacy compatibility | Existing order/service IDs continue to display correctly |
| Permissions | Owner-only mutations and public read-only access |
| UI | Full CRUD forms, validation warnings, archive/restore, readiness indicators, audit view |

The implementation completion gate is `npm run check`, focused catalog and consumption tests, the full Vitest suite, and `npm run build`.

## Rollout Plan

### Phase 1: Schema and read-only owner view

Add the service definitions, machine ink rules, machine-service routes, and route-level BOM fields. Add owner dashboard tabs in read-only mode. Add readiness and migration-report queries.

### Phase 2: Owner CRUD

Enable owner CRUD for machine-material links, ink consumption rules, service routes, service definitions, and BOM rows. Add audit events, archive behavior, and backend validation.

### Phase 3: Seed reconciliation

Seed all current machines, material variants, ink rules, routes, services, and BOM rows. Run the migration report and resolve ambiguous records.

### Phase 4: Runtime switching

Switch job-card creation and production consumption to route snapshots. Switch public service display and customer wizard to the published-service query. Keep static catalog fallback only behind a monitored legacy compatibility path.

### Phase 5: Deprecation

Stop writing legacy machine arrays, embedded ink requirements, `materialTypeCatalog` routing projections, and client-side service availability lists. Remove fallback reads after the owner confirms production parity.

## Acceptance Criteria

The implementation is complete when:

1. The owner can manage machine-specific ink consumption with full CRUD and archive behavior.
2. The owner can manage exact machine-to-raw-material links with production rules.
3. The owner can manage which services each machine supports.
4. The owner can manage service BOMs and required consumables from the machine dashboard.
5. Service readiness warnings identify missing machines, materials, ink rules, or BOM rows.
6. Current seed machines and raw materials are reconciled without duplicate records.
7. Digital Screen and Neon Light records are available as structured seed data where applicable.
8. The public landing page and customer order wizard display the same active service records.
9. Inactive or unpublished services cannot be submitted through stale clients.
10. Job cards snapshot machine, route, material, and consumption configuration.
11. Later owner edits do not change historical production consumption calculations.
12. Existing orders and service IDs remain readable.
13. Every owner configuration mutation is permission-protected and auditable.
14. Typecheck, focused tests, full tests, and production build pass.

## References

[1]: https://github.com/yoh-space/yt-ads/blob/main/src/app/%28dashboard%29/dashboard/owner/machines/page.tsx "YT Ads owner machine dashboard"

[2]: https://github.com/yoh-space/yt-ads/blob/main/convex/jobConsumption.ts "YT Ads production consumption engine"

[3]: https://github.com/yoh-space/yt-ads/blob/main/src/shared/services.ts "YT Ads canonical service catalog"

[4]: https://github.com/yoh-space/yt-ads/blob/main/src/shared/production-manifest.ts "YT Ads machine and service routing manifest"

[5]: https://github.com/yoh-space/yt-ads/blob/main/convex/serviceRecipes.ts "YT Ads service recipe management"

[6]: https://github.com/yoh-space/yt-ads/blob/main/convex/seed.ts "YT Ads workspace seed and migration paths"

[7]: https://github.com/yoh-space/yt-ads/blob/main/docs/plan/dynamic-catalog-single-source-plan.md "YT Ads dynamic catalog single-source plan"
