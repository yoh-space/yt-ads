import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { packageUnit, unit } from "../schema";
import { requireManagerRole } from "../users";
import { canAccessMaterialRequest } from "../authorization";
import { notifyRoles } from "../notificationHelpers";

/**
 * Manager requisition surface for the /dashboard/manager namespace. Strictly
 * gated to the manager role. Reads reuse the shared material-request
 * enrichment; the `create` mutation is the manager workspace's key mutation
 * (the generic `materialRequests.create` is operator-only).
 */

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { identity } = await requireManagerRole(ctx);
    const [requests, jobs, materials, machines, users] = await Promise.all([
      ctx.db.query("materialRequests").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("materials").collect(),
      ctx.db.query("machines").collect(),
      ctx.db.query("users").collect(),
    ]);

    const jobMap = new Map(jobs.map((job) => [job._id, job]));
    const materialMap = new Map(materials.map((material) => [material._id, material]));
    const machineMap = new Map(machines.map((machine) => [machine._id, machine]));
    const userMap = new Map(users.map((user) => [user.authUserId, user.name]));

    const visibleRequests = requests.filter((request) => {
      const job = jobMap.get(request.jobCardId);
      const machine = job ? machineMap.get(job.machineId) : undefined;
      return canAccessMaterialRequest("manager", identity._id, request, machine);
    });

    return visibleRequests
      .map((request) => {
        const job = jobMap.get(request.jobCardId);
        const material = materialMap.get(request.materialId);
        const machine = job ? machineMap.get(job.machineId) : undefined;
        return {
          ...request,
          jobCode: job?.code ?? "Unknown job",
          client: job?.client ?? "Unknown client",
          jobTitle: job?.title ?? "Unknown job",
          materialName: material?.name ?? "Unknown material",
          machineName: machine?.name ?? machine?.code ?? "Unassigned station",
          pickLocation: material?.storageLocation ?? "Central store",
          requesterName: userMap.get(request.requestedBy) ?? request.requestedBy,
          issuerName: request.issuedBy ? userMap.get(request.issuedBy) ?? request.issuedBy : undefined,
          receiverName: request.receivedBy ? userMap.get(request.receivedBy) ?? request.receivedBy : undefined,
        };
      })
      .sort((left, right) => right.requestedAt - left.requestedAt);
  },
});

/**
 * Manager-side material request creation. Mirrors the operator path's
 * validations (active job, active material, allowed-material matching, base
 * unit, positive quantities) without the operator sub-stock clearance gate.
 */
export const create = mutation({
  args: {
    jobCardId: v.id("jobCards"),
    materialId: v.id("materials"),
    requestedQuantity: v.number(),
    unit,
    note: v.optional(v.string()),
    packageUnit: v.optional(packageUnit),
    requestedPackages: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireManagerRole(ctx);
    if (!Number.isFinite(args.requestedQuantity) || args.requestedQuantity <= 0) {
      throw new Error("Requested quantity must be greater than zero.");
    }
    if (args.requestedPackages !== undefined && (!Number.isFinite(args.requestedPackages) || args.requestedPackages <= 0)) {
      throw new Error("Requested package quantity must be greater than zero.");
    }

    const [job, material] = await Promise.all([
      ctx.db.get(args.jobCardId),
      ctx.db.get(args.materialId),
    ]);
    if (!job || job.status === "Completed") throw new Error("An active job is required for a material request.");
    if (!material || !material.active) throw new Error("Active material not found.");

    const requirements = await ctx.db
      .query("jobMaterialRequirements")
      .withIndex("by_job_card", (q) => q.eq("jobCardId", args.jobCardId))
      .collect();
    const allowedMaterials = new Set([job.materialId, ...requirements.map((requirement) => requirement.materialId)]);
    if (!allowedMaterials.has(args.materialId)) {
      throw new Error("The requested material and unit must match the job card.");
    }
    if (args.unit !== (material.baseUnit ?? material.unit)) {
      throw new Error("Requested unit must match the material base unit.");
    }

    const requestGroupId = `${identity._id}-${Date.now()}`;
    const id = await ctx.db.insert("materialRequests", {
      jobCardId: args.jobCardId,
      materialId: args.materialId,
      requestedQuantity: Number(args.requestedQuantity.toFixed(3)),
      issuedQuantity: 0,
      unit: args.unit,
      status: "Requested",
      requestedBy: identity._id,
      requestedAt: Date.now(),
      note: args.note?.trim() || undefined,
      requestGroupId,
      packageUnit: args.packageUnit,
      requestedPackages: args.requestedPackages,
      conversionRatioSnapshot: material.conversionRatio ?? 1,
      issuedPackages: 0,
    });
    await ctx.db.insert("materialRequestLines", {
      requestGroupId,
      jobCardId: args.jobCardId,
      materialId: args.materialId,
      packageUnit: args.packageUnit ?? "PACKAGE",
      requestedPackages: args.requestedPackages ?? 0,
      issuedPackages: 0,
      baseUnit: args.unit,
      requestedBaseQuantity: Number(args.requestedQuantity.toFixed(3)),
      issuedBaseQuantity: 0,
      conversionRatioSnapshot: material.conversionRatio ?? 1,
      status: "Requested",
      note: args.note?.trim() || undefined,
      requestedBy: identity._id,
      requestedAt: Date.now(),
    });
    await notifyRoles(ctx, ["owner", "manager", "admin", "storekeeper"], {
      title: "New material request",
      message: `${material.name} requested ${args.requestedQuantity} ${args.unit} for ${job.code}.`,
      type: "material_request",
      actorAuthUserId: identity._id,
      relatedTable: "materialRequests",
      relatedId: id,
    });
    return (await ctx.db.get(id))!;
  },
});