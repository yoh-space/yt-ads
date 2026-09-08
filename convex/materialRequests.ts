import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { packageUnit, unit } from "./schema";
import { requireActiveProfile, requirePermission } from "./users";
import { canAccessMaterialRequest } from "./authorization";
import { notifyRoles, notifyUser } from "./notificationHelpers";
import { recordInventoryEvent } from "./inventoryLedger";
import type { Id } from "./_generated/dataModel";

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

export const markShortStock = mutation({
  args: { requestId: v.id("materialRequests"), note: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "request.issue");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Material request not found.");
    if (request.status !== "Requested" && request.status !== "Partially Issued") {
      throw new Error("Only open requests can be marked short stock.");
    }
    await ctx.db.patch(args.requestId, {
      status: "Short Stock",
      issuedBy: identity._id,
      issuedAt: Date.now(),
      note: args.note?.trim() || request.note,
    });
    if (request.requestGroupId) {
      const lines = await ctx.db.query("materialRequestLines")
        .withIndex("by_request_group", (q) => q.eq("requestGroupId", request.requestGroupId!))
        .collect();
      for (const line of lines) {
        if (line.materialId === request.materialId && line.status !== "Issued") {
          await ctx.db.patch(line._id, { status: "Short Stock" });
        }
      }
    }
    return (await ctx.db.get(args.requestId))!;
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
    lines: v.optional(v.array(v.object({
      materialId: v.id("materials"),
      requestedQuantity: v.number(),
      unit,
      requestedPackages: v.number(),
      packageUnit,
    }))),
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
    const requestLines = args.lines?.length ? args.lines : [{
      materialId: args.materialId,
      requestedQuantity: args.requestedQuantity,
      unit: args.unit,
      requestedPackages: args.requestedPackages ?? 0,
      packageUnit: args.packageUnit ?? "PACKAGE" as const,
    }];
    if (requestLines.some((line) => !Number.isFinite(line.requestedQuantity) || line.requestedQuantity <= 0 || !Number.isFinite(line.requestedPackages) || line.requestedPackages <= 0)) {
      throw new Error("Each material line must contain positive package and converted quantities.");
    }
    const requirements = await ctx.db
      .query("jobMaterialRequirements")
      .withIndex("by_job_card", (q) => q.eq("jobCardId", args.jobCardId))
      .collect();
    const allowedMaterials = new Set([job.materialId, ...requirements.map((requirement) => requirement.materialId)]);
    if (requestLines.some((line) => !allowedMaterials.has(line.materialId))) {
      throw new Error("The requested material and unit must match the job card.");
    }
    const requestGroupId = `${identity._id}-${Date.now()}`;
    let firstId: Id<"materialRequests"> | undefined;
    for (const line of requestLines) {
      const lineMaterial = line.materialId === material._id ? material : await ctx.db.get(line.materialId);
      if (!lineMaterial || !lineMaterial.active) throw new Error("Every requested material must be active.");
      if (line.unit !== (lineMaterial.baseUnit ?? lineMaterial.unit)) throw new Error("Requested unit must match the material base unit.");
      const id = await ctx.db.insert("materialRequests", {
        jobCardId: args.jobCardId,
        materialId: line.materialId,
        requestedQuantity: Number(line.requestedQuantity.toFixed(3)),
        issuedQuantity: 0,
        unit: line.unit,
        status: "Requested",
        requestedBy: identity._id,
        requestedAt: Date.now(),
        note: args.note?.trim() || undefined,
        requestGroupId,
        packageUnit: line.packageUnit,
        requestedPackages: line.requestedPackages,
        issuedPackages: 0,
      });
      firstId ??= id;
      await ctx.db.insert("materialRequestLines", {
        requestGroupId,
        jobCardId: args.jobCardId,
        materialId: line.materialId,
        packageUnit: line.packageUnit,
        requestedPackages: line.requestedPackages,
        issuedPackages: 0,
        baseUnit: line.unit,
        requestedBaseQuantity: Number(line.requestedQuantity.toFixed(3)),
        issuedBaseQuantity: 0,
        conversionRatioSnapshot: lineMaterial.conversionRatio ?? 1,
        status: "Requested",
        note: args.note?.trim() || undefined,
        requestedBy: identity._id,
        requestedAt: Date.now(),
      });
    }
    await notifyRoles(ctx, ["owner", "manager", "admin", "storekeeper"], {
      title: "New material request",
      message: `${requestLines.length} material line(s) requested for ${job.code}.`,
      type: "material_request",
      actorAuthUserId: identity._id,
      relatedTable: "materialRequests",
      relatedId: firstId,
    });
    return (await ctx.db.get(firstId!))!;
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
    if (request.requestGroupId) {
      const lines = await ctx.db.query("materialRequestLines")
        .withIndex("by_request_group", (q) => q.eq("requestGroupId", request.requestGroupId!))
        .collect();
      const matchingLine = lines.find((line) => line.materialId === request.materialId);
      if (matchingLine) {
        await ctx.db.patch(matchingLine._id, {
          issuedPackages: (matchingLine.issuedPackages ?? 0) + (args.issuedPackages ?? 0),
          issuedBaseQuantity: (matchingLine.issuedBaseQuantity ?? 0) + args.issuedQuantity,
          status: totalIssued < request.requestedQuantity ? "Partially Issued" : "Issued",
          issuedBy: identity._id,
          issuedAt: Date.now(),
        });
      }
    }
    await notifyUser(ctx, request.requestedBy, {
      title: nextStatus === "Partially Issued" ? "Short stock: request partially issued" : "Material issued",
      message: `${material.name} for ${job.code} was issued at ${totalIssued} ${request.unit}.`,
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
    const material = await ctx.db.get(request.materialId);
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
      message: `${material?.name ?? "Material request"} for ${job?.code ?? "the production job"} was marked received.`,
      type: "material_received",
      actorAuthUserId: identity._id,
      relatedTable: "materialRequests",
      relatedId: args.requestId,
    });
    return (await ctx.db.get(args.requestId))!;
  },
});
