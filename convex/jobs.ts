import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { priority, unit } from "./schema";
import { requireActiveProfile, requireRoles } from "./users";
import { assertProductionQuantities } from "./validation";

const JOB_MANAGER_ROLES = ["admin", "storekeeper"] as const;

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
  const machine = await ctx.db.get(job.machineId);
  if (machine && machine.status !== "Running") {
    await ctx.db.patch(machine._id, { status: "Running", activeJob: job.code });
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await authComponent.getAuthUser(ctx);
    return ctx.db.query("jobCards").collect();
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
    const { identity } = await requireRoles(ctx, [...JOB_MANAGER_ROLES]);
    if (!args.client.trim() || !args.title.trim()) throw new Error("Client and job description are required.");
    if (!Number.isFinite(args.quantity) || args.quantity <= 0) {
      throw new Error("Planned job quantity must be greater than zero.");
    }
    const machine = await ctx.db.get(args.machineId);
    const material = await ctx.db.get(args.materialId);
    if (!machine || !machine.active) throw new Error("Active machine not found.");
    if (!material || !material.active) throw new Error("Active material not found.");
    if (args.unit !== material.unit) throw new Error("Job unit must match the selected material base unit.");
    if (machine.status === "Maintenance") throw new Error("Jobs cannot be assigned to a machine in maintenance.");

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
    return (await ctx.db.get(id))!;
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
    if (profile.role !== "admin" && profile.role !== "storekeeper" && profile.role !== machine.operatorRole) {
      throw new Error("You are not assigned to this machine.");
    }
    await recordProductionInternal(ctx, args, identity._id);
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
    if (profile.role !== "admin" && profile.role !== "storekeeper" && profile.role !== machine.operatorRole) {
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
    await ctx.db.patch(machine._id, { status: "Available", activeJob: undefined });
  },
});
