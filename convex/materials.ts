import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { unit, accent } from "./schema";
import { convertToBase, type InputUnit } from "./units";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await authComponent.getAuthUser(ctx);
    return ctx.db
      .query("materials")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    unit,
    quantity: v.number(),
    reorderAt: v.number(),
    rollEquivalent: v.optional(v.number()),
    sheetEquivalent: v.optional(v.number()),
    accent,
  },
  handler: async (ctx, args) => {
    await authComponent.getAuthUser(ctx);
    const id = await ctx.db.insert("materials", { ...args, active: true });
    return (await ctx.db.get(id))!;
  },
});

export const recordStockMovement = mutation({
  args: {
    materialId: v.id("materials"),
    direction: v.union(v.literal("in"), v.literal("out")),
    quantity: v.number(),
    inputUnit: v.union(v.literal("roll"), v.literal("sheet"), unit),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const material = await ctx.db.get(args.materialId);
    if (!material) throw new Error("Material not found.");

    const converted = convertToBase(
      args.quantity,
      args.inputUnit as InputUnit,
      material.unit,
      material.rollEquivalent,
      material.sheetEquivalent,
    );
    const delta = args.direction === "in" ? converted : -converted;
    await ctx.db.patch(args.materialId, {
      quantity: Math.max(0, Number((material.quantity + delta).toFixed(2))),
    });
    await ctx.db.insert("stockMovements", {
      materialId: args.materialId,
      direction: args.direction,
      quantity: args.quantity,
      unit: args.inputUnit,
      note: args.note,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});
