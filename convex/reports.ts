import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireActiveProfile } from "./users";

const period = v.union(
  v.literal("weekly"),
  v.literal("biweekly"),
  v.literal("monthly"),
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

function sumByUnit(entries: Array<{ quantity: number; unit: string }>) {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.unit, Number(((totals.get(entry.unit) ?? 0) + entry.quantity).toFixed(2)));
  }
  return Array.from(totals, ([unit, quantity]) => ({ unit, quantity }));
}

export const getSummary = query({
  args: { period },
  handler: async (ctx, args) => {
    await requireActiveProfile(ctx);

    const endAt = Date.now();
    const days = PERIOD_DAYS[args.period as PeriodKey];
    const startAt = endAt - days * 24 * 60 * 60 * 1000;

    const [materials, machines, jobs, productionLogs, stockMovements, offcuts, scraps] = await Promise.all([
      ctx.db.query("materials").collect(),
      ctx.db.query("machines").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("productionLogs").collect(),
      ctx.db.query("stockMovements").collect(),
      ctx.db.query("offcuts").collect(),
      ctx.db.query("scraps").collect(),
    ]);

    const periodJobs = jobs.filter((job) => inRange(job.createdAt, startAt, endAt));
    const periodProductionLogs = productionLogs.filter((log) => inRange(log.createdAt, startAt, endAt));
    const periodStockMovements = stockMovements.filter((movement) => inRange(movement.createdAt, startAt, endAt));
    const periodOffcuts = offcuts.filter((offcut) => inRange(offcut.createdAt, startAt, endAt));
    const periodScraps = scraps.filter((scrap) => inRange(scrap.createdAt, startAt, endAt));

    const plannedQuantity = periodJobs.reduce((total, job) => total + job.quantity, 0);
    const productionInput = periodProductionLogs.reduce((total, log) => total + log.inputQuantity, 0);
    const productionOutput = periodProductionLogs.reduce((total, log) => total + log.outputQuantity, 0);
    const productionWaste = periodProductionLogs.reduce((total, log) => total + log.wasteQuantity, 0);
    const outputAndWaste = productionOutput + productionWaste;

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
    };
  },
});
