# Database-First Migration Plan

## Goal
Eliminate ALL static configuration files as runtime sources. Every catalog (services, materials, machines, roles, capabilities, routing rules, permissions) must be managed through the database with owner UI CRUD operations. No code changes required to add/update/delete any business entity.

---

Important Details
Repository: yoh-space/yt-ads, branch: main
Production Convex deployment: glad-ibis-568 (dashboard URL: https://dashboard.convex.dev/t/yoh-space/yt-ads/glad-ibis-568)
Deploy command: npx convex deploy --yes (pushes to production); --prod for running queries/mutations against production
22 canonical service IDs defined in src/shared/services.ts (SERVICE_IDS), mirrored in convex/schema.ts serviceType union
Custom Tabs component (src/components/shared/ui/tabs.tsx) uses defaultValue only — no controlled value/onValueChange props
safeMutation signature: (key, promise, onSuccess?, onError?) from src/utils/pending-store.ts
Pre-existing test failure: admin.test.ts (auth mock issue, unrelated to changes)
staff table uses applicationRoles (array), NOT role field; users table has single role field
System data reset wipes everything except non-operator staff — one-time irreversible operation, dataResetExecuted flag

## Architecture Principle

**Before:** Static TS files → imported at runtime → schema validates with `v.union(v.literal(...))`  
**After:** DB tables → queried at runtime → mutations validate against DB catalogs → schema uses `v.string()` with FK-like validation

---

## Phase 1: Service Catalog (22 services)

### Problem
`src/shared/services.ts` is imported by 18 files. Adding a new service requires editing this file, `convex/schema.ts` (the `serviceType` v.union), and redeploying.

### Solution

**New table:** `serviceCatalog`
```typescript
serviceCatalog: defineTable({
  id: v.string(),              // "banner_print" — stable slug, replaces serviceType literal
  labelEn: v.string(),         // "Banner Printing"
  labelAm: v.string(),         // "የባነር ማተሚያ"
  categoryKey: v.string(),     // "PRINTING"
  categoryNameEn: v.string(), // "Printing & Stickers"
  categoryNameAm: v.string(),
  iconKey: v.optional(v.string()),
  sortOrder: v.number(),
  active: v.boolean(),
  publishable: v.boolean(),    // visible to customers
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_service_id", ["id"]).index("by_active", ["active", "sortOrder"])
```

**Schema change:** `serviceType` v.union → `v.string()`
- Validation moves to mutation handlers: `validateServiceType(ctx, serviceType)` queries `serviceCatalog` for valid active IDs
- Existing `serviceDefinitions` table stays (it has different fields); `serviceCatalog` is the new authoritative catalog

**Owner UI:** Service management page with table + create/edit/delete modals

**Migration path:**
1. Create `serviceCatalog` table
2. Seed from static `SERVICE_IDS` + `SERVICE_CATEGORIES` + `AMHARIC_SERVICE_LABELS`
3. Add `validateServiceType()` helper
4. Update `convex/schema.ts`: `serviceType: v.string()`
5. Update all 18 import sites to query `serviceCatalog`
6. Remove `src/shared/services.ts` runtime exports (keep type-only)

**Files to update:**
- `convex/schema.ts` — change serviceType validator
- `convex/orders.ts` — validate against DB
- `convex/orderAutomation.ts` — query DB for route resolution
- `convex/seed.ts` — seed from DB
- `src/shared/service-specifications.ts` — derive from DB
- `src/shared/roll-width.ts` — derive from DB
- `src/app/telegram/bot.ts` — query DB
- `src/app/telegram/keyboards.ts` — query DB
- All Mini App wizard components — use Convex query
- Dashboard order components — use Convex query

---

## Phase 2: Material Specifications (40+ materials)

### Problem
`src/shared/material-specifications.ts` (800+ lines) is the runtime source for all material metadata. `findMaterialSpecification()` is called on every material create/update.

### Solution

**New table:** `materialCatalog`
```typescript
materialCatalog: defineTable({
  id: v.string(),              // stable slug: "banner_flex"
  name: v.string(),            // "Banner Flex"
  aliases: v.optional(v.array(v.string())),
  category: v.string(),        // "Banner Flex", "Ink", etc.
  catalogFamily: v.string(),   // "ROLL", "RIGID_SHEET", "INK_SOLVENT", "HARDWARE"
  baseUnit: v.string(),        // "m²", "m", "L", "pcs"
  purchaseUnit: v.string(),    // "roll", "sheet", "liter", "piece"
  conversionRatio: v.number(),
  rollWidth: v.optional(v.number()),
  sheetWidth: v.optional(v.number()),
  sheetLength: v.optional(v.number()),
  specificationOptions: v.optional(v.array(v.string())),
  compatibleMachineTypes: v.optional(v.array(v.string())),
  storageLocation: v.optional(v.string()),
  averageUse: v.optional(v.string()),
  catalogDimensions: v.optional(v.string()),
  catalogVariant: v.optional(v.string()),
  active: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_material_id", ["id"]).index("by_name", ["name"]).index("by_active", ["active"])
```

**Schema changes:**
- `materialCatalogFamily` v.union → `v.string()` (validated against `materialCatalog` distinct families)
- `materialFamily` v.union → `v.string()` (validated at mutation level)

**Owner UI:** Material catalog management with import/export, specification editor

**Migration path:**
1. Create `materialCatalog` table
2. Seed from static `MATERIAL_SPECIFICATIONS`
3. Add `validateMaterialCatalogFamily()` and `findMaterialInCatalog()` helpers
4. Update `convex/schema.ts` validators
5. Update `findMaterialSpecification()` to query DB
6. Update `nav-config.ts`, material modals, service-specifications to use DB
7. Remove `src/shared/material-specifications.ts` runtime exports

---

## Phase 3: Service Routes (22 routing rules)

### Problem
`CANONICAL_SERVICE_ROUTES` in `production-manifest.ts` is the routing matrix. `orderAutomation.ts` builds a static Map at module load. Owner can't change waste margins without code deploy.

### Solution

**Existing table:** `materialTypeCatalog` (already exists, seeded)  
**Enhanced table:** `serviceRoutes` (new, replaces `materialTypeCatalog`)
```typescript
serviceRoutes: defineTable({
  serviceId: v.string(),       // FK → serviceCatalog.id
  materialType: v.string(),
  preferredMaterialName: v.string(),
  requiredCapabilities: v.array(v.string()),
  legacyCapabilities: v.array(v.string()),
  operatorRole: v.string(),
  preferredMachineCode: v.string(),
  calculationUnit: v.string(),
  defaultWasteMarginPercent: v.number(),
  maxScrapLimitPercent: v.number(),
  active: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_service_active", ["serviceId", "active"])
```

**Runtime change:** `resolveRouteForService()` becomes async, queries `serviceRoutes` table. `bomResolver.ts` already implements this pattern.

**Owner UI:** Route configuration editor with waste margin sliders, machine assignment dropdowns

**Migration path:**
1. Create `serviceRoutes` table
2. Seed from static `CANONICAL_SERVICE_ROUTES`
3. Make `resolveRouteForService()` async in `orderAutomation.ts`
4. Update `bomResolver.ts` to use new table
5. Remove static `CANONICAL_SERVICE_ROUTES` from `production-manifest.ts`
6. Deprecate `materialTypeCatalog` table (or migrate data to `serviceRoutes`)

---

## Phase 4: Capability Registry + Machine Capabilities

### Problem
`CAPABILITY_REGISTRY` in `production-manifest.ts` is the seed source. `normalizeCapabilityId()` uses it for string normalization. Machine→capability mapping is duplicated in 3 files.

### Solution

**Existing table:** `capabilities` (already exists)  
**Enhanced:** Add normalization aliases
```typescript
// Add to capabilities table:
// normalizationAliases: v.optional(v.array(v.string()))
```

**New table:** `machineCapabilityLinks` (replaces `machineCapabilities`)
```typescript
machineCapabilityLinks: defineTable({
  machineCode: v.string(),     // "CJ7K-01"
  capabilityCode: v.string(),  // "PRINT_ROLL_3_2M"
  active: v.boolean(),
}).index("by_machine", ["machineCode"]).index("by_capability", ["capabilityCode"])
```

**Runtime change:** `normalizeCapabilityId()` queries `capabilities` table for alias matching

**Owner UI:** Capability management, machine→capability assignment

---

## Phase 5: Service Specifications

### Problem
`SERVICE_SPECIFICATION_FIELDS` in `service-specifications.ts` defines per-service form fields for the order wizard.

### Solution

**New table:** `serviceSpecFields`
```typescript
serviceSpecFields: defineTable({
  serviceId: v.string(),       // FK → serviceCatalog.id
  fieldKey: v.string(),        // "screenSize", "faceMaterial"
  labelEn: v.string(),
  labelAm: v.string(),
  materialName: v.optional(v.string()),  // derive options from materialCatalog
  options: v.optional(v.array(v.string())),
  required: v.boolean(),
  sortOrder: v.number(),
  active: v.boolean(),
}).index("by_service", ["serviceId", "active"])
```

**Runtime change:** `serviceSpecificationFields()` queries DB. `validateServiceSpecifications()` validates against DB options.

**Owner UI:** Service specification field editor per service

---

## Phase 6: Role Routing + Workspace Config

### Problem
`role-routing.ts` has 11 roles hardcoded in multiple maps. Adding a new role requires editing 6+ locations.

### Solution

**New tables:**
```typescript
roleWorkspaceConfig: defineTable({
  roleCode: v.string(),        // "crystal_jet_operator"
  workspaceId: v.string(),     // "operator"
  homeRoute: v.string(),       // "/dashboard/operator/crystal_jet"
  machineSlug: v.optional(v.string()),  // "crystal_jet"
  active: v.boolean(),
}).index("by_role", ["roleCode"])

workspaceRoutes: defineTable({
  workspaceId: v.string(),
  routePrefix: v.string(),     // "/dashboard/operator"
  allowedRoles: v.array(v.string()),
  label: v.string(),
  labelAm: v.string(),
  sortOrder: v.number(),
  active: v.boolean(),
}).index("by_workspace", ["workspaceId"])
```

**Schema change:** `role` v.union → `v.string()` (validated against `roleWorkspaceConfig` or a `roles` table)

**Runtime change:** Middleware queries `roleWorkspaceConfig` for route authorization. Navigation queries for sidebar items.

**Owner UI:** Role management, workspace assignment, route configuration

---

## Phase 7: Permission System

### Problem
`role-permissions.ts` (shared) is static. Adding a new role or changing permissions requires code changes.

### Solution

**New table:** `rolePermissions`
```typescript
rolePermissions: defineTable({
  roleCode: v.string(),
  permission: v.string(),
  active: v.boolean(),
}).index("by_role", ["roleCode", "active"]).index("by_permission", ["permission"])
```

**Runtime change:** `hasPermission()` queries DB (with in-memory cache for performance). Load permissions on auth, cache in session.

**Owner UI:** Permission matrix editor (role × permission grid)

---

## Phase 8: Inventory Category Groups

### Problem
`inventory-category-groups.ts` has hardcoded category sets and display definitions.

### Solution

**New table:** `materialCategoryGroups`
```typescript
materialCategoryGroups: defineTable({
  id: v.string(),
  labelEn: v.string(),
  labelAm: v.string(),
  descriptionEn: v.optional(v.string()),
  descriptionAm: v.optional(v.string()),
  iconName: v.string(),
  tone: v.string(),
  memberCategories: v.array(v.string()),
  sortOrder: v.number(),
  active: v.boolean(),
}).index("by_active", ["active", "sortOrder"])
```

**Owner UI:** Category group editor

---

## Phase 9: Cleanup

### Remove static files (keep type-only):
- `src/shared/services.ts` — remove SERVICE_IDS, SERVICE_CATEGORIES, AMHARIC_SERVICE_LABELS (keep ServiceId type)
- `src/shared/material-specifications.ts` — remove MATERIAL_SPECIFICATIONS (keep types)
- `src/shared/machine-catalog.ts` — remove CANONICAL_MACHINES (keep types)
- `src/shared/production-manifest.ts` — remove CANONICAL_SERVICE_ROUTES, CAPABILITY_REGISTRY (keep types)
- `src/shared/service-specifications.ts` — remove SERVICE_SPECIFICATION_FIELDS (keep types)
- `src/shared/roll-width.ts` — remove ROLL_SUBSTRATE_MATERIAL_BY_SERVICE (keep functions)
- `src/lib/role-routing.ts` — remove static maps (keep types)
- `src/lib/access-policy.ts` — remove static maps (keep types)
- `src/lib/inventory-category-groups.ts` — remove static sets (keep types)
- `src/lib/operations-types.ts` — remove roleLabels (keep types)

### Add drift checks:
- `assertServiceCatalogSync()` — runs at seed time, verifies schema validators match DB
- `assertRoleCatalogSync()` — same for roles
- `assertMaterialCatalogSync()` — same for materials

---

## Implementation Order

| Phase | Effort | Risk | Value | Dependencies |
|-------|--------|------|-------|--------------|
| 1. Service Catalog | High | Medium | High | None |
| 2. Material Specs | High | Medium | High | None |
| 3. Service Routes | Medium | Low | High | Phase 1 |
| 4. Capabilities | Low | Low | Medium | None |
| 5. Service Specs | Medium | Low | Medium | Phase 1 |
| 6. Role Routing | Medium | Medium | High | None |
| 7. Permissions | Low | Low | High | Phase 6 |
| 8. Category Groups | Low | Low | Low | None |
| 9. Cleanup | Low | Low | Medium | All above |

**Recommended order:** 1 → 3 → 2 → 5 → 4 → 6 → 7 → 8 → 9

**Total estimated effort:** ~20-30 files changed, ~5 new DB tables, ~10 new Convex queries/mutations

---

## Testing Strategy

For each phase:
1. Unit tests for new DB queries/mutations
2. Integration tests for the migrated runtime path
3. Verify all existing tests still pass
4. Manual verification on production deployment

## Rollback Strategy

Each phase is independently deployable:
- Old static path stays as fallback until new DB path is verified
- Feature flag per phase: `useServiceCatalogDB`, `useMaterialCatalogDB`, etc.
- Disable flag to revert to static path
