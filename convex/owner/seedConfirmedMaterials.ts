import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { authComponent } from "../auth";
import { requireOwner } from "../users";
import {
  MATERIAL_SPECIFICATIONS,
  resolveMaterialFamily,
} from "../../src/shared/material-specifications";

async function resolveBootstrapOwner(ctx: MutationCtx) {
  const identity = await authComponent.safeGetAuthUser(ctx);
  if (identity) {
    const { profile } = await requireOwner(ctx);
    return { authUserId: profile.authUserId };
  }
  return { authUserId: undefined };
}

/**
 * Authoritative single-source-of-truth material seeding.
 *
 * Upserts definitions into materialCatalog first, then upserts operational
 * records into materials and links them via catalogMaterialId. Idempotent.
 */
export const seedConfirmedMaterials = mutation({
  args: {
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await resolveBootstrapOwner(ctx);
    const now = Date.now();

    const counts = {
      catalogItems: 0,
      materials: 0,
    };

    const accents = ["cyan", "violet", "gold", "green", "blue"] as const;

    for (const [index, spec] of MATERIAL_SPECIFICATIONS.entries()) {
      const slug = spec.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      // 1. Upsert materialCatalog definition
      const existingCatalog = await ctx.db
        .query("materialCatalog")
        .withIndex("by_material_id", (q) => q.eq("id", slug))
        .unique();

      let catalogId: Id<"materialCatalog">;

      if (existingCatalog) {
        catalogId = existingCatalog._id;
        await ctx.db.patch(existingCatalog._id, {
          name: spec.name,
          aliases: spec.aliases ? [...spec.aliases] : undefined,
          category: spec.category,
          catalogFamily: spec.catalogFamily ?? "ROLL",
          baseUnit: spec.baseUnit,
          purchaseUnit: spec.purchaseUnit,
          conversionRatio: spec.conversionRatio ?? 1,
          rollWidth: spec.rollWidth,
          sheetWidth: spec.sheetWidth,
          sheetLength: spec.sheetLength,
          specificationOptions: spec.specificationOptions
            ? [...spec.specificationOptions]
            : undefined,
          compatibleMachineTypes: spec.compatibleMachineTypes
            ? [...spec.compatibleMachineTypes]
            : undefined,
          storageLocation: spec.storageLocation,
          averageUse: spec.averageUse,
          catalogDimensions: spec.catalogDimensions,
          catalogVariant: spec.catalogVariant,
          active: true,
          updatedAt: now,
        });
      } else {
        catalogId = await ctx.db.insert("materialCatalog", {
          id: slug,
          name: spec.name,
          aliases: spec.aliases ? [...spec.aliases] : undefined,
          category: spec.category,
          catalogFamily: spec.catalogFamily ?? "ROLL",
          baseUnit: spec.baseUnit,
          purchaseUnit: spec.purchaseUnit,
          conversionRatio: spec.conversionRatio ?? 1,
          rollWidth: spec.rollWidth,
          sheetWidth: spec.sheetWidth,
          sheetLength: spec.sheetLength,
          specificationOptions: spec.specificationOptions
            ? [...spec.specificationOptions]
            : undefined,
          compatibleMachineTypes: spec.compatibleMachineTypes
            ? [...spec.compatibleMachineTypes]
            : undefined,
          storageLocation: spec.storageLocation,
          averageUse: spec.averageUse,
          catalogDimensions: spec.catalogDimensions,
          catalogVariant: spec.catalogVariant,
          active: true,
          createdAt: now,
          updatedAt: now,
        });
        counts.catalogItems++;
      }

      // 2. Upsert operational materials table and link catalogMaterialId
      const existingMaterial = await ctx.db
        .query("materials")
        .withIndex("by_name", (q) => q.eq("name", spec.name))
        .first();

      let materialId: Id<"materials">;

      if (existingMaterial) {
        materialId = existingMaterial._id;
        await ctx.db.patch(existingMaterial._id, {
          catalogMaterialId: catalogId,
          category: spec.category,
          unit: spec.baseUnit,
          baseUnit: spec.baseUnit,
          purchaseUnit: spec.purchaseUnit,
          conversionRatio: spec.conversionRatio,
          catalogFamily: spec.catalogFamily as any,
          rollWidth: spec.rollWidth,
          sheetWidth: spec.sheetWidth,
          sheetLength: spec.sheetLength,
          isSolvent: spec.isSolvent,
          materialFamily: resolveMaterialFamily(spec),
          inkColor: spec.inkColor,
          storageLocation: spec.storageLocation,
          displayUnit: spec.displayUnit,
          averageUse: spec.averageUse,
          active: true,
        });
      } else {
        materialId = await ctx.db.insert("materials", {
          catalogMaterialId: catalogId,
          name: spec.name,
          category: spec.category,
          unit: spec.baseUnit,
          baseUnit: spec.baseUnit,
          purchaseUnit: spec.purchaseUnit,
          conversionRatio: spec.conversionRatio,
          catalogFamily: spec.catalogFamily as any,
          rollWidth: spec.rollWidth,
          sheetWidth: spec.sheetWidth,
          sheetLength: spec.sheetLength,
          isSolvent: spec.isSolvent,
          materialFamily: resolveMaterialFamily(spec),
          inkColor: spec.inkColor,
          quantity: 0,
          reorderAt: 5,
          storageLocation: spec.storageLocation,
          displayUnit: spec.displayUnit,
          averageUse: spec.averageUse,
          accent: accents[index % accents.length],
          active: true,
        });
        counts.materials++;
      }

      // 3. Upsert parentInventory tier 1 whole-packaging unit record
      const unitType: "ROLL" | "SHEET" | "LITER" =
        spec.purchaseUnit === "roll" || spec.catalogFamily === "ROLL"
          ? "ROLL"
          : spec.purchaseUnit === "sheet" || spec.catalogFamily === "RIGID_SHEET"
            ? "SHEET"
            : "LITER";

      const existingParent = await ctx.db
        .query("parentInventory")
        .withIndex("by_material", (q) => q.eq("materialId", materialId))
        .first();

      if (!existingParent) {
        await ctx.db.insert("parentInventory", {
          materialId,
          unitType,
          totalStockQuantity: 0,
          lengthPerRoll: unitType === "ROLL" ? (spec.conversionRatio ?? spec.rollWidth) : undefined,
          areaPerSheet: unitType === "SHEET" ? spec.conversionRatio : undefined,
          volumePerContainer: unitType === "LITER" ? (spec.conversionRatio ?? 1) : undefined,
          updatedAt: now,
        });
      }
    }

    return {
      success: true,
      totalCatalogSpecs: MATERIAL_SPECIFICATIONS.length,
      ...counts,
    };
  },
});
