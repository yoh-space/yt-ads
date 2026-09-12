import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { serviceType } from "../schema";
import { requireOwner } from "../users";

const consumptionMode = v.union(
  v.literal("area_rate"),
  v.literal("linear_rate"),
  v.literal("quantity_rate"),
  v.literal("fixed"),
);

export const list = query({
  args: {
    serviceType: v.optional(serviceType),
    machineServiceRouteId: v.optional(v.id("machineServiceRoutes")),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    let rows = await ctx.db.query("serviceBOM").collect();
    if (args.serviceType !== undefined) rows = rows.filter((r) => r.serviceType === args.serviceType);
    if (args.machineServiceRouteId !== undefined) rows = rows.filter((r) => r.machineServiceRouteId === args.machineServiceRouteId);
    if (!args.includeInactive) rows = rows.filter((r) => r.active);
    return rows;
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("serviceBOM")),
    serviceType,
    materialId: v.id("materials"),
    machineServiceRouteId: v.optional(v.id("machineServiceRoutes")),
    consumptionMode,
    quantityPerUnit: v.number(),
    wasteAllowancePercent: v.optional(v.number()),
    required: v.boolean(),
    note: v.optional(v.string()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);

    const material = await ctx.db.get(args.materialId);
    if (!material) throw new Error("Material not found.");
    if (!material.active) throw new Error("Cannot use an archived material for BOM.");

    if (args.machineServiceRouteId) {
      const route = await ctx.db.get(args.machineServiceRouteId);
      if (!route) throw new Error("Machine service route not found.");
      if (!route.active) throw new Error("Cannot add BOM to an inactive route.");
      if (route.serviceId !== args.serviceType) {
        throw new Error("Route service mismatch: the route's service must match the BOM service type.");
      }
    }

    if (args.quantityPerUnit <= 0) throw new Error("Quantity per unit must be greater than zero.");
    if (args.wasteAllowancePercent !== undefined && (args.wasteAllowancePercent < 0 || args.wasteAllowancePercent > 100)) {
      throw new Error("Waste allowance must be between 0 and 100 percent.");
    }

    // Check for duplicate: same service + material + route combination
    const existingRows = (await ctx.db
      .query("serviceBOM")
      .withIndex("by_service", (q) => q.eq("serviceType", args.serviceType))
      .collect())
      .filter((r) =>
        r.materialId === args.materialId &&
        r.machineServiceRouteId === args.machineServiceRouteId &&
        r.active &&
        args.active &&
        r._id !== args.id
      );
    if (existingRows.length > 0) {
      throw new Error("An active BOM row already exists for this service/material/route combination.");
    }

    const now = Date.now();
    const payload = {
      serviceType: args.serviceType,
      materialId: args.materialId,
      machineServiceRouteId: args.machineServiceRouteId || undefined,
      consumptionMode: args.consumptionMode,
      quantityPerUnit: Number(args.quantityPerUnit.toFixed(6)),
      wasteAllowancePercent: args.wasteAllowancePercent !== undefined ? Number(args.wasteAllowancePercent.toFixed(3)) : undefined,
      required: args.required,
      note: args.note?.trim() || undefined,
      active: args.active,
      updatedAt: now,
      updatedBy: identity._id,
    };

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("BOM row not found.");
      await ctx.db.patch(args.id, payload);
      return (await ctx.db.get(args.id))!;
    }

    const id = await ctx.db.insert("serviceBOM", payload);
    return (await ctx.db.get(id))!;
  },
});

export const archive = mutation({
  args: { id: v.id("serviceBOM"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("BOM row not found.");
    await ctx.db.patch(args.id, {
      active: false,
      updatedAt: Date.now(),
      updatedBy: identity._id,
    });
  },
});

export const restore = mutation({
  args: { id: v.id("serviceBOM") },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("BOM row not found.");
    await ctx.db.patch(args.id, {
      active: true,
      updatedAt: Date.now(),
      updatedBy: identity._id,
    });
  },
});

export const bulkUpsert = mutation({
  args: {
    serviceType,
    machineServiceRouteId: v.optional(v.id("machineServiceRoutes")),
    items: v.array(
      v.object({
        materialId: v.id("materials"),
        consumptionMode,
        quantityPerUnit: v.number(),
        wasteAllowancePercent: v.optional(v.number()),
        required: v.boolean(),
        note: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);

    if (args.machineServiceRouteId) {
      const route = await ctx.db.get(args.machineServiceRouteId);
      if (!route) throw new Error("Machine service route not found.");
      if (!route.active) throw new Error("Cannot add BOM to an inactive route.");
      if (route.serviceId !== args.serviceType) {
        throw new Error("Route service mismatch.");
      }
    }

    // Deactivate existing service-level BOM rows (where route is null)
    const existingRows = await ctx.db
      .query("serviceBOM")
      .withIndex("by_service", (q) => q.eq("serviceType", args.serviceType))
      .collect();

    const toDeactivate = existingRows.filter(
      (r) => r.active && r.machineServiceRouteId === args.machineServiceRouteId
    );

    for (const row of toDeactivate) {
      await ctx.db.patch(row._id, { active: false, updatedAt: Date.now(), updatedBy: identity._id });
    }

    const now = Date.now();
    const createdIds: string[] = [];

    for (const item of args.items) {
      const material = await ctx.db.get(item.materialId);
      if (!material || !material.active) throw new Error(`Material ${item.materialId} not found or inactive.`);

      const id = await ctx.db.insert("serviceBOM", {
        serviceType: args.serviceType,
        materialId: item.materialId,
        machineServiceRouteId: args.machineServiceRouteId || undefined,
        consumptionMode: item.consumptionMode,
        quantityPerUnit: Number(item.quantityPerUnit.toFixed(6)),
        wasteAllowancePercent: item.wasteAllowancePercent !== undefined ? Number(item.wasteAllowancePercent.toFixed(3)) : undefined,
        required: item.required,
        note: item.note?.trim() || undefined,
        active: true,
        updatedAt: now,
        updatedBy: identity._id,
      });
      createdIds.push(id);
    }

    return { deactivated: toDeactivate.length, created: createdIds.length };
  },
});
