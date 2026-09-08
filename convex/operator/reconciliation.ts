import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { resolveOperatorMachine } from "./common";

/**
 * Machine-scoped weekly reconciliation history for the operator workspace.
 * Shows only counts recorded against the operator's own machine, freshly
 * enriched with material names for display.
 */
export const list = query({
  args: { machineSlug: v.string() },
  handler: async (ctx, args) => {
    const { machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    const [records, materials, mappedBatches] = await Promise.all([
      ctx.db.query("weeklyReconciliations")
        .withIndex("by_machine", (q) => q.eq("machineId", machine._id as Id<"machines">))
        .collect(),
      ctx.db.query("materials").collect(),
      ctx.db
        .query("operatorSubStock")
        .withIndex("by_machine", (q) => q.eq("machineId", machine._id as Id<"machines">))
        .collect(),
    ]);
    const materialById = new Map(materials.map((material) => [material._id, material]));
    const batchById = new Map(mappedBatches.map((batch) => [batch._id, batch]));
    return records
      .sort((left, right) => right.reconciledAt - left.reconciledAt)
      .slice(0, 100)
      .map((record) => {
        const batch = record.operatorSubStockId ? batchById.get(record.operatorSubStockId) : undefined;
        const material = batch ? materialById.get(batch.materialId) : undefined;
        const { _id, ...rest } = record;
        return {
          ...rest,
          id: _id,
          materialName: material?.name ?? "Material",
        };
      });
  },
});

/**
 * Machine-scoped open-reconciliation pressure for the operator workspace:
 * counts of the operator's floor batches that still have a pending physical
 * count or an approved clearance on this machine.
 */
export const operatorPressure = query({
  args: { machineSlug: v.string() },
  handler: async (ctx, args) => {
    const { identity, machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    const batches = await ctx.db
      .query("operatorSubStock")
      .withIndex("by_machine", (q) => q.eq("machineId", machine._id as Id<"machines">))
      .collect();
    const ownBatches = batches.filter(
      (batch) => batch.operatorId === identity._id || batch.operatorId === machine.operatorRole
    );
    return {
      awaitingCount: ownBatches.filter((batch) => batch.status === "ACTIVE").length,
      awaitingClearance: ownBatches.filter((batch) => batch.status === "PENDING_CLEARANCE").length,
    };
  },
});