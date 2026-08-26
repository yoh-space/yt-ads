import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { calculateOffcutArea } from "./units";
import { requireActiveProfile } from "./users";

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
    const { identity } = await requireActiveProfile(ctx);
    if (!Number.isFinite(args.width) || !Number.isFinite(args.length) || args.width <= 0 || args.length <= 0) {
      throw new Error("Offcut dimensions must be greater than zero.");
    }
    if (!args.location.trim()) throw new Error("Offcut location is required.");
    const material = await ctx.db.get(args.materialId);
    if (!material || !material.active) throw new Error("Active material not found.");
    if (material.unit !== "m²") throw new Error("Only square-meter materials can create sheet offcuts.");

    const area = calculateOffcutArea(args.width, args.length);
    const label = material.name;
    const id = await ctx.db.insert("offcuts", {
      materialId: args.materialId,
      label,
      width: args.width,
      length: args.length,
      area,
      location: args.location.trim(),
      usable: true,
      status: "available",
      createdBy: identity._id,
      createdAt: new Date().toISOString(),
    });

    await ctx.db.patch(args.materialId, {
      quantity: Number((material.quantity + area).toFixed(2)),
    });
    await ctx.db.insert("stockMovements", {
      materialId: args.materialId,
      direction: "offcut_return",
      quantity: area,
      unit: "m²",
      baseUnit: "m²",
      baseQuantity: area,
      note: `Usable offcut returned at ${args.location.trim()}`,
      createdBy: identity._id,
      createdAt: Date.now(),
    });
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
    const { identity } = await requireActiveProfile(ctx);
    if (!Number.isFinite(args.quantity) || args.quantity <= 0) {
      throw new Error("Scrap quantity must be greater than zero.");
    }
    if (!args.reason.trim()) throw new Error("A scrap reason is required.");
    const material = await ctx.db.get(args.materialId);
    if (!material || !material.active) throw new Error("Active material not found.");
    if (args.quantity > material.quantity) {
      throw new Error(`Insufficient ${material.name} stock for this scrap record.`);
    }

    const id = await ctx.db.insert("scraps", {
      materialId: args.materialId,
      label: material.name,
      quantity: args.quantity,
      unit: material.unit,
      reason: args.reason.trim(),
      createdBy: identity._id,
      createdAt: new Date().toISOString(),
    });
    await ctx.db.patch(args.materialId, {
      quantity: Number((material.quantity - args.quantity).toFixed(2)),
    });
    await ctx.db.insert("stockMovements", {
      materialId: args.materialId,
      direction: "out",
      quantity: args.quantity,
      unit: material.unit,
      baseUnit: material.baseUnit ?? material.unit,
      baseQuantity: args.quantity,
      note: `Scrap: ${args.reason.trim()}`,
      createdBy: identity._id,
      createdAt: Date.now(),
    });
    return (await ctx.db.get(id))!;
  },
});
