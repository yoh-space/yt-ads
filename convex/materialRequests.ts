import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { packageUnit, unit } from "./schema";
import { requireActiveProfile, requirePermission, OPERATOR_ROLES } from "./users";
import { canAccessMaterialRequest } from "./authorization";
import { notifyRoles, notifyUser } from "./notificationHelpers";
import { recordInventoryEvent } from "./inventoryLedger";
import { requireNoUnresolvedShortage } from "./reconciliation";
import type { Id } from "./_generated/dataModel";
import type { Role } from "./types";

type Unit = Infer<typeof unit>;
type PackageUnit = Infer<typeof packageUnit>;

function expectedPackageUnit(material: {
  packageUnit?: PackageUnit;
  purchaseUnit?: string;
}): PackageUnit {
  if (material.packageUnit) return material.packageUnit;
  switch (material.purchaseUnit) {
    case "roll":
      return "ROLL";
    case "sheet":
      return "SHEET";
    case "canister":
    case "liter":
      return "CANISTER";
    case "piece":
      return "PIECE";
    default:
      return "PACKAGE";
  }
}

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

const createMaterialRequestArgs = {
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
};

type CreateMaterialRequestArgs = {
  jobCardId: Id<"jobCards">;
  materialId: Id<"materials">;
  requestedQuantity: number;
  unit: Unit;
  note?: string;
  packageUnit?: PackageUnit;
  requestedPackages: number;
  lines?: Array<{
    materialId: Id<"materials">;
    requestedQuantity: number;
    unit: Unit;
    requestedPackages: number;
    packageUnit: PackageUnit;
  }>;
};

/**
 * Shared transaction that validates and persists a material request. Operators
 * reach it through the generic `create` mutation or the machine-scoped
 * `operator.requests.create` surface. When `scopeMachineId` is supplied the job
 * is locked to that machine; otherwise the job's own machine operator role must
 * equal the caller's role (attribute isolation), so an operator can never open
 * a request against another role's job card.
 */
export async function getMaterialRequestEligibilityInternal(
  ctx: QueryCtx | MutationCtx,
  identity: { _id: string },
  profile: { role: Role; assignedMachineIds?: ReadonlyArray<string> },
  args: { machineId: Id<"machines">; jobCardId: Id<"jobCards"> },
) {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  const [machine, job] = await Promise.all([
    ctx.db.get(args.machineId),
    ctx.db.get(args.jobCardId),
  ]);

  if (!machine) {
    return {
      eligible: false,
      blockingReasons: ["Machine not found."],
      warnings: [],
      machine: null,
      job: null,
      allowedMaterials: [],
      conversionSnapshots: [],
    };
  }

  if (machine.operatorRole !== profile.role) {
    blockingReasons.push("This machine is not assigned to your operator role.");
  }
  if (profile.assignedMachineIds?.length && !profile.assignedMachineIds.includes(machine._id)) {
    blockingReasons.push("This machine is outside your assigned machine scope.");
  }

  if (!job) {
    blockingReasons.push("Job card not found.");
  } else {
    if (job.status === "Completed") {
      blockingReasons.push("Job card is already completed.");
    }
    if (job.machineId !== machine._id) {
      blockingReasons.push("This job is not assigned to the selected machine.");
    }
  }

  if (!job) {
    return {
      eligible: false,
      blockingReasons,
      warnings,
      machine: {
        id: machine._id,
        code: machine.code,
        name: machine.name,
        operatorRole: machine.operatorRole,
      },
      job: null,
      allowedMaterials: [],
      conversionSnapshots: [],
    };
  }

  const requirements = await ctx.db
    .query("jobMaterialRequirements")
    .withIndex("by_job_card", (q) => q.eq("jobCardId", job._id))
    .collect();

  const materialIdSet = new Set<Id<"materials">>([job.materialId]);
  for (const req of requirements) {
    materialIdSet.add(req.materialId);
  }

  const materials = (await Promise.all(Array.from(materialIdSet).map((id) => ctx.db.get(id)))).filter(
    (m): m is NonNullable<typeof m> => m !== null && m.active,
  );

  const machineBatches = await ctx.db
    .query("operatorSubStock")
    .withIndex("by_machine", (q) => q.eq("machineId", machine._id))
    .collect();

  const operatorBatches = machineBatches.filter(
    (b) => b.operatorId === identity._id || b.operatorId === profile.role,
  );

  const reconciliations = await ctx.db.query("reconciliations").collect();

  const allowedMaterials = [];
  const conversionSnapshots = [];

  for (const mat of materials) {
    const isPrimary = mat._id === job.materialId;
    const req = requirements.find((r) => r.materialId === mat._id);
    const plannedQty = req?.plannedBaseQuantity ?? (isPrimary ? (job.quantity ?? 0) : 0);

    const matBatches = operatorBatches.filter((b) => b.materialId === mat._id);
    const pendingBatch = matBatches.find((b) => b.status === "PENDING_CLEARANCE");
    const activeBatchWithStock = matBatches.find((b) => b.status === "ACTIVE" && b.currentRemaining > 0.0001);
    const depletedBatch = matBatches.find((b) => b.currentRemaining <= 0.0001);

    const shortage = reconciliations.find(
      (r) => r.materialId === mat._id && r.variance < 0 && r.status !== "Resolved",
    );

    let priorCustodyState: "NONE" | "USABLE_STOCK" | "DEPLETED" | "PENDING_CLEARANCE" | "SHORTAGE" = "NONE";
    let isBlocked = false;
    let materialBlockReason: string | undefined;

    if (shortage) {
      priorCustodyState = "SHORTAGE";
      isBlocked = true;
      materialBlockReason = `Unresolved shortage reconciliation (${shortage.status ?? "Open"}).`;
    } else if (pendingBatch) {
      priorCustodyState = "PENDING_CLEARANCE";
      isBlocked = true;
      materialBlockReason = "Pending owner clearance approval for previous batch.";
    } else if (activeBatchWithStock) {
      priorCustodyState = "USABLE_STOCK";
      isBlocked = true;
      materialBlockReason = `Active stock of ${activeBatchWithStock.currentRemaining.toFixed(2)} ${activeBatchWithStock.baseUnit ?? "units"} still in custody.`;
    } else if (depletedBatch) {
      priorCustodyState = "DEPLETED";
      warnings.push(`Previous batch for ${mat.name} has been consumed (0 remaining).`);
    }

    const packageUnit = expectedPackageUnit(mat);
    const conversionRatio = mat.conversionRatio && mat.conversionRatio > 0 ? mat.conversionRatio : 1;
    const baseUnit = mat.baseUnit ?? mat.unit;

    allowedMaterials.push({
      id: mat._id,
      name: mat.name,
      unit: mat.unit,
      baseUnit,
      category: mat.category,
      catalogFamily: mat.catalogFamily,
      inkColor: mat.inkColor,
      specificationOptions: mat.specificationOptions,
      packageUnit,
      conversionRatio,
      plannedQuantity: plannedQty,
      remainingInCustody: activeBatchWithStock?.currentRemaining ?? 0,
      priorCustodyState,
      isBlocked,
      blockReason: materialBlockReason,
      isPrimary,
    });

    conversionSnapshots.push({
      materialId: mat._id,
      materialName: mat.name,
      packageUnit,
      baseUnit,
      conversionRatio,
    });
  }

  if (allowedMaterials.length === 0) {
    blockingReasons.push("No active materials configured for this job card.");
  } else if (allowedMaterials.every((m) => m.isBlocked)) {
    blockingReasons.push("All required materials for this job card have active custody or clearance blocks.");
  }

  return {
    eligible: blockingReasons.length === 0 && allowedMaterials.some((m) => !m.isBlocked),
    blockingReasons,
    warnings,
    machine: {
      id: machine._id,
      code: machine.code,
      name: machine.name,
      operatorRole: machine.operatorRole,
    },
    job: {
      id: job._id,
      code: job.code,
      title: job.title,
      client: job.client,
      status: job.status,
      machineId: job.machineId,
    },
    allowedMaterials,
    conversionSnapshots,
  };
}

export async function createMaterialRequestInternal(
  ctx: MutationCtx,
  identity: { _id: string },
  profile: { role: Role; assignedMachineIds?: ReadonlyArray<string> },
  args: CreateMaterialRequestArgs,
  scopeMachineId?: string,
) {
  if (!OPERATOR_ROLES.includes(profile.role)) {
    throw new Error("Only machine operators can request materials for active production tasks.");
  }
  if (!Number.isFinite(args.requestedQuantity) || args.requestedQuantity <= 0) {
    throw new Error("Requested quantity must be greater than zero.");
  }

  const [job, material] = await Promise.all([
    ctx.db.get(args.jobCardId),
    ctx.db.get(args.materialId),
  ]);
  if (!job || job.status === "Completed") throw new Error("An active job is required for a material request.");
  if (!material || !material.active) throw new Error("Active material not found.");
  const scopeMachine =
    scopeMachineId !== undefined ? await ctx.db.get(scopeMachineId as Id<"machines">) : await ctx.db.get(job.machineId);
  if (!scopeMachine) throw new Error("The job's machine is unavailable.");
  if (job.machineId !== scopeMachine._id) {
    throw new Error("This job is not assigned to your machine.");
  }
  if (scopeMachine.operatorRole !== profile.role) {
    throw new Error("This job belongs to a different operator role.");
  }
  if (profile.assignedMachineIds?.length && !profile.assignedMachineIds.includes(scopeMachine._id)) {
    throw new Error("This machine is outside your assigned machine scope.");
  }

  const requestLines: CreateMaterialRequestArgs["lines"] = args.lines?.length ? args.lines : [{
    materialId: args.materialId,
    requestedQuantity: args.requestedQuantity,
    unit: args.unit,
    requestedPackages: args.requestedPackages,
    packageUnit: args.packageUnit ?? "PACKAGE",
  }];
  if (requestLines.some((line) => !Number.isFinite(line.requestedQuantity) || line.requestedQuantity <= 0)) {
    throw new Error("Each material line must contain a positive converted quantity.");
  }
  if (requestLines.some((line) => !Number.isFinite(line.requestedPackages) || line.requestedPackages <= 0)) {
    throw new Error("Each material line must contain a positive package quantity.");
  }
  const requirements = await ctx.db
    .query("jobMaterialRequirements")
    .withIndex("by_job_card", (q) => q.eq("jobCardId", args.jobCardId))
    .collect();
  const allowedMaterials = new Set([job.materialId, ...requirements.map((requirement) => requirement.materialId)]);
  if (requestLines.some((line) => !allowedMaterials.has(line.materialId))) {
    throw new Error("The requested material and unit must match the job card.");
  }
  for (const line of requestLines) {
    const lineMaterial = line.materialId === material._id ? material : await ctx.db.get(line.materialId);
    if (!lineMaterial || !lineMaterial.active) throw new Error("Every requested material must be active.");
    const expectedUnit = lineMaterial.baseUnit ?? lineMaterial.unit;
    if (line.unit !== expectedUnit) throw new Error("Requested unit must match the material base unit.");
    const expectedPackage = expectedPackageUnit(lineMaterial);
    if (line.packageUnit !== expectedPackage) {
      throw new Error(`Requested package unit must match ${lineMaterial.name}'s configured purchase unit.`);
    }
    const conversionRatio = lineMaterial.conversionRatio ?? 1;
    const expectedQuantity = Number((line.requestedPackages * conversionRatio).toFixed(3));
    if (Math.abs(expectedQuantity - line.requestedQuantity) > 0.001) {
      throw new Error(`Requested quantity must equal ${expectedQuantity} ${expectedUnit} for ${line.requestedPackages} package(s).`);
    }
    await requireNoUnresolvedShortage(ctx, line.materialId);
  }

  // Scoped custody check for this operator and machine
  const machineBatches = await ctx.db
    .query("operatorSubStock")
    .withIndex("by_machine", (q) => q.eq("machineId", scopeMachine._id))
    .collect();

  const operatorBatches = machineBatches.filter(
    (b) => b.operatorId === identity._id || b.operatorId === profile.role,
  );

  // Auto-transition depleted batches to EXHAUSTED
  for (const batch of operatorBatches) {
    if (batch.status === "ACTIVE" && batch.currentRemaining <= 0.0001) {
      await ctx.db.patch(batch._id, { status: "EXHAUSTED", updatedAt: Date.now() });
    }
  }

  const requestedMaterialIds = new Set(requestLines.map((line) => line.materialId));
  for (const requestedMaterialId of requestedMaterialIds) {
    const matBatches = operatorBatches.filter((b) => b.materialId === requestedMaterialId);

    // 1. Unresolved clearance on this machine
    const pendingBatch = matBatches.find((b) => b.status === "PENDING_CLEARANCE");
    if (pendingBatch) {
      const lineMaterial = requestedMaterialId === material._id ? material : await ctx.db.get(requestedMaterialId);
      const name = lineMaterial?.name ?? "Material";
      throw new Error(
        `UNRESOLVED_CUSTODY_CLEARANCE: Cannot request new stock for ${name} until previous stock cycle clearance is approved by Owner.`,
      );
    }

    // 2. Active usable stock already in custody
    const activeBatch = matBatches.find((b) => b.status === "ACTIVE" && b.currentRemaining > 0.0001);
    if (activeBatch) {
      const lineMaterial = requestedMaterialId === material._id ? material : await ctx.db.get(requestedMaterialId);
      const name = lineMaterial?.name ?? "Material";
      const remaining = activeBatch.currentRemaining.toFixed(2);
      const unitLabel = activeBatch.baseUnit ?? "units";
      throw new Error(
        `ACTIVE_CUSTODY_EXISTS: An active batch of ${name} with ${remaining} ${unitLabel} remaining is already assigned to this machine. Consume or reconcile existing stock before requesting a new batch.`,
      );
    }
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
      conversionRatioSnapshot: lineMaterial.conversionRatio ?? 1,
      issuedPackages: 0,
      machineId: scopeMachine._id,
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
}

export const create = mutation({
  args: createMaterialRequestArgs,
  handler: async (ctx, args) => {
    const { identity, profile } = await requirePermission(ctx, "request.create");
    return await createMaterialRequestInternal(ctx, identity, profile, args);
  },
});

export async function issueMaterialRequestInternal(
  ctx: any,
  args: {
    requestId: Id<"materialRequests">;
    issuedQuantity: number;
    issuedPackages?: number;
    packageUnit?: any;
    operatorId?: string;
    note?: string;
  },
  identity: { _id: string; [key: string]: any }
) {
  if (!Number.isFinite(args.issuedQuantity) || args.issuedQuantity <= 0) {
    throw new Error("Issued quantity must be greater than zero.");
  }
  if (args.issuedPackages !== undefined && (!Number.isFinite(args.issuedPackages) || args.issuedPackages <= 0)) {
    throw new Error("Issued package quantity must be greater than zero.");
  }
  const request = await ctx.db.get(args.requestId);
  if (!request) throw new Error("Material request not found.");
  if (request.status === "Received" || request.status === "Issued" || request.status === "Short Stock" || request.status === "Discrepancy") {
    throw new Error("Only an open material request can be issued.");
  }
  const remainingRequested = request.requestedQuantity - request.issuedQuantity;
  if (remainingRequested <= 0) {
    throw new Error("This material request has already been fully issued.");
  }
  if (args.issuedQuantity > remainingRequested) {
    throw new Error("Issued quantity cannot exceed the remaining requested quantity.");
  }

  const material = await ctx.db.get(request.materialId);
  if (!material || !material.active) throw new Error("Active material not found.");
  const job = await ctx.db.get(request.jobCardId);
  const machine = job ? await ctx.db.get(job.machineId) : undefined;
  if (!job || !machine) throw new Error("The request's job machine is unavailable.");
  const operatorId = args.operatorId?.trim() || request.requestedBy;
  if (operatorId !== request.requestedBy) throw new Error("Material can only be issued to the requesting operator.");

  const requesterProfile = await ctx.db
    .query("profiles")
    .withIndex("by_auth_user_id", (q: any) => q.eq("authUserId", request.requestedBy))
    .unique();
    if (requesterProfile && OPERATOR_ROLES.includes(requesterProfile.role) && requesterProfile.role !== machine.operatorRole) {
    throw new Error(`Requesting operator role (${requesterProfile.role}) does not match the machine operator role (${machine.operatorRole}).`);
  }

  const packageQuantity = args.issuedPackages ?? request.requestedPackages;
  if (packageQuantity === undefined || !Number.isFinite(packageQuantity) || packageQuantity <= 0) {
    throw new Error("Issued package quantity is required for central-store transfer.");
  }
  const requestedPackageUnit = args.packageUnit ?? request.packageUnit;
  const parentInventory = await ctx.db
    .query("parentInventory")
    .withIndex("by_material", (q: any) => q.eq("materialId", request.materialId))
    .unique();
  if (!parentInventory) throw new Error("Central package inventory is not configured for this material.");
  if (packageQuantity > parentInventory.totalStockQuantity) {
    throw new Error("Insufficient central package stock for this request.");
  }
  const packageFactor = parentInventory.unitType === "ROLL"
    ? parentInventory.lengthPerRoll
    : parentInventory.unitType === "SHEET"
      ? parentInventory.areaPerSheet
      : parentInventory.volumePerContainer ?? 1;
  if (!packageFactor || packageFactor <= 0) throw new Error("Central package conversion factor is not configured.");
  // Prefer the conversion ratio captured when the request was created so partial
  // issues and the ledger stay consistent with what the operator was quoted;
  // fall back to the current package factor only for legacy requests without a
  // snapshot. Otherwise a ratio change between request and issue would drift the
  // package-to-base derivation.
  const conversionRatio = request.conversionRatioSnapshot && request.conversionRatioSnapshot > 0
    ? request.conversionRatioSnapshot
    : packageFactor;
  const expectedBaseQuantity = Number((packageQuantity * conversionRatio).toFixed(3));
  if (Math.abs(expectedBaseQuantity - args.issuedQuantity) > 0.001) {
    throw new Error(`Issued quantity must equal ${expectedBaseQuantity} ${request.unit} for ${packageQuantity} package(s).`);
  }
  const ledgerPackageUnit = requestedPackageUnit === "ROLL"
    ? "ROLL"
    : requestedPackageUnit === "SHEET"
      ? "SHEET"
      : requestedPackageUnit === "CANISTER"
        ? "LITER"
        : undefined;
  const subStockId = await ctx.db.insert("operatorSubStock", {
    parentInventoryId: parentInventory._id,
    materialId: request.materialId,
    operatorId,
    machineId: job.machineId,
    issuedUnits: packageQuantity,
    issuedQuantity: args.issuedQuantity,
    currentRemaining: args.issuedQuantity,
    status: "ACTIVE",
    issuedBy: identity._id,
    issuedAt: Date.now(),
    updatedAt: Date.now(),
    packageUnit: requestedPackageUnit,
    issuedPackages: packageQuantity,
    remainingPackages: packageQuantity,
    baseUnit: material.baseUnit ?? material.unit,
    conversionRatioSnapshot: conversionRatio,
    consumedBaseQuantity: 0,
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
    parentInventoryId: parentInventory._id,
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
    issuedPackages: Number(((request.issuedPackages ?? 0) + packageQuantity).toFixed(3)),
    packageUnit: requestedPackageUnit,
    parentInventoryId: parentInventory._id,
    operatorSubStockId: subStockId,
    machineId: machine._id,
    status: nextStatus,
    issuedBy: identity._id,
    issuedAt: Date.now(),
    note: args.note?.trim() || request.note,
  });
  if (request.requestGroupId) {
    const lines = await ctx.db.query("materialRequestLines")
      .withIndex("by_request_group", (q: any) => q.eq("requestGroupId", request.requestGroupId!))
      .collect();
    const matchingLine = lines.find((line: any) => line.materialId === request.materialId);
    if (matchingLine) {
      await ctx.db.patch(matchingLine._id, {
        issuedPackages: (matchingLine.issuedPackages ?? 0) + packageQuantity,
        issuedBaseQuantity: (matchingLine.issuedBaseQuantity ?? 0) + args.issuedQuantity,
        status: totalIssued < request.requestedQuantity ? "Partially Issued" : "Issued",
        issuedBy: identity._id,
        issuedAt: Date.now(),
      });
    }
  }
  const requirements = await ctx.db
    .query("jobMaterialRequirements")
    .withIndex("by_job_card", (q: any) => q.eq("jobCardId", request.jobCardId))
    .collect();
  const requirement = requirements.find((entry: any) => entry.materialId === request.materialId);
  if (requirement) {
    const requiredTotal = requirement.plannedBaseQuantity + requirement.approvedScrapQuantity;
    await ctx.db.patch(requirement._id, {
      requestedPackages: Number(((requirement.requestedPackages ?? 0) + packageQuantity).toFixed(3)),
      issuedPackages: Number(((requirement.issuedPackages ?? 0) + packageQuantity).toFixed(3)),
      status: totalIssued >= requiredTotal ? "ISSUED" : "PARTIALLY_ISSUED",
      updatedAt: Date.now(),
    });
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
}

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
    return await issueMaterialRequestInternal(ctx, args, identity);
  },
});

export async function acknowledgeMaterialRequestInternal(
  ctx: any,
  args: { requestId: Id<"materialRequests"> },
  identity: { _id: string; [key: string]: any },
  role: any
) {
  const request = await ctx.db.get(args.requestId);
  if (!request) throw new Error("Material request not found.");
  if (request.status !== "Issued" && request.status !== "Partially Issued") {
    throw new Error("Only an issued request can be marked received.");
  }
  const job = await ctx.db.get(request.jobCardId);
  const machine = job ? await ctx.db.get(job.machineId) : undefined;
  const material = await ctx.db.get(request.materialId);
  if (!canAccessMaterialRequest(role, identity._id, request, machine ?? undefined)) {
    throw new Error("You cannot acknowledge this material request.");
  }
  if (request.requestGroupId) {
    const lines = await ctx.db
      .query("materialRequestLines")
      .withIndex("by_request_group", (q: any) => q.eq("requestGroupId", request.requestGroupId!))
      .collect();
    const hasPartiallyIssuedLine = lines.some((line: any) => line.status === "Partially Issued");
    if (hasPartiallyIssuedLine && request.issuedQuantity < request.requestedQuantity) {
      throw new Error("Cannot acknowledge receipt while request lines are still partially issued.");
    }
    const matchingLine = lines.find((line: any) => line.materialId === request.materialId);
    if (matchingLine) {
      await ctx.db.patch(matchingLine._id, {
        status: "Received",
      });
    }
  } else if (request.status === "Partially Issued" && request.issuedQuantity < request.requestedQuantity) {
    throw new Error("Cannot acknowledge receipt while request is still partially issued.");
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
}

export const acknowledge = mutation({
  args: { requestId: v.id("materialRequests") },
  handler: async (ctx, args) => {
    const { identity, profile } = await requirePermission(ctx, "request.acknowledge");
    return await acknowledgeMaterialRequestInternal(ctx, args, identity, profile.role);
  },
});
