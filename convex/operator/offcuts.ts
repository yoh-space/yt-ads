import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { resolveOperatorMachine, collectFloorStock } from "./common";
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

/**
 * Data for the operator offcut & scrap logging page. Returns the machine's
 * floor stock enriched with the owner-set waste bounds (max scrap, minimum
 * offcut dimensions, warn/block policy) and the material-global scrap already
 * logged, plus the most recent offcuts and scraps on this machine.
 */
export const getWastePageData = query({
  args: { machineSlug: v.string() },
  handler: async (ctx, args) => {
    const { identity, profile, machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    const [floorStock, materials, allScraps, recentOffcuts, recentScraps] = await Promise.all([
      collectFloorStock(ctx, machine, identity, profile.role),
      ctx.db.query("materials").collect(),
      ctx.db.query("scraps").collect(),
      ctx.db
        .query("offcuts")
        .withIndex("by_machine_created", (q) => q.eq("machineId", machine._id as Id<"machines">))
        .order("desc")
        .take(20),
      ctx.db
        .query("scraps")
        .withIndex("by_machine", (q) => q.eq("machineId", machine._id as Id<"machines">))
        .order("desc")
        .take(20),
    ]);

    const materialById = new Map(materials.map((m) => [m._id, m]));
    const scrapTotals = new Map<string, number>();
    for (const scrap of allScraps) {
      scrapTotals.set(scrap.materialId, (scrapTotals.get(scrap.materialId) ?? 0) + scrap.quantity);
    }

    const enrichedStock = floorStock.map((batch) => {
      const material = materialById.get(batch.materialId);
      return {
        ...batch,
        maxScrap: material?.maxScrap,
        minOffcutWidth: material?.minOffcutWidth,
        minOffcutLength: material?.minOffcutLength,
        wasteLimitPolicy: material?.wasteLimitPolicy ?? "warn",
        unitLabel: material?.baseUnit ?? material?.unit ?? batch.baseUnit,
        catalogFamily: material?.catalogFamily ?? "ROLL",
        totalScrapLogged: scrapTotals.get(batch.materialId) ?? 0,
      };
    });

    return {
      floorStock: enrichedStock,
      recentOffcuts: recentOffcuts.map((entry) => ({
        ...entry,
        materialName: materialById.get(entry.materialId)?.name ?? "Unknown material",
      })),
      recentScraps: recentScraps.map((entry) => ({
        ...entry,
        materialName: materialById.get(entry.materialId)?.name ?? "Unknown material",
      })),
    };
  },
});