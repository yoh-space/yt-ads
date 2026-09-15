import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { collectFloorStock, resolveOperatorMachine } from "./common";

const COMPLETED_STATUSES = ["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"];

type EnrichedRequirement = Doc<"jobMaterialRequirements"> & {
  materialName: string;
  materialUnit: string;
  materialFamily?: string;
};

export type SubstrateMatchInfo =
  | {
      status: "MATCHED";
      materialId: string;
      materialName: string;
      remaining: number;
      unit: string;
    }
  | {
      status: "ROLL_CHANGE_REQUIRED";
      materialId: string;
      requiredMaterialName: string;
      loadedMaterialName: string;
      loadedRemaining: number;
      unit: string;
    }
  | {
      status: "NO_STOCK";
      materialId: string;
      requiredMaterialName: string;
    }
  | {
      status: "UNLINKED";
      materialId: string;
      requiredMaterialName: string;
      message: string;
    };

/**
 * Machine-scoped operator overview: one snapshot for the operator console.
 * Returns enriched data for the machine the operator is assigned to,
 * including artwork download URLs, order specifications, and substrate matching.
 */
export const getMachineOverview = query({
  args: {
    machineSlug: v.string(),
    selectedJobId: v.optional(v.id("jobCards")),
  },
  handler: async (ctx, args) => {
    const { identity, profile, machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    const [jobs, orders, materials, machineLinks] = await Promise.all([
      ctx.db.query("jobCards").collect(),
      ctx.db.query("customerOrders").collect(),
      ctx.db.query("materials").collect(),
      ctx.db.query("machineMaterialLinks").withIndex("by_machine", (q: any) => q.eq("machineId", machine._id as Id<"machines">)).collect(),
    ]);
    const orderById = new Map(orders.map((order) => [order._id, order]));
    const materialById = new Map(materials.map((material) => [material._id, material]));
    const activeLinkByMaterial = new Map(
      machineLinks.filter((l) => l.active).map((l) => [l.materialId, l])
    );

    const floorStock = await collectFloorStock(ctx, machine, identity, profile.role);

    // Filter non-ink active substrate batches to detect loaded roll/media
    const activeSubstrateBatches = floorStock.filter(
      (batch: any) =>
        (batch.status === "ACTIVE" || batch.status === "PENDING_CLEARANCE") &&
        batch.materialFamily !== "INK" &&
        !batch.isSolvent &&
        batch.currentRemaining > 0
    );
    const primaryMountedBatch = activeSubstrateBatches[0];

    const getSubstrateMatch = (materialId: string): SubstrateMatchInfo => {
      const directBatch = activeSubstrateBatches.find((b: any) => b.materialId === materialId);
      const reqMat = materialById.get(materialId as Id<"materials">);
      const isLinked = activeLinkByMaterial.has(materialId as Id<"materials">);

      if (directBatch) {
        return {
          status: "MATCHED",
          materialId,
          materialName: directBatch.materialName,
          remaining: directBatch.currentRemaining,
          unit: directBatch.baseUnit,
        };
      }

      if (!isLinked) {
        return {
          status: "UNLINKED",
          materialId,
          requiredMaterialName: reqMat?.name ?? "Unknown material",
          message: `Material "${reqMat?.name ?? materialId}" is not authorized/linked to this machine. Owner must link it before requesting.`,
        };
      }

      if (primaryMountedBatch) {
        return {
          status: "ROLL_CHANGE_REQUIRED",
          materialId,
          requiredMaterialName: reqMat?.name ?? "Unknown material",
          loadedMaterialName: primaryMountedBatch.materialName,
          loadedRemaining: primaryMountedBatch.currentRemaining,
          unit: primaryMountedBatch.baseUnit,
        };
      }
      return {
        status: "NO_STOCK",
        materialId,
        requiredMaterialName: reqMat?.name ?? "Unknown material",
      };
    };

    const machineJobs = jobs
      .filter((job) => job.machineId === machine._id)
      .map((job) => {
        const order = job.orderId ? orderById.get(job.orderId) : undefined;
        const reqMat = materialById.get(job.materialId);
        return {
          ...job,
          _id: job._id,
          orderStatus: order?.status,
          orderOverdue: Boolean(
            order && !COMPLETED_STATUSES.includes(order.status) && order.preferredDueDate < Date.now()
          ),
          orderDueTimestamp: order?.preferredDueDate,
          requiredMaterialName: reqMat?.name ?? "Unknown material",
          dimensions:
            order?.dimensions ??
            (job.length && job.width ? `${job.length}m × ${job.width}m` : undefined),
          substrateMatch: getSubstrateMatch(job.materialId),
        };
      });

    const activeJob =
      machineJobs.find((job) => job.status === "In production") ??
      machineJobs.find((job) => job.status === "Queued");
    const completedJob = machineJobs.find((job) => job.status === "Completed");

    const targetedJob = args.selectedJobId
      ? machineJobs.find((job) => job._id === args.selectedJobId)
      : undefined;

    const baseDisplayedJob = targetedJob ?? activeJob ?? completedJob;

    let jobRequirements: EnrichedRequirement[] = [];
    let activeJobRequiredMl: number | undefined;
    let enrichedDisplayedJob: any = null;

    if (baseDisplayedJob) {
      const order = baseDisplayedJob.orderId ? orderById.get(baseDisplayedJob.orderId) : undefined;
      const [requirements, artworkUrl, attachmentUrls] = await Promise.all([
        ctx.db
          .query("jobMaterialRequirements")
          .withIndex("by_job_card", (q) => q.eq("jobCardId", baseDisplayedJob._id))
          .collect(),
        order?.fileStorageId ? ctx.storage.getUrl(order.fileStorageId) : null,
        order?.attachmentStorageIds && order.attachmentStorageIds.length > 0
          ? Promise.all(
              order.attachmentStorageIds.map(async (id, idx) => ({
                name: order.attachmentFileNames?.[idx] ?? `Attachment ${idx + 1}`,
                url: await ctx.storage.getUrl(id),
              }))
            )
          : Promise.resolve([]),
      ]);

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

      enrichedDisplayedJob = {
        ...baseDisplayedJob,
        artworkUrl,
        attachmentUrls,
        fileName: order?.fileName,
        notes: order?.notes,
        specifications: order?.specifications ?? baseDisplayedJob.specifications,
        dimensions:
          order?.dimensions ??
          (baseDisplayedJob.length && baseDisplayedJob.width
            ? `${baseDisplayedJob.length}m × ${baseDisplayedJob.width}m`
            : undefined),
        orderLength: order?.length ?? baseDisplayedJob.length,
        orderWidth: order?.width ?? baseDisplayedJob.width,
        clientPhone: order?.phone,
        clientName: order?.clientName ?? baseDisplayedJob.client,
        serviceType: order?.serviceType ?? baseDisplayedJob.serviceType,
        substrateMatch: getSubstrateMatch(baseDisplayedJob.materialId),
      };
    }

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
      displayedJob: enrichedDisplayedJob,
      jobRequirements,
      activeJobRequiredMl,
      pendingClearance: floorStock.some((batch) => batch.status === "PENDING_CLEARANCE"),
      floorStock,
    };
  },
});