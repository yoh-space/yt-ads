import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireActiveProfile, requirePermission, requireRoles } from "./users";
import { canViewFinancial } from "./authorization";
import { resolveEtbValueFromConfig } from "./materialUsage";
import { ensureSystemConfig } from "./systemConfigs";
import { recordInventoryEvent } from "./inventoryLedger";
import { inventoryUnitType, reconciliationStatus } from "./schema";

/**
 * Physical Stock Reconciliation engine.
 *
 * Record a physical count for a material and immediately compute the variance
 * against the system (expected) quantity. A negative variance is a shortage —
 * its monetary value (ETB) is surfaced to highlight potential stock leakage or
 * theft. Positive variances are surpluses and reported separately.
 */
export const countMaterial = mutation({
  args: {
    materialId: v.id("materials"),
    countedQuantity: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "reconciliation.record");
    if (!Number.isFinite(args.countedQuantity) || args.countedQuantity < 0) {
      throw new Error("Physical counted quantity must be zero or greater.");
    }
    const material = await ctx.db.get(args.materialId);
    if (!material || !material.active) throw new Error("Active material not found.");

    const systemQuantity = Number((material.quantity ?? 0).toFixed(3));
    const countedQuantity = Number(args.countedQuantity.toFixed(3));
    const variance = Number((countedQuantity - systemQuantity).toFixed(3));
    const config = await ensureSystemConfig(ctx, identity._id);
    const etbValue = resolveEtbValueFromConfig(material, config);
    const monetaryLoss = variance < 0 ? Number((-variance * etbValue).toFixed(2)) : 0;

    const autoStatus = variance === 0 ? "Resolved" : "Reviewed";

    const id = await ctx.db.insert("reconciliations", {
      materialId: material._id,
      status: autoStatus,
      systemQuantity,
      countedQuantity,
      variance,
      etbValue,
      monetaryLoss,
      countedBy: identity._id,
      note: args.note?.trim() || undefined,
      createdAt: Date.now(),
    });

    if (variance !== 0) {
      await recordInventoryEvent(ctx, {
        materialId: material._id,
        eventType: "RECONCILIATION_ADJUSTMENT",
        custody: "parent",
        balanceEffect: variance > 0 ? "in" : "out",
        quantity: Math.abs(variance),
        unit: material.baseUnit ?? material.unit,
        baseUnit: material.baseUnit ?? material.unit,
        baseQuantity: Math.abs(variance),
        materialReconciliationId: id,
        note: `Central stock reconciliation · ${material.name}`,
        createdBy: identity._id,
      });
    }
    return (await ctx.db.get(id))!;
  },
});

/** Record a physical count in parent-store packaging units. */
export const countParentInventory = mutation({
 args: {
   parentInventoryId: v.id("parentInventory"),
   countedPackages: v.number(),
   note: v.optional(v.string()),
 },
 returns: v.id("reconciliations"),
 handler: async (ctx, args) => {
   const { identity } = await requirePermission(ctx, "reconciliation.record");
   if (!Number.isFinite(args.countedPackages) || args.countedPackages < 0) {
     throw new Error("Physical package count must be zero or greater.");
   }
   const parentItem = await ctx.db.get(args.parentInventoryId);
   if (!parentItem) throw new Error("Parent inventory item not found.");
   const material = await ctx.db.get(parentItem.materialId);
   if (!material || !material.active) throw new Error("Active material not found.");
   const conversion =
     parentItem.unitType === "ROLL"
       ? parentItem.lengthPerRoll
       : parentItem.unitType === "SHEET"
         ? parentItem.areaPerSheet
         : parentItem.volumePerContainer;
   if (!conversion || conversion <= 0) throw new Error("Parent inventory conversion is not configured.");
   const systemQuantity = Number((material.quantity ?? 0).toFixed(3));
   const countedQuantity = Number((args.countedPackages * conversion).toFixed(3));
   const variance = Number((countedQuantity - systemQuantity).toFixed(3));
   const config = await ensureSystemConfig(ctx, identity._id);
   const etbValue = resolveEtbValueFromConfig(material, config);
   const monetaryLoss = variance < 0 ? Number((-variance * etbValue).toFixed(2)) : 0;
    const autoStatus = variance === 0 ? "Resolved" : "Reviewed";
    const id = await ctx.db.insert("reconciliations", {
      materialId: material._id,
      status: autoStatus,
      systemQuantity,
      countedQuantity,
      variance,
      etbValue,
      monetaryLoss,
      countedBy: identity._id,
      note: args.note?.trim() || undefined,
      createdAt: Date.now(),
    });
   if (variance !== 0) {
     await recordInventoryEvent(ctx, {
       materialId: material._id,
       eventType: "RECONCILIATION_ADJUSTMENT",
       custody: "parent",
       balanceEffect: variance > 0 ? "in" : "out",
       quantity: Math.abs(variance),
       unit: material.baseUnit ?? material.unit,
       baseUnit: material.baseUnit ?? material.unit,
       baseQuantity: Math.abs(variance),
       materialReconciliationId: id,
       note: `Parent packaging reconciliation · ${material.name}`,
       createdBy: identity._id,
     });
   }
   return id;
 },
});

export const review = mutation({
  args: {
    reconciliationId: v.id("reconciliations"),
    status: v.union(v.literal("Reviewed"), v.literal("Accepted"), v.literal("Resolved")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireRoles(ctx, ["owner", "admin"]);
    const record = await ctx.db.get(args.reconciliationId);
    if (!record) throw new Error("Reconciliation record not found.");

    const currentStatus = record.status ?? "Open";
    if (currentStatus === "Resolved" || currentStatus === "Accepted") {
      throw new Error(`Cannot change a record with status "${currentStatus}".`);
    }
    const isShortage = (record.variance ?? 0) < 0;
    if (args.status === "Resolved" && isShortage && !args.note?.trim()) {
      throw new Error("A note is required when resolving a shortage reconciliation.");
    }

    await ctx.db.patch(args.reconciliationId, {
      status: args.status,
      reviewedBy: identity._id,
      reviewedAt: Date.now(),
      note: args.note?.trim() || record.note,
    });
    return (await ctx.db.get(args.reconciliationId))!;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireActiveProfile(ctx);
    const canSeeFinancial = canViewFinancial(profile.role);
    const [records, materials, users] = await Promise.all([
      ctx.db.query("reconciliations").withIndex("by_created").collect(),
      ctx.db.query("materials").collect(),
      ctx.db.query("users").collect(),
    ]);
    const materialMap = new Map(materials.map((m) => [m._id, m]));
    const userName = new Map(users.map((u) => [u.authUserId, u.name]));
    const docs = records
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 200)
      .map((record) => {
        const material = materialMap.get(record.materialId);
        const { _id, ...rest } = record;
        return {
          ...rest,
          id: _id,
          etbValue: canSeeFinancial ? rest.etbValue : undefined as number | undefined,
          monetaryLoss: canSeeFinancial ? rest.monetaryLoss : undefined as number | undefined,
          materialName: material?.name ?? "Unknown material",
          materialUnit: material?.baseUnit ?? material?.unit ?? "m²",
          countedByName: userName.get(record.countedBy) ?? record.countedBy,
          reviewedByName: record.reviewedBy ? userName.get(record.reviewedBy) ?? record.reviewedBy : undefined,
        };
      });
    return docs;
  },
});

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireActiveProfile(ctx);
    const canSeeFinancial = canViewFinancial(profile.role);
    const [records, materials] = await Promise.all([
      ctx.db.query("reconciliations").withIndex("by_created").collect(),
      ctx.db.query("materials").collect(),
    ]);
    const materialMap = new Map(materials.map((m) => [m._id, m]));
    const openCounts = records.filter((r) => r.status === "Open");
    const shortages = records.filter((r) => r.variance < 0);
    const surpluses = records.filter((r) => r.variance > 0);
    const totalMonetaryLoss = shortages.reduce((sum, r) => sum + (r.monetaryLoss ?? 0), 0);
    const latestByMaterial = new Map<string, typeof records[number]>();
    for (const r of [...records].sort((a, b) => b.createdAt - a.createdAt)) {
      if (!latestByMaterial.has(r.materialId)) latestByMaterial.set(r.materialId, r);
    }
    const currentVariances = Array.from(latestByMaterial.values())
      .map((record) => {
        const material = materialMap.get(record.materialId);
        return {
          materialId: record.materialId,
          materialName: material?.name ?? "Unknown material",
          unit: material?.baseUnit ?? material?.unit ?? "m²",
          variance: record.variance,
          monetaryLoss: canSeeFinancial ? record.monetaryLoss ?? 0 : 0,
          countDate: record.createdAt,
        };
      })
      .sort((a, b) => b.monetaryLoss - a.monetaryLoss);
    return {
      openCounts: openCounts.length,
      shortageCounts: shortages.length,
      surplusCounts: surpluses.length,
      totalMonetaryLoss: canSeeFinancial ? Number(totalMonetaryLoss.toFixed(2)) : 0,
      countRecords: records.length,
      currentVariances,
    };
  },
});

/** Storekeeper-only physical parent-store reconciliation surface. */
export const storekeeperOverview = query({
  args: {},
  returns: v.object({
    items: v.array(v.object({
      id: v.id("parentInventory"),
      materialId: v.id("materials"),
      materialName: v.string(),
      category: v.string(),
      unitType: inventoryUnitType,
      stockQuantity: v.number(),
      minThreshold: v.number(),
      storageLocation: v.string(),
      lastCountedAt: v.optional(v.number()),
      lastVariance: v.optional(v.number()),
      lastStatus: v.optional(reconciliationStatus),
    })),
    recentCounts: v.array(v.object({
      id: v.id("reconciliations"),
      materialId: v.id("materials"),
      materialName: v.string(),
      unit: v.string(),
      systemQuantity: v.number(),
      countedQuantity: v.number(),
      variance: v.number(),
      status: reconciliationStatus,
      note: v.optional(v.string()),
      createdAt: v.number(),
    })),
    openCount: v.number(),
    shortageCount: v.number(),
    surplusCount: v.number(),
  }),
  handler: async (ctx) => {
    await requirePermission(ctx, "reconciliation.record");
    const [parentInventory, materials, records] = await Promise.all([
      ctx.db.query("parentInventory").withIndex("by_unit_type").take(500),
      ctx.db.query("materials").withIndex("by_unit").take(500),
      ctx.db.query("reconciliations").withIndex("by_created").order("desc").take(200),
    ]);
    const materialMap = new Map(materials.map((material) => [material._id, material]));
    const latestByMaterial = new Map<string, typeof records[number]>();
    for (const record of records) {
      if (!latestByMaterial.has(record.materialId)) latestByMaterial.set(record.materialId, record);
    }
    const items = parentInventory.flatMap((item) => {
      const material = materialMap.get(item.materialId);
      if (!material || !material.active) return [];
      const latest = latestByMaterial.get(item.materialId);
      return [{
        id: item._id,
        materialId: item.materialId,
        materialName: material.name,
        category: material.category,
        unitType: item.unitType,
        stockQuantity: item.totalStockQuantity,
        minThreshold: material.reorderAt,
        storageLocation: material.storageLocation ?? "Unassigned",
        lastCountedAt: latest?.createdAt,
        lastVariance: latest?.variance,
        lastStatus: latest?.status,
      }];
    });
    const recentCounts = records.map((record) => {
      const material = materialMap.get(record.materialId);
      return {
        id: record._id,
        materialId: record.materialId,
        materialName: material?.name ?? "Unknown material",
        unit: material?.baseUnit ?? material?.unit ?? "unit",
        systemQuantity: record.systemQuantity,
        countedQuantity: record.countedQuantity,
        variance: record.variance,
        status: record.status,
        note: record.note,
        createdAt: record.createdAt,
      };
    });
    return {
      items,
      recentCounts,
      openCount: records.filter((record) => record.status === "Open").length,
      shortageCount: records.filter((record) => record.variance < 0).length,
      surplusCount: records.filter((record) => record.variance > 0).length,
    };
  },
});

/**
 * Check whether a material has any unresolved shortage reconciliation.
 * Returns the blocking record if one exists, or null if the material is clear.
 *
 * A material is blocked when:
 *  - It has a reconciliation with variance < 0 (shortage)
 *  - That reconciliation has status "Reviewed" (not yet resolved)
 *
 * Materials with status "Resolved" are cleared and unblock operations.
 * Materials with variance >= 0 (no shortage) are never blocked.
 */
export async function requireNoUnresolvedShortage(
  ctx: QueryCtx | MutationCtx,
  materialId: Id<"materials">,
) {
  const records = await ctx.db
    .query("reconciliations")
    .withIndex("by_material", (q) => q.eq("materialId", materialId))
    .collect();

  const blocking = records.find(
    (r) => r.variance < 0 && r.status !== "Resolved",
  );

  if (blocking) {
    const statusLabel = blocking.status ?? "Open";
    throw new Error(
      `Material "${materialId}" has an unresolved shortage reconciliation (${statusLabel}). ` +
        `Resolve or accept the shortage before performing inventory movements.`,
    );
  }
}
