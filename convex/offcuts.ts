import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { calculateOffcutArea } from "./units";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await authComponent.getAuthUser(ctx);
    return ctx.db
      .query("offcuts")
      .filter((q) => q.eq(q.field("status"), "available"))
      .collect();
  },
});

export const create = mutation({
  args: {
    materialId: v.id("materials"),
    width: v.number(),
    length: v.number(),
    location: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const material = await ctx.db.get(args.materialId);
    if (!material) throw new Error("Material not found.");

    const area = calculateOffcutArea(args.width, args.length);
    const label = material.name;
    const id = await ctx.db.insert("offcuts", {
      materialId: args.materialId,
      label,
      width: args.width,
      length: args.length,
      area,
      location: args.location,
      usable: true,
      status: "available",
      createdBy: user._id,
      createdAt: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    });

    // Return reusable sheet area to active inventory when the base unit is m².
    if (material.unit === "m²") {
      await ctx.db.patch(args.materialId, {
        quantity: Number((material.quantity + area).toFixed(2)),
      });
    }
    return (await ctx.db.get(id))!;
  },
});

export const listScraps = query({
  args: {},
  handler: async (ctx) => {
    await authComponent.getAuthUser(ctx);
    return ctx.db.query("scraps").collect();
  },
});

export const logScrap = mutation({
  args: {
    materialId: v.id("materials"),
    quantity: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const material = await ctx.db.get(args.materialId);
    if (!material) throw new Error("Material not found.");
    const id = await ctx.db.insert("scraps", {
      materialId: args.materialId,
      label: material.name,
      quantity: args.quantity,
      unit: material.unit,
      reason: args.reason,
      createdBy: user._id,
      createdAt: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    });
    return (await ctx.db.get(id))!;
  },
});
