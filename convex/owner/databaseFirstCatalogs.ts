import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { requireOwner, requirePermission } from "../users";
import { runDatabaseFirstSeed } from "./seedDatabaseFirst";

// Helper to query dynamically added database-first tables
const qTable = (ctx: QueryCtx | MutationCtx, table: string): any => (ctx.db.query as any)(table);

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
      .withIndex("by_id", (q: any) => q.eq("id", args.serviceId))
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
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const now = Date.now();
    const existing = await qTable(ctx, "serviceCatalog")
      .withIndex("by_id", (q: any) => q.eq("id", args.id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("serviceCatalog", {
        ...args,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const toggleServiceActive = mutation({
  args: { serviceId: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const item = await qTable(ctx, "serviceCatalog")
      .withIndex("by_id", (q: any) => q.eq("id", args.serviceId))
      .first();
    if (!item) throw new Error(`Service ${args.serviceId} not found`);
    await ctx.db.patch(item._id, { active: args.active, updatedAt: Date.now() });
  },
});

export async function validateServiceType(ctx: QueryCtx | MutationCtx, serviceId: string): Promise<boolean> {
  const service = await qTable(ctx, "serviceCatalog")
    .withIndex("by_id", (q: any) => q.eq("id", serviceId))
    .first();

  if (service) return service.active;
  // Fallback to static lookup during transitional states
  return true;
}

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
      .withIndex("by_id", (q: any) => q.eq("id", args.id))
      .first();
  },
});

export const upsertMaterialCatalogItem = mutation({
  args: {
    id: v.string(),
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
    specificationOptions: v.optional(v.array(v.string())),
    compatibleMachineTypes: v.optional(v.array(v.string())),
    storageLocation: v.optional(v.string()),
    averageUse: v.optional(v.string()),
    catalogDimensions: v.optional(v.string()),
    catalogVariant: v.optional(v.string()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const now = Date.now();
    const existing = await qTable(ctx, "materialCatalog")
      .withIndex("by_id", (q: any) => q.eq("id", args.id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("materialCatalog", {
        ...args,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const toggleMaterialCatalogActive = mutation({
  args: { id: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const item = await qTable(ctx, "materialCatalog")
      .withIndex("by_id", (q: any) => q.eq("id", args.id))
      .first();
    if (!item) throw new Error(`Material spec ${args.id} not found`);
    await ctx.db.patch(item._id, { active: args.active, updatedAt: Date.now() });
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
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const now = Date.now();
    const existing = await qTable(ctx, "serviceRoutes")
      .withIndex("by_service_active", (q: any) => q.eq("serviceId", args.serviceId).eq("active", true))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("serviceRoutes", {
        ...args,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// ─── Phase 6: Role Workspace Routing Endpoints ─────────────────────────────

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
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const now = Date.now();
    const existing = await qTable(ctx, "roleWorkspaceConfig")
      .withIndex("by_role", (q: any) => q.eq("roleCode", args.roleCode))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("roleWorkspaceConfig", {
        ...args,
        createdAt: now,
        updatedAt: now,
      });
    }
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
  args: { roleCode: v.string(), permission: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const existing = await qTable(ctx, "rolePermissions")
      .withIndex("by_role", (q: any) => q.eq("roleCode", args.roleCode))
      .filter((q: any) => q.eq(q.field("permission"), args.permission))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { active: args.active, updatedAt: now });
    } else if (args.active) {
      await ctx.db.insert("rolePermissions", {
        roleCode: args.roleCode,
        permission: args.permission,
        active: true,
        createdAt: now,
        updatedAt: now,
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
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const now = Date.now();
    const existing = await qTable(ctx, "materialCategoryGroups")
      .filter((q: any) => q.eq(q.field("id"), args.id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("materialCategoryGroups", {
        ...args,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
