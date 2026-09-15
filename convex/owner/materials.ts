import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { requireOwner } from "../users";
import { unit, purchaseUnit, materialCatalogFamily, materialFamily, wasteLimitPolicy } from "../schema";
import { normalizeInkColor } from "../utils/inkColor";

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveInventoryUnitType(
  family: string,
  purchaseUnitValue?: string
): "ROLL" | "SHEET" | "LITER" {
  const normFam = family.toUpperCase();
  const normPu = (purchaseUnitValue ?? "").toLowerCase();

  if (normFam === "ROLL" || normPu === "roll") return "ROLL";
  if (normFam === "RIGID_SHEET" || normPu === "sheet" || normFam === "BARS") return "SHEET";
  return "LITER";
}

/**
 * Validates owner-set waste limits against a material's catalog family.
 * Minimum offcut dimensions are only meaningful for square-metre materials.
 */
function validateWasteLimits(args: {
  catalogFamily: string;
  unit?: string;
  maxScrap?: number;
  minOffcutWidth?: number;
  minOffcutLength?: number;
  wasteLimitPolicy?: string;
}): {
  maxScrap?: number;
  minOffcutWidth?: number;
  minOffcutLength?: number;
  wasteLimitPolicy: "warn" | "block";
} {
  const policy = args.wasteLimitPolicy ?? "warn";
  if (policy !== "warn" && policy !== "block") {
    throw new Error("Waste limit policy must be either 'warn' or 'block'.");
  }
  if (args.maxScrap !== undefined && (!Number.isFinite(args.maxScrap) || args.maxScrap < 0)) {
    throw new Error("Max scrap must be 0 or greater.");
  }
  if ((args.minOffcutWidth !== undefined || args.minOffcutLength !== undefined) && args.unit !== "m²") {
    throw new Error("Minimum offcut dimensions are only valid for square-metre (m²) materials.");
  }
  if (args.minOffcutWidth !== undefined && (!Number.isFinite(args.minOffcutWidth) || args.minOffcutWidth <= 0)) {
    throw new Error("Minimum offcut width must be greater than 0.");
  }
  if (args.minOffcutLength !== undefined && (!Number.isFinite(args.minOffcutLength) || args.minOffcutLength <= 0)) {
    throw new Error("Minimum offcut length must be greater than 0.");
  }
  return {
    maxScrap: args.maxScrap,
    minOffcutWidth: args.minOffcutWidth,
    minOffcutLength: args.minOffcutLength,
    wasteLimitPolicy: policy,
  };
}

/**
 * Simple materials summary for the owner operational-configuration page.
 */
export const getMaterialsSummary = query({
  handler: async (ctx) => {
    await requireOwner(ctx);
    const materials = await ctx.db
      .query("materials")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
    const byCategory = new Map<string, number>();
    for (const material of materials) {
      byCategory.set(material.category, (byCategory.get(material.category) ?? 0) + 1);
    }
    const reorder = materials.filter((m) => m.reorderAt > 0 && m.quantity <= m.reorderAt);
    return {
      totalMaterials: materials.length,
      byCategory: Object.fromEntries(byCategory),
      reorderMaterials: reorder.map((m) => ({
        id: m._id,
        name: m.name,
        category: m.category,
        unit: m.baseUnit ?? m.unit ?? "pcs",
        quantity: m.quantity,
        reorderAt: m.reorderAt,
        reorderPolicy: m.reorderPolicy,
      })),
    };
  },
});

export const listForConfiguration = query({
  handler: async (ctx) => {
    await requireOwner(ctx);
    const materials = await ctx.db
      .query("materials")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
    return materials
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((material) => ({
        id: material._id,
        name: material.name,
        category: material.category,
        catalogFamily: material.catalogFamily,
        unit: material.baseUnit ?? material.unit ?? "pcs",
        reorderAt: material.reorderAt,
        reorderPolicy: material.reorderPolicy,
      }));
  },
});

export const updateReorderLevel = mutation({
  args: {
    materialId: v.id("materials"),
    reorderAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    if (!Number.isFinite(args.reorderAt) || args.reorderAt < 0) {
      throw new Error("Choose a valid reorder level.");
    }
    const material = await ctx.db.get(args.materialId);
    if (!material || !material.active) throw new Error("Material not found.");
    
    const reorderPolicy = {
      enabled: args.reorderAt > 0,
      level: args.reorderAt,
      unit: material.baseUnit ?? material.unit ?? "pcs",
    };

    await ctx.db.patch(material._id, {
      reorderAt: args.reorderAt,
      reorderPolicy,
    });

    await ctx.db.insert("configurationChanges", {
      configKey: `material:${material._id}`,
      changedFields: ["reorderAt", "reorderPolicy"],
      reason: `Reorder level updated for ${material.name}`,
      actorAuthUserId: profile.authUserId,
      createdAt: Date.now(),
    });
    return { id: material._id, reorderAt: args.reorderAt, reorderPolicy };
  },
});

export const updateReorderPolicy = mutation({
  args: {
    materialId: v.id("materials"),
    reorderPolicy: v.object({
      enabled: v.boolean(),
      level: v.number(),
      unit: v.string(),
      leadTimeDays: v.optional(v.number()),
      safetyStock: v.optional(v.number()),
      alertCooldownHours: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    if (!Number.isFinite(args.reorderPolicy.level) || args.reorderPolicy.level < 0) {
      throw new Error("Choose a valid reorder level.");
    }
    const material = await ctx.db.get(args.materialId);
    if (!material || !material.active) throw new Error("Material not found.");

    const reorderAt = args.reorderPolicy.enabled ? args.reorderPolicy.level : 0;
    await ctx.db.patch(material._id, {
      reorderAt,
      reorderPolicy: args.reorderPolicy,
    });

    await ctx.db.insert("configurationChanges", {
      configKey: `material:${material._id}`,
      changedFields: ["reorderAt", "reorderPolicy"],
      reason: `Reorder policy updated for ${material.name}`,
      actorAuthUserId: profile.authUserId,
      createdAt: Date.now(),
    });
    return { id: material._id, reorderAt, reorderPolicy: args.reorderPolicy };
  },
});

export const listRawMaterials = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const materials = await ctx.db.query("materials").collect();
    const parents = await ctx.db.query("parentInventory").collect();
    const parentByMaterial = new Map(parents.map((p) => [p.materialId, p]));

    const filtered = args.includeInactive
      ? materials
      : materials.filter((m) => m.active);

    return filtered
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => {
        const parent = parentByMaterial.get(m._id);
        return {
          _id: m._id,
          catalogMaterialId: m.catalogMaterialId,
          name: m.name,
          category: m.category,
          catalogFamily: m.catalogFamily ?? "ROLL",
          unit: m.unit,
          baseUnit: m.baseUnit ?? m.unit,
          purchaseUnit: m.purchaseUnit ?? "roll",
          packageUnit: m.packageUnit,
          packageSize: m.packageSize,
          packageLabel: m.packageLabel,
          conversionRatio: m.conversionRatio ?? 1,
          quantity: m.quantity,
          parentStockQuantity: parent?.totalStockQuantity ?? 0,
          parentUnitType: parent?.unitType,
          reorderAt: m.reorderAt,
          rollWidth: m.rollWidth,
          sheetWidth: m.sheetWidth,
          sheetLength: m.sheetLength,
          storageLocation: m.storageLocation ?? "Central store",
          displayUnit: m.displayUnit,
          averageUse: m.averageUse,
          inkColor: m.inkColor,
          materialFamily: m.materialFamily,
          maxScrap: m.maxScrap,
          minOffcutWidth: m.minOffcutWidth,
          minOffcutLength: m.minOffcutLength,
          wasteLimitPolicy: m.wasteLimitPolicy,
          active: m.active,
        };
      });
  },
});

export const createRawMaterial = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    catalogFamily: materialCatalogFamily,
    unit: unit,
    baseUnit: v.optional(unit),
    purchaseUnit: v.optional(purchaseUnit),
    conversionRatio: v.number(),
    rollWidth: v.optional(v.number()),
    sheetWidth: v.optional(v.number()),
    sheetLength: v.optional(v.number()),
    thickness: v.optional(v.number()),
    reorderAt: v.number(),
    storageLocation: v.optional(v.string()),
    displayUnit: v.optional(v.string()),
    averageUse: v.optional(v.string()),
    inkColor: v.optional(v.string()),
    materialFamily: v.optional(materialFamily),
    maxScrap: v.optional(v.number()),
    minOffcutWidth: v.optional(v.number()),
    minOffcutLength: v.optional(v.number()),
    wasteLimitPolicy: v.optional(wasteLimitPolicy),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Material name is required.");
    if (args.conversionRatio <= 0) throw new Error("Conversion ratio must be greater than 0.");
    if (args.reorderAt < 0) throw new Error("Reorder level must be 0 or greater.");
    const wasteLimits = validateWasteLimits({
      catalogFamily: args.catalogFamily,
      unit: args.unit,
      maxScrap: args.maxScrap,
      minOffcutWidth: args.minOffcutWidth,
      minOffcutLength: args.minOffcutLength,
      wasteLimitPolicy: args.wasteLimitPolicy,
    });

    const existing = await ctx.db
      .query("materials")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (existing && existing.active) {
      throw new Error(`An active material named "${name}" already exists.`);
    }

    const now = Date.now();
    const rawColor = args.inkColor?.trim();
    const normalizedColor = rawColor ? normalizeInkColor(rawColor) : undefined;
    const isInkOrSolvent = args.catalogFamily === "INK_SOLVENT" || args.category.toLowerCase().includes("ink");
    const isSolvent = isInkOrSolvent && (name.toLowerCase().includes("solvent") || name.toLowerCase().includes("cleaner"));
    const resolvedMaterialFamily = args.materialFamily ?? (isInkOrSolvent ? (isSolvent ? "SOLVENT" : "INK") : undefined);

    const slugBase = normalizedColor && !name.toLowerCase().includes(normalizedColor.toLowerCase())
      ? `${name}_${normalizedColor}`
      : name;
    const slug = deriveSlug(slugBase);
    const baseUnitVal = args.baseUnit ?? args.unit;
    const purchaseUnitVal = args.purchaseUnit ?? "roll";

    // 1. Upsert into materialCatalog (Blueprint)
    let catalogId: Id<"materialCatalog">;
    const existingCatalog = await ctx.db
      .query("materialCatalog")
      .withIndex("by_material_id", (q) => q.eq("id", slug))
      .first();

    if (existingCatalog) {
      catalogId = existingCatalog._id;
      await ctx.db.patch(catalogId, {
        name,
        category: args.category,
        catalogFamily: args.catalogFamily,
        baseUnit: baseUnitVal,
        purchaseUnit: purchaseUnitVal,
        conversionRatio: args.conversionRatio,
        rollWidth: args.rollWidth,
        sheetWidth: args.sheetWidth,
        sheetLength: args.sheetLength,
        thickness: args.thickness,
        inkColor: normalizedColor,
        storageLocation: args.storageLocation,
        averageUse: args.averageUse,
        active: true,
        updatedAt: now,
      });
    } else {
      catalogId = await ctx.db.insert("materialCatalog", {
        id: slug,
        name,
        category: args.category,
        catalogFamily: args.catalogFamily,
        baseUnit: baseUnitVal,
        purchaseUnit: purchaseUnitVal,
        conversionRatio: args.conversionRatio,
        rollWidth: args.rollWidth,
        sheetWidth: args.sheetWidth,
        sheetLength: args.sheetLength,
        thickness: args.thickness,
        inkColor: normalizedColor,
        storageLocation: args.storageLocation,
        averageUse: args.averageUse,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 2. Upsert into materials (Operational Entity)
    let materialId: Id<"materials">;
    const accentColor = normalizedColor === "MAGENTA"
      ? "violet"
      : normalizedColor === "YELLOW"
      ? "gold"
      : normalizedColor === "BLACK"
      ? "blue"
      : "cyan";

    if (existing) {
      materialId = existing._id;
      await ctx.db.patch(materialId, {
        catalogMaterialId: catalogId,
        category: args.category,
        catalogFamily: args.catalogFamily,
        materialFamily: resolvedMaterialFamily,
        inkColor: normalizedColor,
        unit: args.unit,
        baseUnit: baseUnitVal,
        purchaseUnit: purchaseUnitVal,
        conversionRatio: args.conversionRatio,
        rollWidth: args.rollWidth,
        sheetWidth: args.sheetWidth,
        sheetLength: args.sheetLength,
        reorderAt: args.reorderAt,
        storageLocation: args.storageLocation,
        displayUnit: args.displayUnit,
        averageUse: args.averageUse,
        maxScrap: wasteLimits.maxScrap,
        minOffcutWidth: wasteLimits.minOffcutWidth,
        minOffcutLength: wasteLimits.minOffcutLength,
        wasteLimitPolicy: wasteLimits.wasteLimitPolicy,
        active: true,
      });
    } else {
      materialId = await ctx.db.insert("materials", {
        catalogMaterialId: catalogId,
        name,
        category: args.category,
        catalogFamily: args.catalogFamily,
        materialFamily: resolvedMaterialFamily,
        inkColor: normalizedColor,
        unit: args.unit,
        baseUnit: baseUnitVal,
        purchaseUnit: purchaseUnitVal,
        conversionRatio: args.conversionRatio,
        rollWidth: args.rollWidth,
        sheetWidth: args.sheetWidth,
        sheetLength: args.sheetLength,
        quantity: 0,
        reorderAt: args.reorderAt,
        storageLocation: args.storageLocation,
        displayUnit: args.displayUnit,
        averageUse: args.averageUse,
        maxScrap: wasteLimits.maxScrap,
        minOffcutWidth: wasteLimits.minOffcutWidth,
        minOffcutLength: wasteLimits.minOffcutLength,
        wasteLimitPolicy: wasteLimits.wasteLimitPolicy,
        accent: accentColor,
        active: true,
      });
    }

    // 3. Upsert into parentInventory (Store Packaging Units)
    const unitType = resolveInventoryUnitType(args.catalogFamily, purchaseUnitVal);
    const existingParent = await ctx.db
      .query("parentInventory")
      .withIndex("by_material", (q) => q.eq("materialId", materialId))
      .first();

    if (existingParent) {
      await ctx.db.patch(existingParent._id, {
        unitType,
        lengthPerRoll: unitType === "ROLL" ? (args.conversionRatio ?? args.rollWidth) : undefined,
        areaPerSheet: unitType === "SHEET" ? args.conversionRatio : undefined,
        volumePerContainer: unitType === "LITER" ? (args.conversionRatio ?? 1) : undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("parentInventory", {
        materialId,
        unitType,
        totalStockQuantity: 0,
        lengthPerRoll: unitType === "ROLL" ? (args.conversionRatio ?? args.rollWidth) : undefined,
        areaPerSheet: unitType === "SHEET" ? args.conversionRatio : undefined,
        volumePerContainer: unitType === "LITER" ? (args.conversionRatio ?? 1) : undefined,
        updatedAt: now,
      });
    }

    await ctx.db.insert("configurationChanges", {
      configKey: `material:${materialId}`,
      changedFields: ["created", "name", "catalogFamily", "category"],
      reason: `Owner created raw material "${name}"`,
      actorAuthUserId: profile.authUserId,
      createdAt: now,
    });

    return { materialId, catalogId };
  },
});

export const updateRawMaterial = mutation({
  args: {
    materialId: v.id("materials"),
    name: v.string(),
    category: v.string(),
    catalogFamily: materialCatalogFamily,
    unit: unit,
    baseUnit: v.optional(unit),
    purchaseUnit: v.optional(purchaseUnit),
    conversionRatio: v.number(),
    rollWidth: v.optional(v.number()),
    sheetWidth: v.optional(v.number()),
    sheetLength: v.optional(v.number()),
    thickness: v.optional(v.number()),
    reorderAt: v.number(),
    storageLocation: v.optional(v.string()),
    displayUnit: v.optional(v.string()),
    averageUse: v.optional(v.string()),
    inkColor: v.optional(v.string()),
    materialFamily: v.optional(materialFamily),
    maxScrap: v.optional(v.number()),
    minOffcutWidth: v.optional(v.number()),
    minOffcutLength: v.optional(v.number()),
    wasteLimitPolicy: v.optional(wasteLimitPolicy),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const material = await ctx.db.get(args.materialId);
    if (!material) throw new Error("Material not found.");

    const name = args.name.trim();
    if (!name) throw new Error("Material name is required.");
    if (args.conversionRatio <= 0) throw new Error("Conversion ratio must be greater than 0.");
    if (args.reorderAt < 0) throw new Error("Reorder level must be 0 or greater.");
    const wasteLimits = validateWasteLimits({
      catalogFamily: args.catalogFamily,
      unit: args.unit,
      maxScrap: args.maxScrap,
      minOffcutWidth: args.minOffcutWidth,
      minOffcutLength: args.minOffcutLength,
      wasteLimitPolicy: args.wasteLimitPolicy,
    });

    const now = Date.now();
    const baseUnitVal = args.baseUnit ?? args.unit;
    const purchaseUnitVal = args.purchaseUnit ?? material.purchaseUnit ?? "roll";
    const rawColor = args.inkColor !== undefined ? args.inkColor.trim() : material.inkColor;
    const normalizedColor = rawColor ? normalizeInkColor(rawColor) : undefined;
    const isInkOrSolvent = args.catalogFamily === "INK_SOLVENT" || args.category.toLowerCase().includes("ink");
    const isSolvent = isInkOrSolvent && (name.toLowerCase().includes("solvent") || name.toLowerCase().includes("cleaner"));
    const resolvedMaterialFamily = args.materialFamily ?? material.materialFamily ?? (isInkOrSolvent ? (isSolvent ? "SOLVENT" : "INK") : undefined);

    // 1. Update materials record
    await ctx.db.patch(material._id, {
      name,
      category: args.category,
      catalogFamily: args.catalogFamily,
      materialFamily: resolvedMaterialFamily,
      inkColor: normalizedColor,
      unit: args.unit,
      baseUnit: baseUnitVal,
      purchaseUnit: purchaseUnitVal,
      conversionRatio: args.conversionRatio,
      rollWidth: args.rollWidth,
      sheetWidth: args.sheetWidth,
      sheetLength: args.sheetLength,
      reorderAt: args.reorderAt,
      storageLocation: args.storageLocation,
      displayUnit: args.displayUnit,
      averageUse: args.averageUse,
      maxScrap: wasteLimits.maxScrap,
      minOffcutWidth: wasteLimits.minOffcutWidth,
      minOffcutLength: wasteLimits.minOffcutLength,
      wasteLimitPolicy: wasteLimits.wasteLimitPolicy,
      active: args.active,
    });

    // 2. Update linked materialCatalog
    if (material.catalogMaterialId) {
      await ctx.db.patch(material.catalogMaterialId, {
        name,
        category: args.category,
        catalogFamily: args.catalogFamily,
        baseUnit: baseUnitVal,
        purchaseUnit: purchaseUnitVal,
        conversionRatio: args.conversionRatio,
        rollWidth: args.rollWidth,
        sheetWidth: args.sheetWidth,
        sheetLength: args.sheetLength,
        thickness: args.thickness,
        inkColor: normalizedColor,
        storageLocation: args.storageLocation,
        averageUse: args.averageUse,
        active: args.active,
        updatedAt: now,
      });
    }

    // 3. Update parentInventory
    const unitType = resolveInventoryUnitType(args.catalogFamily, purchaseUnitVal);
    const parent = await ctx.db
      .query("parentInventory")
      .withIndex("by_material", (q) => q.eq("materialId", material._id))
      .first();

    if (parent) {
      await ctx.db.patch(parent._id, {
        unitType,
        lengthPerRoll: unitType === "ROLL" ? (args.conversionRatio ?? args.rollWidth) : undefined,
        areaPerSheet: unitType === "SHEET" ? args.conversionRatio : undefined,
        volumePerContainer: unitType === "LITER" ? (args.conversionRatio ?? 1) : undefined,
        updatedAt: now,
      });
    } else if (args.active) {
      await ctx.db.insert("parentInventory", {
        materialId: material._id,
        unitType,
        totalStockQuantity: 0,
        lengthPerRoll: unitType === "ROLL" ? (args.conversionRatio ?? args.rollWidth) : undefined,
        areaPerSheet: unitType === "SHEET" ? args.conversionRatio : undefined,
        volumePerContainer: unitType === "LITER" ? (args.conversionRatio ?? 1) : undefined,
        updatedAt: now,
      });
    }

    await ctx.db.insert("configurationChanges", {
      configKey: `material:${material._id}`,
      changedFields: ["name", "category", "catalogFamily", "conversionRatio", "active", "maxScrap", "minOffcutWidth", "minOffcutLength", "wasteLimitPolicy"],
      reason: `Owner updated raw material "${name}"`,
      actorAuthUserId: profile.authUserId,
      createdAt: now,
    });

    return { success: true };
  },
});

export const deleteRawMaterial = mutation({
  args: {
    materialId: v.id("materials"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const material = await ctx.db.get(args.materialId);
    if (!material) throw new Error("Material not found.");

    const now = Date.now();

    // Check if used by stock movements or active job cards
    const movements = await ctx.db
      .query("stock_movements")
      .withIndex("by_material_created", (q) => q.eq("materialId", material._id))
      .first();

    const jobs = await ctx.db
      .query("jobCards")
      .filter((q) => q.eq(q.field("materialId"), material._id))
      .first();

    const hasHistory = Boolean(movements || jobs);

    if (hasHistory && !args.force) {
      // Soft delete to protect ledger history integrity
      await ctx.db.patch(material._id, { active: false });
      if (material.catalogMaterialId) {
        await ctx.db.patch(material.catalogMaterialId, { active: false, updatedAt: now });
      }
      return { action: "deactivated", message: "Material deactivated to preserve historical stock records." };
    }

    // Completely unused or forced: remove
    await ctx.db.delete(material._id);
    if (material.catalogMaterialId) {
      await ctx.db.delete(material.catalogMaterialId);
    }
    const parent = await ctx.db
      .query("parentInventory")
      .withIndex("by_material", (q) => q.eq("materialId", material._id))
      .first();
    if (parent) {
      await ctx.db.delete(parent._id);
    }

    await ctx.db.insert("configurationChanges", {
      configKey: `material:${material._id}`,
      changedFields: ["deleted"],
      reason: `Owner deleted raw material "${material.name}"`,
      actorAuthUserId: profile.authUserId,
      createdAt: now,
    });

    return { action: "deleted", message: "Material successfully deleted." };
  },
});
