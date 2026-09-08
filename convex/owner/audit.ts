import { query } from "../_generated/server";
import { requireOwner } from "../users";

/**
 * Activity timeline for the owner audit-logs page. Aggregates the canonical
 * stock, job, production, order, and offcut streams into one reverse-chronological
 * list with a compact shape.
 */
export const getAuditSummary = query({
  handler: async (ctx) => {
    await requireOwner(ctx);
    const [users, materials, machines, jobs, productionLogs, stockMovements, offcuts, orders] =
      await Promise.all([
        ctx.db.query("users").collect(),
        ctx.db.query("materials").collect(),
        ctx.db.query("machines").collect(),
        ctx.db.query("jobCards").collect(),
        ctx.db.query("productionLogs").collect(),
        ctx.db.query("stock_movements").collect(),
        ctx.db.query("offcuts").collect(),
        ctx.db.query("customerOrders").collect(),
      ]);
    const userNames = new Map(users.map((u) => [u.authUserId, u.name]));
    const materialNames = new Map(materials.map((m) => [m._id, m.name]));
    const machineNames = new Map(machines.map((m) => [m._id, m.name]));
    const jobMap = new Map(jobs.map((j) => [j._id, j]));

    const events: Array<{ id: string; action: string; actorName: string; at: number; summary: string; detail: string }> = [];

    for (const movement of stockMovements) {
      events.push({
        id: `movement-${movement._id}`,
        action: "Stock movement",
        actorName: userNames.get(movement.createdBy) ?? movement.createdBy,
        at: movement.createdAt,
        summary: `${materialNames.get(movement.materialId) ?? "Material"} · ${movement.baseQuantity} ${movement.baseUnit}`,
        detail: `${movement.eventType}${movement.note ? ` — ${movement.note}` : ""}`,
      });
    }
    for (const job of jobs) {
      events.push({
        id: `job-${job._id}`,
        action: "Job card",
        actorName: userNames.get(job.createdBy) ?? job.createdBy,
        at: job.createdAt,
        summary: `${job.code} · ${job.client}`,
        detail: `${job.title} · ${job.status}`,
      });
    }
    for (const log of productionLogs) {
      events.push({
        id: `production-${log._id}`,
        action: "Production recorded",
        actorName: userNames.get(log.operatorId) ?? log.operatorId,
        at: log.createdAt,
        summary: `${jobMap.get(log.jobCardId)?.code ?? "Production"} · ${machineNames.get(log.machineId) ?? "Machine"}`,
        detail: `Input ${log.inputQuantity} ${log.unit} · Output ${log.outputQuantity} ${log.unit} · Waste ${log.wasteQuantity} ${log.unit}`,
      });
    }
    for (const order of orders) {
      events.push({
        id: `order-${order._id}`,
        action: `Order ${order.status}`,
        actorName: userNames.get(order.createdBy ?? "") ?? "Public client",
        at: order.updatedAt,
        summary: `${order.code} · ${order.clientName}`,
        detail: `${order.serviceType} · ${order.amount ? `ETB ${order.amount}` : "no amount"}`,
      });
    }
    for (const offcut of offcuts) {
      const offcutAt = new Date(offcut.createdAt).getTime();
      events.push({
        id: `offcut-${offcut._id}`,
        action: "Offcut recorded",
        actorName: userNames.get(offcut.createdBy) ?? offcut.createdBy,
        at: Number.isNaN(offcutAt) ? 0 : offcutAt,
        summary: `${offcut.label} · ${offcut.area} m²`,
        detail: `${offcut.location} · ${offcut.status}`,
      });
    }

    return events.sort((a, b) => b.at - a.at).slice(0, 200);
  },
});