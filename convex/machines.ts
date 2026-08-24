import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { role, unit, machineStatus } from "./schema";
import { requireAdmin } from "./users";
import { notifyRoles } from "./notificationHelpers";

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
    manufacturer: v.optional(v.string()),
    model: v.optional(v.string()),
    capability: v.optional(v.string()),
    notes: v.optional(v.string()),
    operatorRole: role,
    materialUnit: unit,
    status: machineStatus,
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    if (!args.name.trim() || !args.code.trim() || !args.type.trim()) {
      throw new Error("Machine name, code, and type are required.");
    }
    const existing = await ctx.db
      .query("machines")
      .withIndex("by_code", (q) => q.eq("code", args.code.trim()))
      .unique();
    if (existing) throw new Error("Machine code already exists.");
    const id = await ctx.db.insert("machines", {
      ...args,
      name: args.name.trim(),
      code: args.code.trim().toUpperCase(),
      type: args.type.trim(),
      manufacturer: args.manufacturer?.trim() || undefined,
      model: args.model?.trim() || undefined,
      capability: args.capability?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      active: true,
    });
    await notifyRoles(ctx, [args.operatorRole, "owner", "manager", "admin"], {
      title: "Machine added",
      message: `${args.name.trim()} was added to the machine register.`,
      type: "machine_update",
      actorAuthUserId: actor.authUserId,
      relatedTable: "machines",
      relatedId: id,
    });
    return (await ctx.db.get(id))!;
  },
});

export const updateStatus = mutation({
  args: { machineId: v.id("machines"), status: machineStatus },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const machine = await ctx.db.get(args.machineId);
    if (!machine) throw new Error("Machine not found.");
    if (args.status === "Maintenance" && machine.activeJob) {
      throw new Error("Active machines must be completed before entering maintenance.");
    }
    await ctx.db.patch(args.machineId, {
      status: args.status,
      activeJob: args.status === "Available" || args.status === "Maintenance" ? undefined : machine.activeJob,
    });
    await notifyRoles(ctx, [machine.operatorRole, "owner", "manager", "admin"], {
      title: "Machine status updated",
      message: `${machine.name} is now ${args.status}.`,
      type: "machine_update",
      actorAuthUserId: actor.authUserId,
      relatedTable: "machines",
      relatedId: args.machineId,
    });
  },
});

export const setActive = mutation({
  args: { machineId: v.id("machines"), active: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const machine = await ctx.db.get(args.machineId);
    if (!machine) throw new Error("Machine not found.");
    if (!args.active && machine.activeJob) {
      throw new Error("A machine with an active job cannot be deactivated.");
    }
    await ctx.db.patch(args.machineId, { active: args.active });
    await notifyRoles(ctx, [machine.operatorRole, "owner", "manager", "admin"], {
      title: "Machine availability updated",
      message: `${machine.name} was ${args.active ? "activated" : "deactivated"}.`,
      type: "machine_update",
      actorAuthUserId: actor.authUserId,
      relatedTable: "machines",
      relatedId: args.machineId,
    });
  },
});
