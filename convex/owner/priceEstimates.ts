import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireActiveProfile } from "../users";
import { logConfigChange } from "./configAudit";

const MANAGEMENT_ROLES = ["owner", "manager", "admin"];

export const listPriceEstimates = query({
  args: { materialId: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("materialPriceEstimates"),
      materialId: v.string(),
      amount: v.number(),
      currency: v.string(),
      purchaseUnit: v.string(),
      baseUnitEquivalent: v.optional(v.number()),
      effectiveAt: v.number(),
      source: v.optional(v.string()),
      notes: v.optional(v.string()),
      active: v.boolean(),
      createdAt: v.number(),
      createdBy: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireActiveProfile(ctx);
    const estimates = await ctx.db
      .query("materialPriceEstimates")
      .withIndex("by_material_effective", (q) => q.eq("materialId", args.materialId))
      .order("desc")
      .collect();
    return estimates;
  },
});

export const getActivePriceEstimate = query({
  args: { materialId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("materialPriceEstimates"),
      materialId: v.string(),
      amount: v.number(),
      currency: v.string(),
      purchaseUnit: v.string(),
      baseUnitEquivalent: v.optional(v.number()),
      effectiveAt: v.number(),
      source: v.optional(v.string()),
      notes: v.optional(v.string()),
      active: v.boolean(),
      createdAt: v.number(),
      createdBy: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireActiveProfile(ctx);
    const activeEstimate = await ctx.db
      .query("materialPriceEstimates")
      .withIndex("by_material_active", (q) => q.eq("materialId", args.materialId).eq("active", true))
      .first();
    return activeEstimate ?? null;
  },
});

export const upsertPriceEstimate = mutation({
  args: {
    materialId: v.string(),
    amount: v.number(),
    currency: v.string(),
    purchaseUnit: v.string(),
    baseUnitEquivalent: v.optional(v.number()),
    effectiveAt: v.optional(v.number()),
    source: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("materialPriceEstimates"),
  handler: async (ctx, args) => {
    const { identity, profile } = await requireActiveProfile(ctx);
    if (!MANAGEMENT_ROLES.includes(profile.role)) {
      throw new Error("Unauthorized: Owner or Manager role required to manage price estimates.");
    }

    if (args.amount < 0 || !Number.isFinite(args.amount)) {
      throw new Error("Price estimate amount must be a non-negative finite number.");
    }

    const currency = args.currency.trim().toUpperCase() || "ETB";
    const purchaseUnit = args.purchaseUnit.trim().toLowerCase();
    const effectiveAt = args.effectiveAt ?? Date.now();

    // Look up authoritative materialCatalog definition to derive base-unit price
    const catalogItem = await ctx.db
      .query("materialCatalog")
      .withIndex("by_material_id", (q) => q.eq("id", args.materialId))
      .unique();

    if (!catalogItem) {
      throw new Error(`Material catalog definition for "${args.materialId}" was not found.`);
    }

    if (!catalogItem.conversionRatio || catalogItem.conversionRatio <= 0) {
      throw new Error(
        `Material "${catalogItem.name}" has an invalid conversion ratio (${catalogItem.conversionRatio}). Conversion ratio must be positive to derive base unit pricing.`,
      );
    }

    const baseUnitEquivalent = Number((args.amount / catalogItem.conversionRatio).toFixed(4));

    // Deactivate existing active estimate for this material + currency
    const existingActive = await ctx.db
      .query("materialPriceEstimates")
      .withIndex("by_material_active", (q) => q.eq("materialId", args.materialId).eq("active", true))
      .collect();

    for (const est of existingActive) {
      if (est.currency === currency) {
        await ctx.db.patch(est._id, { active: false });
      }
    }

    const newId = await ctx.db.insert("materialPriceEstimates", {
      materialId: args.materialId,
      amount: args.amount,
      currency,
      purchaseUnit,
      baseUnitEquivalent,
      effectiveAt,
      source: args.source?.trim(),
      notes: args.notes?.trim(),
      active: true,
      createdAt: Date.now(),
      createdBy: profile.name || identity._id,
    });

    // Project baseUnitEquivalent onto operational materials table as compatibility valuation
    const matchingMaterials = await ctx.db
      .query("materials")
      .withIndex("by_name", (q) => q.eq("name", catalogItem.name))
      .collect();
    for (const mat of matchingMaterials) {
      await ctx.db.patch(mat._id, { etbValue: baseUnitEquivalent });
    }

    await logConfigChange(ctx, {
      entityType: "material_price_estimate",
      entityId: args.materialId,
      action: "create",
      fieldChanges: {
        amount: { from: null, to: args.amount },
        currency: { from: null, to: currency },
        purchaseUnit: { from: null, to: purchaseUnit },
        baseUnitEquivalent: { from: null, to: baseUnitEquivalent },
        effectiveAt: { from: null, to: effectiveAt },
      },
      changedBy: profile.name || identity._id,
    });

    return newId;
  },
});

export const deactivatePriceEstimate = mutation({
  args: { estimateId: v.id("materialPriceEstimates") },
  handler: async (ctx, args) => {
    const { identity, profile } = await requireActiveProfile(ctx);
    if (!MANAGEMENT_ROLES.includes(profile.role)) {
      throw new Error("Unauthorized: Owner or Manager role required to manage price estimates.");
    }

    const estimate = await ctx.db.get(args.estimateId);
    if (!estimate) throw new Error("Price estimate not found.");
    if (!estimate.active) return;

    await ctx.db.patch(args.estimateId, { active: false });

    await logConfigChange(ctx, {
      entityType: "material_price_estimate",
      entityId: estimate.materialId,
      action: "deactivate",
      fieldChanges: {
        active: { from: true, to: false },
      },
      changedBy: profile.name || identity._id,
    });
  },
});
