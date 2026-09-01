import { query } from "./_generated/server";
import { requireActiveProfile, requireRoles } from "./users";
import { canViewFinancial } from "./authorization";
import { resolveEtbValue } from "./materialUsage";

const MATERIAL_PULSE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Resolves the start of "today" in the company's local timezone. */
function getStartOfDay(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Estimates a customer's order value in ETB when the walk-in record was saved
 * without an explicit amount. Mirrors the heuristic used by the legacy overview
 * surface so the two views stay consistent.
 */
function estimateOrderValue(order: { amount?: number; priority: "High" | "Medium" | "Low" }): number {
  if (order.amount !== undefined && order.amount > 0) return order.amount;
  if (order.priority === "High") return 4500 * 1.2;
  if (order.priority === "Low") return 4500 * 0.8;
  return 4500;
}

/**
 * Single round-trip that returns everything the operations dashboard needs:
 * materials, machines, job cards, offcuts, and the scrap register. Reactive by
 * default, so the UI updates in real time as the team records activity.
 */
export const getState = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireActiveProfile(ctx);
    const canSeeAllMachines = ["owner", "manager", "admin", "storekeeper"].includes(profile.role);
    const [materials, allMachines, allJobs, offcuts, scraps, orders, movements] = await Promise.all([
      ctx.db
        .query("materials")
        .filter((q) => q.eq(q.field("active"), true))
        .collect(),
      ctx.db
        .query("machines")
        .filter((q) => q.eq(q.field("active"), true))
        .collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db
        .query("offcuts")
        .filter((q) => q.eq(q.field("status"), "available"))
        .collect(),
      ctx.db.query("scraps").collect(),
      ctx.db.query("customerOrders").collect(),
      ctx.db.query("stockMovements").collect(),
    ]);
    const machines = allMachines.filter((machine) => canSeeAllMachines || machine.operatorRole === profile.role);
    const allowedMachineIds = new Set(machines.map((machine) => machine._id));
    const jobs = allJobs.filter((job) => canSeeAllMachines || allowedMachineIds.has(job.machineId));
    const jobMaterialIds = new Set(jobs.map((job) => job.materialId));
    const visibleMaterials = canSeeAllMachines ? materials : materials.filter((material) => jobMaterialIds.has(material._id));
    const visibleOffcuts = canSeeAllMachines ? offcuts : offcuts.filter((offcut) => jobMaterialIds.has(offcut.materialId));
    const visibleScraps = canSeeAllMachines ? scraps : scraps.filter((scrap) => jobMaterialIds.has(scrap.materialId));
    const ordersById = new Map(orders.map((order) => [order._id, order]));
    const enrichedJobs = jobs.map((job) => {
      const order = job.orderId ? ordersById.get(job.orderId) : undefined;
      return {
        ...job,
        orderStatus: order?.status,
        orderOverdue: Boolean(order && order.status !== "Completed" && order.preferredDueDate < Date.now()),
      };
    });
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todaysOrders = orders.filter((order) => order.createdAt >= startOfDay).length;
    const completedOrders = orders.filter((order) => order.status === "Completed").length;
    const queueOrders = orders.filter((order) => order.status === "Received").length;
    const activeProductionOrders = orders.filter((order) => order.status === "In Production").length;

    const pulseCutoff = Date.now() - MATERIAL_PULSE_WINDOW_MS;
    const consumedByMaterial = new Map<string, number>();
    for (const movement of movements) {
      if (movement.createdAt < pulseCutoff) continue;
      if (movement.direction !== "out" && movement.movementType !== "EXCEPTION_STOCK_OUT") continue;
      const amount = movement.baseQuantity ?? movement.quantity;
      if (!Number.isFinite(amount) || amount <= 0) continue;
      consumedByMaterial.set(
        movement.materialId,
        (consumedByMaterial.get(movement.materialId) ?? 0) + amount,
      );
    }
    const materialPulse = visibleMaterials.map((material) => {
      const consumed = consumedByMaterial.get(material._id) ?? 0;
      const onHand = material.quantity ?? 0;
      const total = consumed + onHand;
      const utilizationPct = total > 0 ? Math.round((consumed / total) * 100) : 0;
      return {
        materialId: material._id,
        consumedLast30Days: Number(consumed.toFixed(2)),
        utilizationPct,
      };
    });

    const canSeeFinancial = canViewFinancial(profile.role);
    const sanitizedMaterials = visibleMaterials.map((material) =>
      canSeeFinancial ? material : { ...material, etbValue: undefined as number | undefined },
    );

    return {
      materials: sanitizedMaterials,
      machines,
      jobs: enrichedJobs,
      offcuts: visibleOffcuts,
      scraps: visibleScraps,
      orderPulse: materialPulse,
      orderStats: { todaysOrders, completedOrders, queueOrders, activeProductionOrders },
    };
  },
});

/**
 * Live financial oversight metrics for the owner dashboard. Recomputes on
 * every relevant mutation:
 *
 * - Today's total sales: sum of `amount` (ETB) of every customer order created
 *   since the start of today. Walk-in orders without an explicit amount fall
 *   back to the priority-based estimator so the dashboard always surfaces a
 *   defensible revenue figure.
 *
 * - Total production material cost: sum of the ETB value of every standard
 *   stock-out movement recorded today. Each movement is valued using the
 *   material's current `etbValue` (per base unit) and `baseQuantity`, which
 *   covers both operator-recorded production issues and automatic job
 *   completion deductions.
 *
 * - Estimated net profit: today's sales minus today's production material
 *   cost. Surfaced as the primary financial performance indicator.
 *
 * - Audited stock loss: monetary loss carried by the *latest* physical stock
 *   reconciliation per material. Only negative variances (shortages) are
 *   counted, each multiplied by the material's per-unit ETB value at the
 *   time of the count.
 */
export const financialMetrics = query({
  args: {},
  handler: async (ctx) => {
    await requireRoles(ctx, ["owner"]);
    const startOfDay = getStartOfDay();

    const [orders, jobs, movements, materials, reconciliations] = await Promise.all([
      ctx.db.query("customerOrders").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("stockMovements").collect(),
      ctx.db.query("materials").collect(),
      ctx.db.query("reconciliations").withIndex("by_created").collect(),
    ]);

    const todayJobs = jobs.filter((job) => job.createdAt >= startOfDay);
    const todayJobIds = new Set(todayJobs.map((job) => job._id));

    const todaysOrders = orders.filter((order) => order.createdAt >= startOfDay);
    const todaysSales = todaysOrders.reduce((sum, order) => sum + estimateOrderValue(order), 0);

    const materialMap = new Map(materials.map((material) => [material._id, material]));

    let todaysMaterialCost = 0;
    for (const movement of movements) {
      if (movement.createdAt < startOfDay) continue;
      if (movement.direction !== "out") continue;
      if (movement.movementType && movement.movementType !== "STANDARD") continue;
      const note = movement.note ?? "";
      if (!note.startsWith("Production issue") && !note.startsWith("Automatic job completion deduction")) continue;
      const material = materialMap.get(movement.materialId);
      if (!material) continue;
      const baseQuantity = movement.baseQuantity ?? movement.quantity;
      if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) continue;
      const unitCost = resolveEtbValue(material);
      todaysMaterialCost += baseQuantity * unitCost;
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
      auditedStockLoss += record.monetaryLoss ?? Math.abs(record.variance) * (record.etbValue ?? resolveEtbValue(materialMap.get(record.materialId) ?? { name: "", unit: "m2" }));
    }

    const todaysNetProfit = todaysSales - todaysMaterialCost;

    return {
      todaysSales: Number(todaysSales.toFixed(2)),
      todaysMaterialCost: Number(todaysMaterialCost.toFixed(2)),
      todaysNetProfit: Number(todaysNetProfit.toFixed(2)),
      auditedStockLoss: Number(auditedStockLoss.toFixed(2)),
      todaysOrderCount: todaysOrders.length,
      todaysJobCount: todayJobIds.size,
      auditedShortageCount,
      generatedAt: Date.now(),
    };
  },
});
