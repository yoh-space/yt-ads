import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./users";
import { serviceType } from "./schema";

const requirementMode = v.union(
  v.literal("fixed"),
  v.literal("area_rate"),
  v.literal("linear_rate"),
  v.literal("quantity_rate"),
);

const recipeValidator = v.object({
  _id: v.id("serviceMaterialRecipes"),
  _creationTime: v.number(),
  serviceType,
  materialId: v.id("materials"),
  requirementMode,
  quantity: v.number(),
  wasteAllowancePercent: v.optional(v.number()),
  required: v.boolean(),
  active: v.boolean(),
  updatedAt: v.number(),
  updatedBy: v.string(),
});

export const list = query({
  args: { serviceType: v.optional(serviceType), activeOnly: v.optional(v.boolean()) },
  returns: v.array(recipeValidator),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "material.view");
    const rows = args.activeOnly
      ? await ctx.db
          .query("serviceMaterialRecipes")
          .withIndex("by_active_service", (q) => q.eq("active", true))
          .collect()
      : await ctx.db
          .query("serviceMaterialRecipes")
          .withIndex("by_service", (q) => q.eq("serviceType", args.serviceType ?? "banner_print"))
          .collect();
    return rows
      .filter((row) => args.serviceType === undefined || row.serviceType === args.serviceType)
      .sort((left, right) => left.materialId.localeCompare(right.materialId));
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("serviceMaterialRecipes")),
    serviceType,
    materialId: v.id("materials"),
    requirementMode,
    quantity: v.number(),
    wasteAllowancePercent: v.optional(v.number()),
    required: v.boolean(),
    active: v.boolean(),
  },
  returns: recipeValidator,
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "material.edit");
    if (!Number.isFinite(args.quantity) || args.quantity <= 0) {
      throw new Error("Recipe quantity must be greater than zero.");
    }
    const allowance = args.wasteAllowancePercent ?? 0;
    if (!Number.isFinite(allowance) || allowance < 0 || allowance > 100) {
      throw new Error("Waste allowance must be between 0 and 100 percent.");
    }
    const material = await ctx.db.get(args.materialId);
    if (!material || !material.active) throw new Error("Active recipe material not found.");
    const existing = await ctx.db
      .query("serviceMaterialRecipes")
      .withIndex("by_service", (q) => q.eq("serviceType", args.serviceType))
      .collect();
    const duplicate = existing.find(
      (row) => row.materialId === args.materialId && row._id !== args.id && row.active && args.active,
    );
    if (duplicate) throw new Error("An active recipe already contains this material.");

    const payload = {
      serviceType: args.serviceType,
      materialId: args.materialId,
      requirementMode: args.requirementMode,
      quantity: Number(args.quantity.toFixed(6)),
      wasteAllowancePercent: Number(allowance.toFixed(3)),
      required: args.required,
      active: args.active,
      updatedAt: Date.now(),
      updatedBy: identity._id,
    };
    const id = args.id
      ? (await ctx.db.patch(args.id, payload), args.id)
      : await ctx.db.insert("serviceMaterialRecipes", payload);
    return (await ctx.db.get(id))!;
  },
});

export const deactivate = mutation({
  args: { id: v.id("serviceMaterialRecipes") },
  returns: recipeValidator,
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "material.edit");
    const recipe = await ctx.db.get(args.id);
    if (!recipe) throw new Error("Recipe not found.");
    await ctx.db.patch(args.id, { active: false, updatedAt: Date.now(), updatedBy: identity._id });
    return (await ctx.db.get(args.id))!;
  },
});
