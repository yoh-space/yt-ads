import { query } from "../_generated/server";
import { requireStorekeeper } from "../users";
import { conversionFactorFor } from "../inventory";

/**
 * Storekeeper-only parent inventory reads for the /dashboard/storekeeper
 * workspace namespace. Mirrors the shared `inventory.listParentInventory`
 * enrichment but is guarded by the strict storekeeper role guard.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireStorekeeper(ctx);
    const items = await ctx.db.query("parentInventory").collect();
    const materials = await ctx.db.query("materials").collect();
    const byId = new Map(materials.map((material) => [material._id, material]));
    return items
      .sort((left, right) => left.unitType.localeCompare(right.unitType))
      .map((item) => {
        const material = byId.get(item.materialId);
        const factor = conversionFactorFor(item);
        return {
          ...item,
          materialName: material?.name ?? "Unknown material",
          materialCategory: material?.category ?? "—",
          reorderAt: material?.reorderAt ?? 0,
          storageLocation: material?.storageLocation ?? "Central store",
          baseUnit: material?.baseUnit ?? material?.unit ?? "m²",
          conversionFactor: factor,
          baseUnitsInStock: factor ? Number((item.totalStockQuantity * factor).toFixed(3)) : undefined,
        };
      });
  },
});

/**
 * Central-store items at or below their reorder point, resolved into the
 * physical packaging units the storekeeper tracks. Read-only reorder view for
 * the storekeeper workspace.
 */
export const listReorderAlerts = query({
  args: {},
  handler: async (ctx) => {
    await requireStorekeeper(ctx);
    const items = await ctx.db.query("parentInventory").collect();
    const materials = await ctx.db.query("materials").collect();
    const byId = new Map(materials.map((material) => [material._id, material]));
    return items
      .map((item) => {
        const material = byId.get(item.materialId);
        const factor = conversionFactorFor(item);
        return {
          ...item,
          materialName: material?.name ?? "Unknown material",
          materialCategory: material?.category ?? "—",
          reorderAt: material?.reorderAt ?? 0,
          storageLocation: material?.storageLocation ?? "Central store",
          conversionFactor: factor,
        };
      })
      .filter((item) => {
        const threshold = item.conversionFactor && item.conversionFactor > 0 ? item.reorderAt / item.conversionFactor : item.reorderAt;
        return threshold > 0 && item.totalStockQuantity <= threshold;
      });
  },
});