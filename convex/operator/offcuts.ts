import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { resolveOperatorMachine } from "./common";
import { createOffcutInternal, logScrapInternal } from "../offcuts";

/**
 * Isolated machine-scoped offcut/scrap entry for the operator workspace. Both
 * mutations enforce the operator role and a strict machine scope, then require
 * the returned/scrapped material to come from the operator's own floor stock on
 * that machine (validated again inside the shared internals) while all
 * accounting stays auditable through the inventory ledger.
 */
export const logOffcut = mutation({
  args: {
    machineSlug: v.string(),
    materialId: v.id("materials"),
    width: v.number(),
    length: v.number(),
    location: v.string(),
    operatorSubStockId: v.id("operatorSubStock"),
  },
  handler: async (ctx, args) => {
    const { identity, profile, machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    const subStock = await ctx.db.get(args.operatorSubStockId);
    if (!subStock || subStock.machineId !== machine._id || subStock.operatorId !== identity._id) {
      throw new Error("You can only return offcuts from your assigned floor stock on this machine.");
    }
    return createOffcutInternal(ctx, identity, profile, {
      materialId: args.materialId,
      width: args.width,
      length: args.length,
      location: args.location,
      operatorSubStockId: args.operatorSubStockId,
      machineId: machine._id,
    });
  },
});

export const logScrap = mutation({
  args: {
    machineSlug: v.string(),
    materialId: v.id("materials"),
    quantity: v.number(),
    reason: v.string(),
    operatorSubStockId: v.id("operatorSubStock"),
  },
  handler: async (ctx, args) => {
    const { identity, profile, machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    const subStock = await ctx.db.get(args.operatorSubStockId);
    if (!subStock || subStock.machineId !== machine._id || subStock.operatorId !== identity._id) {
      throw new Error("You can only log scrap against your assigned floor stock on this machine.");
    }
    return logScrapInternal(ctx, identity, profile, {
      materialId: args.materialId,
      quantity: args.quantity,
      reason: args.reason,
      operatorSubStockId: args.operatorSubStockId,
      machineId: machine._id,
    });
  },
});