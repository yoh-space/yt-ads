import { mutation, query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { v } from "convex/values";
import { resolveOperatorMachine } from "./common";
import { completeJobInternal } from "../jobs";

const COMPLETED_STATUSES = ["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"];

type OperatorJob = Doc<"jobCards"> & {
  orderStatus?: string;
  orderOverdue: boolean;
  orderDueTimestamp?: number;
};

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
    const { machine } = await resolveOperatorMachine(ctx, args.machineSlug);
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
    };
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