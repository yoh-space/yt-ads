import { query } from "../_generated/server";
import { requireStorekeeper } from "../users";
import { conversionFactorFor } from "../inventory";

/**
 * Storekeeper workspace overview: central-store package totals by packaging
 * type, pending material requests, and items at their reorder point. Guarded by
 * the strict storekeeper role guard.
 */
export const getOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireStorekeeper(ctx);
    const [items, requests, materials] = await Promise.all([
      ctx.db.query("parentInventory").collect(),
      ctx.db.query("materialRequests").collect(),
      ctx.db.query("materials").collect(),
    ]);
    const materialById = new Map(materials.map((material) => [material._id, material]));

    const enriched = items.map((item) => {
      const material = materialById.get(item.materialId);
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

    const lowStockItems = enriched
      .map((item) => {
        const threshold = item.conversionFactor && item.conversionFactor > 0 ? item.reorderAt / item.conversionFactor : item.reorderAt;
        return { ...item, threshold };
      })
      .filter((item) => item.threshold > 0 && item.totalStockQuantity <= item.threshold);

    const pendingRequests = requests.filter(
      (request) => request.status === "Requested" || request.status === "Partially Issued",
    ).length;

    return {
      items: enriched,
      totals: {
        rolls: enriched.filter((item) => item.unitType === "ROLL").reduce((sum, item) => sum + item.totalStockQuantity, 0),
        sheets: enriched.filter((item) => item.unitType === "SHEET").reduce((sum, item) => sum + item.totalStockQuantity, 0),
        inks: enriched.filter((item) => item.unitType === "LITER").reduce((sum, item) => sum + item.totalStockQuantity, 0),
      },
      itemsCount: items.length,
      pendingRequests,
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.map((item) => ({
        materialName: item.materialName,
        unitType: item.unitType,
        totalStockQuantity: item.totalStockQuantity,
        storageLocation: item.storageLocation,
        reorderAt: item.reorderAt,
        conversionFactor: item.conversionFactor,
      })),
    };
  },
});