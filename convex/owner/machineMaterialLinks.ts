import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { machineMaterialRelationship, productionType } from "../schema";
import { requireOwner } from "../users";

export const list = query({
  args: {
    machineId: v.optional(v.id("machines")),
    materialId: v.optional(v.id("materials")),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    let rows = await ctx.db.query("machineMaterialLinks").collect();
    if (args.machineId) rows = rows.filter((r) => r.machineId === args.machineId);
    if (args.materialId) rows = rows.filter((r) => r.materialId === args.materialId);
    if (!args.includeInactive) rows = rows.filter((r) => r.active);
    return rows;
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("machineMaterialLinks")),
    machineId: v.id("machines"),
    materialId: v.id("materials"),
    relationshipType: machineMaterialRelationship,
    productionType: v.optional(productionType),
    conversionRatioOverride: v.optional(v.number()),
    wasteMarginPercent: v.optional(v.number()),
    required: v.boolean(),
    notes: v.optional(v.string()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);

    const machine = await ctx.db.get(args.machineId);
    if (!machine) throw new Error("Machine not found.");
    if (!machine.active) throw new Error("Cannot link materials to an archived machine.");

    const material = await ctx.db.get(args.materialId);
    if (!material) throw new Error("Material not found.");
    if (!material.active) throw new Error("Cannot link an archived material.");

    if (args.wasteMarginPercent !== undefined && (args.wasteMarginPercent < 0 || args.wasteMarginPercent > 100)) {
      throw new Error("Waste margin must be between 0 and 100 percent.");
    }

    // Check for duplicate active relationship
    const existing = (await ctx.db
      .query("machineMaterialLinks")
      .withIndex("by_machine_material", (q) =>
        q.eq("machineId", args.machineId).eq("materialId", args.materialId)
      )
      .collect())
      .find((r) => r.active && r.relationshipType === args.relationshipType && r._id !== args.id);
    if (existing) {
      throw new Error("This active machine-material relationship already exists.");
    }

    const now = Date.now();
    const payload = {
      machineId: args.machineId,
      materialId: args.materialId,
      relationshipType: args.relationshipType,
      productionType: args.productionType,
      conversionRatioOverride: args.conversionRatioOverride,
      wasteMarginPercent: args.wasteMarginPercent !== undefined ? Number(args.wasteMarginPercent.toFixed(3)) : undefined,
      required: args.required,
      notes: args.notes?.trim() || undefined,
      active: args.active,
      createdAt: now,
      updatedAt: now,
      createdBy: identity._id,
      updatedBy: identity._id,
    };

    if (args.id) {
      const existingLink = await ctx.db.get(args.id);
      if (!existingLink) throw new Error("Material link not found.");
      await ctx.db.patch(args.id, { ...payload, createdAt: existingLink.createdAt });
      return (await ctx.db.get(args.id))!;
    }

    const id = await ctx.db.insert("machineMaterialLinks", payload);
    return (await ctx.db.get(id))!;
  },
});

export const archive = mutation({
  args: { id: v.id("machineMaterialLinks"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const link = await ctx.db.get(args.id);
    if (!link) throw new Error("Material link not found.");
    await ctx.db.patch(args.id, {
      active: false,
      effectiveTo: Date.now(),
      updatedAt: Date.now(),
      updatedBy: identity._id,
    });
  },
});

export const restore = mutation({
  args: { id: v.id("machineMaterialLinks") },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const link = await ctx.db.get(args.id);
    if (!link) throw new Error("Material link not found.");
    await ctx.db.patch(args.id, {
      active: true,
      effectiveFrom: Date.now(),
      effectiveTo: undefined,
      updatedAt: Date.now(),
      updatedBy: identity._id,
    });
  },
});
