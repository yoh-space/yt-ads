import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { calculateOffcutArea } from "./units";
import { requirePermission } from "./users";
import { canAccessMachine } from "./authorization";
import { recordInventoryEvent } from "./inventoryLedger";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "offcut.view");
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
    operatorSubStockId: v.optional(v.id("operatorSubStock")),
    machineId: v.optional(v.id("machines")),
  },
  handler: async (ctx, args) => {
    const { identity, profile } = await requirePermission(ctx, "offcut.create");
    if (!Number.isFinite(args.width) || !Number.isFinite(args.length) || args.width <= 0 || args.length <= 0) {
      throw new Error("Offcut dimensions must be greater than zero.");
    }
    if (!args.location.trim()) throw new Error("Offcut location is required.");
    const material = await ctx.db.get(args.materialId);
    if (!material || !material.active) throw new Error("Active material not found.");
    if (material.unit !== "m²") throw new Error("Only square-meter materials can create sheet offcuts.");
    const isManagement = ["owner", "manager", "admin", "storekeeper"].includes(profile.role);
    let operatorSubStockId = args.operatorSubStockId;
    if (!isManagement) {
      if (!args.machineId || !args.operatorSubStockId) throw new Error("Operators must select their assigned floor stock when returning an offcut.");
      const machine = await ctx.db.get(args.machineId);
      const subStock = await ctx.db.get(args.operatorSubStockId);
      if (!machine || !subStock || !canAccessMachine(profile.role, machine) || subStock.operatorId !== identity._id || subStock.machineId !== machine._id || subStock.materialId !== material._id) {
        throw new Error("You can only return offcuts from your assigned floor stock.");
      }
    }

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
      operatorSubStockId,
      operatorId: operatorSubStockId ? identity._id : undefined,
      machineId: args.machineId,
    });

    await recordInventoryEvent(ctx, {
      materialId: args.materialId,
      eventType: "OFFCUT_RETURN",
      custody: "parent",
      balanceEffect: "in",
      quantity: area,
      unit: "m²",
      baseUnit: "m²",
      baseQuantity: area,
      operatorSubStockId,
      operatorId: operatorSubStockId ? identity._id : undefined,
      machineId: args.machineId,
      offcutId: id,
      note: `Usable offcut returned at ${args.location.trim()}`,
      createdBy: identity._id,
    });
    return (await ctx.db.get(id))!;
  },
});

export const listScraps = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "scrap.view");
    return ctx.db.query("scraps").collect();
  },
});

export const logScrap = mutation({
  args: {
    materialId: v.id("materials"),
    quantity: v.number(),
    reason: v.string(),
    operatorSubStockId: v.optional(v.id("operatorSubStock")),
    machineId: v.optional(v.id("machines")),
  },
  handler: async (ctx, args) => {
    const { identity, profile } = await requirePermission(ctx, "scrap.create");
    if (!Number.isFinite(args.quantity) || args.quantity <= 0) {
      throw new Error("Scrap quantity must be greater than zero.");
    }
    if (!args.reason.trim()) throw new Error("A scrap reason is required.");
    const material = await ctx.db.get(args.materialId);
    if (!material || !material.active) throw new Error("Active material not found.");
    const isManagement = ["owner", "manager", "admin", "storekeeper"].includes(profile.role);
    let operatorSubStockId = args.operatorSubStockId;
    if (!isManagement) {
      if (!args.machineId || !args.operatorSubStockId) throw new Error("Operators must select their assigned floor stock when logging scrap.");
      const machine = await ctx.db.get(args.machineId);
      const subStock = await ctx.db.get(args.operatorSubStockId);
      if (!machine || !subStock || !canAccessMachine(profile.role, machine) || subStock.operatorId !== identity._id || subStock.machineId !== machine._id || subStock.materialId !== material._id) {
        throw new Error("You can only log scrap against your assigned floor stock.");
      }
    }
    if (!operatorSubStockId && args.quantity > material.quantity) {
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
      operatorSubStockId,
      operatorId: operatorSubStockId ? identity._id : undefined,
      machineId: args.machineId,
    });
    await recordInventoryEvent(ctx, {
      materialId: args.materialId,
      eventType: "SCRAP_LOG",
      custody: operatorSubStockId ? "operator" : "parent",
      balanceEffect: operatorSubStockId ? "none" : "out",
      quantity: args.quantity,
      unit: material.unit,
      baseUnit: material.baseUnit ?? material.unit,
      baseQuantity: args.quantity,
      operatorSubStockId,
      operatorId: operatorSubStockId ? identity._id : undefined,
      machineId: args.machineId,
      note: `Scrap: ${args.reason.trim()}`,
      createdBy: identity._id,
    });
    return (await ctx.db.get(id))!;
  },
});
