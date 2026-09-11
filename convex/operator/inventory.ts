import { query } from "../_generated/server";
import { v } from "convex/values";
import { collectFloorStock, resolveOperatorMachine } from "./common";

/** Machine-scoped floor sub-stock for the operator workspace. */
export const listStock = query({
  args: { machineSlug: v.string() },
  handler: async (ctx, args) => {
    const { identity, profile, machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    return collectFloorStock(ctx, machine, identity, profile.role);
  },
});

/** Live/uncleared floor batches for this machine, plus the clearance gate flag. */
export const uncleared = query({
  args: { machineSlug: v.string() },
  handler: async (ctx, args) => {
    const { identity, profile, machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    const batches = await collectFloorStock(ctx, machine, identity, profile.role);
    const live = batches.filter(
      (batch) =>
        (batch.status === "ACTIVE" && batch.currentRemaining > 0.0001) ||
        batch.status === "PENDING_CLEARANCE",
    );
    return {
      batches: live,
      hasPendingClearance: live.some((batch) => batch.status === "PENDING_CLEARANCE"),
    };
  },
});