import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireOwner } from "../users";

/**
 * Simple materials summary for the owner operational-configuration page.
 */
export const getMaterialsSummary = query({
  handler: async (ctx) => {
    await requireOwner(ctx);
    const materials = await ctx.db
      .query("materials")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
    const byCategory = new Map<string, number>();
    for (const material of materials) {
      byCategory.set(material.category, (byCategory.get(material.category) ?? 0) + 1);
    }
    const reorder = materials.filter((m) => m.reorderAt > 0 && m.quantity <= m.reorderAt);
    return {
      totalMaterials: materials.length,
      byCategory: Object.fromEntries(byCategory),
      reorderMaterials: reorder.map((m) => ({
        id: m._id,
        name: m.name,
        category: m.category,
        unit: m.baseUnit ?? m.unit ?? "pcs",
        quantity: m.quantity,
        reorderAt: m.reorderAt,
        reorderPolicy: m.reorderPolicy,
      })),
    };
  },
});

export const listForConfiguration = query({
  handler: async (ctx) => {
    await requireOwner(ctx);
    const materials = await ctx.db
      .query("materials")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
    return materials
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((material) => ({
        id: material._id,
        name: material.name,
        category: material.category,
        catalogFamily: material.catalogFamily,
        unit: material.baseUnit ?? material.unit ?? "pcs",
        reorderAt: material.reorderAt,
        reorderPolicy: material.reorderPolicy,
      }));
  },
});

export const updateReorderLevel = mutation({
  args: {
    materialId: v.id("materials"),
    reorderAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    if (!Number.isFinite(args.reorderAt) || args.reorderAt < 0) {
      throw new Error("Choose a valid reorder level.");
    }
    const material = await ctx.db.get(args.materialId);
    if (!material || !material.active) throw new Error("Material not found.");
    
    const reorderPolicy = {
      enabled: args.reorderAt > 0,
      level: args.reorderAt,
      unit: material.baseUnit ?? material.unit ?? "pcs",
    };

    await ctx.db.patch(material._id, {
      reorderAt: args.reorderAt,
      reorderPolicy,
    });

    await ctx.db.insert("configurationChanges", {
      configKey: `material:${material._id}`,
      changedFields: ["reorderAt", "reorderPolicy"],
      reason: `Reorder level updated for ${material.name}`,
      actorAuthUserId: profile.authUserId,
      createdAt: Date.now(),
    });
    return { id: material._id, reorderAt: args.reorderAt, reorderPolicy };
  },
});

export const updateReorderPolicy = mutation({
  args: {
    materialId: v.id("materials"),
    reorderPolicy: v.object({
      enabled: v.boolean(),
      level: v.number(),
      unit: v.string(),
      leadTimeDays: v.optional(v.number()),
      safetyStock: v.optional(v.number()),
      alertCooldownHours: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    if (!Number.isFinite(args.reorderPolicy.level) || args.reorderPolicy.level < 0) {
      throw new Error("Choose a valid reorder level.");
    }
    const material = await ctx.db.get(args.materialId);
    if (!material || !material.active) throw new Error("Material not found.");

    const reorderAt = args.reorderPolicy.enabled ? args.reorderPolicy.level : 0;
    await ctx.db.patch(material._id, {
      reorderAt,
      reorderPolicy: args.reorderPolicy,
    });

    await ctx.db.insert("configurationChanges", {
      configKey: `material:${material._id}`,
      changedFields: ["reorderAt", "reorderPolicy"],
      reason: `Reorder policy updated for ${material.name}`,
      actorAuthUserId: profile.authUserId,
      createdAt: Date.now(),
    });
    return { id: material._id, reorderAt, reorderPolicy: args.reorderPolicy };
  },
});
