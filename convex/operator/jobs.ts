import { mutation, query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { resolveOperatorMachine } from "./common";
import { completeJobInternal } from "../jobs";

const COMPLETED_STATUSES = ["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"];

type OperatorJob = Doc<"jobCards"> & {
  orderStatus?: string;
  orderOverdue: boolean;
  orderDueTimestamp?: number;
};

export function findStockShortages(
  required: Array<{ materialId: string; quantity: number; materialName?: string; unit?: string }>,
  batches: Array<{ materialId: string; currentRemaining: number; machineId: string; operatorId: string; status: string }>,
  machineId: string,
  operatorIds: string[],
) {
  return required.map((item) => ({
    ...item,
    available: Number(batches
      .filter((batch) => batch.machineId === machineId && operatorIds.includes(batch.operatorId) && (batch.status === "ACTIVE" || batch.status === "PENDING_CLEARANCE") && batch.materialId === item.materialId)
      .reduce((sum, batch) => sum + Math.max(0, batch.currentRemaining), 0).toFixed(3)),
  })).filter((item) => item.available + 0.0005 < item.quantity);
}

async function enrichJobs(
  ctx: any,
  machineId: string,
  jobs: Array<Doc<"jobCards">>,
  orderById: Map<string, Doc<"customerOrders">>,
): Promise<OperatorJob[]> {
  return jobs
    .filter((job) => job.machineId === machineId)
    .map((job) => {
      const order = job.orderId ? orderById.get(job.orderId) : undefined;
      return {
        ...job,
        orderStatus: order?.status,
        orderOverdue: Boolean(
          order &&
            !COMPLETED_STATUSES.includes(order.status) &&
            order.preferredDueDate < Date.now()
        ),
        orderDueTimestamp: order?.preferredDueDate,
      } as OperatorJob;
    });
}

export async function auditJobMaterialAvailability(
  ctx: any,
  job: Doc<"jobCards">,
  machineId: string,
  operatorId: string,
  operatorRole: string,
) {
  const [requirements, batches, materials] = await Promise.all([
    ctx.db.query("jobMaterialRequirements").withIndex("by_job_card", (q: any) => q.eq("jobCardId", job._id)).collect(),
    ctx.db.query("operatorSubStock").collect(),
    ctx.db.query("materials").collect(),
  ]);
  const materialById = new Map<string, any>(materials.map((material: any) => [material._id as string, material]));
  const required: Array<{ materialId: string; quantity: number }> = requirements.length > 0
    ? requirements.map((requirement: any) => ({ materialId: requirement.materialId, quantity: Number((requirement.plannedBaseQuantity + requirement.approvedScrapQuantity).toFixed(3)) }))
    : [{ materialId: job.materialId, quantity: job.quantity }];
  const missing = findStockShortages(required, batches, machineId, [operatorId, operatorRole]).map((item) => {
    const material = materialById.get(item.materialId);
    return { materialId: item.materialId, materialName: material?.name ?? "Required material", required: item.quantity, available: item.available, unit: material?.baseUnit ?? material?.unit ?? job.unit };
  });
  return { sufficient: missing.length === 0, missing };
}

/** Machine-scoped job cards for the operator workspace. */
export const list = query({
  args: { machineSlug: v.string() },
  handler: async (ctx, args) => {
    const { machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    const [jobs, orders] = await Promise.all([
      ctx.db.query("jobCards").collect(),
      ctx.db.query("customerOrders").collect(),
    ]);
    const orderById = new Map(orders.map((order) => [order._id, order]));
    return enrichJobs(ctx, machine._id, jobs, orderById);
  },
});

/** Single machine-scoped job with its material requirements, for job/[id]. */
export const getJob = query({
  args: { machineSlug: v.string(), jobId: v.id("jobCards") },
  handler: async (ctx, args) => {
    const { machine, identity, profile } = await resolveOperatorMachine(ctx, args.machineSlug);
    const job = await ctx.db.get(args.jobId);
    if (!job || job.machineId !== machine._id) {
      throw new Error("Job card not found on this machine.");
    }
    const [orders, requirements, materials] = await Promise.all([
      ctx.db.query("customerOrders").collect(),
      ctx.db.query("jobMaterialRequirements")
        .withIndex("by_job_card", (q) => q.eq("jobCardId", args.jobId))
        .collect(),
      ctx.db.query("materials").collect(),
    ]);
    const orderById = new Map(orders.map((order) => [order._id, order]));
    const materialById = new Map(materials.map((material) => [material._id, material]));
    const order = job.orderId ? orderById.get(job.orderId) : undefined;
    const { _id, ...rest } = job;
    const stockAudit = await auditJobMaterialAvailability(ctx, job, machine._id, identity._id, profile.role);
    return {
      job: {
        ...rest,
        id: _id,
        orderStatus: order?.status,
        orderOverdue: Boolean(
          order &&
            !COMPLETED_STATUSES.includes(order.status) &&
            order.preferredDueDate < Date.now()
        ),
        orderDueTimestamp: order?.preferredDueDate,
      },
      requirements: requirements.map((req) => {
        const mat = materialById.get(req.materialId);
        return {
          ...req,
          materialName: mat?.name ?? "Unknown material",
          materialUnit: mat?.baseUnit ?? mat?.unit ?? req.baseUnit,
          materialFamily: mat?.materialFamily,
        };
      }),
      stockAudit,
    };
  },
});

export const start = mutation({
  args: { machineSlug: v.string(), jobId: v.id("jobCards") },
  handler: async (ctx, args) => {
    const { identity, profile, machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    const job = await ctx.db.get(args.jobId);
    if (!job || job.machineId !== machine._id) throw new Error("This job is not assigned to your machine.");
    if (job.status === "Completed") throw new Error("A completed job cannot be started again.");
    const stockAudit = await auditJobMaterialAvailability(ctx, job, machine._id, identity._id, profile.role);
    if (!stockAudit.sufficient) {
      const detail = stockAudit.missing.map((item: any) => `${item.materialName}: ${item.available}/${item.required} ${item.unit}`).join("; ");
      throw new Error(`Insufficient Stock — Request required materials from the storekeeper before starting production. ${detail}`);
    }
    const now = Date.now();
    await ctx.db.patch(job._id, { status: "In production", startedAt: job.startedAt ?? now, pausedAt: undefined, pauseReason: undefined });
    await ctx.db.patch(machine._id as Id<"machines">, { status: "Running", activeJob: job.code });
    if (job.orderId) await ctx.db.patch(job.orderId, { status: "IN_PRODUCTION", updatedAt: now });
    return { success: true, operatorId: identity._id };
  },
});

export const pause = mutation({
  args: { machineSlug: v.string(), jobId: v.id("jobCards"), reason: v.string() },
  handler: async (ctx, args) => {
    const { machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    const job = await ctx.db.get(args.jobId);
    if (!job || job.machineId !== machine._id) throw new Error("This job is not assigned to your machine.");
    if (job.status === "Completed") throw new Error("A completed job cannot be paused.");
    const reason = args.reason.trim();
    if (!reason) throw new Error("Please explain why the job is paused.");
    await ctx.db.patch(job._id, { status: "Paused", pausedAt: Date.now(), pauseReason: reason });
    await ctx.db.patch(machine._id as Id<"machines">, { status: "Available", activeJob: undefined });
    return { success: true };
  },
});

/**
 * Isolated operator job-completion mutation. Enforces the operator role and a
 * strict machine scope (slug must resolve to the operator's role AND the job
 * must be assigned to that machine), then runs the shared completion
 * transaction which keeps all accounting/status writes auditable.
 */
export const complete = mutation({
  args: { machineSlug: v.string(), jobId: v.id("jobCards") },
  handler: async (ctx, args) => {
    const { identity, profile, machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job card not found.");
    if (job.machineId !== machine._id) {
      throw new Error("This job is not assigned to your machine.");
    }
    return completeJobInternal(ctx, identity, profile, { jobId: args.jobId });
  },
});
