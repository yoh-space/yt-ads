import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireOwner } from "../users";

export const list = query({
  args: {
    machineId: v.optional(v.id("machines")),
    serviceId: v.optional(v.id("serviceDefinitions")),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    let rows = await ctx.db.query("machineServiceRoutes").collect();
    if (args.machineId) rows = rows.filter((r) => r.machineId === args.machineId);
    if (args.serviceId) rows = rows.filter((r) => r.serviceId === args.serviceId);
    if (!args.includeInactive) rows = rows.filter((r) => r.active);
    return rows;
  },
});

export const listPublishedServices = query({
  args: {},
  handler: async (ctx) => {
    const activeRoutes = await ctx.db
      .query("machineServiceRoutes")
      .withIndex("by_active_service", (q) => q.eq("active", true))
      .collect();
    const visibleRoutes = activeRoutes.filter((r) => r.customerVisible);

    const serviceIds = new Set(visibleRoutes.map((r) => r.serviceId));
    const services: Array<{
      serviceId: string;
      serviceKey: string;
      nameEn: string;
      nameAm: string;
      shortDescriptionEn?: string;
      shortDescriptionAm?: string;
      iconKey?: string;
      categoryKey: string;
      sortOrder: number;
      requiresQuote: boolean;
      specificationSchema?: unknown;
    }> = [];

    for (const serviceId of serviceIds) {
      const service = await ctx.db.get(serviceId);
      if (!service || !service.active || !service.publishable) continue;

      const routeCount = visibleRoutes.filter((r) => r.serviceId === serviceId).length;
      services.push({
        serviceId: service._id,
        serviceKey: service.serviceKey,
        nameEn: service.nameEn,
        nameAm: service.nameAm,
        shortDescriptionEn: service.shortDescriptionEn,
        shortDescriptionAm: service.shortDescriptionAm,
        iconKey: service.iconKey,
        categoryKey: service.categoryKey,
        sortOrder: service.sortOrder,
        requiresQuote: service.requiresQuote,
        specificationSchema: service.specificationSchema,
      });
    }

    return services.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("machineServiceRoutes")),
    machineId: v.id("machines"),
    serviceId: v.id("serviceDefinitions"),
    capabilityId: v.id("capabilities"),
    priority: v.number(),
    active: v.boolean(),
    requiresManualReview: v.boolean(),
    calculationUnit: v.string(),
    defaultWasteMarginPercent: v.optional(v.number()),
    maxScrapLimitPercent: v.optional(v.number()),
    customerVisible: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);

    const machine = await ctx.db.get(args.machineId);
    if (!machine) throw new Error("Machine not found.");
    if (!machine.active) throw new Error("Cannot create route for an archived machine.");

    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Service definition not found.");
    if (!service.active) throw new Error("Cannot create route for an inactive service.");

    const capability = await ctx.db.get(args.capabilityId);
    if (!capability) throw new Error("Capability not found.");
    if (!capability.active) throw new Error("Cannot create route with an inactive capability.");

    if (args.priority < 1) throw new Error("Priority must be at least 1.");
    if (args.defaultWasteMarginPercent !== undefined && (args.defaultWasteMarginPercent < 0 || args.defaultWasteMarginPercent > 100)) {
      throw new Error("Waste margin must be between 0 and 100 percent.");
    }
    if (args.maxScrapLimitPercent !== undefined && (args.maxScrapLimitPercent < 0 || args.maxScrapLimitPercent > 100)) {
      throw new Error("Scrap limit must be between 0 and 100 percent.");
    }

    if (args.customerVisible && !service.publishable) {
      throw new Error("Cannot make a route customer-visible for a non-publishable service.");
    }

    const now = Date.now();
    const payload = {
      machineId: args.machineId,
      serviceId: args.serviceId,
      capabilityId: args.capabilityId,
      priority: args.priority,
      active: args.active,
      requiresManualReview: args.requiresManualReview,
      calculationUnit: args.calculationUnit.trim(),
      defaultWasteMarginPercent: args.defaultWasteMarginPercent !== undefined ? Number(args.defaultWasteMarginPercent.toFixed(3)) : undefined,
      maxScrapLimitPercent: args.maxScrapLimitPercent !== undefined ? Number(args.maxScrapLimitPercent.toFixed(3)) : undefined,
      customerVisible: args.customerVisible,
      createdAt: now,
      updatedAt: now,
      createdBy: identity._id,
      updatedBy: identity._id,
    };

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Service route not found.");
      await ctx.db.patch(args.id, { ...payload, createdAt: existing.createdAt });
      return (await ctx.db.get(args.id))!;
    }

    const id = await ctx.db.insert("machineServiceRoutes", payload);
    return (await ctx.db.get(id))!;
  },
});

export const update = mutation({
  args: {
    id: v.id("machineServiceRoutes"),
    priority: v.optional(v.number()),
    active: v.optional(v.boolean()),
    requiresManualReview: v.optional(v.boolean()),
    calculationUnit: v.optional(v.string()),
    defaultWasteMarginPercent: v.optional(v.number()),
    maxScrapLimitPercent: v.optional(v.number()),
    customerVisible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Service route not found.");

    const patch: Record<string, unknown> = { updatedAt: Date.now(), updatedBy: identity._id };
    if (args.priority !== undefined) {
      if (args.priority < 1) throw new Error("Priority must be at least 1.");
      patch.priority = args.priority;
    }
    if (args.active !== undefined) patch.active = args.active;
    if (args.requiresManualReview !== undefined) patch.requiresManualReview = args.requiresManualReview;
    if (args.calculationUnit !== undefined) patch.calculationUnit = args.calculationUnit.trim();
    if (args.defaultWasteMarginPercent !== undefined) {
      if (args.defaultWasteMarginPercent < 0 || args.defaultWasteMarginPercent > 100) {
        throw new Error("Waste margin must be between 0 and 100 percent.");
      }
      patch.defaultWasteMarginPercent = Number(args.defaultWasteMarginPercent.toFixed(3));
    }
    if (args.maxScrapLimitPercent !== undefined) {
      if (args.maxScrapLimitPercent < 0 || args.maxScrapLimitPercent > 100) {
        throw new Error("Scrap limit must be between 0 and 100 percent.");
      }
      patch.maxScrapLimitPercent = Number(args.maxScrapLimitPercent.toFixed(3));
    }
    if (args.customerVisible !== undefined) {
      const service = await ctx.db.get(existing.serviceId);
      if (args.customerVisible && service && !service.publishable) {
        throw new Error("Cannot make a route customer-visible for a non-publishable service.");
      }
      patch.customerVisible = args.customerVisible;
    }

    await ctx.db.patch(args.id, patch);
    return (await ctx.db.get(args.id))!;
  },
});

export const archive = mutation({
  args: { id: v.id("machineServiceRoutes"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const route = await ctx.db.get(args.id);
    if (!route) throw new Error("Service route not found.");

    // Check if there are active jobs using this route
    // (In the future, jobMaterialRequirements will reference machineServiceRouteId)
    // For now, just archive the route
    await ctx.db.patch(args.id, {
      active: false,
      customerVisible: false,
      effectiveTo: Date.now(),
      updatedAt: Date.now(),
      updatedBy: identity._id,
    });
  },
});

export const restore = mutation({
  args: { id: v.id("machineServiceRoutes") },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const route = await ctx.db.get(args.id);
    if (!route) throw new Error("Service route not found.");
    await ctx.db.patch(args.id, {
      active: true,
      effectiveFrom: Date.now(),
      effectiveTo: undefined,
      updatedAt: Date.now(),
      updatedBy: identity._id,
    });
  },
});
