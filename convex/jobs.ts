import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { priority, unit } from "./schema";
import { requireActiveProfile, requirePermission } from "./users";
import { canAccessJob } from "./authorization";
import { notifyRoles, notifyUser } from "./notificationHelpers";
import { assertProductionQuantities } from "./validation";

async function notifyOrderCompletion(ctx: any, orderId: any, actorAuthUserId: string) {
  const order = await ctx.db.get(orderId);
  if (!order) return;
  const users = await ctx.db.query("users").collect();
  for (const user of users) {
    if (user.active && ["owner", "manager", "admin"].includes(user.role) && user.authUserId !== actorAuthUserId) {
      await ctx.db.insert("notifications", {
        recipientAuthUserId: user.authUserId,
        title: "Order ready for pickup",
        message: `${order.code} · ${order.clientName} is ready for pickup.`,
        type: "order_status",
        actorAuthUserId,
        relatedTable: "customerOrders",
        relatedId: orderId,
        createdAt: Date.now(),
      });
    }
  }
}

type ProductionInput = {
  jobCardId: string;
  inputQuantity: number;
  outputQuantity: number;
  wasteQuantity: number;
};

async function getProductionTotals(ctx: any, jobCardId: any) {
  const logs = await ctx.db
    .query("productionLogs")
    .withIndex("by_job_card", (q: any) => q.eq("jobCardId", jobCardId))
    .collect();
  return logs.reduce((total: number, log: { inputQuantity: number }) => total + log.inputQuantity, 0);
}

async function recordProductionInternal(ctx: any, args: ProductionInput, operatorId: string) {
  assertProductionQuantities(args.inputQuantity, args.outputQuantity, args.wasteQuantity);

  const job = await ctx.db.get(args.jobCardId);
  if (!job) throw new Error("Job card not found.");
  if (job.status === "Completed") throw new Error("Completed job cards cannot receive more production logs.");

  const material = await ctx.db.get(job.materialId);
  if (!material || !material.active) throw new Error("Active job material not found.");
  const previousInput = await getProductionTotals(ctx, args.jobCardId);
  if (previousInput + args.inputQuantity > job.quantity) {
    throw new Error("Production input exceeds the planned job quantity.");
  }
  if (args.inputQuantity > material.quantity) {
    throw new Error(`Insufficient ${material.name} stock for this production run.`);
  }

  await ctx.db.patch(job.materialId, {
    quantity: Number((material.quantity - args.inputQuantity).toFixed(2)),
  });
  await ctx.db.insert("stockMovements", {
    materialId: job.materialId,
    direction: "out",
    quantity: args.inputQuantity,
    unit: job.unit,
    baseUnit: job.unit,
    baseQuantity: args.inputQuantity,
    movementType: "STANDARD",
    note: `Production issue ${job.code}`,
    createdBy: operatorId,
    createdAt: Date.now(),
  });
  await ctx.db.insert("productionLogs", {
    jobCardId: job._id,
    machineId: job.machineId,
    inputQuantity: args.inputQuantity,
    outputQuantity: args.outputQuantity,
    wasteQuantity: args.wasteQuantity,
    unit: job.unit,
    operatorId,
    createdAt: Date.now(),
  });
  await ctx.db.patch(job._id, { status: "In production" });
  if (job.orderId) {
    await ctx.db.patch(job.orderId, { status: "In Production", updatedAt: Date.now() });
  }
  const machine = await ctx.db.get(job.machineId);
  if (machine && machine.status !== "Running") {
    await ctx.db.patch(machine._id, { status: "Running", activeJob: job.code });
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireActiveProfile(ctx);
    const jobs = await ctx.db.query("jobCards").collect();
    if (["owner", "manager", "admin", "storekeeper"].includes(profile.role)) return jobs;
    const machines = await ctx.db.query("machines").collect();
    const assignedMachineIds = new Set(machines.filter((machine) => machine.operatorRole === profile.role).map((machine) => machine._id));
    return jobs.filter((job) => assignedMachineIds.has(job.machineId));
  },
});

export const create = mutation({
  args: {
    client: v.string(),
    title: v.string(),
    machineId: v.id("machines"),
    materialId: v.id("materials"),
    quantity: v.number(),
    unit,
    due: v.string(),
    priority,
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "job.create");
    if (!args.client.trim() || !args.title.trim()) throw new Error("Client and job description are required.");
    if (!Number.isFinite(args.quantity) || args.quantity <= 0) {
      throw new Error("Planned job quantity must be greater than zero.");
    }
    const machine = await ctx.db.get(args.machineId);
    const material = await ctx.db.get(args.materialId);
    if (!machine || !machine.active) throw new Error("Active machine not found.");
    if (!material || !material.active) throw new Error("Active material not found.");
    if (args.unit !== (material.baseUnit ?? material.unit)) throw new Error("Job unit must match the selected material base unit.");
    if (machine.status === "Maintenance" || machine.status === "Unavailable") {
      return { success: false as const, error: `${machine.name} is currently ${machine.status.toLowerCase()} and cannot accept new jobs.` };
    }
    if (args.quantity > material.quantity) {
      return { success: false as const, error: `Stock shortfall — ${material.name} has ${material.quantity} ${material.baseUnit ?? material.unit} available but ${args.quantity} ${args.unit} is required.` };
    }

    const code = `JC-${String(430 + Math.floor(Math.random() * 500)).padStart(4, "0")}`;
    const id = await ctx.db.insert("jobCards", {
      code,
      client: args.client.trim(),
      title: args.title.trim(),
      machineId: args.machineId,
      materialId: args.materialId,
      quantity: args.quantity,
      unit: args.unit,
      status: "Queued",
      due: args.due,
      priority: args.priority,
      createdBy: identity._id,
      createdAt: Date.now(),
    });
    if (machine.status !== "Running") {
      await ctx.db.patch(args.machineId, { status: "Running", activeJob: code });
    }
    await notifyRoles(ctx, [machine.operatorRole, "owner", "manager", "admin"], {
      title: "Job card assigned",
      message: `${code} · ${args.client.trim()} was assigned to ${machine.name}.`,
      type: "job_update",
      actorAuthUserId: identity._id,
      relatedTable: "jobCards",
      relatedId: id,
    });
    const job = (await ctx.db.get(id))!;
    return { success: true as const, job };
  },
});

export const recordProduction = mutation({
  args: {
    jobCardId: v.id("jobCards"),
    inputQuantity: v.number(),
    outputQuantity: v.number(),
    wasteQuantity: v.number(),
  },
  handler: async (ctx, args) => {
    const { identity, profile } = await requireActiveProfile(ctx);
    const job = await ctx.db.get(args.jobCardId);
    if (!job) throw new Error("Job card not found.");
    const machine = await ctx.db.get(job.machineId);
    if (!machine) throw new Error("Job machine not found.");
    if (!canAccessJob(profile.role, machine)) {
      throw new Error("You are not assigned to this machine.");
    }
    await recordProductionInternal(ctx, args, identity._id);
    await notifyUser(ctx, job.createdBy, {
      title: "Production activity recorded",
      message: `${job.code} received a production update on ${machine.name}.`,
      type: "job_update",
      actorAuthUserId: identity._id,
      relatedTable: "jobCards",
      relatedId: args.jobCardId,
    });
  },
});

export const complete = mutation({
  args: { jobId: v.id("jobCards") },
  handler: async (ctx, args) => {
    const { identity, profile } = await requireActiveProfile(ctx);
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job card not found.");
    const machine = await ctx.db.get(job.machineId);
    if (!machine) throw new Error("Job machine not found.");
    if (!canAccessJob(profile.role, machine)) {
      throw new Error("You are not assigned to this machine.");
    }
    if (job.status === "Completed") return;

    const loggedInput = await getProductionTotals(ctx, args.jobId);
    const remaining = Number((job.quantity - loggedInput).toFixed(2));
    if (remaining > 0) {
      await recordProductionInternal(ctx, {
        jobCardId: args.jobId,
        inputQuantity: remaining,
        outputQuantity: remaining,
        wasteQuantity: 0,
      }, identity._id);
    }

    await ctx.db.patch(args.jobId, { status: "Completed" });
    if (job.orderId) {
      await ctx.db.patch(job.orderId, { status: "Ready for Pickup", updatedAt: Date.now() });
      await notifyOrderCompletion(ctx, job.orderId, identity._id);
    }
    await ctx.db.patch(machine._id, { status: "Available", activeJob: undefined });
    await notifyUser(ctx, job.createdBy, {
      title: "Job completed",
      message: `${job.code} was completed and ${machine.name} is available.`,
      type: "job_update",
      actorAuthUserId: identity._id,
      relatedTable: "jobCards",
      relatedId: args.jobId,
    });
  },
});
