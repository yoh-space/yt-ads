import { query } from "../_generated/server";
import { requireAdminRole } from "../users";
import { resolveEtbValue } from "../materialUsage";
import { getStartOfDay } from "./common";

/**
 * Daily performance + audited-stock-loss summary for the admin reports page.
 * Mirrors the owner financial metrics surface but is gated to the admin role.
 */
export const getReportSummary = query({
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    const startOfDay = getStartOfDay();

    const [orders, jobs, movements, materials, reconciliations] = await Promise.all([
      ctx.db.query("customerOrders").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("stock_movements").collect(),
      ctx.db.query("materials").collect(),
      ctx.db.query("reconciliations").collect(),
    ]);

    const todaysOrders = orders.filter((order) => order.createdAt >= startOfDay);
    const todaysSales = todaysOrders.reduce(
      (sum, order) => sum + (order.amount && order.amount > 0 ? order.amount : 0),
      0,
    );

    const materialMap = new Map(materials.map((material) => [material._id, material]));

    let todaysMaterialCost = 0;
    for (const movement of movements) {
      if (movement.createdAt < startOfDay) continue;
      if (movement.eventType !== "PRODUCTION_CONSUMPTION") continue;
      const material = materialMap.get(movement.materialId);
      if (!material || !Number.isFinite(movement.baseQuantity) || movement.baseQuantity <= 0) continue;
      todaysMaterialCost += movement.baseQuantity * resolveEtbValue(material);
    }

    const latestByMaterial = new Map<string, typeof reconciliations[number]>();
    for (const record of [...reconciliations].sort((left, right) => right.createdAt - left.createdAt)) {
      if (!latestByMaterial.has(record.materialId)) latestByMaterial.set(record.materialId, record);
    }
    let auditedStockLoss = 0;
    let auditedShortageCount = 0;
    for (const record of latestByMaterial.values()) {
      if (record.variance >= 0) continue;
      auditedShortageCount += 1;
      auditedStockLoss +=
        record.monetaryLoss ??
        Math.abs(record.variance) * (record.etbValue ?? resolveEtbValue(materialMap.get(record.materialId) ?? { name: "", unit: "m2" }));
    }

    const todayJobs = jobs.filter((job) => job.createdAt >= startOfDay);

    return {
      todaysSales: Number(todaysSales.toFixed(2)),
      todaysMaterialCost: Number(todaysMaterialCost.toFixed(2)),
      todaysNetProfit: Number((todaysSales - todaysMaterialCost).toFixed(2)),
      auditedStockLoss: Number(auditedStockLoss.toFixed(2)),
      auditedShortageCount,
      todaysOrderCount: todaysOrders.length,
      todaysJobCount: todayJobs.length,
      generatedAt: Date.now(),
    };
  },
});