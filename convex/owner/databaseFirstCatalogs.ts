import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { requireOwner, requirePermission } from "../users";
import { runDatabaseFirstSeed } from "./seedDatabaseFirst";
import { validateNumber } from "../systemConfigs";
import { logConfigChange, computeFieldChanges } from "./configAudit";
import {
  normalizeText,
  deriveSlug,
  normalizeCatalogFamily,
  normalizeBaseUnit,
  normalizePurchaseUnit,
  normalizeGroupTone,
  normalizeGroupIcon,
} from "../utils/normalizer";

// Helper to query dynamically added database-first tables
const qTable = (ctx: QueryCtx | MutationCtx, table: string): any => (ctx.db.query as any)(table);

// Re-export drift detection endpoints
export { detectConfigDrift, reconcileConfigDrift } from "./driftDetection";

// Re-export price estimates endpoints
export {
  listPriceEstimates,
  getActivePriceEstimate,
  upsertPriceEstimate,
  deactivatePriceEstimate,
} from "./priceEstimates";

// ─── Unified Seeder & Sync Status ──────────────────────────────────────────

export const seedDatabaseFirstCatalogs = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await runDatabaseFirstSeed(ctx);
  },
});

export const getDatabaseFirstSyncStatus = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "machine.view");
    const [
      services,
      materials,
      routes,
      capLinks,
      specFields,
      roles,
      roleConfigs,
      workspaceRoutes,
      rolePermissions,
      categoryGroups,
    ] = await Promise.all([
      qTable(ctx, "serviceCatalog").collect(),
      qTable(ctx, "materialCatalog").collect(),
      qTable(ctx, "serviceRoutes").collect(),
      qTable(ctx, "machineCapabilityLinks").collect(),
      qTable(ctx, "serviceSpecFields").collect(),
      qTable(ctx, "roles").collect(),
      qTable(ctx, "roleWorkspaceConfig").collect(),
      qTable(ctx, "workspaceRoutes").collect(),
      qTable(ctx, "rolePermissions").collect(),
      qTable(ctx, "materialCategoryGroups").collect(),
    ]);

    return {
      services: {
        total: services.length,
        active: services.filter((s: any) => s.active).length,
        publishable: services.filter((s: any) => s.publishable).length,
      },
      materials: {
        total: materials.length,
        active: materials.filter((m: any) => m.active).length,
      },
      routes: {
        total: routes.length,
        active: routes.filter((r: any) => r.active).length,
      },
      capabilityLinks: {
        total: capLinks.length,
        active: capLinks.filter((l: any) => l.active).length,
      },
      specFields: {
        total: specFields.length,
        active: specFields.filter((f: any) => f.active).length,
      },
      roles: {
        total: roles.length,
        active: roles.filter((r: any) => r.active).length,
      },
      roleConfigs: {
        total: roleConfigs.length,
        active: roleConfigs.filter((c: any) => c.active).length,
      },
      workspaceRoutes: {
        total: workspaceRoutes.length,
        active: workspaceRoutes.filter((w: any) => w.active).length,
      },
      rolePermissions: {
        total: rolePermissions.length,
        active: rolePermissions.filter((p: any) => p.active).length,
      },
      categoryGroups: {
        total: categoryGroups.length,
        active: categoryGroups.filter((g: any) => g.active).length,
      },
    };
  },
});

// ─── Phase 1: Service Catalog Endpoints ────────────────────────────────────

export const listServices = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let q: any[] = await qTable(ctx, "serviceCatalog").collect();
    if (!args.includeInactive) {
      q = q.filter((s) => s.active);
    }
    return q.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const getService = query({
  args: { serviceId: v.string() },
  handler: async (ctx, args) => {
    return qTable(ctx, "serviceCatalog")
      .withIndex("by_service_id", (q: any) => q.eq("id", args.serviceId))
      .first();
  },
});

export const upsertService = mutation({
  args: {
    id: v.string(),
    labelEn: v.string(),
    labelAm: v.string(),
    categoryKey: v.string(),
    categoryNameEn: v.string(),
    categoryNameAm: v.optional(v.string()),
    iconKey: v.optional(v.string()),
    sortOrder: v.number(),
    active: v.boolean(),
    publishable: v.boolean(),
    attributes: v.optional(v.record(v.string(), v.union(v.string(), v.number()))),
    expectedUpdatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const now = Date.now();
    const id = normalizeText(args.id);
    const labelEn = normalizeText(args.labelEn);
    const labelAm = normalizeText(args.labelAm);
    const categoryKey = normalizeText(args.categoryKey).toUpperCase();
    const categoryNameEn = normalizeText(args.categoryNameEn);

    if (!id) throw new Error("Service ID is required.");
    if (!labelEn) throw new Error("English label is required.");
    if (!labelAm) throw new Error("Amharic label is required.");
    if (!categoryKey) throw new Error("Category key is required.");

    const existing = await qTable(ctx, "serviceCatalog")
      .withIndex("by_service_id", (q: any) => q.eq("id", id))
      .first();

    if (existing && args.expectedUpdatedAt !== undefined && existing.updatedAt !== args.expectedUpdatedAt) {
      throw new Error("CONFIG_CONFLICT: Service was modified since you opened it. Reload to review the latest changes.");
    }

    const payload = {
      id,
      labelEn,
      labelAm,
      categoryKey,
      categoryNameEn,
      categoryNameAm: args.categoryNameAm ? normalizeText(args.categoryNameAm) : undefined,
      iconKey: args.iconKey ? normalizeText(args.iconKey) : undefined,
      sortOrder: args.sortOrder,
      active: args.active,
      publishable: args.publishable,
      attributes: args.attributes,
      updatedAt: now,
    };

    let resultId: string;
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      resultId = existing._id;
      await logConfigChange(ctx, {
        entityType: "service",
        entityId: id,
        action: "update",
        fieldChanges: computeFieldChanges(existing, payload),
        changedBy: profile._id,
      });
    } else {
      resultId = await ctx.db.insert("serviceCatalog", {
        ...payload,
        createdAt: now,
      });
      await logConfigChange(ctx, {
        entityType: "service",
        entityId: id,
        action: "create",
        changedBy: profile._id,
      });
    }

    return resultId;
  },
});

export const toggleServiceActive = mutation({
  args: { serviceId: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const item = await qTable(ctx, "serviceCatalog")
      .withIndex("by_service_id", (q: any) => q.eq("id", args.serviceId))
      .first();
    if (!item) throw new Error(`Service ${args.serviceId} not found`);

    if (item.active && !args.active) {
      // Referential integrity check (Section 6.1)
      const routes: any[] = await qTable(ctx, "serviceRoutes").collect();
      const activeRoutes = routes.filter((r) => r.active && r.serviceId === args.serviceId);
      if (activeRoutes.length > 0) {
        throw new Error(
          `SERVICE_REFERENCED: Service ${args.serviceId} is used by active service route(s). Deactivate or update those routes before deactivating this service.`,
        );
      }
    }

    const now = Date.now();
    await ctx.db.patch(item._id, { active: args.active, updatedAt: now });
    await logConfigChange(ctx, {
      entityType: "service",
      entityId: args.serviceId,
      action: args.active ? "update" : "deactivate",
      fieldChanges: { active: { from: item.active, to: args.active } },
      changedBy: profile._id,
    });
  },
});

export async function validateServiceType(ctx: QueryCtx | MutationCtx, serviceId: string): Promise<boolean> {
  const service = await qTable(ctx, "serviceCatalog")
    .withIndex("by_service_id", (q: any) => q.eq("id", serviceId))
    .first();

  if (service) return service.active;
  return false;
}

export async function validateServiceSpecificationsAgainstDb(
  ctx: QueryCtx | MutationCtx,
  serviceId: string,
  input?: Record<string, string>,
): Promise<Record<string, string> | undefined> {
  const service = await qTable(ctx, "serviceCatalog")
    .withIndex("by_service_id", (q: any) => q.eq("id", serviceId))
    .first();

  if (!service || !service.active) {
    throw new Error(`Service "${serviceId}" is not available in the service catalog.`);
  }

  const specFields: any[] = await qTable(ctx, "serviceSpecFields")
    .withIndex("by_service", (q: any) => q.eq("serviceId", serviceId).eq("active", true))
    .collect();

  specFields.sort((a, b) => a.sortOrder - b.sortOrder);

  if (specFields.length === 0) {
    return input && Object.keys(input).length ? input : undefined;
  }

  if (!input) {
    throw new Error(`Select the required material specifications for ${service.labelEn}.`);
  }

  const normalized: Record<string, string> = {};
  for (const field of specFields) {
    const value = input[field.fieldKey]?.trim();
    if (field.required && !value) {
      throw new Error(`${field.labelEn} is required.`);
    }
    if (value) {
      if (field.options && field.options.length > 0 && !field.options.includes(value)) {
        throw new Error(`${field.labelEn} must be selected from the confirmed options.`);
      }
      normalized[field.fieldKey] = value;
    }
  }

  return normalized;
}

/**
 * Authoritative customer-facing catalog query.
 * Sourced directly from `serviceCatalog` and `serviceSpecFields`.
 * Convex database is the single source of truth; no static fallback.
 */
export const getPublishedCatalog = query({
  args: {},
  handler: async (ctx) => {
    const services: any[] = await qTable(ctx, "serviceCatalog")
      .withIndex("by_active", (q: any) => q.eq("active", true))
      .collect();

    const publishable = services
      .filter((s) => s.publishable)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    if (publishable.length === 0) {
      return [];
    }

    const allSpecFields: any[] = await qTable(ctx, "serviceSpecFields").collect();
    const activeSpecFields = allSpecFields.filter((f) => f.active);

    const specFieldsByService = new Map<string, any[]>();
    for (const field of activeSpecFields) {
      const list = specFieldsByService.get(field.serviceId) ?? [];
      list.push({
        key: field.fieldKey,
        label: field.labelEn,
        labelEn: field.labelEn,
        labelAm: field.labelAm,
        materialName: field.materialName,
        options: field.options ?? [],
        required: field.required,
        sortOrder: field.sortOrder,
      });
      specFieldsByService.set(field.serviceId, list);
    }

    for (const list of specFieldsByService.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    const categoryMap = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        categoryNameEn: string;
        categoryNameAm: string;
        iconKey?: string;
        sortOrder: number;
        items: any[];
      }
    >();

    for (const svc of publishable) {
      const catKey = svc.categoryKey;
      let cat = categoryMap.get(catKey);
      if (!cat) {
        cat = {
          categoryId: catKey,
          categoryName: svc.categoryNameAm ?? svc.categoryNameEn,
          categoryNameEn: svc.categoryNameEn,
          categoryNameAm: svc.categoryNameAm ?? svc.categoryNameEn,
          iconKey: svc.iconKey,
          sortOrder: svc.sortOrder,
          items: [],
        };
        categoryMap.set(catKey, cat);
      }

      cat.items.push({
        id: svc.id,
        label: svc.labelEn,
        labelEn: svc.labelEn,
        labelAm: svc.labelAm,
        iconKey: svc.iconKey,
        sortOrder: svc.sortOrder,
        attributes: svc.attributes,
        specFields: specFieldsByService.get(svc.id) ?? [],
      });
    }

    return Array.from(categoryMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

// ─── Service Specification Fields (Owner Management) ──────────────────────

export const listServiceSpecFields = query({
  args: {
    serviceId: v.string(),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let rows: any[] = await qTable(ctx, "serviceSpecFields")
      .withIndex("by_service_all", (q: any) => q.eq("serviceId", args.serviceId))
      .collect();

    if (!args.includeInactive) {
      rows = rows.filter((r) => r.active);
    }
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const upsertServiceSpecField = mutation({
  args: {
    serviceId: v.string(),
    fieldKey: v.string(),
    labelEn: v.string(),
    labelAm: v.optional(v.string()),
    materialName: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    required: v.boolean(),
    sortOrder: v.number(),
    active: v.boolean(),
    expectedUpdatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const now = Date.now();
    const serviceId = normalizeText(args.serviceId);
    const fieldKey = normalizeText(args.fieldKey);
    const labelEn = normalizeText(args.labelEn);
    const labelAm = args.labelAm ? normalizeText(args.labelAm) : undefined;
    const materialName = args.materialName ? normalizeText(args.materialName) : undefined;

    if (!serviceId) throw new Error("Service ID is required.");
    if (!fieldKey) throw new Error("Field key is required.");
    if (!labelEn) throw new Error("English label is required.");

    const service = await qTable(ctx, "serviceCatalog")
      .withIndex("by_service_id", (q: any) => q.eq("id", serviceId))
      .first();
    if (!service) throw new Error(`Service "${serviceId}" does not exist in serviceCatalog.`);

    const existing = await qTable(ctx, "serviceSpecFields")
      .withIndex("by_service_all", (q: any) => q.eq("serviceId", serviceId))
      .filter((q: any) => q.eq(q.field("fieldKey"), fieldKey))
      .first();

    if (existing && args.expectedUpdatedAt !== undefined && existing.updatedAt !== args.expectedUpdatedAt) {
      throw new Error("CONFIG_CONFLICT: Specification field was modified since you opened it. Reload to review changes.");
    }

    const payload = {
      serviceId,
      fieldKey,
      labelEn,
      labelAm,
      materialName,
      options: args.options?.map((o) => normalizeText(o)).filter(Boolean),
      required: args.required,
      sortOrder: args.sortOrder,
      active: args.active,
      updatedAt: now,
    };

    let resultId: string;
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      resultId = existing._id;
      await logConfigChange(ctx, {
        entityType: "spec_field",
        entityId: `${serviceId}:${fieldKey}`,
        action: "update",
        fieldChanges: computeFieldChanges(existing, payload),
        changedBy: profile._id,
      });
    } else {
      resultId = await ctx.db.insert("serviceSpecFields", {
        ...payload,
        createdAt: now,
      });
      await logConfigChange(ctx, {
        entityType: "spec_field",
        entityId: `${serviceId}:${fieldKey}`,
        action: "create",
        changedBy: profile._id,
      });
    }

    return resultId;
  },
});

export const toggleServiceSpecFieldActive = mutation({
  args: {
    id: v.id("serviceSpecFields"),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Specification field not found.");

    const now = Date.now();
    await ctx.db.patch(args.id, { active: args.active, updatedAt: now });
    await logConfigChange(ctx, {
      entityType: "spec_field",
      entityId: `${item.serviceId}:${item.fieldKey}`,
      action: args.active ? "update" : "deactivate",
      fieldChanges: { active: { from: item.active, to: args.active } },
      changedBy: profile._id,
    });
  },
});

export const deleteServiceSpecField = mutation({
  args: {
    id: v.id("serviceSpecFields"),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Specification field not found.");

    await ctx.db.delete(args.id);
    await logConfigChange(ctx, {
      entityType: "spec_field",
      entityId: `${item.serviceId}:${item.fieldKey}`,
      action: "deactivate",
      fieldChanges: { deleted: { from: false, to: true } },
      changedBy: profile._id,
    });
  },
});

// ─── Phase 2: Material Specifications Catalog Endpoints ────────────────────

export const listMaterialsCatalog = query({
  args: { includeInactive: v.optional(v.boolean()), catalogFamily: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let rows: any[] = await qTable(ctx, "materialCatalog").collect();
    if (!args.includeInactive) {
      rows = rows.filter((r) => r.active);
    }
    if (args.catalogFamily) {
      rows = rows.filter((r) => r.catalogFamily === args.catalogFamily);
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getMaterialCatalogItem = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return qTable(ctx, "materialCatalog")
      .withIndex("by_material_id", (q: any) => q.eq("id", args.id))
      .first();
  },
});

export const listMaterialAttributeDefinitions = query({
  args: { includeInactive: v.optional(v.boolean()), catalogFamily: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let rows: any[] = await qTable(ctx, "materialAttributeDefinitions").collect();
    if (!args.includeInactive) rows = rows.filter((row) => row.active);
    if (args.catalogFamily) rows = rows.filter((row) => row.applicableCatalogFamily.includes(args.catalogFamily));
    return rows.sort((left, right) => left.key.localeCompare(right.key));
  },
});

export const upsertMaterialCatalogItem = mutation({
  args: {
    id: v.optional(v.string()),
    name: v.string(),
    aliases: v.optional(v.array(v.string())),
    category: v.string(),
    catalogFamily: v.string(),
    baseUnit: v.string(),
    purchaseUnit: v.string(),
    conversionRatio: v.number(),
    rollWidth: v.optional(v.number()),
    sheetWidth: v.optional(v.number()),
    sheetLength: v.optional(v.number()),
    thickness: v.optional(v.number()),
    attributes: v.optional(v.record(v.string(), v.union(v.string(), v.number()))),
    specificationOptions: v.optional(v.array(v.string())),
    compatibleMachineTypes: v.optional(v.array(v.string())),
    storageLocation: v.optional(v.string()),
    averageUse: v.optional(v.string()),
    catalogDimensions: v.optional(v.string()),
    catalogVariant: v.optional(v.string()),
    active: v.boolean(),
    expectedUpdatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const name = normalizeText(args.name);
    const category = normalizeText(args.category);
    const catalogFamily = normalizeCatalogFamily(args.catalogFamily);
    const baseUnit = normalizeBaseUnit(args.baseUnit);
    const purchaseUnit = normalizePurchaseUnit(args.purchaseUnit);

    if (!name) throw new Error("Material name is required.");
    if (!category) throw new Error("Material category is required.");

    validateNumber(args.conversionRatio, "Conversion ratio", { min: 0 });
    if (args.conversionRatio <= 0) throw new Error("Conversion ratio must be greater than zero.");
    if (args.rollWidth !== undefined) validateNumber(args.rollWidth, "Roll width", { min: 0 });
    if (args.sheetWidth !== undefined) validateNumber(args.sheetWidth, "Sheet width", { min: 0 });
    if (args.sheetLength !== undefined) validateNumber(args.sheetLength, "Sheet length", { min: 0 });
    if (args.thickness !== undefined) validateNumber(args.thickness, "Thickness", { min: 0 });

    if (catalogFamily === "ROLL" && (!args.rollWidth || args.rollWidth <= 0)) {
      throw new Error("ROLL materials require a rollWidth greater than zero.");
    }
    if (catalogFamily === "RIGID_SHEET" && (!args.sheetWidth || args.sheetWidth <= 0)) {
      throw new Error("RIGID_SHEET materials require a sheetWidth greater than zero.");
    }
    if (catalogFamily === "RIGID_SHEET" && (!args.sheetLength || args.sheetLength <= 0)) {
      throw new Error("RIGID_SHEET materials require a sheetLength greater than zero.");
    }
    if (catalogFamily === "INK_SOLVENT" && !["L", "mL", "ml"].includes(baseUnit)) {
      throw new Error("INK_SOLVENT materials require a volume baseUnit such as L or mL.");
    }
    if (args.attributes) {
      for (const [key, value] of Object.entries(args.attributes)) {
        if (!key.trim()) throw new Error("Material attribute keys cannot be empty.");
        if (typeof value === "number") validateNumber(value, `Material attribute ${key}`);
      }
    }

    const now = Date.now();
    const id = normalizeText(args.id ?? "") || deriveSlug(name);
    const existing = await qTable(ctx, "materialCatalog")
      .withIndex("by_material_id", (q: any) => q.eq("id", id))
      .first();

    const aliases = (args.aliases ?? []).map(normalizeText).filter(Boolean);
    const allMaterials: any[] = await qTable(ctx, "materialCatalog").collect();
    const duplicate = allMaterials.find((row) => {
      if (existing && row._id === existing._id) return false;
      const names = [row.name, ...(row.aliases ?? [])].map((value: string) => normalizeText(value).toLowerCase());
      return names.includes(name.toLowerCase()) || aliases.some((alias) => names.includes(alias.toLowerCase()));
    });
    if (duplicate) throw new Error(`A material named ${name} already exists.`);

    if (existing && args.expectedUpdatedAt !== undefined && existing.updatedAt !== args.expectedUpdatedAt) {
      throw new Error("CONFIG_CONFLICT: MATERIAL_CONFLICT: this material changed since you opened it. Reload and retry.");
    }

    // Referential integrity check before renaming or changing active status (Section 6.1)
    if (existing && (normalizeText(existing.name).toLowerCase() !== name.toLowerCase() || existing.active !== args.active)) {
      const oldNames = new Set([normalizeText(existing.name).toLowerCase(), normalizeText(existing.id).toLowerCase()]);
      const routes: any[] = await qTable(ctx, "serviceRoutes").collect();
      const referenced = routes.filter((route) => route.active && oldNames.has(normalizeText(route.preferredMaterialName).toLowerCase()));
      if (referenced.length > 0) {
        throw new Error(
          `MATERIAL_REFERENCED: ${existing.name} is used by active service routes: ${referenced.map((route) => route.serviceId).join(", ")}. Update those routes before renaming or deactivating this material.`,
        );
      }
    }

    const payload = {
      id,
      name,
      aliases: aliases.length ? aliases : undefined,
      category,
      catalogFamily,
      baseUnit,
      purchaseUnit,
      conversionRatio: args.conversionRatio,
      rollWidth: args.rollWidth,
      sheetWidth: args.sheetWidth,
      sheetLength: args.sheetLength,
      thickness: args.thickness,
      attributes: args.attributes,
      specificationOptions: args.specificationOptions,
      compatibleMachineTypes: args.compatibleMachineTypes,
      storageLocation: args.storageLocation ? normalizeText(args.storageLocation) : undefined,
      averageUse: args.averageUse ? normalizeText(args.averageUse) : undefined,
      catalogDimensions: args.catalogDimensions ? normalizeText(args.catalogDimensions) : undefined,
      catalogVariant: args.catalogVariant ? normalizeText(args.catalogVariant) : undefined,
      active: args.active,
      updatedAt: now,
    };

    let resultId: string;
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      resultId = existing._id;
      await logConfigChange(ctx, {
        entityType: "material",
        entityId: id,
        action: "update",
        fieldChanges: computeFieldChanges(existing, payload),
        changedBy: profile._id,
      });
    } else {
      resultId = await ctx.db.insert("materialCatalog", {
        ...payload,
        createdAt: now,
      });
      await logConfigChange(ctx, {
        entityType: "material",
        entityId: id,
        action: "create",
        changedBy: profile._id,
      });
    }

    return resultId;
  },
});

export const toggleMaterialCatalogActive = mutation({
  args: { id: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const item = await qTable(ctx, "materialCatalog")
      .withIndex("by_material_id", (q: any) => q.eq("id", args.id))
      .first();
    if (!item) throw new Error(`Material spec ${args.id} not found`);

    if (item.active && !args.active) {
      const routes: any[] = await qTable(ctx, "serviceRoutes").collect();
      const itemNames = new Set([String(item.name).trim().toLowerCase(), String(item.id).trim().toLowerCase()]);
      const referenced = routes.filter((route) => route.active && itemNames.has(String(route.preferredMaterialName).trim().toLowerCase()));
      if (referenced.length > 0) {
        throw new Error(
          `MATERIAL_REFERENCED: ${item.name} is used by active service routes: ${referenced.map((route) => route.serviceId).join(", ")}. Update those routes before deactivating this material.`,
        );
      }
    }

    const now = Date.now();
    await ctx.db.patch(item._id, { active: args.active, updatedAt: now });
    await logConfigChange(ctx, {
      entityType: "material",
      entityId: args.id,
      action: args.active ? "update" : "deactivate",
      fieldChanges: { active: { from: item.active, to: args.active } },
      changedBy: profile._id,
    });
  },
});

// ─── Phase 3: Service Production Routes Endpoints ──────────────────────────

export const listServiceRoutes = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let rows: any[] = await qTable(ctx, "serviceRoutes").collect();
    if (!args.includeInactive) {
      rows = rows.filter((r) => r.active);
    }
    return rows.sort((a, b) => a.serviceId.localeCompare(b.serviceId));
  },
});

export const upsertServiceRoute = mutation({
  args: {
    serviceId: v.string(),
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
    expectedUpdatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const serviceId = normalizeText(args.serviceId);
    const preferredMachineCode = normalizeText(args.preferredMachineCode);
    const preferredMaterialName = normalizeText(args.preferredMaterialName);

    // Referential integrity validations (Section 4.2 & Section 6)
    const service = await qTable(ctx, "serviceCatalog")
      .withIndex("by_service_id", (q: any) => q.eq("id", serviceId))
      .first();
    if (!service) {
      throw new Error(`Referenced serviceId '${serviceId}' does not exist in serviceCatalog.`);
    }

    const machine = (await ctx.db.query("machines").collect()).find(
      (m: any) => m.code === preferredMachineCode,
    );
    if (!machine) {
      throw new Error(`Referenced preferredMachineCode '${preferredMachineCode}' does not exist in machines table.`);
    }

    // Verify preferred material exists in materialCatalog by id or name/alias
    const allMaterials: any[] = await qTable(ctx, "materialCatalog").collect();
    const materialMatch = allMaterials.find((m: any) => {
      const names = [m.id, m.name, ...(m.aliases ?? [])].map((v: string) => normalizeText(v).toLowerCase());
      return names.includes(preferredMaterialName.toLowerCase());
    });
    if (!materialMatch) {
      throw new Error(`Referenced preferredMaterialName '${preferredMaterialName}' does not exist in materialCatalog.`);
    }

    validateNumber(args.defaultWasteMarginPercent, "Default waste margin", { min: 0, max: 100 });
    validateNumber(args.maxScrapLimitPercent, "Max scrap limit", { min: 0, max: 100 });

    const now = Date.now();
    const existing = await qTable(ctx, "serviceRoutes")
      .withIndex("by_service_active", (q: any) => q.eq("serviceId", serviceId).eq("active", true))
      .first();

    if (existing && args.expectedUpdatedAt !== undefined && existing.updatedAt !== args.expectedUpdatedAt) {
      throw new Error("CONFIG_CONFLICT: this service route changed since you opened it. Reload and retry.");
    }

    const payload = {
      serviceId,
      materialType: normalizeText(args.materialType),
      preferredMaterialName: materialMatch.name, // normalize to authoritative catalog name
      requiredCapabilities: args.requiredCapabilities.map(normalizeText).filter(Boolean),
      legacyCapabilities: args.legacyCapabilities.map(normalizeText).filter(Boolean),
      operatorRole: normalizeText(args.operatorRole),
      preferredMachineCode,
      calculationUnit: normalizeBaseUnit(args.calculationUnit),
      defaultWasteMarginPercent: args.defaultWasteMarginPercent,
      maxScrapLimitPercent: args.maxScrapLimitPercent,
      active: args.active,
      updatedAt: now,
    };

    let resultId: string;
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      resultId = existing._id;
      await logConfigChange(ctx, {
        entityType: "route",
        entityId: serviceId,
        action: "update",
        fieldChanges: computeFieldChanges(existing, payload),
        changedBy: profile._id,
      });
    } else {
      resultId = await ctx.db.insert("serviceRoutes", {
        ...payload,
        createdAt: now,
      });
      await logConfigChange(ctx, {
        entityType: "route",
        entityId: serviceId,
        action: "create",
        changedBy: profile._id,
      });
    }

    return resultId;
  },
});

// ─── Phase 6: Canonical Roles Catalog Endpoints (Section 8.1) ──────────────

export const listRoles = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let rows: any[] = await qTable(ctx, "roles").collect();
    if (!args.includeInactive) {
      rows = rows.filter((r) => r.active);
    }
    return rows.sort((a, b) => a.code.localeCompare(b.code));
  },
});

export const getRole = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return qTable(ctx, "roles")
      .withIndex("by_code", (q: any) => q.eq("code", args.code))
      .first();
  },
});

export const upsertRole = mutation({
  args: {
    code: v.string(),
    labelEn: v.string(),
    labelAm: v.string(),
    workspaceId: v.string(),
    active: v.boolean(),
    attributes: v.optional(v.record(v.string(), v.union(v.string(), v.number()))),
    expectedUpdatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const code = deriveSlug(args.code);
    const labelEn = normalizeText(args.labelEn);
    const labelAm = normalizeText(args.labelAm);
    const workspaceId = normalizeText(args.workspaceId);

    if (!code) throw new Error("Role code is required.");
    if (!labelEn) throw new Error("Role English label is required.");
    if (!labelAm) throw new Error("Role Amharic label is required.");

    // Verify workspaceId exists in workspaceRoutes
    const workspace = await qTable(ctx, "workspaceRoutes")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", workspaceId))
      .first();
    if (!workspace) {
      throw new Error(`Referenced workspaceId '${workspaceId}' does not exist in workspaceRoutes.`);
    }

    const existing = await qTable(ctx, "roles")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .first();

    if (existing && args.expectedUpdatedAt !== undefined && existing.updatedAt !== args.expectedUpdatedAt) {
      throw new Error("CONFIG_CONFLICT: this role changed since you opened it. Reload and retry.");
    }

    const now = Date.now();
    const payload = {
      code,
      labelEn,
      labelAm,
      workspaceId,
      active: args.active,
      attributes: args.attributes,
      updatedAt: now,
    };

    let resultId: string;
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      resultId = existing._id;
      await logConfigChange(ctx, {
        entityType: "role",
        entityId: code,
        action: "update",
        fieldChanges: computeFieldChanges(existing, payload),
        changedBy: profile._id,
      });
    } else {
      resultId = await ctx.db.insert("roles", {
        ...payload,
        createdAt: now,
      });
      await logConfigChange(ctx, {
        entityType: "role",
        entityId: code,
        action: "create",
        changedBy: profile._id,
      });
    }

    // Maintain corresponding roleWorkspaceConfig
    const existingConfig = await qTable(ctx, "roleWorkspaceConfig")
      .withIndex("by_role", (q: any) => q.eq("roleCode", code))
      .first();
    if (!existingConfig) {
      await ctx.db.insert("roleWorkspaceConfig", {
        roleCode: code,
        workspaceId,
        homeRoute: workspace.routePrefix,
        active: args.active,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(existingConfig._id, {
        workspaceId,
        active: args.active,
        updatedAt: now,
      });
    }

    return resultId;
  },
});

export const toggleRoleActive = mutation({
  args: { code: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const role = await qTable(ctx, "roles")
      .withIndex("by_code", (q: any) => q.eq("code", args.code))
      .first();
    if (!role) throw new Error(`Role ${args.code} not found.`);

    if (role.active && !args.active) {
      // Referential integrity check (Section 6.1)
      const activeUsers = (await ctx.db.query("users").collect()).filter(
        (u: any) => u.active && u.role === args.code,
      );
      if (activeUsers.length > 0) {
        throw new Error(
          `ROLE_REFERENCED: Cannot deactivate role '${args.code}' because ${activeUsers.length} active staff profile(s) are assigned to it (${activeUsers.map((u: any) => u.email || u.name).join(", ")}). Reassign these users first.`,
        );
      }
    }

    const now = Date.now();
    await ctx.db.patch(role._id, { active: args.active, updatedAt: now });

    // Also toggle roleWorkspaceConfig
    const config = await qTable(ctx, "roleWorkspaceConfig")
      .withIndex("by_role", (q: any) => q.eq("roleCode", args.code))
      .first();
    if (config) {
      await ctx.db.patch(config._id, { active: args.active, updatedAt: now });
    }

    await logConfigChange(ctx, {
      entityType: "role",
      entityId: args.code,
      action: args.active ? "update" : "deactivate",
      fieldChanges: { active: { from: role.active, to: args.active } },
      changedBy: profile._id,
    });
  },
});

// ─── Role Workspace Routing Endpoints ─────────────────────────────────────

export const listRoleWorkspaceConfigs = query({
  args: {},
  handler: async (ctx) => {
    const rows: any[] = await qTable(ctx, "roleWorkspaceConfig").collect();
    return rows.sort((a, b) => a.roleCode.localeCompare(b.roleCode));
  },
});

export const upsertRoleWorkspaceConfig = mutation({
  args: {
    roleCode: v.string(),
    workspaceId: v.string(),
    homeRoute: v.string(),
    machineSlug: v.optional(v.string()),
    active: v.boolean(),
    expectedUpdatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const now = Date.now();
    const roleCode = deriveSlug(args.roleCode);
    const workspaceId = normalizeText(args.workspaceId);
    const homeRoute = normalizeText(args.homeRoute);

    const existing = await qTable(ctx, "roleWorkspaceConfig")
      .withIndex("by_role", (q: any) => q.eq("roleCode", roleCode))
      .first();

    if (existing && args.expectedUpdatedAt !== undefined && existing.updatedAt !== args.expectedUpdatedAt) {
      throw new Error("CONFIG_CONFLICT: this role workspace config changed since you opened it. Reload and retry.");
    }

    const payload = {
      roleCode,
      workspaceId,
      homeRoute,
      machineSlug: args.machineSlug ? normalizeText(args.machineSlug) : undefined,
      active: args.active,
      updatedAt: now,
    };

    let id: string;
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      id = existing._id;
      await logConfigChange(ctx, {
        entityType: "role_workspace",
        entityId: roleCode,
        action: "update",
        fieldChanges: computeFieldChanges(existing, payload),
        changedBy: profile._id,
      });
    } else {
      id = await ctx.db.insert("roleWorkspaceConfig", {
        ...payload,
        createdAt: now,
      });
      await logConfigChange(ctx, {
        entityType: "role_workspace",
        entityId: roleCode,
        action: "create",
        changedBy: profile._id,
      });
    }

    return id;
  },
});

export const listWorkspaceRoutes = query({
  args: {},
  handler: async (ctx) => {
    const rows: any[] = await qTable(ctx, "workspaceRoutes").collect();
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

// ─── Phase 7: Role Permissions Endpoints ───────────────────────────────────

export const listRolePermissions = query({
  args: { roleCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let rows: any[] = await qTable(ctx, "rolePermissions").collect();
    if (args.roleCode) {
      rows = rows.filter((r) => r.roleCode === args.roleCode);
    }
    return rows.filter((r) => r.active);
  },
});

export const toggleRolePermission = mutation({
  args: {
    roleCode: v.string(),
    permission: v.string(),
    active: v.boolean(),
    elevatedConfirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const roleCode = normalizeText(args.roleCode);
    const permission = normalizeText(args.permission);

    // Section 7.2: Elevated confirmation check for highest-risk permission alterations
    if (args.active && !args.elevatedConfirmed) {
      throw new Error("ELEVATED_CONFIRMATION_REQUIRED: Modifying role permissions requires explicit elevated confirmation.");
    }

    const existing = await qTable(ctx, "rolePermissions")
      .withIndex("by_role", (q: any) => q.eq("roleCode", roleCode))
      .filter((q: any) => q.eq(q.field("permission"), permission))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { active: args.active, updatedAt: now });
      await logConfigChange(ctx, {
        entityType: "permission",
        entityId: `${roleCode}:${permission}`,
        action: args.active ? "update" : "deactivate",
        fieldChanges: { active: { from: existing.active, to: args.active } },
        changedBy: profile._id,
      });
    } else if (args.active) {
      await ctx.db.insert("rolePermissions", {
        roleCode,
        permission,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      await logConfigChange(ctx, {
        entityType: "permission",
        entityId: `${roleCode}:${permission}`,
        action: "create",
        changedBy: profile._id,
      });
    }
  },
});

// ─── Phase 8: Material Category Groups Endpoints ───────────────────────────

export const listMaterialCategoryGroups = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let rows: any[] = await qTable(ctx, "materialCategoryGroups").collect();
    if (!args.includeInactive) {
      rows = rows.filter((g) => g.active);
    }
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const upsertMaterialCategoryGroup = mutation({
  args: {
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
    expectedUpdatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const now = Date.now();
    const id = deriveSlug(args.id);
    const labelEn = normalizeText(args.labelEn);
    const labelAm = normalizeText(args.labelAm);
    const tone = normalizeGroupTone(args.tone);
    const iconName = normalizeGroupIcon(args.iconName);

    const existing = await qTable(ctx, "materialCategoryGroups")
      .filter((q: any) => q.eq(q.field("id"), id))
      .first();

    if (existing && args.expectedUpdatedAt !== undefined && existing.updatedAt !== args.expectedUpdatedAt) {
      throw new Error("CONFIG_CONFLICT: this category group changed since you opened it. Reload and retry.");
    }

    const payload = {
      id,
      labelEn,
      labelAm,
      descriptionEn: args.descriptionEn ? normalizeText(args.descriptionEn) : undefined,
      descriptionAm: args.descriptionAm ? normalizeText(args.descriptionAm) : undefined,
      iconName,
      tone,
      memberCategories: args.memberCategories.map(normalizeText).filter(Boolean),
      sortOrder: args.sortOrder,
      active: args.active,
      updatedAt: now,
    };

    let resultId: string;
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      resultId = existing._id;
      await logConfigChange(ctx, {
        entityType: "group",
        entityId: id,
        action: "update",
        fieldChanges: computeFieldChanges(existing, payload),
        changedBy: profile._id,
      });
    } else {
      resultId = await ctx.db.insert("materialCategoryGroups", {
        ...payload,
        createdAt: now,
      });
      await logConfigChange(ctx, {
        entityType: "group",
        entityId: id,
        action: "create",
        changedBy: profile._id,
      });
    }

    return resultId;
  },
});

// ─── Phase 9: Configuration Change Log Endpoints (Section 7.1) ─────────────

export const listConfigChangeLog = query({
  args: {
    limit: v.optional(v.number()),
    entityType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audit.view");
    const limit = args.limit ?? 50;
    let logs: any[] = await qTable(ctx, "configChangeLog").collect();
    if (args.entityType) {
      logs = logs.filter((l) => l.entityType === args.entityType);
    }
    return logs.sort((a, b) => b.changedAt - a.changedAt).slice(0, limit);
  },
});
