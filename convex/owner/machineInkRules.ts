import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { inkConsumptionUnit } from "../schema";
import { requireOwner } from "../users";

export const list = query({
  args: {
    machineId: v.optional(v.id("machines")),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    let rows = await ctx.db.query("machineInkConsumptionRules").collect();
    if (args.machineId) rows = rows.filter((r) => r.machineId === args.machineId);
    if (!args.includeInactive) rows = rows.filter((r) => r.active);
    return rows;
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("machineInkConsumptionRules")),
    machineId: v.id("machines"),
    materialId: v.id("materials"),
    inkColor: v.string(),
    consumptionUnit: inkConsumptionUnit,
    rate: v.number(),
    wasteAllowancePercent: v.optional(v.number()),
    isDefault: v.boolean(),
    active: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);

    const machine = await ctx.db.get(args.machineId);
    if (!machine) throw new Error("Machine not found.");
    if (!machine.active) throw new Error("Cannot configure ink rules for an archived machine.");

    const material = await ctx.db.get(args.materialId);
    if (!material) throw new Error("Material not found.");
    if (!material.active) throw new Error("Cannot use an archived material for ink rules.");
    if (material.materialFamily !== "INK") {
      throw new Error("Ink rule material must be in the INK family.");
    }

    if (args.rate <= 0) throw new Error("Rate must be greater than zero.");
    if (args.wasteAllowancePercent !== undefined && (args.wasteAllowancePercent < 0 || args.wasteAllowancePercent > 100)) {
      throw new Error("Waste allowance must be between 0 and 100 percent.");
    }

    // Enforce single default per machine/color
    if (args.isDefault) {
      const existingDefaults = (await ctx.db
        .query("machineInkConsumptionRules")
        .withIndex("by_machine_material_color", (q) =>
          q.eq("machineId", args.machineId).eq("materialId", args.materialId).eq("inkColor", args.inkColor)
        )
        .collect())
        .filter((r) => r.active && r.isDefault && r._id !== args.id);
      if (existingDefaults.length > 0) {
        throw new Error("An active default ink rule already exists for this machine/material/color combination.");
      }
    }

    const now = Date.now();
    const payload = {
      machineId: args.machineId,
      materialId: args.materialId,
      inkColor: args.inkColor,
      consumptionUnit: args.consumptionUnit,
      rate: Number(args.rate.toFixed(6)),
      wasteAllowancePercent: args.wasteAllowancePercent !== undefined ? Number(args.wasteAllowancePercent.toFixed(3)) : undefined,
      isDefault: args.isDefault,
      active: args.active,
      notes: args.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: identity._id,
      updatedBy: identity._id,
    };

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Ink rule not found.");
      await ctx.db.patch(args.id, { ...payload, createdAt: existing.createdAt });
      return (await ctx.db.get(args.id))!;
    }

    const id = await ctx.db.insert("machineInkConsumptionRules", payload);
    return (await ctx.db.get(id))!;
  },
});

export const archive = mutation({
  args: { id: v.id("machineInkConsumptionRules"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const rule = await ctx.db.get(args.id);
    if (!rule) throw new Error("Ink rule not found.");
    await ctx.db.patch(args.id, {
      active: false,
      effectiveTo: Date.now(),
      updatedAt: Date.now(),
      updatedBy: identity._id,
    });
  },
});

export const restore = mutation({
  args: { id: v.id("machineInkConsumptionRules") },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const rule = await ctx.db.get(args.id);
    if (!rule) throw new Error("Ink rule not found.");
    await ctx.db.patch(args.id, {
      active: true,
      effectiveFrom: Date.now(),
      effectiveTo: undefined,
      updatedAt: Date.now(),
      updatedBy: identity._id,
    });
  },
});
