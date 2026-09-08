import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { collectFloorStock, resolveOperatorMachine } from "./common";

const COMPLETED_STATUSES = ["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"];

type EnrichedRequirement = Doc<"jobMaterialRequirements"> & {
  materialName: string;
  materialUnit: string;
  materialFamily?: string;
};

/**
 * Machine-scoped operator overview: one snapshot for the operator console.
 * Unlike the legacy page (which pulled `machines.list`, `jobs.list`,
 * `inventory.listOperatorMachineStock`, and `jobs.getJobRequirements` and
 * re-derived everything client-side), this returns already-scoped, enriched
 * data for the single machine the operator is assigned to.
 */
export const getMachineOverview = query({
  args: { machineSlug: v.string() },
  handler: async (ctx, args) => {
    const { identity, profile, machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    const [jobs, orders, materials] = await Promise.all([
      ctx.db.query("jobCards").collect(),
      ctx.db.query("customerOrders").collect(),
      ctx.db.query("materials").collect(),
    ]);
    const orderById = new Map(orders.map((order) => [order._id, order]));
    const materialById = new Map(materials.map((material) => [material._id, material]));

    const machineJobs = jobs
      .filter((job) => job.machineId === machine._id)
      .map((job) => {
        const order = job.orderId ? orderById.get(job.orderId) : undefined;
        return {
          ...job,
          _id: job._id,
          orderStatus: order?.status,
          orderOverdue: Boolean(
            order && !COMPLETED_STATUSES.includes(order.status) && order.preferredDueDate < Date.now()
          ),
          orderDueTimestamp: order?.preferredDueDate,
        };
      });

    const activeJob =
      machineJobs.find((job) => job.status === "In production") ??
      machineJobs.find((job) => job.status === "Queued");
    const completedJob = machineJobs.find((job) => job.status === "Completed");
    const displayedJob = activeJob ?? completedJob;

    let jobRequirements: EnrichedRequirement[] = [];
    let activeJobRequiredMl: number | undefined;
    if (displayedJob) {
      const requirements = await ctx.db
        .query("jobMaterialRequirements")
        .withIndex("by_job_card", (q) => q.eq("jobCardId", displayedJob._id))
        .collect();
      jobRequirements = requirements.map((req) => {
        const mat = materialById.get(req.materialId);
        return {
          ...req,
          materialName: mat?.name ?? "Unknown material",
          materialUnit: mat?.baseUnit ?? mat?.unit ?? req.baseUnit,
          materialFamily: mat?.materialFamily,
        };
      });
      activeJobRequiredMl = jobRequirements
        .filter((req) => req.materialFamily === "INK")
        .reduce((sum, req) => {
          const base = req.plannedBaseQuantity + req.approvedScrapQuantity;
          return sum + (req.materialUnit.toLowerCase().includes("l") ? base * 1000 : base);
        }, 0);
    }

    const floorStock = await collectFloorStock(ctx, machine, identity, profile.role);

    return {
      machine: {
        id: machine._id,
        name: machine.name,
        code: machine.code,
        type: machine.type,
        status: machine.status,
        materialUnit: machine.materialUnit,
        operatorRole: machine.operatorRole,
        activeJob: machine.activeJob,
      },
      machineJobs,
      activeJob: activeJob ?? null,
      completedJob: completedJob ?? null,
      displayedJob: displayedJob ?? null,
      jobRequirements,
      activeJobRequiredMl,
      pendingClearance: floorStock.some((batch) => batch.status === "PENDING_CLEARANCE"),
      floorStock,
    };
  },
});