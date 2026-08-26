import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireActiveProfile } from "./users";

const period = v.union(
  v.literal("weekly"),
  v.literal("biweekly"),
  v.literal("monthly"),
  v.literal("custom"),
);

const PERIOD_DAYS = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
} as const;

type PeriodKey = keyof typeof PERIOD_DAYS;

type TimestampValue = number | string;

function normalizeTimestamp(value: TimestampValue, reference: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return reference;

  const trimmed = value.trim();
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return parsed;

  if (trimmed.toLowerCase() === "yesterday") return reference - 24 * 60 * 60 * 1000;

  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (timeMatch) {
    const current = new Date(reference);
    current.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    const timestamp = current.getTime();
    return timestamp > reference ? timestamp - 24 * 60 * 60 * 1000 : timestamp;
  }

  return reference;
}

function inRange(value: TimestampValue, startAt: number, endAt: number) {
  const timestamp = normalizeTimestamp(value, endAt);
  return timestamp >= startAt && timestamp <= endAt;
}

function sumByUnit(entries: Array<{ quantity: number; unit: string; baseQuantity?: number; baseUnit?: string }>) {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const unit = entry.baseUnit ?? entry.unit;
    const quantity = entry.baseQuantity ?? entry.quantity;
    totals.set(unit, Number(((totals.get(unit) ?? 0) + quantity).toFixed(3)));
  }
  return Array.from(totals, ([unit, quantity]) => ({ unit, quantity }));
}

const ETB_PER_WASTE_UNIT: Record<string, number> = {
  "m²": 85,
  "m": 45,
  "sheet": 120,
  "piece": 30,
  "pcs": 30,
  "L": 350,
};

export const getSummary = query({
  args: {
    period,
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireActiveProfile(ctx);

    const now = Date.now();
    let startAt: number;
    let endAt: number;
    let days: number;

    if (args.period === "custom" && args.startAt !== undefined && args.endAt !== undefined) {
      startAt = args.startAt;
      endAt = args.endAt;
      days = Math.max(1, Math.round((endAt - startAt) / (24 * 60 * 60 * 1000)));
    } else {
      endAt = now;
      const periodKey = args.period === "custom" ? "monthly" : (args.period as PeriodKey);
      days = PERIOD_DAYS[periodKey];
      startAt = endAt - days * 24 * 60 * 60 * 1000;
    }

    const [
      materials,
      machines,
      jobs,
      productionLogs,
      stockMovements,
      offcuts,
      scraps,
      orders,
      exceptions,
      users,
    ] = await Promise.all([
      ctx.db.query("materials").collect(),
      ctx.db.query("machines").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("productionLogs").collect(),
      ctx.db.query("stockMovements").collect(),
      ctx.db.query("offcuts").collect(),
      ctx.db.query("scraps").collect(),
      ctx.db.query("customerOrders").collect(),
      ctx.db.query("stockExceptions").collect(),
      ctx.db.query("users").collect(),
    ]);

    const userNames = new Map(users.map((user) => [user.authUserId, user.name]));
    const materialNames = new Map<string, string>(materials.map((m) => [m._id, m.name]));
    const materialDocs = new Map(materials.map((m) => [m._id, m]));
    const machineNames = new Map(machines.map((m) => [m._id, m.name]));
    const machineTypes = new Map(machines.map((m) => [m._id, m.type]));

    const periodJobs = jobs.filter((job) => inRange(job.createdAt, startAt, endAt));
    const periodProductionLogs = productionLogs.filter((log) => inRange(log.createdAt, startAt, endAt));
    const periodStockMovements = stockMovements.filter((movement) => inRange(movement.createdAt, startAt, endAt));
    const periodOffcuts = offcuts.filter((offcut) => inRange(normalizeTimestamp(offcut.createdAt, endAt), startAt, endAt));
    const periodScraps = scraps.filter((scrap) => inRange(normalizeTimestamp(scrap.createdAt, endAt), startAt, endAt));
    const periodOrders = orders.filter((order) => inRange(order.createdAt, startAt, endAt));
    const periodExceptions = exceptions.filter((exception) => inRange(exception.createdAt, startAt, endAt));

    const plannedQuantity = periodJobs.reduce((total, job) => total + job.quantity, 0);
    const productionInput = periodProductionLogs.reduce((total, log) => total + log.inputQuantity, 0);
    const productionOutput = periodProductionLogs.reduce((total, log) => total + log.outputQuantity, 0);
    const productionWaste = periodProductionLogs.reduce((total, log) => total + log.wasteQuantity, 0);
    const outputAndWaste = productionOutput + productionWaste;

    const nowMs = Date.now();
    const overdueOrders = periodOrders.filter(
      (order) => order.status !== "Completed" && order.preferredDueDate < nowMs,
    ).length;
    const completedOrders = periodOrders.filter((order) => order.status === "Completed").length;
    const pendingOrders = periodOrders.filter((order) => order.status === "Received").length;

    const estimatedRevenue = periodOrders.reduce((total, order) => {
      const priorityMultiplier = order.priority === "High" ? 1.2 : order.priority === "Low" ? 0.8 : 1;
      return total + Math.round(4500 * priorityMultiplier);
    }, 0);

    const consumptionByMaterial = new Map<string, { totalConsumed: number; unit: string; movementCount: number }>();
    for (const movement of periodStockMovements) {
      if (movement.direction !== "out" && movement.movementType !== "EXCEPTION_STOCK_OUT") continue;
      const matId = movement.materialId;
      const existing = consumptionByMaterial.get(matId) ?? { totalConsumed: 0, unit: movement.baseUnit ?? movement.unit, movementCount: 0 };
      existing.totalConsumed += movement.baseQuantity ?? movement.quantity;
      existing.movementCount += 1;
      consumptionByMaterial.set(matId, existing);
    }
    const topMaterials = Array.from(consumptionByMaterial.entries())
      .map(([materialId, data]) => ({ materialId, materialName: materialNames.get(materialId) ?? "Unknown", ...data }))
      .sort((a, b) => b.totalConsumed - a.totalConsumed)
      .slice(0, 5);

    const reorderAlerts = materials
      .filter((m) => m.active && m.quantity <= m.reorderAt)
      .map((m) => {
        const outMovements = periodStockMovements.filter(
          (mov) => mov.materialId === m._id && (mov.direction === "out" || mov.movementType === "EXCEPTION_STOCK_OUT"),
        );
        const totalOut = outMovements.reduce((sum, mov) => sum + (mov.baseQuantity ?? mov.quantity), 0);
        const dailyRate = days > 0 ? totalOut / days : 0;
        const estimatedDaysLeft = dailyRate > 0 ? Math.round(m.quantity / dailyRate) : null;
        return {
          materialName: m.name,
          currentStock: m.quantity,
          reorderAt: m.reorderAt,
          unit: m.baseUnit ?? m.unit,
          estimatedDaysLeft,
        };
      })
      .sort((a, b) => (a.estimatedDaysLeft ?? Infinity) - (b.estimatedDaysLeft ?? Infinity));

    const machineTypeStats = new Map<string, { machineCount: number; jobCount: number; logCount: number; totalOutput: number; totalWaste: number }>();
    const activeMachineIds = new Set(machines.filter((m) => m.active).map((m) => m._id));
    for (const machine of machines) {
      if (!machine.active) continue;
      const mType = machine.type;
      if (!machineTypeStats.has(mType)) {
        machineTypeStats.set(mType, { machineCount: 0, jobCount: 0, logCount: 0, totalOutput: 0, totalWaste: 0 });
      }
    }
    for (const machine of machines) {
      if (!machine.active) continue;
      const stats = machineTypeStats.get(machine.type)!;
      stats.machineCount += 1;
    }
    for (const job of periodJobs) {
      if (!activeMachineIds.has(job.machineId)) continue;
      const mType = machineTypes.get(job.machineId);
      if (mType) {
        const stats = machineTypeStats.get(mType);
        if (stats) stats.jobCount += 1;
      }
    }
    for (const log of periodProductionLogs) {
      if (!activeMachineIds.has(log.machineId)) continue;
      const mType = machineTypes.get(log.machineId);
      if (mType) {
        const stats = machineTypeStats.get(mType);
        if (stats) {
          stats.logCount += 1;
          stats.totalOutput += log.outputQuantity;
          stats.totalWaste += log.wasteQuantity;
        }
      }
    }
    const byType = Array.from(machineTypeStats.entries()).map(([machineType, data]) => ({ machineType, ...data }));

    const wasteByUnit = sumByUnit(periodScraps);
    const totalWasteQuantity = periodScraps.reduce((sum, scrap) => sum + scrap.quantity, 0);
    const wasteUnit = wasteByUnit.length > 0 ? wasteByUnit[0].unit : "m²";
    const estimatedETB = periodScraps.reduce((sum, scrap) => {
      const rate = ETB_PER_WASTE_UNIT[scrap.unit] ?? 85;
      return sum + scrap.quantity * rate;
    }, 0);

    const operatorJobs = new Map<string, { jobCount: number; logCount: number; outputQuantity: number }>();
    for (const job of periodJobs) {
      const existing = operatorJobs.get(job.createdBy) ?? { jobCount: 0, logCount: 0, outputQuantity: 0 };
      existing.jobCount += 1;
      operatorJobs.set(job.createdBy, existing);
    }
    for (const log of periodProductionLogs) {
      const existing = operatorJobs.get(log.operatorId) ?? { jobCount: 0, logCount: 0, outputQuantity: 0 };
      existing.logCount += 1;
      existing.outputQuantity += log.outputQuantity;
      operatorJobs.set(log.operatorId, existing);
    }
    const operatorActivity = Array.from(operatorJobs.entries())
      .map(([operatorId, data]) => ({
        operatorName: userNames.get(operatorId) ?? operatorId,
        ...data,
      }))
      .sort((a, b) => b.logCount - a.logCount)
      .slice(0, 10);

    return {
      period: args.period,
      startAt,
      endAt,
      days,
      seededDataNote: "Seed data contains materials, machines, job cards, and offcuts. Production logs, stock movements, and scraps appear after users record those activities.",
      inventory: {
        trackedMaterials: materials.filter((material) => material.active).length,
        lowStockMaterials: materials.filter((material) => material.active && material.quantity <= material.reorderAt).length,
        totalBaseQuantity: Number(materials.filter((material) => material.active).reduce((total, material) => total + material.quantity, 0).toFixed(2)),
        movementCount: periodStockMovements.length,
        stockInByUnit: sumByUnit(periodStockMovements.filter((movement) => movement.direction === "in")),
        stockOutByUnit: sumByUnit(periodStockMovements.filter((movement) => movement.direction === "out")),
      },
      production: {
        machineCount: machines.filter((machine) => machine.active).length,
        runningMachines: machines.filter((machine) => machine.active && machine.status === "Running").length,
        jobCardsCreated: periodJobs.length,
        activeJobs: periodJobs.filter((job) => job.status !== "Completed").length,
        completedJobs: periodJobs.filter((job) => job.status === "Completed").length,
        plannedQuantity: Number(plannedQuantity.toFixed(2)),
        logCount: periodProductionLogs.length,
        inputQuantity: Number(productionInput.toFixed(2)),
        outputQuantity: Number(productionOutput.toFixed(2)),
        wasteQuantity: Number(productionWaste.toFixed(2)),
        wasteRate: outputAndWaste > 0 ? Number(((productionWaste / outputAndWaste) * 100).toFixed(1)) : 0,
      },
      recovery: {
        offcutReturns: periodOffcuts.length,
        reusableOffcuts: periodOffcuts.filter((offcut) => offcut.usable && offcut.status === "available").length,
        scrapRecords: periodScraps.length,
        scrapQuantity: Number(periodScraps.reduce((total, scrap) => total + scrap.quantity, 0).toFixed(2)),
        scrapByUnit: sumByUnit(periodScraps),
      },
      financial: {
        totalOrders: periodOrders.length,
        completedOrders,
        overdueOrders,
        pendingOrders,
        estimatedRevenue,
      },
      exceptions: periodExceptions.map((exception) => ({
        id: exception._id,
        materialName: materialNames.get(exception.materialId) ?? "Unknown material",
        quantity: exception.quantity,
        unit: exception.unit,
        reason: exception.reason,
        operatorName: userNames.get(exception.createdBy) ?? exception.createdBy,
        authorizationNote: exception.authorizationNote,
        createdAt: exception.createdAt,
      })),
      consumption: {
        topMaterials: topMaterials.map(({ materialId: _, ...rest }) => rest),
        reorderAlerts,
      },
      machineEfficiency: {
        byType,
        wasteValue: {
          totalWasteQuantity: Number(totalWasteQuantity.toFixed(2)),
          wasteUnit,
          estimatedETB: Math.round(estimatedETB),
        },
        operatorActivity,
      },
    };
  },
});
