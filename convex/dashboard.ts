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
      ctx.db.query("stock_movements").collect(),
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
        orderOverdue: Boolean(order && !["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"].includes(order.status) && order.preferredDueDate < Date.now()),
      };
    });
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todaysOrders = orders.filter((order) => order.createdAt >= startOfDay).length;
    const completedOrders = orders.filter((order) => order.status === "COMPLETED").length;
    const queueOrders = orders.filter((order) => order.status === "PENDING_REVIEW").length;
    const activeProductionOrders = orders.filter((order) => order.status === "IN_PRODUCTION").length;

    const pulseCutoff = Date.now() - MATERIAL_PULSE_WINDOW_MS;
    const consumedByMaterial = new Map<string, number>();
    for (const movement of movements) {
      if (movement.createdAt < pulseCutoff) continue;
       if (movement.eventType === "STOCK_IN" || movement.eventType === "OFFCUT_RETURN") continue;
       const amount = movement.baseQuantity;
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

const EXPIRING_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Reactive operational KPIs for the admin/management overview grid. Computes
 * order-led real-time counters (new orders today, live production, pending
 * payment, completed today) plus the inventory and expiration alerts. Monetary
 * figures are gated behind `canViewFinancial` so only the owner sees ETB sums.
 */
export const getKpis = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireActiveProfile(ctx);
    const now = Date.now();
    const startOfToday = getStartOfDay();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

    const [orders, materials, operatorStock] = await Promise.all([
      ctx.db.query("customerOrders").collect(),
      ctx.db.query("materials").collect(),
      ctx.db.query("operatorSubStock").collect(),
    ]);

    const ordersToday = orders.filter((order) => order.createdAt >= startOfToday);
    const ordersYesterday = orders.filter(
      (order) => order.createdAt >= startOfYesterday && order.createdAt < startOfToday,
    );

    const todaysOrdersCount = ordersToday.length;
    const yesterdayOrdersCount = ordersYesterday.length;

    const inProductionCount = orders.filter((order) => order.status === "IN_PRODUCTION").length;

    const pendingPaymentOrders = orders.filter(
      (order) =>
        order.status === "PRICED_AND_PENDING_PAYMENT" ||
        (order.paymentStatus === "APPROVED_CREDIT" && order.status !== "COMPLETED"),
    );
    const pendingPaymentCount = pendingPaymentOrders.length;
    const pendingPaymentTotal = pendingPaymentOrders.reduce(
      (sum, order) => sum + (order.amount ?? 0),
      0,
    );

    const todaysCompletedCount = orders.filter(
      (order) => order.status === "COMPLETED" && order.updatedAt >= startOfToday,
    ).length;
    const yesterdayCompletedCount = orders.filter(
      (order) =>
        order.status === "COMPLETED" &&
        order.updatedAt >= startOfYesterday &&
        order.updatedAt < startOfToday,
    ).length;

    const activeMaterialsAtReorder = materials.filter(
      (material) => material.active && material.reorderAt > 0 && material.quantity <= material.reorderAt,
    ).length;
    const depletedOperatorBatches = operatorStock.filter(
      (batch) => batch.status === "ACTIVE" && batch.currentRemaining <= 0,
    ).length;
    const lowStockAlertCount = activeMaterialsAtReorder + depletedOperatorBatches;

    const expiringSoonCount = orders.filter(
      (order) =>
        order.expiresAt !== undefined &&
        order.expiresAt > now &&
        order.expiresAt <= now + EXPIRING_WINDOW_MS &&
        order.status !== "COMPLETED" &&
        order.status !== "EXPIRED" &&
        order.paymentStatus !== "PAID" &&
        order.status !== "EXPIRED_JUNK",
    ).length;

    const canSeeFinancial = canViewFinancial(profile.role);

    return {
      todaysOrdersCount,
      yesterdayOrdersCount,
      inProductionCount,
      pendingPaymentCount,
      pendingPaymentTotal: canSeeFinancial ? Number(pendingPaymentTotal.toFixed(2)) : 0,
      todaysCompletedCount,
      yesterdayCompletedCount,
      lowStockAlertCount,
      expiringSoonCount,
      generatedAt: now,
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
      ctx.db.query("stock_movements").collect(),
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
      if (movement.eventType !== "PRODUCTION_CONSUMPTION") continue;
      const note = movement.note ?? "";
      if (!note.toLowerCase().includes("production")) continue;
      const material = materialMap.get(movement.materialId);
      if (!material) continue;
      const baseQuantity = movement.baseQuantity;
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

/**
 * Real-time stockout forecast engine. Computes consumption velocity, estimated
 * runway in days, and urgency level (Critical / Warning / Healthy) per material.
 * Restricts monetary replenishment projections to the owner via `canViewFinancial`.
 */
export const getStockoutForecast = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireActiveProfile(ctx);
    if (!["owner", "manager", "admin", "storekeeper"].includes(profile.role)) {
      return {
        criticalCount: 0,
        warningCount: 0,
        items: [],
      };
    }

    const canSeeFinancial = canViewFinancial(profile.role);
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const [materials, movements] = await Promise.all([
      ctx.db
        .query("materials")
        .filter((q) => q.eq(q.field("active"), true))
        .collect(),
      ctx.db.query("stock_movements").collect(),
    ]);

    const consumptionMap = new Map<string, number>();
    for (const m of movements) {
      if (m.createdAt < thirtyDaysAgo) continue;
      if (
        m.eventType === "PRODUCTION_CONSUMPTION" ||
        m.eventType === "STORE_TO_OPERATOR_TRANSFER" ||
        m.eventType === "EXCEPTION_STOCK_OUT"
      ) {
        const qty = m.baseQuantity;
        if (Number.isFinite(qty) && qty > 0) {
          consumptionMap.set(m.materialId, (consumptionMap.get(m.materialId) ?? 0) + qty);
        }
      }
    }

    const items = materials.map((material) => {
      const consumed30Days = consumptionMap.get(material._id) ?? 0;
      const dailyRate = consumed30Days / 30;
      const currentStock = material.quantity ?? 0;
      const reorderAt = material.reorderAt ?? 0;

      let runwayDays: number;
      if (currentStock <= 0) {
        runwayDays = 0;
      } else if (dailyRate > 0) {
        runwayDays = Math.round(currentStock / dailyRate);
      } else if (reorderAt > 0 && currentStock <= reorderAt) {
        runwayDays = 1;
      } else {
        runwayDays = 999;
      }

      let urgency: "CRITICAL" | "WARNING" | "HEALTHY" = "HEALTHY";
      if (currentStock <= 0 || runwayDays <= 2 || (reorderAt > 0 && currentStock <= reorderAt)) {
        urgency = "CRITICAL";
      } else if (runwayDays <= 7 || (reorderAt > 0 && currentStock <= reorderAt * 1.5)) {
        urgency = "WARNING";
      }

      const targetStock = reorderAt > 0 ? reorderAt * 2 : 10;
      const suggestedReorder = Math.max(0, targetStock - currentStock);
      const unitValue = resolveEtbValue(material);
      const estimatedCostEtb = canSeeFinancial ? Math.round(suggestedReorder * unitValue) : undefined;

      return {
        materialId: material._id,
        materialName: material.name,
        category: material.category,
        baseUnit: material.baseUnit ?? material.unit ?? "pcs",
        currentStock: Number(currentStock.toFixed(2)),
        reorderAt,
        dailyRate: Number(dailyRate.toFixed(2)),
        runwayDays: runwayDays === 999 ? null : runwayDays,
        urgency,
        suggestedReorder: Number(suggestedReorder.toFixed(2)),
        estimatedCostEtb,
      };
    });

    const urgencyWeight = { CRITICAL: 0, WARNING: 1, HEALTHY: 2 };
    items.sort((a, b) => {
      const weightDiff = urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
      if (weightDiff !== 0) return weightDiff;
      const aRunway = a.runwayDays ?? 9999;
      const bRunway = b.runwayDays ?? 9999;
      return aRunway - bRunway;
    });

    const criticalCount = items.filter((i) => i.urgency === "CRITICAL").length;
    const warningCount = items.filter((i) => i.urgency === "WARNING").length;

    return {
      criticalCount,
      warningCount,
      items,
    };
  },
});
