import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { requireOwner } from "./users";
import { DEFAULT_SYSTEM_CONFIG, type SystemConfig } from "./materialUsage";

/**
 * Single-row key for the workspace's central configuration. Mirrors the
 * `companySettings` pattern so a single deterministic lookup can resolve the
 * active configuration without a full-table scan.
 */
export const CONFIG_KEY = "default";

function validateNumber(value: number, label: string, options: { min?: number; max?: number } = {}) {
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

/**
 * Owner-only mutation: write the operational & financial configuration. All
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
    materialOverrides: v.array(v.object({
      materialName: v.string(),
      etbValue: v.number(),
    })),
    inkMlPerSquareMetre: v.number(),
    maxAllowedWastePercent: v.number(),
    minOffcutAreaSquareMetre: v.number(),
    requireAdminPinForExceptions: v.boolean(),
    maxDirectStockOutEtb: v.number(),
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
      materialOverrides: overrides,
      inkMlPerSquareMetre: args.inkMlPerSquareMetre,
      maxAllowedWastePercent: args.maxAllowedWastePercent,
      minOffcutAreaSquareMetre: args.minOffcutAreaSquareMetre,
      requireAdminPinForExceptions: args.requireAdminPinForExceptions,
      maxDirectStockOutEtb: args.maxDirectStockOutEtb,
      updatedAt: Date.now(),
      updatedBy: profile._id,
    };

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
  const existing = await ctx.db
    .query("systemConfigs")
    .withIndex("by_key", (q) => q.eq("key", CONFIG_KEY))
    .unique();
  if (existing) {
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