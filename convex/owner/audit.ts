import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOwner } from "../users";

/** Human-readable labels for system configuration field names. */
const CONFIG_FIELD_LABELS: Record<string, string> = {
  etbPerSquareMetre: "ETB rate per m²",
  etbPerLitre: "ETB rate per litre (ink)",
  etbPerPiece: "ETB rate per piece (hardware)",
  etbPerMetre: "ETB rate per metre",
  etbPerSheet: "ETB rate per sheet",
  inkMlPerSquareMetre: "Ink consumption rate (mL/m²)",
  maxAllowedWastePercent: "Max allowed waste %",
  minOffcutAreaSquareMetre: "Min offcut size (m²)",
  requireAdminPinForExceptions: "Require admin PIN for exceptions",
  maxDirectStockOutEtb: "Max direct stock-out value (ETB)",
  orderExpirationHours: "Order expiration window (hours)",
  defaultScrapAllowancePercent: "Default scrap allowance %",
  defaultMarginSquareMetres: "Default bleed/trim margin (m²)",
  standardWasteMargin: "Standard waste margin %",
  maxAllowedScrapLimit: "Max approved scrap ceiling %",
  defaultReorderLevel: "Default reorder level",
  reorderAlertsEnabled: "Low-stock alerts enabled",
  reorderAlertCooldownHours: "Alert cooldown (hours)",
  unitConversionDefaults: "Unit conversion defaults",
  materialOverrides: "Per-material ETB price overrides",
  materialScrapAllowances: "Per-material scrap allowances",
};

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
    const orderById = new Map(orders.map((o) => [o._id, o]));

    /** Resolve an auth user ID to a display name. */
    const userName = (authId: string | undefined) =>
      authId ? (userByAuth.get(authId)?.name ?? authId) : undefined;

    /**
     * Strip internal noise fields and replace every known ID field with its
     * resolved human name so the owner never sees a raw Convex document ID.
     */
    function resolvePayload(doc: Record<string, unknown>): Record<string, unknown> {
      const OMIT = new Set([
        "_id", "_creationTime",
        // raw ID fields — replaced below with resolved names
        "materialId", "machineId", "jobCardId", "orderId",
        "parentInventoryId", "operatorSubStockId", "materialRequestId",
        "offcutId", "reconciliationId", "materialReconciliationId",
        "operatorId", "createdBy", "countedBy", "reviewedBy",
        "actorAuthUserId", "updatedBy", "approvedBy",
        "paymentConfirmedBy",
      ]);

      const out: Record<string, unknown> = {};

      for (const [k, v] of Object.entries(doc)) {
        if (OMIT.has(k)) continue;
        // humanise the changedFields array for config events
        if (k === "changedFields" && Array.isArray(v)) {
          out[k] = (v as string[]).map(
            (f) => CONFIG_FIELD_LABELS[f] ?? f.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim()
          );
          continue;
        }
        out[k] = v;
      }

      // Resolve IDs → names and add them back under friendly keys
      const raw = doc as Record<string, string | undefined>;
      const matName = raw.materialId ? (materialById.get(raw.materialId as never)?.name) : undefined;
      const macName = raw.machineId ? (machineById.get(raw.machineId as never)?.name) : undefined;
      const jobCode = raw.jobCardId ? (jobById.get(raw.jobCardId as never)?.code) : undefined;
      const orderCode = raw.orderId ? (orderById.get(raw.orderId as never)?.code) : undefined;
      const recordedBy = raw.createdBy ? userName(raw.createdBy) : undefined;
      const operatorName = raw.operatorId ? userName(raw.operatorId) : undefined;
      const countedByName = raw.countedBy ? userName(raw.countedBy) : undefined;
      const reviewedByName = raw.reviewedBy ? userName(raw.reviewedBy) : undefined;
      const actorName = raw.actorAuthUserId ? userName(raw.actorAuthUserId) : undefined;
      const updatedByName = raw.updatedBy ? userName(raw.updatedBy) : undefined;
      const approvedByName = raw.approvedBy ? userName(raw.approvedBy) : undefined;
      const confirmedByName = raw.paymentConfirmedBy ? userName(raw.paymentConfirmedBy) : undefined;

      if (matName) out["material"] = matName;
      if (macName) out["machine"] = macName;
      if (jobCode) out["jobCard"] = jobCode;
      if (orderCode) out["order"] = orderCode;
      if (recordedBy) out["recordedBy"] = recordedBy;
      if (operatorName) out["operator"] = operatorName;
      if (countedByName) out["countedBy"] = countedByName;
      if (reviewedByName) out["reviewedBy"] = reviewedByName;
      if (actorName) out["performedBy"] = actorName;
      if (updatedByName) out["updatedBy"] = updatedByName;
      if (approvedByName) out["approvedBy"] = approvedByName;
      if (confirmedByName) out["paymentConfirmedBy"] = confirmedByName;

      // parentInventoryId / operatorSubStockId have no name — just drop them
      return out;
    }

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
      resolvedPayload: Record<string, unknown>;
    };
    const events: Event[] = [];
    const add = (event: Event) => { if (matches(event, args)) events.push(event); };
    const actorProfile = (id: string) => userByAuth.get(id);
    const eventBase = (
      id: string, category: string, action: string, actorId: string,
      at: number, summary: string, detail: string, severity: Event["severity"],
      associated: Event["associated"], payload: Record<string, unknown>
    ): Event => {
      const profile = actorProfile(actorId);
      return {
        id, category, action, actorId,
        actorName: profile?.name ?? (actorId || "Public client"),
        actorRole: profile?.role ?? "public",
        at,
        searchText: `${category} ${action} ${summary} ${detail} ${JSON.stringify(payload)}`,
        summary, detail, severity, associated,
        resolvedPayload: resolvePayload(payload),
      };
    };

    for (const movement of stockMovements) {
      const material = materialById.get(movement.materialId);
      const severity = movement.eventType.includes("EXCEPTION") || movement.eventType.includes("RECONCILIATION") ? "critical" : movement.eventType.includes("SCRAP") ? "warning" : "normal";
      add(eventBase(`movement-${movement._id}`, movement.eventType.includes("EXCEPTION") ? "Exception Overrides" : "Stock Movement", movement.eventType.replaceAll("_", " "), movement.createdBy, movement.createdAt, `${material?.name ?? "Material"} · ${movement.baseQuantity} ${movement.baseUnit}`, movement.note || "Inventory movement recorded", severity, { materialId: movement.materialId as string, machineId: movement.machineId as string | undefined, jobCardId: movement.jobCardId as string | undefined }, movement as unknown as Record<string, unknown>));
    }
    for (const job of jobs) {
      add(eventBase(`job-${job._id}`, "Job Processing", `Job ${job.status.replaceAll("_", " ")}`, job.createdBy, job.createdAt, `${job.code} · ${job.client}`, `${job.title} · ${job.quantity} ${job.unit}`, "normal", { jobCardId: job._id as string, machineId: job.machineId as string }, job as unknown as Record<string, unknown>));
    }
    for (const log of productionLogs) {
      const job = jobById.get(log.jobCardId);
      add(eventBase(`production-${log._id}`, "Job Processing", "Production recorded", log.operatorId, log.createdAt, `${job?.code ?? "Production"} · ${machineById.get(log.machineId)?.name ?? "Machine"}`, `Input ${log.inputQuantity} ${log.unit} · Output ${log.outputQuantity} ${log.unit} · Waste ${log.wasteQuantity} ${log.unit}`, log.wasteQuantity > log.inputQuantity * 0.2 ? "warning" : "normal", { jobCardId: log.jobCardId as string, machineId: log.machineId as string }, log as unknown as Record<string, unknown>));
    }
    for (const order of orders) {
      add(eventBase(`order-${order._id}`, "Order Management", `Order ${order.status.replaceAll("_", " ")}`, order.createdBy ?? "", order.updatedAt, `${order.code} · ${order.clientName}`, `${order.serviceType} · ${order.amount ? `ETB ${order.amount}` : "No amount"}`, "normal", { orderId: order._id as string, jobCardId: order.jobCardId as string | undefined, machineId: order.machineId as string | undefined }, order as unknown as Record<string, unknown>));
    }
    for (const offcut of offcuts) {
      add(eventBase(`offcut-${offcut._id}`, "Stock Movement", "Offcut recorded", offcut.createdBy, new Date(offcut.createdAt).getTime(), `${offcut.label} · ${offcut.area} m²`, `${offcut.location} · ${offcut.status}`, "normal", { machineId: offcut.machineId as string | undefined, jobCardId: offcut.jobCardId as string | undefined }, offcut as unknown as Record<string, unknown>));
    }
    for (const reconciliation of reconciliations) {
      const profile = actorProfile(reconciliation.countedBy);
      add(eventBase(`reconciliation-${reconciliation._id}`, "Reconciliation", `Reconciliation ${reconciliation.status}`, reconciliation.countedBy, reconciliation.createdAt, `${materialById.get(reconciliation.materialId)?.name ?? "Material"} · variance ${reconciliation.variance}`, reconciliation.note ?? "Reconciliation recorded", reconciliation.variance < 0 ? "critical" : "warning", { materialId: reconciliation.materialId as string }, { ...reconciliation, actorRole: profile?.role } as unknown as Record<string, unknown>));
    }
    for (const change of changes) {
      const humanFields = change.changedFields.map((f) => CONFIG_FIELD_LABELS[f] ?? f.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim());
      add(eventBase(`config-${change._id}`, "System Configuration", "Configuration changed", change.actorAuthUserId, change.createdAt, change.configKey, change.reason ?? humanFields.join(", "), "normal", {}, change as unknown as Record<string, unknown>));
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
