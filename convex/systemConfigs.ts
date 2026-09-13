import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { requireOwner, requirePermission } from "./users";
import { DEFAULT_SYSTEM_CONFIG, type SystemConfig } from "./materialUsage";
import { unitConversionRule } from "./schema";

/**
 * Single-row key for the workspace's central configuration. Mirrors the
 * `companySettings` pattern so a single deterministic lookup can resolve the
 * active configuration without a full-table scan.
 */
export const CONFIG_KEY = "default";

export function validateNumber(value: number, label: string, options: { min?: number; max?: number } = {}) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  if (options.min !== undefined && value < options.min) {
    throw new Error(`${label} must be at least ${options.min}.`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new Error(`${label} must be at most ${options.max}.`);
  }
}

/**
 * Resolves the active system configuration. Lazily creates a default row on
 * first read so the rest of the app can assume the configuration always
 * exists. Returned shape mirrors the stored document (minus internal fields).
 */
export const getSystemConfig = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const row = await ctx.db
      .query("systemConfigs")
      .withIndex("by_key", (q) => q.eq("key", CONFIG_KEY))
      .unique();
    if (!row) return null;
    const { _id, _creationTime, key, updatedBy, ...rest } = row;
    return { ...rest, updatedBy: updatedBy ?? null };
  },
});

/** Safe operational freshness read for inventory workspaces; excludes all financial settings. */
export const getStorekeeperConfig = query({
  args: {},
  returns: v.object({ updatedAt: v.union(v.number(), v.null()) }),
  handler: async (ctx) => {
    await requirePermission(ctx, "material.view");
    const row = await ctx.db
      .query("systemConfigs")
      .withIndex("by_key", (q) => q.eq("key", CONFIG_KEY))
      .unique();
    return { updatedAt: row?.updatedAt ?? null };
  },
});

export const getConfigurationHistory = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    return ctx.db
      .query("configurationChanges")
      .withIndex("by_config_created", (q) => q.eq("configKey", CONFIG_KEY))
      .order("desc")
      .take(20);
  },
});

/**
 * Owner/admin-only mutation: write the operational & financial configuration. All
 * numeric inputs are validated (finite, in-range) and overrides are deduped by
 * material name (last write wins). Returns the persisted document.
 */
export const updateSystemConfig = mutation({
  args: {
    etbPerSquareMetre: v.number(),
    etbPerLitre: v.number(),
    etbPerPiece: v.number(),
    etbPerMetre: v.number(),
    etbPerSheet: v.number(),
    unitConversionDefaults: v.array(unitConversionRule),
    materialOverrides: v.array(v.object({
      materialName: v.string(),
      etbValue: v.number(),
    })),
    inkMlPerSquareMetre: v.number(),
    maxAllowedWastePercent: v.number(),
    minOffcutAreaSquareMetre: v.number(),
    requireAdminPinForExceptions: v.boolean(),
    maxDirectStockOutEtb: v.number(),
    orderExpirationHours: v.number(),
    defaultScrapAllowancePercent: v.number(),
    defaultMarginSquareMetres: v.number(),
    standardWasteMargin: v.number(),
    maxAllowedScrapLimit: v.number(),
    defaultReorderLevel: v.optional(v.number()),
    reorderAlertsEnabled: v.optional(v.boolean()),
    reorderAlertCooldownHours: v.optional(v.number()),
    materialScrapAllowances: v.array(v.object({
      materialId: v.id("materials"),
      allowancePercent: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const { identity, profile } = await requireOwner(ctx);
    validateNumber(args.etbPerSquareMetre, "Price per m²", { min: 0 });
    validateNumber(args.etbPerLitre, "Price per litre", { min: 0 });
    validateNumber(args.etbPerPiece, "Price per piece", { min: 0 });
    validateNumber(args.etbPerMetre, "Price per metre", { min: 0 });
    validateNumber(args.etbPerSheet, "Price per sheet", { min: 0 });
    validateNumber(args.inkMlPerSquareMetre, "Ink consumption rate", { min: 0 });
    validateNumber(args.maxAllowedWastePercent, "Maximum allowed waste rate", { min: 0, max: 100 });
    validateNumber(args.minOffcutAreaSquareMetre, "Minimum offcut registration size", { min: 0 });
    validateNumber(args.maxDirectStockOutEtb, "Maximum ETB for direct stock-outs", { min: 0 });
    validateNumber(args.orderExpirationHours, "Order expiration hours", { min: 1, max: 168 });
    validateNumber(args.defaultScrapAllowancePercent, "Default scrap allowance", { min: 0, max: 100 });
    validateNumber(args.defaultMarginSquareMetres, "Default margin allowance", { min: 0 });
    validateNumber(args.standardWasteMargin, "Standard job-card waste margin", { min: 0, max: 100 });
    validateNumber(args.maxAllowedScrapLimit, "Maximum allowed scrap limit", { min: 0, max: 100 });
    validateNumber(args.defaultReorderLevel ?? 0, "Default reorder level", { min: 0 });
    validateNumber(args.reorderAlertCooldownHours ?? 24, "Reorder alert cooldown", { min: 0, max: 168 });

    const seenScrap = new Set<string>();
    const scrapAllowances = args.materialScrapAllowances
      .map((entry) => ({
        materialId: entry.materialId,
        allowancePercent: Number(entry.allowancePercent),
      }))
      .filter((entry) => {
        validateNumber(entry.allowancePercent, `Scrap allowance for material ${entry.materialId}`, { min: 0, max: 100 });
        if (seenScrap.has(entry.materialId)) return false;
        seenScrap.add(entry.materialId);
        return true;
      });

    const conversionRules = args.unitConversionDefaults.map((rule) => ({
      materialName: rule.materialName.trim(),
      purchaseUnit: rule.purchaseUnit,
      baseUnit: rule.baseUnit,
      inputDimension: rule.inputDimension,
      conversionRatio: Number(rule.conversionRatio),
    }));
    for (const rule of conversionRules) {
      if (!rule.materialName) throw new Error("Conversion rule material name is required.");
      validateNumber(rule.conversionRatio, `Conversion ratio for ${rule.materialName}`, { min: 0.000001 });
      if (rule.inputDimension !== undefined) {
        validateNumber(rule.inputDimension, `Input dimension for ${rule.materialName}`, { min: 0.000001 });
      }
    }

    const seen = new Set<string>();
    const overrides = args.materialOverrides
      .map((entry) => ({
        materialName: entry.materialName.trim(),
        etbValue: Number(entry.etbValue),
      }))
      .filter((entry) => {
        if (!entry.materialName) return false;
        validateNumber(entry.etbValue, `Override price for ${entry.materialName}`, { min: 0 });
        const key = entry.materialName.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    const existing = await ctx.db
      .query("systemConfigs")
      .withIndex("by_key", (q) => q.eq("key", CONFIG_KEY))
      .unique();

    const payload = {
      key: CONFIG_KEY,
      etbPerSquareMetre: args.etbPerSquareMetre,
      etbPerLitre: args.etbPerLitre,
      etbPerPiece: args.etbPerPiece,
      etbPerMetre: args.etbPerMetre,
      etbPerSheet: args.etbPerSheet,
      unitConversionDefaults: conversionRules,
      materialOverrides: overrides,
      inkMlPerSquareMetre: args.inkMlPerSquareMetre,
      maxAllowedWastePercent: args.maxAllowedWastePercent,
      minOffcutAreaSquareMetre: args.minOffcutAreaSquareMetre,
      requireAdminPinForExceptions: args.requireAdminPinForExceptions,
      maxDirectStockOutEtb: args.maxDirectStockOutEtb,
      orderExpirationHours: args.orderExpirationHours,
      defaultScrapAllowancePercent: args.defaultScrapAllowancePercent,
      defaultMarginSquareMetres: args.defaultMarginSquareMetres,
      standardWasteMargin: args.standardWasteMargin,
      maxAllowedScrapLimit: args.maxAllowedScrapLimit,
      defaultReorderLevel: args.defaultReorderLevel ?? 0,
      reorderAlertsEnabled: args.reorderAlertsEnabled ?? true,
      reorderAlertCooldownHours: args.reorderAlertCooldownHours ?? 24,
      materialScrapAllowances: scrapAllowances,
      updatedAt: Date.now(),
      updatedBy: profile._id,
    };

    const changedFields = Object.keys(payload).filter((field) => field !== "updatedAt" && field !== "updatedBy" && field !== "key");
    await ctx.db.insert("configurationChanges", {
      configKey: CONFIG_KEY,
      changedFields,
      actorAuthUserId: identity._id,
      createdAt: Date.now(),
    });

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return (await ctx.db.get(existing._id))!;
    }
    const id = await ctx.db.insert("systemConfigs", payload);
    return (await ctx.db.get(id))!;
  },
});

/**
 * Reads the active configuration and seeds a default row when the workspace
 * has never been configured. Used by background handlers that need a guaranteed
 * configuration value. Returns the resolved document.
 */
export async function ensureSystemConfig(ctx: MutationCtx, actorAuthUserId?: string): Promise<SystemConfig> {
  let existing = await ctx.db
    .query("systemConfigs")
    .withIndex("by_key", (q) => q.eq("key", CONFIG_KEY))
    .unique();
  if (existing) {
    // Backfill any newer fields the stored row predates so callers always get
    // the full typed config without null guards.
    const patch = {} as Record<string, unknown>;
    if (existing.orderExpirationHours === undefined) patch.orderExpirationHours = DEFAULT_SYSTEM_CONFIG.orderExpirationHours;
    if (existing.defaultMarginSquareMetres === undefined) patch.defaultMarginSquareMetres = DEFAULT_SYSTEM_CONFIG.defaultMarginSquareMetres;
    if (existing.unitConversionDefaults === undefined) patch.unitConversionDefaults = DEFAULT_SYSTEM_CONFIG.unitConversionDefaults;
    if (existing.standardWasteMargin === undefined) patch.standardWasteMargin = DEFAULT_SYSTEM_CONFIG.standardWasteMargin;
    if (existing.maxAllowedScrapLimit === undefined) patch.maxAllowedScrapLimit = DEFAULT_SYSTEM_CONFIG.maxAllowedScrapLimit;
    if (existing.defaultReorderLevel === undefined) patch.defaultReorderLevel = DEFAULT_SYSTEM_CONFIG.defaultReorderLevel;
    if (existing.reorderAlertsEnabled === undefined) patch.reorderAlertsEnabled = DEFAULT_SYSTEM_CONFIG.reorderAlertsEnabled;
    if (existing.reorderAlertCooldownHours === undefined) patch.reorderAlertCooldownHours = DEFAULT_SYSTEM_CONFIG.reorderAlertCooldownHours;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(existing._id, { ...patch, updatedAt: Date.now() });
      existing = (await ctx.db.get(existing._id))!;
    }
    return existing as SystemConfig;
  }
  const id = await ctx.db.insert("systemConfigs", {
    ...DEFAULT_SYSTEM_CONFIG,
    key: CONFIG_KEY,
    updatedAt: Date.now(),
    updatedBy: actorAuthUserId,
  });
  return (await ctx.db.get(id)) as SystemConfig;
}
