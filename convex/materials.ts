import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { unit, accent } from "./schema";
import { convertToBase, type InputUnit } from "./units";
import { requireRoles } from "./users";

const INVENTORY_ROLES = ["admin", "storekeeper"] as const;

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
    storageLocation: v.optional(v.string()),
    averageUse: v.optional(v.string()),
    reorderRule: v.optional(v.string()),
    scrapRule: v.optional(v.string()),
    accent,
  },
  handler: async (ctx, args) => {
    await requireRoles(ctx, [...INVENTORY_ROLES]);
    if (!args.name.trim()) throw new Error("Material name is required.");
    if (!Number.isFinite(args.quantity) || args.quantity < 0) {
      throw new Error("Opening quantity must be zero or greater.");
    }
    if (!Number.isFinite(args.reorderAt) || args.reorderAt < 0) {
      throw new Error("Reorder level must be zero or greater.");
    }
    if (args.rollEquivalent !== undefined && args.rollEquivalent <= 0) {
      throw new Error("Roll conversion must be greater than zero.");
    }
    if (args.sheetEquivalent !== undefined && args.sheetEquivalent <= 0) {
      throw new Error("Sheet conversion must be greater than zero.");
    }
    const id = await ctx.db.insert("materials", {
      ...args,
      name: args.name.trim(),
      category: args.category.trim() || "Custom",
      storageLocation: args.storageLocation?.trim() || undefined,
      averageUse: args.averageUse?.trim() || undefined,
      reorderRule: args.reorderRule?.trim() || undefined,
      scrapRule: args.scrapRule?.trim() || undefined,
      active: true,
    });
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
    const { identity } = await requireRoles(ctx, [...INVENTORY_ROLES]);
    if (!Number.isFinite(args.quantity) || args.quantity <= 0) {
      throw new Error("Stock movement quantity must be greater than zero.");
    }
    const material = await ctx.db.get(args.materialId);
    if (!material || !material.active) throw new Error("Active material not found.");

    const converted = convertToBase(
      args.quantity,
      args.inputUnit as InputUnit,
      material.unit,
      material.rollEquivalent,
      material.sheetEquivalent,
    );
    if (!Number.isFinite(converted) || converted <= 0) {
      throw new Error("Converted stock quantity must be greater than zero.");
    }
    if (args.direction === "out" && converted > material.quantity) {
      throw new Error(`Insufficient ${material.name} stock for this movement.`);
    }

    const delta = args.direction === "in" ? converted : -converted;
    await ctx.db.patch(args.materialId, {
      quantity: Number((material.quantity + delta).toFixed(2)),
    });
    await ctx.db.insert("stockMovements", {
      materialId: args.materialId,
      direction: args.direction,
      quantity: args.quantity,
      unit: args.inputUnit,
      note: args.note.trim() || "Manual stock movement",
      createdBy: identity._id,
      createdAt: Date.now(),
    });
  },
});
