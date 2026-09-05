import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { packageUnit, unit } from "./schema";
import { requireActiveProfile, requirePermission } from "./users";
import { canAccessMaterialRequest } from "./authorization";
import { notifyRoles, notifyUser } from "./notificationHelpers";
import { recordInventoryEvent } from "./inventoryLedger";

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
    const { identity, profile } = await requirePermission(ctx, "request.create");
    const OPERATOR_ROLES: string[] = ["laser_operator", "cnc_operator", "plotter_operator", "printer_operator"];
    if (!OPERATOR_ROLES.includes(profile.role)) {
      throw new Error("Only machine operators can request materials for active production tasks.");
    }
    if (!Number.isFinite(args.requestedQuantity) || args.requestedQuantity <= 0) {
      throw new Error("Requested quantity must be greater than zero.");
    }
    if (args.requestedPackages !== undefined && (!Number.isFinite(args.requestedPackages) || args.requestedPackages <= 0)) {
      throw new Error("Requested package quantity must be greater than zero.");
    }
    const unclearedBatches = await ctx.db
      .query("operatorSubStock")
      .withIndex("by_operator", (q) => q.eq("operatorId", identity._id))
      .filter((q) => q.or(q.eq(q.field("status"), "ACTIVE"), q.eq(q.field("status"), "PENDING_CLEARANCE")))
      .collect();
    if (unclearedBatches.length > 0) {
      throw new Error("Cannot request new materials until previous stock cycle clearance is approved by Owner.");
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
      packageUnit: args.packageUnit,
      requestedPackages: args.requestedPackages,
      issuedPackages: 0,
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
    issuedPackages: v.optional(v.number()),
    packageUnit: v.optional(packageUnit),
    operatorId: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "request.issue");
    if (!Number.isFinite(args.issuedQuantity) || args.issuedQuantity <= 0) {
      throw new Error("Issued quantity must be greater than zero.");
    }
    if (args.issuedPackages !== undefined && (!Number.isFinite(args.issuedPackages) || args.issuedPackages <= 0)) {
      throw new Error("Issued package quantity must be greater than zero.");
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
    const job = await ctx.db.get(request.jobCardId);
    const machine = job ? await ctx.db.get(job.machineId) : undefined;
    if (!job || !machine) throw new Error("The request's job machine is unavailable.");
    const operatorId = args.operatorId?.trim() || request.requestedBy;
    const packageQuantity = args.issuedPackages ?? 0;
    const conversionRatio = material.conversionRatio ?? 1;
    const ledgerPackageUnit = (args.packageUnit ?? request.packageUnit) === "ROLL"
      ? "ROLL"
      : (args.packageUnit ?? request.packageUnit) === "SHEET"
        ? "SHEET"
        : (args.packageUnit ?? request.packageUnit) === "CANISTER"
          ? "LITER"
          : undefined;
    const subStockId = await ctx.db.insert("operatorSubStock", {
      materialId: request.materialId,
      operatorId,
      machineId: job.machineId,
      issuedUnits: 0,
      issuedQuantity: 0,
      currentRemaining: 0,
      status: "ACTIVE",
      issuedBy: identity._id,
      issuedAt: Date.now(),
      updatedAt: Date.now(),
      packageUnit: args.packageUnit ?? request.packageUnit,
      issuedPackages: packageQuantity,
      remainingPackages: packageQuantity,
      baseUnit: material.baseUnit ?? material.unit,
      conversionRatioSnapshot: conversionRatio,
      issuedBaseQuantity: args.issuedQuantity,
      consumedBaseQuantity: 0,
      remainingBaseQuantity: args.issuedQuantity,
    });
    await recordInventoryEvent(ctx, {
      materialId: request.materialId,
      eventType: "STORE_TO_OPERATOR_TRANSFER",
      custody: "operator",
      balanceEffect: "transfer",
      quantity: args.issuedQuantity,
      unit: request.unit,
      baseUnit: request.unit,
      baseQuantity: args.issuedQuantity,
      packageQuantity: packageQuantity || undefined,
      packageUnit: ledgerPackageUnit,
      conversionRatio,
      operatorSubStockId: subStockId,
      operatorId,
      machineId: machine._id,
      jobCardId: request.jobCardId,
      materialRequestId: request._id,
      note: args.note?.trim() || `Material request issue for ${request.jobCardId}`,
      createdBy: identity._id,
    });
    const totalIssued = Number((request.issuedQuantity + args.issuedQuantity).toFixed(2));
    const nextStatus = totalIssued < request.requestedQuantity ? "Partially Issued" : "Issued";
    await ctx.db.patch(args.requestId, {
      issuedQuantity: totalIssued,
      issuedPackages: Number(((request.issuedPackages ?? 0) + (args.issuedPackages ?? 0)).toFixed(3)),
      packageUnit: args.packageUnit ?? request.packageUnit,
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
    if (!canAccessMaterialRequest(profile.role, identity._id, request, machine ?? undefined)) {
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
