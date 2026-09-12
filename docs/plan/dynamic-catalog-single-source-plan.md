# Dynamic Single-Source Configuration Plan

## Repository Context

**Repository:** `yoh-space/yt-ads`  
**Synchronized branch:** `main`  
**Synchronized commit:** `60b2166`  
**Plan status:** Implementation plan only; no application source files are modified by this plan.

## Executive Decision

The application should make the database the authoritative runtime source for machines, material specifications, operator assignments, and machine-material compatibility. The existing TypeScript catalogs and seed definitions should remain as **versioned seed data and migration input**, but they must no longer be consulted as independent runtime truth after the migration.

The owner remains the configuration authority. Administrators may create, edit, archive, and manage machines, materials, operator roles, and compatibility links through delegated permissions. Every mutation must validate referential integrity, preserve historical references, and write an audit event. Destructive deletion should be replaced by archival whenever a record has inventory, job, order, request, or audit history.

The design separates four concepts that are currently mixed together:

| Concept | Purpose | Example |
|---|---|---|
| **Application role** | Controls authentication and broad authorization | `admin`, `storekeeper`, `receptionist` |
| **Operational operator role** | Describes the production responsibility assigned to a person | `Printer Operator`, `Laser Operator` |
| **Machine** | A physical production asset with capabilities and status | Crystal Jet 7K Series |
| **Material specification** | A purchasable and stock-tracked material variant | Banner Flex, 3.2m × 50m |
| **Machine-material link** | States that a machine can consume a material and defines usage rules | Crystal Jet → Banner Flex, area-based, 5% waste |
| **Service route/BOM** | States which machine capability and material specification are valid for a customer service | Banner Print → 3.2m printer + Banner Flex |

This separation prevents a machine name, material name, or fixed role string from being used as an implicit foreign key.

## Current-State Findings

The current branch already improves the catalog baseline, but it does not yet provide a complete dynamic runtime model.

| Area | Current implementation | Remaining risk |
|---|---|---|
| Machine definitions | `src/shared/production-manifest.ts`, `src/shared/machine-catalog.ts`, seeded `machines` rows | Runtime machines still carry free-text `primaryMaterials`, `compatibleInks`, `solventNames`, and a single `operatorRole`. |
| Materials | `materials` table plus `src/shared/material-specifications.ts` and admin reseed data | Specification details are partly stored as strings and arrays. Width, length, thickness, color, volume, and package identity are not consistently first-class fields. |
| Machine-material compatibility | `compatibleMachineTypes`, `machineType`, and machine arrays | Compatibility is duplicated and name-based. There is no explicit junction table with effective rules. |
| Operators | Fixed `role` union and `assignedMachineIds` on `users` | One application role is overloaded as authorization, production responsibility, routing eligibility, and machine assignment. |
| Admin control | Owner/admin modules and settings panels exist | Machine CRUD, material CRUD, role CRUD, and compatibility CRUD are not one coherent configuration workspace. |
| Seed data | Current canonical manifest and 23-category material reseed flow | Seeds can drift from runtime edits unless seed identity and idempotent reconciliation are formalized. |
| History safety | Operational tables reference machine and material IDs | Hard deletion would break historical interpretation or force unsafe cascading changes. |

The current seed data already includes the requested signage-related records, including **Digital Screen A1/A2** and **Neon Light** variants. The migration must preserve these records as canonical seeded specifications rather than adding them as ad hoc UI-only options.

## Target Data Model

### 1. Machine catalog

Retain the `machines` table as the physical asset table, but add stable catalog identity and structured capabilities. The existing `code` should become the immutable business key after deduplication.

Recommended fields:

| Field | Purpose |
|---|---|
| `catalogKey` | Stable seed identity such as `crystal_jet_7k`; unique and immutable after creation |
| `code` | Human-facing operational code such as `CJ7K-01`; unique |
| `name`, `manufacturer`, `model`, `type` | Display and procurement information |
| `status`, `active` | Runtime availability and archival state |
| `isProductionFleet` | Distinguishes production assets from auxiliary equipment |
| `capabilityIds` | References canonical capability rows rather than free-text capability descriptions |
| `defaultWasteMarginPercent`, `maxAllowedScrapLimitPercent` | Machine-level defaults |
| `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | Ownership and audit metadata |
| `archivedAt`, `archivedBy`, `archiveReason` | Safe lifecycle management |

Create a separate `machineCapabilities` table with a stable `code`, display name, category, dimensions, and active state. A `machineCapabilityLinks` table should connect machines to capabilities and record who configured the link. This allows one machine to support multiple capabilities and prevents exact-string matching failures.

### 2. Material family, specification, and variant

Use separate records for the conceptual material and the stock-tracked physical variant.

| Table | Responsibility |
|---|---|
| `materialCategories` | Owner-managed category hierarchy, for example Roll Material, Rigid Sheet, Ink, Solvent, Lighting, Electrical, Hardware, Apparel, Display |
| `materialDefinitions` | Conceptual material identity, for example Banner Flex, Mica, Digital Screen, Neon Light |
| `materialVariants` | Stock identity with dimensions, color, thickness, volume, package size, and conversion rules |

If implementation simplicity requires retaining `materials` as the operational table, it may be evolved into the equivalent of `materialVariants`, with a new `materialDefinitionId` and structured specification fields. The important rule is that a single row must represent one unambiguous stock variant.

Each material variant should support a structured specification object or normalized attributes for the requested dimensions:

| Attribute group | Examples |
|---|---|
| Roll geometry | width `3.2`, length `50`, dimension unit `m` |
| Sheet geometry | width `1.22`, length `2.44`, dimension unit `m` |
| Thickness | `3`, `5`, `10`, thickness unit `mm` |
| Color | canonical color code and display label, such as `WHITE`, `TRANSPARENT`, `WARM` |
| Volume | `1`, `5`, volume unit `L` |
| Count/package | `250 pcs per packet`, `1 piece`, `1 canister` |
| Tracking rule | `area`, `linear`, `ink`, or `unit` |
| Conversion | purchase package to base-unit ratio, stored with a clear snapshot policy |
| External identity | SKU, supplier code, aliases, and seed key |

A material should not encode its identity only in a display name such as `Mica 3mm White 1.22m × 2.44m`. The display name can be generated from structured fields, while the stable variant ID remains the reference used by inventory, service BOMs, job cards, and requests.

The seed set must include the current raw materials and the requested signage materials. At minimum, the migration acceptance list must cover Banner Flex, sticker variants, DTF Film, Canvas, inks, solvents, rigid sheets, wood, composite panels, electrical supplies, Digital Screen A1/A2, LED modules, Zecolo, Neon Light colors, wire, T-Shirts, Amire, and Roll-Up stands.

### 3. Machine-material compatibility

Create an explicit `machineMaterialLinks` table. This is the central relationship requested by the new configuration model.

Recommended fields:

| Field | Purpose |
|---|---|
| `machineId` | Physical machine reference |
| `materialVariantId` | Exact stock variant reference |
| `relationshipType` | `primary`, `supported`, `ink`, `solvent`, `accessory`, or `consumable` |
| `active` | Whether the link can be selected for new work |
| `productionType` | `area`, `linear`, `ink`, or `unit` |
| `conversionRatioOverride` | Optional machine-specific conversion override |
| `wasteMarginPercent` | Optional machine-specific default |
| `required` | Whether the material is mandatory for a machine/service path |
| `notes` | Operational instructions |
| `effectiveFrom`, `effectiveTo` | Configuration versioning without rewriting history |
| `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | Audit trail |

Add a uniqueness constraint in mutation logic for active `(machineId, materialVariantId, relationshipType)` links. Existing arrays such as `primaryMaterials`, `compatibleInks`, and `solventNames` should become compatibility-read projections during the migration and eventually be deprecated.

### 4. Operational operator roles and assignments

Keep the fixed application `role` union for security-critical authorization. Add an owner-managed `operatorRoles` table for production roles. This avoids attempting to make authentication permissions dynamically executable from arbitrary user-entered strings.

Recommended `operatorRoles` fields include `code`, `name`, `description`, `active`, `allowedCapabilityIds`, `createdAt`, `updatedAt`, and audit metadata. Add `userOperatorRoleAssignments` or extend `users` with an `operatorRoleId` only after enforcing one active assignment per user.

Replace the current assumption that `assignedMachineIds` alone defines an operator with an explicit `operatorMachineAssignments` table containing `userId`, `machineId`, `operatorRoleId`, `active`, effective dates, and assignment audit fields. The assignment validator must ensure:

1. The user has an application role permitted to operate machinery.
2. The assigned operational role is active.
3. The machine is active and not archived.
4. The operator role is allowed for at least one capability on the machine.
5. A user cannot be assigned to a machine outside the owner/admin delegation policy.
6. Historical assignments remain readable after archival.

The existing `assignedMachineIds` field should be retained temporarily as a compatibility projection, then removed after all readers use the assignment table.

## Ownership and Permission Model

The owner is the single source of truth for configuration policy. Admins may perform the day-to-day mutations through explicit permissions, but they do not create a parallel catalog.

Recommended permissions:

| Permission | Owner | Admin | Manager | Other roles |
|---|---:|---:|---:|---:|
| View configuration | Yes | Yes | Optional | No |
| Create/edit machines | Yes | Yes | No | No |
| Archive machines | Yes | Yes, guarded | No | No |
| Create/edit material definitions and variants | Yes | Yes | No | No |
| Archive materials | Yes | Yes, guarded | No | No |
| Create/edit operational operator roles | Yes | Yes | No | No |
| Assign operators to machines | Yes | Yes | Optional | No |
| Configure machine-material links | Yes | Yes | No | No |
| Purge/reseed catalog | Owner only | No | No | No |
| Override protected historical references | Owner only and audited | No | No | No |

All mutations must use server-side permission checks. Hiding a button is not an authorization boundary.

## Migration and Seed Strategy

### Phase 0: Protect the current working tree

Before implementation, preserve and verify the synchronized checkout. The latest pull completed successfully at `60b2166`, and the prior local settings hook-order change is already present in the synchronized tree. No unrelated local changes should be included in the catalog work.

### Phase 1: Introduce stable identities and normalized tables

Add the new schema tables and indexes without removing existing fields. Define validators for material categories, specification attributes, capabilities, links, operator roles, and assignments. Add unique-key checks in mutations because Convex schema indexes do not by themselves provide all required business constraints.

Add a migration that:

1. Deduplicates machines by canonical code and records aliases for display-name differences.
2. Deduplicates materials by seed key or a deterministic composite identity.
3. Converts capability strings into canonical capability IDs.
4. Converts material names and arrays into machine-material link rows.
5. Converts `assignedMachineIds` into assignment rows.
6. Creates operational operator roles from the existing operator role union.
7. Marks ambiguous records for owner review instead of guessing.
8. Writes a migration checkpoint so it is idempotent.

No inventory, job, order, request, or audit history should be deleted by this migration.

### Phase 2: Build the owner/admin configuration workspace

Replace the current fragmented configuration pages with a coherent configuration area containing the following tabs:

| Tab | Required operations |
|---|---|
| Machines | List, search, filter by status, create, edit, archive, restore, inspect linked materials and assigned operators |
| Capabilities | Create/edit/archive capability definitions and assign them to machines |
| Materials | Browse by category, search by name/SKU, create, edit, archive, restore |
| Specifications | Manage dimensions, thickness, color, volume, package, conversion, and tracking rules |
| Machine materials | Matrix or detail view for machine-to-material links, including relationship type and usage rules |
| Operator roles | Create/edit/archive operational roles and capability eligibility |
| Assignments | Assign users to machines and operational roles with validation feedback |
| Audit history | Review configuration changes, actor, before/after values, and effective dates |

Use archive actions instead of hard-delete actions whenever the record is referenced by operational history. A delete button may be exposed only when the server confirms that no historical or dependent references exist.

### Phase 3: Switch runtime consumers to database IDs

Update routing, inventory, order automation, BOM resolution, material requests, operator stock, machine dashboards, and notifications to read from the normalized tables.

The runtime selection rules should be:

1. Select active machine capabilities by capability ID.
2. Select active machine-material links by machine ID and material variant ID.
3. Select service BOM rows by service ID and material variant ID.
4. Use structured material attributes for dimension and specification validation.
5. Snapshot the selected machine, material variant, link rules, and conversion ratio into job requirements at job-card creation.
6. Never recalculate historical job requirements from current catalog values.

The existing `src/shared/production-manifest.ts`, `src/shared/machine-catalog.ts`, and `src/shared/material-specifications.ts` should be reduced to seed definitions, migration aliases, and test fixtures. They should not be imported by production routing code after this phase.

### Phase 4: Retire duplicated fields and enforce invariants

After all readers and writers use the new tables, stop writing the legacy arrays and free-text compatibility fields. Keep read-only projections temporarily for backward compatibility, then remove them in a later migration.

Add validation for the following invariants:

| Invariant | Failure behavior |
|---|---|
| Machine code is unique | Reject mutation with a clear conflict message |
| Material variant identity is unique within a definition | Reject duplicate dimensions/color/thickness/package combinations |
| Archived machines cannot receive new jobs | Reject new assignment or route selection |
| Archived materials cannot receive new inventory | Reject new stock-in and new BOM selection |
| A link must reference active records | Reject link creation or require explicit historical mode |
| Operator assignment must match capability eligibility | Reject assignment and show the incompatible capability |
| Job-card material must be linked to its machine | Reject job creation rather than silently selecting a different material |
| Service BOM material must be active and valid | Prevent activation until all required links are valid |
| Historical snapshots are immutable | Allow only audited correction workflows |

## UI and Workflow Details

The material editor should use category-aware forms rather than one generic form. For roll materials, show width and length. For rigid sheets, show width, length, and thickness. For inks and solvents, show color, volume, and package type. For Digital Screen, LED, Neon Light, electrical, hardware, and display items, show count, dimensions, color, wattage, voltage, length, or other category-specific attributes as applicable.

The machine editor should show identity, capabilities, status, waste defaults, supported material links, required consumables, and assigned operators in separate sections. A machine cannot be activated until it has at least one valid capability and, when it is marked as production equipment, at least one supported material link.

The machine-material editor should support both a machine-centric and material-centric view. The machine-centric view answers “what can this machine consume?” The material-centric view answers “which machines can use this variant?” Both views must edit the same junction rows.

The operator assignment workflow should display compatibility before saving. For example, assigning a `Laser Operator` to a machine with no laser capability should show the missing capability and reject the mutation. A user may have multiple active machine assignments only when the owner/admin explicitly permits it.

## Testing Strategy

Add unit and integration coverage before switching runtime consumers.

| Test group | Required coverage |
|---|---|
| Schema and mutation tests | CRUD, archive, restore, unique keys, permission checks, audit events |
| Seed reconciliation tests | Existing current catalog produces the expected machine, material, capability, and link counts without duplicates |
| Specification tests | Valid and invalid width, length, thickness, color, volume, package, and conversion combinations |
| Assignment tests | Compatible and incompatible operator-role/machine assignments, archived records, duplicate assignments |
| Routing tests | Service routes choose only active machine-material links and reject unsupported combinations |
| Historical snapshot tests | Catalog edits do not change existing job requirements, stock batches, or audit displays |
| UI tests | Category-aware material forms, machine link matrix, owner/admin permissions, archive flows |
| Regression tests | Existing inventory, material requests, operator dashboard, order automation, and machine settings behavior |

The completion gate is `npm run check`, the focused Convex and routing tests, the full Vitest suite, and a successful `npm run build`.

## Rollout Order and Risk Controls

The implementation should be delivered in small, reversible slices. First add schema and migration support. Then add owner/admin read-only views. Then enable CRUD behind permissions. Then switch one runtime consumer at a time, beginning with machine settings and material requests, followed by inventory, job creation, and automatic routing. Remove legacy fields only after production reads no longer depend on them.

The owner should review the migration report before runtime switching. The report must list duplicate machines, duplicate material variants, unresolved capability strings, ambiguous machine-material links, and operator assignments that fail the new compatibility rules. No ambiguous record should be silently discarded.

The catalog reseed action must remain owner-only and must never be the normal way to edit operational configuration. Reseeding should create or reconcile missing seed records by stable key, preserve owner edits, and report conflicts instead of overwriting them.

## Acceptance Criteria

The plan is complete when all of the following are true:

1. Machines, materials, capabilities, machine-material links, operator roles, and operator assignments have stable database identities.
2. Owner and delegated admin users can manage these records from one configuration workspace.
3. Current raw materials and machines are present as idempotent seed data, including Digital Screen and Neon Light records.
4. Material variants are grouped and filtered by structured specifications rather than name parsing alone.
5. Machine compatibility is read from the machine-material junction table.
6. Operator assignments are validated against machine capabilities and operational roles.
7. Service routing and BOM selection use active database IDs and reject stale or unsupported combinations.
8. Existing stock, jobs, requests, and audit history remain readable and semantically stable.
9. Archive behavior prevents new use without destroying historical references.
10. Legacy catalogs are no longer runtime authorities.
11. Permission, migration, routing, inventory, and UI regression tests pass.
12. The owner receives a migration report with no unresolved high-severity identity conflicts before the new runtime path is enabled.

## References

[1]: https://github.com/yoh-space/yt-ads/blob/main/convex/schema.ts "YT Ads Convex schema"

[2]: https://github.com/yoh-space/yt-ads/blob/main/src/shared/production-manifest.ts "YT Ads canonical production manifest"

[3]: https://github.com/yoh-space/yt-ads/blob/main/src/shared/material-specifications.ts "YT Ads material specification catalog"

[4]: https://github.com/yoh-space/yt-ads/blob/main/convex/admin.ts "YT Ads administrative seed and catalog operations"

[5]: https://github.com/yoh-space/yt-ads/blob/main/docs/plan/single-source-remediation.md "YT Ads prior single-source remediation analysis"
