import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { exceptionReason, unit } from "../schema";
import { requireManagerRole } from "../users";
import { ensureSystemConfig } from "../systemConfigs";
import { resolveEtbValue } from "../materialUsage";
import { recordInventoryEvent } from "../inventoryLedger";
import { notifyRoles } from "../notificationHelpers";

const managerMaterial = v.object({
  id: v.id("materials"),
  name: v.string(),
  unit,
  baseUnit: v.optional(unit),
  quantity: v.number(),
});

export const listMaterials = query({
  args: {},
  returns: v.array(managerMaterial),
  handler: async (ctx) => {
    await requireManagerRole(ctx);
    const materials = await ctx.db.query("materials").withIndex("by_name").take(200);
    return materials.filter((material) => material.active).map((material) => ({
      id: material._id,
      name: material.name,
      unit: material.unit,
      baseUnit: material.baseUnit,
      quantity: material.quantity,
    }));
  },
});

export const recordDirectStockOut = mutation({
  args: {
    materialId: v.id("materials"),
    quantity: v.number(),
    unit,
    reason: exceptionReason,
    authorizationNote: v.string(),
  },
  returns: v.object({
    status: v.union(v.literal("RECORDED"), v.literal("PENDING_OWNER_APPROVAL")),
    remainingQuantity: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const { identity } = await requireManagerRole(ctx);
    const material = await ctx.db.get(args.materialId);
    if (!material || !material.active) throw new Error("Active material not found.");
    const baseUnit = material.baseUnit ?? material.unit;
    if (args.unit !== baseUnit) throw new Error(`Use the material base unit (${baseUnit}).`);
    if (!Number.isFinite(args.quantity) || args.quantity <= 0) throw new Error("Quantity must be greater than zero.");
    if (args.quantity > material.quantity) throw new Error(`Insufficient ${material.name} stock.`);
    const note = args.authorizationNote.trim();
    if (note.length < 5) throw new Error("Explain why this emergency stock-out is needed.");
    if (note.length > 1000) throw new Error("The explanation is too long.");

    const config = await ensureSystemConfig(ctx, identity._id);
    const requestedValue = Number((args.quantity * resolveEtbValue(material)).toFixed(2));
    const now = Date.now();
    if (requestedValue > config.maxDirectStockOutEtb) {
      const exceptionId = await ctx.db.insert("stockExceptions", {
        materialId: material._id,
        quantity: args.quantity,
        unit: args.unit,
        baseQuantity: args.quantity,
        reason: args.reason,
        authorizationNote: note,
        status: "PENDING_OWNER_APPROVAL",
        requestedBy: identity._id,
        requestedValue,
        createdBy: identity._id,
        createdAt: now,
      });
      await notifyRoles(ctx, ["owner"], {
        title: "Manager stock-out approval needed",
        message: `${material.name} requires owner approval for an exceptional stock-out.`,
        type: "exception_stock_out",
        actorAuthUserId: identity._id,
        relatedTable: "stockExceptions",
        relatedId: exceptionId,
      });
      return { status: "PENDING_OWNER_APPROVAL" as const };
    }

    const exceptionId = await ctx.db.insert("stockExceptions", {
      materialId: material._id,
      quantity: args.quantity,
      unit: args.unit,
      baseQuantity: args.quantity,
      reason: args.reason,
      authorizationNote: note,
      status: "RECORDED",
      requestedBy: identity._id,
      createdBy: identity._id,
      createdAt: now,
    });
    await recordInventoryEvent(ctx, {
      materialId: material._id,
      eventType: "EXCEPTION_STOCK_OUT",
      custody: "parent",
      balanceEffect: "out",
      quantity: args.quantity,
      unit: args.unit,
      baseUnit,
      baseQuantity: args.quantity,
      note: `Manager emergency stock-out · ${args.reason} · ${note}`,
      createdBy: identity._id,
    });
    await notifyRoles(ctx, ["owner"], {
      title: "Manager emergency stock-out recorded",
      message: `${material.name} was recorded as an exceptional stock-out.`,
      type: "exception_stock_out",
      actorAuthUserId: identity._id,
      relatedTable: "stockExceptions",
      relatedId: exceptionId,
    });
    const updatedMaterial = await ctx.db.get(material._id);
    return { status: "RECORDED" as const, remainingQuantity: updatedMaterial?.quantity ?? 0 };
  },
});