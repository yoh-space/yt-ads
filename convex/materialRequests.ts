import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { unit } from "./schema";
import { requireActiveProfile, requirePermission } from "./users";
import { canAccessMaterialRequest } from "./authorization";
import { notifyRoles, notifyUser } from "./notificationHelpers";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { identity, profile } = await requireActiveProfile(ctx);
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
    jobCardId: v.id("jobCards"),
    materialId: v.id("materials"),
    requestedQuantity: v.number(),
    unit,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "request.create");
    if (!Number.isFinite(args.requestedQuantity) || args.requestedQuantity <= 0) {
      throw new Error("Requested quantity must be greater than zero.");
    }
    const [job, material] = await Promise.all([
      ctx.db.get(args.jobCardId),
      ctx.db.get(args.materialId),
    ]);
    if (!job || job.status === "Completed") throw new Error("An active job is required for a material request.");
    if (!material || !material.active) throw new Error("Active material not found.");
    if (job.materialId !== args.materialId || job.unit !== args.unit) {
      throw new Error("The requested material and unit must match the job card.");
    }

    const id = await ctx.db.insert("materialRequests", {
      jobCardId: args.jobCardId,
      materialId: args.materialId,
      requestedQuantity: Number(args.requestedQuantity.toFixed(2)),
      issuedQuantity: 0,
      unit: args.unit,
      status: "Requested",
      requestedBy: identity._id,
      requestedAt: Date.now(),
      note: args.note?.trim() || undefined,
    });
    await notifyRoles(ctx, ["owner", "manager", "admin", "storekeeper"], {
      title: "New material request",
      message: `${material.name} requested for ${job.code} (${args.requestedQuantity} ${args.unit}).`,
      type: "material_request",
      actorAuthUserId: identity._id,
      relatedTable: "materialRequests",
      relatedId: id,
    });
    return (await ctx.db.get(id))!;
  },
});

export const issue = mutation({
  args: {
    requestId: v.id("materialRequests"),
    issuedQuantity: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "request.issue");
    if (!Number.isFinite(args.issuedQuantity) || args.issuedQuantity <= 0) {
      throw new Error("Issued quantity must be greater than zero.");
    }
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Material request not found.");
    if (request.status === "Received") throw new Error("A received request cannot be issued again.");
    const remainingRequested = request.requestedQuantity - request.issuedQuantity;
    if (args.issuedQuantity > remainingRequested) {
      throw new Error("Issued quantity cannot exceed the remaining requested quantity.");
    }

    const material = await ctx.db.get(request.materialId);
    if (!material || !material.active) throw new Error("Active material not found.");
    if (args.issuedQuantity > material.quantity) {
      throw new Error(`Insufficient ${material.name} stock for this request.`);
    }

    await ctx.db.patch(request.materialId, {
      quantity: Number((material.quantity - args.issuedQuantity).toFixed(2)),
    });
    await ctx.db.insert("stockMovements", {
      materialId: request.materialId,
      direction: "out",
      quantity: args.issuedQuantity,
      unit: request.unit,
      baseUnit: request.unit,
      baseQuantity: args.issuedQuantity,
      note: args.note?.trim() || `Material request issue for ${request.jobCardId}`,
      createdBy: identity._id,
      createdAt: Date.now(),
    });
    const totalIssued = Number((request.issuedQuantity + args.issuedQuantity).toFixed(2));
    const nextStatus = totalIssued < request.requestedQuantity ? "Partially Issued" : "Issued";
    await ctx.db.patch(args.requestId, {
      issuedQuantity: totalIssued,
      status: nextStatus,
      issuedBy: identity._id,
      issuedAt: Date.now(),
      note: args.note?.trim() || request.note,
    });
    await notifyUser(ctx, request.requestedBy, {
      title: nextStatus === "Partially Issued" ? "Short stock: request partially issued" : "Material issued",
      message: `${material.name} for ${request.jobCardId} was issued at ${totalIssued} ${request.unit}.`,
      type: nextStatus === "Partially Issued" ? "short_stock" : "material_issue",
      actorAuthUserId: identity._id,
      relatedTable: "materialRequests",
      relatedId: args.requestId,
    });
    return (await ctx.db.get(args.requestId))!;
  },
});

export const acknowledge = mutation({
  args: { requestId: v.id("materialRequests") },
  handler: async (ctx, args) => {
    const { identity, profile } = await requirePermission(ctx, "request.acknowledge");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Material request not found.");
    if (request.status !== "Issued" && request.status !== "Partially Issued") {
      throw new Error("Only an issued request can be marked received.");
    }
    const job = await ctx.db.get(request.jobCardId);
    const machine = job ? await ctx.db.get(job.machineId) : undefined;
    if (!canAccessMaterialRequest(profile.role, identity._id, request, machine)) {
      throw new Error("You cannot acknowledge this material request.");
    }
    await ctx.db.patch(args.requestId, {
      status: "Received",
      receivedBy: identity._id,
      receivedAt: Date.now(),
    });
    await notifyUser(ctx, request.issuedBy ?? request.requestedBy, {
      title: "Material received",
      message: `Material request ${args.requestId} was marked received.`,
      type: "material_received",
      actorAuthUserId: identity._id,
      relatedTable: "materialRequests",
      relatedId: args.requestId,
    });
    return (await ctx.db.get(args.requestId))!;
  },
});
