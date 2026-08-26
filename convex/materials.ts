import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { unit, purchaseUnit, accent } from "./schema";
import { convertToBase, type InputUnit } from "./units";
import { requirePermission } from "./users";
import { notifyRoles } from "./notificationHelpers";
import { findMaterialSpecification } from "../shared/material-specifications";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await authComponent.getAuthUser(ctx);
    return ctx.db
      .query("materials")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    unit,
    baseUnit: v.optional(unit),
    purchaseUnit: v.optional(purchaseUnit),
    conversionRatio: v.optional(v.number()),
    specification: v.optional(v.string()),
    specificationValue: v.optional(v.string()),
    specificationOptions: v.optional(v.array(v.string())),
    displayUnit: v.optional(v.string()),
    quantity: v.number(),
    reorderAt: v.number(),
    rollEquivalent: v.optional(v.number()),
    sheetEquivalent: v.optional(v.number()),
    storageLocation: v.optional(v.string()),
    averageUse: v.optional(v.string()),
    reorderRule: v.optional(v.string()),
    scrapRule: v.optional(v.string()),
    accent,
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "material.create");
    if (!args.name.trim()) throw new Error("Material name is required.");
    if (!Number.isFinite(args.quantity) || args.quantity < 0) {
      throw new Error("Opening quantity must be zero or greater.");
    }
    if (!Number.isFinite(args.reorderAt) || args.reorderAt < 0) {
      throw new Error("Reorder level must be zero or greater.");
    }
    const requestedName = args.name.trim();
    const catalog = findMaterialSpecification(requestedName);
    const canonicalName = catalog?.name ?? requestedName;
    const baseUnit = catalog?.baseUnit ?? args.baseUnit ?? args.unit;
    const purchaseUnitValue = catalog?.purchaseUnit ?? args.purchaseUnit;
    const specification = catalog?.specification ?? (args.specification?.trim() || undefined);
    const specificationOptions = catalog?.specificationOptions ? [...catalog.specificationOptions] : args.specificationOptions?.map((option) => option.trim()).filter(Boolean);
    const specificationValue = args.specificationValue?.trim() || undefined;
    if (specificationOptions?.length && specificationValue && !specificationOptions.includes(specificationValue)) {
      throw new Error(`Invalid ${specification ?? "material specification"} option for ${canonicalName}.`);
    }
    if (catalog?.specificationOptions && !specificationValue) {
      throw new Error(`${catalog.specification} is required for ${canonicalName}.`);
    }
    if (catalog?.conversionRatio !== undefined && args.conversionRatio !== undefined && args.conversionRatio !== catalog.conversionRatio) {
      throw new Error(`The confirmed conversion ratio for ${canonicalName} is ${catalog.conversionRatio}.`);
    }
    const resolvedRatio = catalog?.conversionRatio ?? args.conversionRatio;
    if (resolvedRatio !== undefined && (!Number.isFinite(resolvedRatio) || resolvedRatio <= 0)) {
      throw new Error("Conversion ratio must be greater than zero.");
    }
    if (args.rollEquivalent !== undefined && args.rollEquivalent <= 0) {
      throw new Error("Roll conversion must be greater than zero.");
    }
    if (args.sheetEquivalent !== undefined && args.sheetEquivalent <= 0) {
      throw new Error("Sheet conversion must be greater than zero.");
    }
    if (purchaseUnitValue) {
      convertToBase(1, purchaseUnitValue as InputUnit, baseUnit, resolvedRatio, args.rollEquivalent, args.sheetEquivalent);
    }
    const id = await ctx.db.insert("materials", {
      name: canonicalName,
      category: catalog?.category ?? (args.category.trim() || "Custom"),
      unit: baseUnit,
      baseUnit,
      purchaseUnit: purchaseUnitValue,
      conversionRatio: resolvedRatio,
      rollEquivalent: purchaseUnitValue === "roll" ? resolvedRatio : args.rollEquivalent,
      sheetEquivalent: purchaseUnitValue === "sheet" ? resolvedRatio : args.sheetEquivalent,
      displayUnit: args.displayUnit?.trim() || catalog?.displayUnit,
      specification,
      specificationValue,
      specificationOptions,
      quantity: args.quantity,
      reorderAt: args.reorderAt,
      storageLocation: args.storageLocation?.trim() || catalog?.storageLocation || undefined,
      averageUse: args.averageUse?.trim() || catalog?.averageUse || undefined,
      reorderRule: args.reorderRule?.trim() || undefined,
      scrapRule: args.scrapRule?.trim() || undefined,
      accent: args.accent,
      active: true,
    });
    return (await ctx.db.get(id))!;
  },
});

export const recordStockMovement = mutation({
  args: {
    materialId: v.id("materials"),
    direction: v.union(v.literal("in"), v.literal("out")),
    quantity: v.number(),
    inputUnit: v.union(v.literal("roll"), v.literal("sheet"), v.literal("pack"), v.literal("liter"), unit),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "stock.record");
    if (!Number.isFinite(args.quantity) || args.quantity <= 0) {
      throw new Error("Stock movement quantity must be greater than zero.");
    }
    const material = await ctx.db.get(args.materialId);
    if (!material || !material.active) throw new Error("Active material not found.");

    const converted = convertToBase(
      args.quantity,
      args.inputUnit as InputUnit,
      material.baseUnit ?? material.unit,
      material.conversionRatio,
      material.rollEquivalent,
      material.sheetEquivalent,
    );
    if (!Number.isFinite(converted) || converted <= 0) {
      throw new Error("Converted stock quantity must be greater than zero.");
    }
    if (args.direction === "out" && converted > material.quantity) {
      throw new Error(`Insufficient ${material.name} stock for this movement.`);
    }

    const delta = args.direction === "in" ? converted : -converted;
    await ctx.db.patch(args.materialId, {
      quantity: Number((material.quantity + delta).toFixed(2)),
    });
    await ctx.db.insert("stockMovements", {
      materialId: args.materialId,
      direction: args.direction,
      quantity: args.quantity,
      unit: args.inputUnit,
      baseUnit: material.baseUnit ?? material.unit,
      baseQuantity: converted,
      movementType: "STANDARD",
      note: args.note.trim() || "Manual stock movement",
      createdBy: identity._id,
      createdAt: Date.now(),
    });
    const nextQuantity = Number((material.quantity + delta).toFixed(2));
    if (args.direction === "out" && nextQuantity <= material.reorderAt) {
      await notifyRoles(ctx, ["owner", "manager", "admin", "storekeeper"], {
        title: "Low stock alert",
        message: `${material.name} is at ${nextQuantity} ${material.unit}, at or below its reorder level.`,
        type: "short_stock",
        actorAuthUserId: identity._id,
        relatedTable: "materials",
        relatedId: args.materialId,
      });
    }
  },
});
