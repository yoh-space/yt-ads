import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireOwner } from "../users";
import { SERVICE_IDS } from "../../src/shared/services";

const VALID_SERVICE_KEYS = new Set<string>(SERVICE_IDS);

export const list = query({
  args: {
    includeInactive: v.optional(v.boolean()),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    let rows = await ctx.db.query("serviceDefinitions").collect();
    if (args.activeOnly === true) rows = rows.filter((r) => r.active);
    else if (!args.includeInactive) rows = rows.filter((r) => r.active);
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const getByKey = query({
  args: { serviceKey: v.string() },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    return ctx.db
      .query("serviceDefinitions")
      .withIndex("by_service_key", (q) => q.eq("serviceKey", args.serviceKey))
      .first();
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("serviceDefinitions")),
    serviceKey: v.string(),
    categoryKey: v.string(),
    nameEn: v.string(),
    nameAm: v.string(),
    shortDescriptionEn: v.optional(v.string()),
    shortDescriptionAm: v.optional(v.string()),
    iconKey: v.optional(v.string()),
    sortOrder: v.number(),
    active: v.boolean(),
    publishable: v.boolean(),
    requiresQuote: v.boolean(),
    specificationSchema: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);

    if (!VALID_SERVICE_KEYS.has(args.serviceKey)) {
      throw new Error(`Invalid service key: ${args.serviceKey}. Must be one of the canonical 22 service IDs.`);
    }
    if (!args.nameEn.trim() || !args.nameAm.trim()) {
      throw new Error("English and Amharic names are required.");
    }
    if (args.publishable && !args.active) {
      throw new Error("A publishable service must be active.");
    }

    const now = Date.now();
    const payload = {
      serviceKey: args.serviceKey,
      categoryKey: args.categoryKey.trim(),
      nameEn: args.nameEn.trim(),
      nameAm: args.nameAm.trim(),
      shortDescriptionEn: args.shortDescriptionEn?.trim() || undefined,
      shortDescriptionAm: args.shortDescriptionAm?.trim() || undefined,
      iconKey: args.iconKey?.trim() || undefined,
      sortOrder: args.sortOrder,
      active: args.active,
      publishable: args.publishable,
      requiresQuote: args.requiresQuote,
      specificationSchema: args.specificationSchema,
      updatedAt: now,
      updatedBy: identity._id,
    };

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Service definition not found.");
      await ctx.db.patch(args.id, { ...payload, createdAt: existing.createdAt });
      return (await ctx.db.get(args.id))!;
    }

    // Check for duplicate service key
    const existing = await ctx.db
      .query("serviceDefinitions")
      .withIndex("by_service_key", (q) => q.eq("serviceKey", args.serviceKey))
      .first();
    if (existing) throw new Error(`Service definition for '${args.serviceKey}' already exists. Use update instead.`);

    const id = await ctx.db.insert("serviceDefinitions", {
      ...payload,
      createdAt: now,
      createdBy: identity._id,
    });
    return (await ctx.db.get(id))!;
  },
});

export const update = mutation({
  args: {
    id: v.id("serviceDefinitions"),
    categoryKey: v.optional(v.string()),
    nameEn: v.optional(v.string()),
    nameAm: v.optional(v.string()),
    shortDescriptionEn: v.optional(v.string()),
    shortDescriptionAm: v.optional(v.string()),
    iconKey: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    active: v.optional(v.boolean()),
    publishable: v.optional(v.boolean()),
    requiresQuote: v.optional(v.boolean()),
    specificationSchema: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Service definition not found.");

    const patch: Record<string, unknown> = { updatedAt: Date.now(), updatedBy: identity._id };
    if (args.categoryKey !== undefined) patch.categoryKey = args.categoryKey.trim();
    if (args.nameEn !== undefined) patch.nameEn = args.nameEn.trim();
    if (args.nameAm !== undefined) patch.nameAm = args.nameAm.trim();
    if (args.shortDescriptionEn !== undefined) patch.shortDescriptionEn = args.shortDescriptionEn?.trim() || undefined;
    if (args.shortDescriptionAm !== undefined) patch.shortDescriptionAm = args.shortDescriptionAm?.trim() || undefined;
    if (args.iconKey !== undefined) patch.iconKey = args.iconKey?.trim() || undefined;
    if (args.sortOrder !== undefined) patch.sortOrder = args.sortOrder;
    if (args.active !== undefined) patch.active = args.active;
    if (args.publishable !== undefined) patch.publishable = args.publishable;
    if (args.requiresQuote !== undefined) patch.requiresQuote = args.requiresQuote;
    if (args.specificationSchema !== undefined) patch.specificationSchema = args.specificationSchema;

    const newActive = args.active ?? existing.active;
    const newPublishable = args.publishable ?? existing.publishable;
    if (newPublishable && !newActive) {
      throw new Error("A publishable service must be active.");
    }

    await ctx.db.patch(args.id, patch);
    return (await ctx.db.get(args.id))!;
  },
});

export const archive = mutation({
  args: { id: v.id("serviceDefinitions"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const service = await ctx.db.get(args.id);
    if (!service) throw new Error("Service definition not found.");

    // Block archive if service has active customer-visible routes
    const routes = await ctx.db
      .query("machineServiceRoutes")
      .withIndex("by_service", (q) => q.eq("serviceId", args.id))
      .collect();
    const activeVisibleRoutes = routes.filter((r) => r.active && r.customerVisible);
    if (activeVisibleRoutes.length > 0) {
      throw new Error("Cannot archive a service with active customer-visible routes. Remove routes first.");
    }

    await ctx.db.patch(args.id, {
      active: false,
      publishable: false,
      updatedAt: Date.now(),
      updatedBy: identity._id,
    });
  },
});

export const restore = mutation({
  args: { id: v.id("serviceDefinitions") },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const service = await ctx.db.get(args.id);
    if (!service) throw new Error("Service definition not found.");
    await ctx.db.patch(args.id, {
      active: true,
      updatedAt: Date.now(),
      updatedBy: identity._id,
    });
  },
});
