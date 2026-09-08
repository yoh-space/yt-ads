import { query } from "../_generated/server";
import { requireAdminRole } from "../users";
import { resolveEtbValue } from "../materialUsage";
import { getStartOfDay } from "./common";

/**
 * Admin-only consolidated overview. Surfaces the business status at a glance in
 * everyday terms: today's sales, today's net profit, active jobs on the floor,
 * running machines, pending clearance, and low / reorder materials.
 */
export const getOverviewSummary = query({
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    const startOfDay = getStartOfDay();
    const now = Date.now();

    const [orders, jobs, machines, materials, subStock, reconciliations, movements] = await Promise.all([
      ctx.db.query("customerOrders").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("machines").filter((q) => q.eq(q.field("active"), true)).collect(),
      ctx.db.query("materials").filter((q) => q.eq(q.field("active"), true)).collect(),
      ctx.db.query("operatorSubStock").collect(),
      ctx.db.query("reconciliations").collect(),
      ctx.db.query("stock_movements").collect(),
    ]);

    const materialMap = new Map(materials.map((m) => [m._id, m]));

    const todaysOrders = orders.filter((o) => o.createdAt >= startOfDay);
    const todaysSales = todaysOrders.reduce(
      (sum, o) => sum + (o.amount && o.amount > 0 ? o.amount : 0),
      0,
    );

    let todaysMaterialCost = 0;
    for (const movement of movements) {
      if (movement.createdAt < startOfDay) continue;
      if (movement.eventType !== "PRODUCTION_CONSUMPTION") continue;
      const material = materialMap.get(movement.materialId);
      if (!material || !Number.isFinite(movement.baseQuantity) || movement.baseQuantity <= 0) continue;
      todaysMaterialCost += movement.baseQuantity * resolveEtbValue(material);
    }

    const activeJobs = jobs.filter((j) => j.status === "In production").length;
    const queuedJobs = jobs.filter((j) => j.status === "Queued").length;
    const runningMachines = machines.filter((m) => m.status === "Running").length;
    const pendingClearance = reconciliations.filter((r) => r.status === "Open").length;
    const reorderMaterials = materials.filter((m) => m.reorderAt > 0 && m.quantity <= m.reorderAt).length;

    return {
      todaysSales: Number(todaysSales.toFixed(2)),
      todaysMaterialCost: Number(todaysMaterialCost.toFixed(2)),
      todaysNetProfit: Number((todaysSales - todaysMaterialCost).toFixed(2)),
      todaysOrderCount: todaysOrders.length,
      activeJobs,
      queuedJobs,
      runningMachines,
      machinesCount: machines.length,
      pendingClearance,
      reorderMaterials,
      lowStockCount: reorderMaterials,
      generatedAt: now,
    };
  },
});