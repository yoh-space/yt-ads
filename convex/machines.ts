import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { role, unit, machineStatus } from "./schema";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await authComponent.getAuthUser(ctx);
    return ctx.db
      .query("machines")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    type: v.string(),
    operatorRole: role,
    materialUnit: unit,
    status: machineStatus,
  },
  handler: async (ctx, args) => {
    await authComponent.getAuthUser(ctx);
    const id = await ctx.db.insert("machines", { ...args, active: true });
    return (await ctx.db.get(id))!;
  },
});
