import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { role, unit, machineStatus } from "./schema";
import type { Infer } from "convex/values";
import { requirePermission } from "./users";
import { notifyRoles } from "./notificationHelpers";

type Role = Infer<typeof role>;

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "machine.view");
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
    const { identity } = await requirePermission(ctx, "machine.create");
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
      actorAuthUserId: identity._id,
      relatedTable: "machines",
      relatedId: id,
    });
    return (await ctx.db.get(id))!;
  },
});

export const updateStatus = mutation({
  args: { machineId: v.id("machines"), status: machineStatus },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "machine.update");
    const machine = await ctx.db.get(args.machineId);
    if (!machine) throw new Error("Machine not found.");
    if ((args.status === "Maintenance" || args.status === "Unavailable") && machine.activeJob) {
      throw new Error("Active machines must be completed before changing to this status.");
    }
    await ctx.db.patch(args.machineId, {
      status: args.status,
      activeJob: args.status === "Available" || args.status === "Maintenance" || args.status === "Unavailable" ? undefined : machine.activeJob,
    });
    await notifyRoles(ctx, [machine.operatorRole, "owner", "manager", "admin"], {
      title: "Machine status updated",
      message: `${machine.name} is now ${args.status}.`,
      type: "machine_update",
      actorAuthUserId: identity._id,
      relatedTable: "machines",
      relatedId: args.machineId,
    });
  },
});

export const setActive = mutation({
  args: { machineId: v.id("machines"), active: v.boolean() },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "machine.update");
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
      actorAuthUserId: identity._id,
      relatedTable: "machines",
      relatedId: args.machineId,
    });
  },
});

export const update = mutation({
  args: {
    machineId: v.id("machines"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    type: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    model: v.optional(v.string()),
    capability: v.optional(v.string()),
    notes: v.optional(v.string()),
    operatorRole: v.optional(role),
    materialUnit: v.optional(unit),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "machine.update");
    const machine = await ctx.db.get(args.machineId);
    if (!machine) throw new Error("Machine not found.");
    if (args.code && args.code.trim().toUpperCase() !== machine.code) {
      const normalizedCode = args.code.trim().toUpperCase();
      const existing = await ctx.db
        .query("machines")
        .withIndex("by_code", (q) => q.eq("code", normalizedCode))
        .unique();
      if (existing) throw new Error("Machine code already exists.");
    }
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.code !== undefined) patch.code = args.code.trim().toUpperCase();
    if (args.type !== undefined) patch.type = args.type.trim();
    if (args.manufacturer !== undefined) patch.manufacturer = args.manufacturer.trim() || undefined;
    if (args.model !== undefined) patch.model = args.model.trim() || undefined;
    if (args.capability !== undefined) patch.capability = args.capability.trim() || undefined;
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;
    if (args.operatorRole !== undefined) patch.operatorRole = args.operatorRole;
    if (args.materialUnit !== undefined) patch.materialUnit = args.materialUnit;
    await ctx.db.patch(args.machineId, patch);
    await notifyRoles(ctx, [machine.operatorRole, "owner", "manager", "admin"], {
      title: "Machine updated",
      message: `${machine.name} configuration was updated.`,
      type: "machine_update",
      actorAuthUserId: identity._id,
      relatedTable: "machines",
      relatedId: args.machineId,
    });
  },
});

export const assignNextJob = mutation({
  args: { machineId: v.id("machines") },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "order.manage");
    const machine = await ctx.db.get(args.machineId);
    if (!machine) throw new Error("Machine not found.");
    if (machine.activeJob) throw new Error("Machine already has an active job.");
    if (machine.status === "Maintenance" || machine.status === "Unavailable") {
      return { success: false as const, error: `${machine.name} is currently ${machine.status.toLowerCase()} and cannot accept jobs.` };
    }
    const queuedJobs = (await ctx.db.query("jobCards").withIndex("by_status", (q) => q.eq("status", "Queued")).collect())
      .filter((job) => job.machineId === args.machineId)
      .sort((a, b) => a.createdAt - b.createdAt);
    const nextJob = queuedJobs[0];
    if (!nextJob) {
      return { success: false as const, error: `No queued job cards waiting for ${machine.name}.` };
    }
    await ctx.db.patch(nextJob._id, { status: "In production" });
    await ctx.db.patch(args.machineId, { status: "Running", activeJob: nextJob.code });
    if (nextJob.orderId) {
      const order = await ctx.db.get(nextJob.orderId);
      if (order && order.status === "Received") {
        await ctx.db.patch(nextJob.orderId, { status: "In Production", updatedAt: Date.now() });
      }
    }
    await notifyRoles(ctx, [machine.operatorRole, "owner", "manager", "admin"], {
      title: "Job assigned to machine",
      message: `${nextJob.code} · ${nextJob.client} is now active on ${machine.name}.`,
      type: "job_update",
      actorAuthUserId: identity._id,
      relatedTable: "jobCards",
      relatedId: nextJob._id,
    });
    return { success: true as const, job: nextJob };
  },
});

export const remove = mutation({
  args: { machineId: v.id("machines") },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "machine.delete");
    const machine = await ctx.db.get(args.machineId);
    if (!machine) throw new Error("Machine not found.");
    if (machine.activeJob) {
      throw new Error("Cannot remove a machine with an active job. Complete or reassign the job first.");
    }
    await ctx.db.patch(args.machineId, { active: false });
    await notifyRoles(ctx, [machine.operatorRole, "owner", "manager", "admin"], {
      title: "Machine removed",
      message: `${machine.name} was removed from the active machine register.`,
      type: "machine_update",
      actorAuthUserId: identity._id,
      relatedTable: "machines",
      relatedId: args.machineId,
    });
  },
});
