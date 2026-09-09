import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOwner } from "../users";

const auditArgs = {
  from: v.optional(v.number()),
  to: v.optional(v.number()),
  category: v.optional(v.string()),
  actor: v.optional(v.string()),
  search: v.optional(v.string()),
  offset: v.optional(v.number()),
  limit: v.optional(v.number()),
};

function matches(event: { category: string; actorId: string; actorRole: string; searchText: string; at: number }, args: { from?: number; to?: number; category?: string; actor?: string; search?: string }) {
  if (args.from !== undefined && event.at < args.from) return false;
  if (args.to !== undefined && event.at >= args.to) return false;
  if (args.category && args.category !== "all" && event.category !== args.category) return false;
  if (args.actor && args.actor !== "all") {
    if (args.actor.startsWith("role:") && event.actorRole !== args.actor.slice(5)) return false;
    if (!args.actor.startsWith("role:") && event.actorId !== args.actor) return false;
  }
  if (args.search && !event.searchText.toLowerCase().includes(args.search.trim().toLowerCase())) return false;
  return true;
}

export const getAuditSummary = query({
  args: auditArgs,
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const [users, materials, machines, jobs, productionLogs, stockMovements, offcuts, orders, reconciliations, changes] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("materials").collect(),
      ctx.db.query("machines").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("productionLogs").collect(),
      ctx.db.query("stock_movements").collect(),
      ctx.db.query("offcuts").collect(),
      ctx.db.query("customerOrders").collect(),
      ctx.db.query("reconciliations").collect(),
      ctx.db.query("configurationChanges").collect(),
    ]);
    const userByAuth = new Map(users.map((u) => [u.authUserId, u]));
    const materialById = new Map(materials.map((m) => [m._id, m]));
    const machineById = new Map(machines.map((m) => [m._id, m]));
    const jobById = new Map(jobs.map((j) => [j._id, j]));
    type Event = {
      id: string;
      category: string;
      action: string;
      actorId: string;
      actorName: string;
      actorRole: string;
      at: number;
      searchText: string;
      summary: string;
      detail: string;
      severity: "normal" | "warning" | "critical";
      associated: { orderId?: string; jobCardId?: string; machineId?: string; materialId?: string };
      rawPayload: string;
    };
    const events: Event[] = [];
    const add = (event: Event) => { if (matches(event, args)) events.push(event); };
    const actor = (id: string) => userByAuth.get(id);
    const eventBase = (id: string, category: string, action: string, actorId: string, at: number, summary: string, detail: string, severity: Event["severity"], associated: Event["associated"], payload: unknown): Event => {
      const profile = actor(actorId);
      return { id, category, action, actorId, actorName: profile?.name ?? (actorId || "Public client"), actorRole: profile?.role ?? "public", at, searchText: `${category} ${action} ${summary} ${detail} ${JSON.stringify(payload)}`, summary, detail, severity, associated, rawPayload: JSON.stringify(payload, null, 2) };
    };

    for (const movement of stockMovements) {
      const material = materialById.get(movement.materialId);
      const severity = movement.eventType.includes("EXCEPTION") || movement.eventType.includes("RECONCILIATION") ? "critical" : movement.eventType.includes("SCRAP") ? "warning" : "normal";
      add(eventBase(`movement-${movement._id}`, movement.eventType.includes("EXCEPTION") ? "Exception Overrides" : "Stock Movement", movement.eventType.replaceAll("_", " "), movement.createdBy, movement.createdAt, `${material?.name ?? "Material"} · ${movement.baseQuantity} ${movement.baseUnit}`, movement.note || "Inventory movement recorded", severity, { materialId: movement.materialId as string, machineId: movement.machineId as string | undefined, jobCardId: movement.jobCardId as string | undefined }, movement));
    }
    for (const job of jobs) {
      add(eventBase(`job-${job._id}`, "Job Processing", `Job ${job.status.replaceAll("_", " ")}`, job.createdBy, job.createdAt, `${job.code} · ${job.client}`, `${job.title} · ${job.quantity} ${job.unit}`, "normal", { jobCardId: job._id as string, machineId: job.machineId as string }, job));
    }
    for (const log of productionLogs) {
      const job = jobById.get(log.jobCardId);
      add(eventBase(`production-${log._id}`, "Job Processing", "Production recorded", log.operatorId, log.createdAt, `${job?.code ?? "Production"} · ${machineById.get(log.machineId)?.name ?? "Machine"}`, `Input ${log.inputQuantity} ${log.unit} · Output ${log.outputQuantity} ${log.unit} · Waste ${log.wasteQuantity} ${log.unit}`, log.wasteQuantity > log.inputQuantity * 0.2 ? "warning" : "normal", { jobCardId: log.jobCardId as string, machineId: log.machineId as string }, log));
    }
    for (const order of orders) {
      add(eventBase(`order-${order._id}`, "Order Management", `Order ${order.status.replaceAll("_", " ")}`, order.createdBy ?? "", order.updatedAt, `${order.code} · ${order.clientName}`, `${order.serviceType} · ${order.amount ? `ETB ${order.amount}` : "No amount"}`, "normal", { orderId: order._id as string, jobCardId: order.jobCardId as string | undefined, machineId: order.machineId as string | undefined }, order));
    }
    for (const offcut of offcuts) {
      add(eventBase(`offcut-${offcut._id}`, "Stock Movement", "Offcut recorded", offcut.createdBy, new Date(offcut.createdAt).getTime(), `${offcut.label} · ${offcut.area} m²`, `${offcut.location} · ${offcut.status}`, "normal", { machineId: offcut.machineId as string | undefined, jobCardId: offcut.jobCardId as string | undefined }, offcut));
    }
    for (const reconciliation of reconciliations) {
      const profile = actor(reconciliation.countedBy);
      add(eventBase(`reconciliation-${reconciliation._id}`, "Reconciliation", `Reconciliation ${reconciliation.status}`, reconciliation.countedBy, reconciliation.createdAt, `${materialById.get(reconciliation.materialId)?.name ?? "Material"} · variance ${reconciliation.variance}`, reconciliation.note ?? "Reconciliation recorded", reconciliation.variance < 0 ? "critical" : "warning", { materialId: reconciliation.materialId as string }, { ...reconciliation, actorRole: profile?.role }));
    }
    for (const change of changes) {
      add(eventBase(`config-${change._id}`, "System Configuration", "Configuration changed", change.actorAuthUserId, change.createdAt, change.configKey, change.reason ?? change.changedFields.join(", "), "normal", {}, change));
    }

    events.sort((a, b) => b.at - a.at);
    const offset = Math.max(0, args.offset ?? 0);
    const limit = Math.min(100, Math.max(1, args.limit ?? 40));
    return {
      events: events.slice(offset, offset + limit),
      total: events.length,
      hasMore: offset + limit < events.length,
      users: users.map((user) => ({ id: user.authUserId, name: user.name, role: user.role })).sort((a, b) => a.name.localeCompare(b.name)),
      roles: [...new Set(users.map((user) => user.role))].sort(),
    };
  },
});
