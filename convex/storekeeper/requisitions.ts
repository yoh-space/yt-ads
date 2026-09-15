import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { packageUnit } from "../schema";
import { requireStorekeeper } from "../users";
import { canAccessMaterialRequest } from "../authorization";
import { acknowledgeMaterialRequestInternal, issueMaterialRequestInternal } from "../materialRequests";

function packageFactor(inventory: any): number {
  if (!inventory) return 1;
  if (inventory.unitType === "ROLL") return inventory.lengthPerRoll ?? 1;
  if (inventory.unitType === "SHEET") return inventory.areaPerSheet ?? 1;
  return inventory.volumePerContainer ?? 1;
}

function packageUnitForInventory(inventory: any): "ROLL" | "SHEET" | "CANISTER" | undefined {
  if (!inventory) return undefined;
  return inventory.unitType === "ROLL" ? "ROLL" : inventory.unitType === "SHEET" ? "SHEET" : "CANISTER";
}

/**
 * Storekeeper-only requisition surface for the /dashboard/storekeeper
 * workspace namespace. Every function is guarded by the strict storekeeper role
 * guard; accounting changes reuse the shared, transactionally-audited internal
 * helpers from `materialRequests.ts`.
 */

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { identity } = await requireStorekeeper(ctx);
    const [requests, jobs, materials, machines, users, parentInventory] = await Promise.all([
      ctx.db.query("materialRequests").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("materials").collect(),
      ctx.db.query("machines").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("parentInventory").collect(),
    ]);

    const jobMap = new Map(jobs.map((job) => [job._id, job]));
    const materialMap = new Map(materials.map((material) => [material._id, material]));
    const machineMap = new Map(machines.map((machine) => [machine._id, machine]));
    const userMap = new Map(users.map((user) => [user.authUserId, user.name]));
    const parentInventoryMap = new Map(parentInventory.map((item) => [item.materialId, item]));

    const visibleRequests = requests.filter((request) => {
      const job = jobMap.get(request.jobCardId);
      const machine = job ? machineMap.get(job.machineId) : undefined;
      return canAccessMaterialRequest("storekeeper", identity._id, request, machine);
    });

    return visibleRequests
      .map((request) => {
        const job = jobMap.get(request.jobCardId);
        const material = materialMap.get(request.materialId);
        const machine = job ? machineMap.get(job.machineId) : undefined;
        const centralInventory = parentInventoryMap.get(request.materialId);
        return {
          ...request,
          conversionRatioSnapshot: request.conversionRatioSnapshot ?? packageFactor(centralInventory),
          packageUnit: request.packageUnit ?? packageUnitForInventory(centralInventory),
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
    const { identity } = await requireStorekeeper(ctx);
    return await issueMaterialRequestInternal(ctx, args, identity);
  },
});

export const acknowledge = mutation({
  args: { requestId: v.id("materialRequests") },
  handler: async (ctx, args) => {
    const { identity, profile } = await requireStorekeeper(ctx);
    return await acknowledgeMaterialRequestInternal(ctx, args, identity, profile.role);
  },
});

export const markShortStock = mutation({
  args: { requestId: v.id("materialRequests"), note: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { identity } = await requireStorekeeper(ctx);
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
      const lines = await ctx.db
        .query("materialRequestLines")
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
