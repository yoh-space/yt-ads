import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { packageUnit, unit } from "../schema";
import { resolveOperatorMachine } from "./common";
import { createMaterialRequestInternal, acknowledgeMaterialRequestInternal } from "../materialRequests";
import { canAccessMaterialRequest } from "../authorization";

/**
 * Operator-scoped requisition surface for the /dashboard/operator workspace
 * namespace. Every handler is guarded by `resolveOperatorMachine`, so reads are
 * locked to the operator's own machine and writes can never target another
 * role's job card.
 */

export const list = query({
  args: { machineSlug: v.string() },
  handler: async (ctx, args) => {
    const { identity, profile, machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    const [requests, jobs, materials, users] = await Promise.all([
      ctx.db.query("materialRequests").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("materials").collect(),
      ctx.db.query("users").collect(),
    ]);

    const jobMap = new Map(jobs.map((job) => [job._id, job]));
    const materialMap = new Map(materials.map((material) => [material._id, material]));
    const userMap = new Map(users.map((user) => [user.authUserId, user.name]));

    const visibleRequests = requests.filter((request) => {
      const job = jobMap.get(request.jobCardId);
      if (!job || job.machineId !== machine._id) return false;
      return canAccessMaterialRequest(profile.role, identity._id, request, machine);
    });

    return visibleRequests
      .map((request) => {
        const job = jobMap.get(request.jobCardId);
        const material = materialMap.get(request.materialId);
        return {
          ...request,
          jobCode: job?.code ?? "Unknown job",
          client: job?.client ?? "Unknown client",
          jobTitle: job?.title ?? "Unknown job",
          materialName: material?.name ?? "Unknown material",
          machineName: machine.name,
          pickLocation: material?.storageLocation ?? "Central store",
          requesterName: userMap.get(request.requestedBy) ?? request.requestedBy,
          issuerName: request.issuedBy ? userMap.get(request.issuedBy) ?? request.issuedBy : undefined,
          receiverName: request.receivedBy ? userMap.get(request.receivedBy) ?? request.receivedBy : undefined,
        };
      })
      .sort((left, right) => right.requestedAt - left.requestedAt);
  },
});

export const create = mutation({
  args: {
    machineSlug: v.string(),
    jobCardId: v.id("jobCards"),
    materialId: v.id("materials"),
    requestedQuantity: v.number(),
    unit,
    note: v.optional(v.string()),
    packageUnit: v.optional(packageUnit),
    requestedPackages: v.number(),
    lines: v.optional(
      v.array(
        v.object({
          materialId: v.id("materials"),
          requestedQuantity: v.number(),
          unit,
          requestedPackages: v.number(),
          packageUnit,
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { identity, profile, machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    const { machineSlug: _machineSlug, ...rest } = args;
    return await createMaterialRequestInternal(ctx, identity, profile, rest, machine._id);
  },
});

/** Machine-scoped acknowledge: only requests raised on the operator's own machine. */
export const acknowledge = mutation({
  args: { machineSlug: v.string(), requestId: v.id("materialRequests") },
  handler: async (ctx, args) => {
    const { identity, profile, machine } = await resolveOperatorMachine(ctx, args.machineSlug);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Material request not found.");
    const job = await ctx.db.get(request.jobCardId);
    if (!job || job.machineId !== machine._id) {
      throw new Error("This request does not belong to your machine.");
    }
    return await acknowledgeMaterialRequestInternal(ctx, args, identity, profile.role);
  },
});