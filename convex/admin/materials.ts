import { query } from "../_generated/server";
import { requireAdminRole } from "../users";

/**
 * Simple materials summary for the admin operational-configuration page.
 */
export const getMaterialsSummary = query({
  handler: async (ctx) => {
    await requireAdminRole(ctx);
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
      })),
    };
  },
});