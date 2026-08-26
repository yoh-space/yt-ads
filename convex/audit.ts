import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireActiveProfile } from "./users";

type TimestampValue = number | string;
type AuditCategory = "inventory" | "production" | "recovery";

type AuditEvent = {
  id: string;
  category: AuditCategory;
  action: string;
  actorId: string;
  actorName: string;
  at: number;
  summary: string;
  detail: string;
};

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

const category = v.union(
  v.literal("all"),
  v.literal("inventory"),
  v.literal("production"),
  v.literal("recovery"),
);

export const list = query({
  args: {
    limit: v.optional(v.number()),
    category,
  },
  handler: async (ctx, args) => {
    await requireActiveProfile(ctx);
    const reference = Date.now();
    const [users, materials, machines, jobs, productionLogs, stockMovements, offcuts, scraps] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("materials").collect(),
      ctx.db.query("machines").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("productionLogs").collect(),
      ctx.db.query("stockMovements").collect(),
      ctx.db.query("offcuts").collect(),
      ctx.db.query("scraps").collect(),
    ]);

    const userNames = new Map(users.map((user) => [user.authUserId, user.name]));
    const materialNames = new Map(materials.map((material) => [material._id, material.name]));
    const machineNames = new Map(machines.map((machine) => [machine._id, machine.name]));
    const jobDetails = new Map(jobs.map((job) => [job._id, job]));
    const events: AuditEvent[] = [];

    function add(event: AuditEvent) {
      if (args.category === "all" || args.category === event.category) events.push(event);
    }

    for (const job of jobs) {
      add({
        id: `job-${job._id}`,
        category: "production",
        action: "Job card created",
        actorId: job.createdBy,
        actorName: userNames.get(job.createdBy) ?? job.createdBy,
        at: job.createdAt,
        summary: `${job.code} · ${job.client}`,
        detail: `${job.title} · ${job.quantity} ${job.unit} · ${job.status}`,
      });
    }

    for (const movement of stockMovements) {
      const materialName = materialNames.get(movement.materialId) ?? "Unknown material";
      const action = movement.direction === "in"
        ? "Stock received"
        : movement.direction === "offcut_return"
          ? "Offcut returned"
          : "Stock issued";
      add({
        id: `movement-${movement._id}`,
        category: movement.direction === "offcut_return" ? "recovery" : "inventory",
        action,
        actorId: movement.createdBy,
        actorName: userNames.get(movement.createdBy) ?? movement.createdBy,
        at: movement.createdAt,
        summary: `${materialName} · ${movement.baseQuantity ?? movement.quantity} ${movement.baseUnit ?? movement.unit}`,
        detail: movement.baseQuantity !== undefined && movement.baseUnit && movement.unit !== movement.baseUnit
          ? `${movement.quantity} ${movement.unit} converted to ${movement.baseQuantity} ${movement.baseUnit} · ${movement.note || "Inventory movement recorded"}`
          : movement.note || "Inventory movement recorded",
      });
    }

    for (const log of productionLogs) {
      const job = jobDetails.get(log.jobCardId);
      add({
        id: `production-${log._id}`,
        category: "production",
        action: "Production recorded",
        actorId: log.operatorId,
        actorName: userNames.get(log.operatorId) ?? log.operatorId,
        at: log.createdAt,
        summary: `${job?.code ?? "Production log"} · ${machineNames.get(log.machineId) ?? "Machine"}`,
        detail: `Input ${log.inputQuantity} ${log.unit} · Output ${log.outputQuantity} ${log.unit} · Waste ${log.wasteQuantity} ${log.unit}`,
      });
    }

    for (const offcut of offcuts) {
      add({
        id: `offcut-${offcut._id}`,
        category: "recovery",
        action: "Offcut recorded",
        actorId: offcut.createdBy,
        actorName: userNames.get(offcut.createdBy) ?? offcut.createdBy,
        at: normalizeTimestamp(offcut.createdAt, reference),
        summary: `${offcut.label} · ${offcut.area} m²`,
        detail: `${offcut.location} · ${offcut.status} · ${offcut.usable ? "usable" : "unusable"}`,
      });
    }

    for (const scrap of scraps) {
      add({
        id: `scrap-${scrap._id}`,
        category: "recovery",
        action: "Scrap recorded",
        actorId: scrap.createdBy,
        actorName: userNames.get(scrap.createdBy) ?? scrap.createdBy,
        at: normalizeTimestamp(scrap.createdAt, reference),
        summary: `${scrap.label} · ${scrap.quantity} ${scrap.unit}`,
        detail: scrap.reason,
      });
    }

    return events
      .sort((left, right) => right.at - left.at)
      .slice(0, Math.min(Math.max(args.limit ?? 100, 1), 250));
  },
});
