import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireActiveProfile, requirePermission } from "./users";
import { resolveEtbValue } from "./materialUsage";

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
    const etbValue = resolveEtbValue(material);
    const monetaryLoss = variance < 0 ? Number((-variance * etbValue).toFixed(2)) : 0;

    const id = await ctx.db.insert("reconciliations", {
      materialId: material._id,
      status: "Open",
      systemQuantity,
      countedQuantity,
      variance,
      etbValue,
      monetaryLoss,
      countedBy: identity._id,
      note: args.note?.trim() || undefined,
      createdAt: Date.now(),
    });
    return (await ctx.db.get(id))!;
  },
});

export const review = mutation({
  args: {
    reconciliationId: v.id("reconciliations"),
    status: v.union(v.literal("Reviewed"), v.literal("Resolved")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "reconciliation.review");
    const record = await ctx.db.get(args.reconciliationId);
    if (!record) throw new Error("Reconciliation record not found.");
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
    await requireActiveProfile(ctx);
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
    await requireActiveProfile(ctx);
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
          monetaryLoss: record.monetaryLoss ?? 0,
          countDate: record.createdAt,
        };
      })
      .sort((a, b) => b.monetaryLoss - a.monetaryLoss);
    return {
      openCounts: openCounts.length,
      shortageCounts: shortages.length,
      surplusCounts: surpluses.length,
      totalMonetaryLoss: Number(totalMonetaryLoss.toFixed(2)),
      countRecords: records.length,
      currentVariances,
    };
  },
});
