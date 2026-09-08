import { query } from "../_generated/server";
import { v } from "convex/values";
import { resolveOperatorMachine } from "./common";

/**
 * Machine-scoped machine info for the operator workspace. Returns only the
 * fields the operator console needs instead of the full management catalog.
 */
export const getMachine = query({
  args: { machineSlug: v.string() },
  handler: async (ctx, args) => {
    const { machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    return {
      id: machine._id,
      name: machine.name,
      code: machine.code,
      type: machine.type,
      status: machine.status,
      materialUnit: machine.materialUnit,
      operatorRole: machine.operatorRole,
      activeJob: machine.activeJob,
      active: machine.active,
    };
  },
});