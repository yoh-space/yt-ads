import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { exceptionReason, orderPriority, orderStatus, unit } from "./schema";
import { requireAnyPermission, requirePermission } from "./users";
import { notifyRoles } from "./notificationHelpers";

const PUBLIC_TRACKING_STATUSES = new Set(["Received", "In Production", "Ready for Pickup", "Completed"]);

type OrderDoc = {
  _id: string;
  _creationTime: number;
  code: string;
  clientName: string;
  phone: string;
  serviceType: string;
  dimensions: string;
  quantity: string;
  amount?: number;
  fileStorageId?: string;
  fileName?: string;
  preferredDueDate: number;
  status: "Received" | "In Production" | "Ready for Pickup" | "Completed";
  priority: "High" | "Medium" | "Low";
  source: "public_portal" | "walk_in";
  notes?: string;
  machineId?: string;
  jobCardId?: string;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
  overdueInquiryAt?: number;
  lastOverdueNotifiedAt?: number;
};

function normalizePhone(phone: string) {
  return phone.replace(/[^+\d]/g, "").trim();
}

function publicOrder(order: OrderDoc) {
  return {
    id: order._id,
    code: order.code,
    clientName: order.clientName,
    serviceType: order.serviceType,
    dimensions: order.dimensions,
    quantity: order.quantity,
    preferredDueDate: order.preferredDueDate,
    status: order.status,
    priority: order.priority,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    overdue: order.status !== "Completed" && order.preferredDueDate < Date.now(),
  };
}

async function notifyOrderRoles(ctx: any, input: Parameters<typeof notifyRoles>[2]) {
  await notifyRoles(ctx, ["owner", "manager", "admin"], input);
}

export const publicInfo = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("companySettings").withIndex("by_key", (q) => q.eq("key", "yt-advertisement")).unique();
    return settings ? { companyName: settings.companyName, address: settings.address, phone: settings.phone, logoUrl: settings.logoUrl } : { companyName: "YT Advertisement", address: "Jemo Kafdem Building, Addis Ababa", phone: undefined, logoUrl: undefined };
  },
});

export const submit = mutation({
  args: {
    clientName: v.string(),
    phone: v.string(),
    serviceType: v.string(),
    dimensions: v.string(),
    quantity: v.string(),
    preferredDueDate: v.number(),
    priority: v.optional(orderPriority),
    notes: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clientName = args.clientName.trim();
    const phone = normalizePhone(args.phone);
    const serviceType = args.serviceType.trim();
    const dimensions = args.dimensions.trim();
    const quantity = args.quantity.trim();
    if (!clientName || !phone || !serviceType || !dimensions || !quantity) {
      throw new Error("Client, phone, service, dimensions, and quantity are required.");
    }
    if (!/^\+?[\d ]{7,18}$/.test(phone)) throw new Error("Enter a valid phone number.");
    if (!Number.isFinite(args.preferredDueDate) || args.preferredDueDate < Date.now() - 60_000) {
      throw new Error("Preferred due date must be in the future.");
    }

    const identity = await authComponent.safeGetAuthUser(ctx);
    const code = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const now = Date.now();
    const id = await ctx.db.insert("customerOrders", {
      code,
      clientName,
      phone,
      serviceType,
      dimensions,
      quantity,
      preferredDueDate: args.preferredDueDate,
      status: "Received",
      priority: args.priority ?? "Medium",
      source: "public_portal",
      notes: args.notes?.trim() || undefined,
      fileStorageId: args.fileStorageId,
      fileName: args.fileName?.trim() || undefined,
      createdBy: identity?._id,
      createdAt: now,
      updatedAt: now,
    });
    await notifyOrderRoles(ctx, {
      title: "New customer order received",
      message: `${code} · ${clientName} requested ${serviceType}.`,
      type: "order_received",
      actorAuthUserId: identity?._id,
      relatedTable: "customerOrders",
      relatedId: id,
    });
    return { code, order: publicOrder((await ctx.db.get(id)) as OrderDoc) };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

/** Internal walk-in order creation (management roles). */
export const createWalkIn = mutation({
  args: {
    clientName: v.string(),
    phone: v.string(),
    serviceType: v.string(),
    dimensions: v.string(),
    quantity: v.string(),
    amount: v.optional(v.number()),
    preferredDueDate: v.number(),
    priority: v.optional(orderPriority),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "order.create");
    const clientName = args.clientName.trim();
    const phone = normalizePhone(args.phone);
    const serviceType = args.serviceType.trim();
    const dimensions = args.dimensions.trim();
    const quantity = args.quantity.trim();
    if (!clientName || !phone || !serviceType || !dimensions || !quantity) {
      throw new Error("Client, phone, service, dimensions, and quantity are required.");
    }
    if (!/^\+?[\d ]{7,18}$/.test(phone)) throw new Error("Enter a valid phone number.");
    if (!Number.isFinite(args.preferredDueDate) || args.preferredDueDate < Date.now() - 60_000) {
      throw new Error("Preferred due date must be in the future.");
    }
    if (args.amount !== undefined && (!Number.isFinite(args.amount) || args.amount < 0)) {
      throw new Error("Order value must be zero or greater.");
    }

    const code = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const now = Date.now();
    const id = await ctx.db.insert("customerOrders", {
      code,
      clientName,
      phone,
      serviceType,
      dimensions,
      quantity,
      amount: args.amount === undefined ? undefined : Number(args.amount.toFixed(2)),
      preferredDueDate: args.preferredDueDate,
      status: "Received",
      priority: args.priority ?? "Medium",
      source: "walk_in",
      notes: args.notes?.trim() || undefined,
      createdBy: identity._id,
      createdAt: now,
      updatedAt: now,
    });
    await notifyOrderRoles(ctx, {
      title: "New walk-in order created",
      message: `${code} · ${clientName} requested ${serviceType}.`,
      type: "order_received",
      actorAuthUserId: identity._id,
      relatedTable: "customerOrders",
      relatedId: id,
    });
    return { code, order: publicOrder((await ctx.db.get(id)) as OrderDoc) };
  },
});

export const track = query({
  args: { lookup: v.string() },
  handler: async (ctx, args) => {
    const lookup = args.lookup.trim();
    if (!lookup) return [];
    const byCode = lookup.toUpperCase().startsWith("ORD-")
      ? await ctx.db.query("customerOrders").withIndex("by_code", (q) => q.eq("code", lookup.toUpperCase())).collect()
      : [];
    const byPhone = byCode.length > 0
      ? []
      : await ctx.db.query("customerOrders").withIndex("by_phone", (q) => q.eq("phone", normalizePhone(lookup))).collect();
    return [...byCode, ...byPhone]
      .filter((order) => PUBLIC_TRACKING_STATUSES.has(order.status))
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 10)
      .map(publicOrder);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "order.view");
    const orders = await ctx.db.query("customerOrders").withIndex("by_due_date").collect();
    const machines = await ctx.db.query("machines").collect();
    const machineNames = new Map(machines.map((machine) => [machine._id, machine.name]));
    const ordered = [...orders].sort((left, right) => {
      const rank = { High: 0, Medium: 1, Low: 2 } as const;
      return rank[left.priority] - rank[right.priority] || left.preferredDueDate - right.preferredDueDate;
    });
    return Promise.all(ordered.map(async (order) => ({
      ...order,
      machineName: order.machineId ? machineNames.get(order.machineId) : undefined,
      overdue: order.status !== "Completed" && order.preferredDueDate < Date.now(),
      fileUrl: order.fileStorageId ? await ctx.storage.getUrl(order.fileStorageId) : undefined,
    })));
  },
});

export const setStatus = mutation({
  args: { orderId: v.id("customerOrders"), status: orderStatus },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "order.manage");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    if (order.status === "Completed" && args.status !== "Completed") throw new Error("Completed orders cannot move backwards.");
    await ctx.db.patch(args.orderId, { status: args.status, updatedAt: Date.now() });
    if (order.jobCardId && (args.status === "In Production" || args.status === "Completed")) {
      const jobStatus = args.status === "In Production" ? "In production" : "Completed";
      await ctx.db.patch(order.jobCardId, { status: jobStatus });
    }
    await notifyOrderRoles(ctx, {
      title: "Order status updated",
      message: `${order.code} · ${order.clientName} is now ${args.status}.`,
      type: "order_status",
      actorAuthUserId: identity._id,
      relatedTable: "customerOrders",
      relatedId: args.orderId,
    });
  },
});

export const convertToJob = mutation({
  args: {
    orderId: v.id("customerOrders"),
    machineId: v.id("machines"),
    materialId: v.id("materials"),
    quantity: v.number(),
    unit,
    priority: v.optional(orderPriority),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "order.manage");
    const order = await ctx.db.get(args.orderId);
    const machine = await ctx.db.get(args.machineId);
    const material = await ctx.db.get(args.materialId);
    if (!order || !machine || !material || !machine.active || !material.active) throw new Error("Order, machine, or material is unavailable.");
    if (order.jobCardId) throw new Error("This order already has a job card.");
    if (!Number.isFinite(args.quantity) || args.quantity <= 0) throw new Error("Planned material quantity must be greater than zero.");
    if (args.unit !== (material.baseUnit ?? material.unit)) throw new Error("Job unit must match the selected material base unit.");
    if (machine.status === "Maintenance" || machine.status === "Unavailable") {
      return { success: false as const, error: `${machine.name} is currently ${machine.status.toLowerCase()} and cannot accept new jobs.` };
    }
    if (args.quantity > material.quantity) {
      return { success: false as const, error: `Stock shortfall — ${material.name} has ${material.quantity} ${material.baseUnit ?? material.unit} available but ${args.quantity} ${args.unit} is required.` };
    }

    const code = `JC-${String(430 + Math.floor(Math.random() * 500)).padStart(4, "0")}`;
    const jobId = await ctx.db.insert("jobCards", {
      code,
      client: order.clientName,
      title: order.serviceType,
      machineId: args.machineId,
      materialId: args.materialId,
      quantity: args.quantity,
      unit: args.unit,
      status: "Queued",
      due: new Date(order.preferredDueDate).toLocaleString("en-ET", { dateStyle: "medium", timeStyle: "short" }),
      priority: args.priority === "Low" ? "Normal" : args.priority ?? "Normal",
      createdBy: identity._id,
      createdAt: Date.now(),
      orderId: args.orderId,
    });
    await ctx.db.patch(args.orderId, { jobCardId: jobId, machineId: args.machineId, updatedAt: Date.now() });
    if (machine.status !== "Running") await ctx.db.patch(machine._id, { status: "Running", activeJob: code });
    await notifyRoles(ctx, [machine.operatorRole, "owner", "manager", "admin"], {
      title: "Order converted to job card",
      message: `${order.code} is now ${code} on ${machine.name}.`,
      type: "order_status",
      actorAuthUserId: identity._id,
      relatedTable: "customerOrders",
      relatedId: args.orderId,
    });
    return { success: true as const, jobId, code };
  },
});

export const requestOverdueInquiry = mutation({
  args: { orderId: v.id("customerOrders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    if (order.status === "Completed" || order.preferredDueDate >= Date.now()) throw new Error("This order is not overdue.");
    const now = Date.now();
    if (!order.overdueInquiryAt || now - order.overdueInquiryAt > 60 * 60 * 1000) {
      await notifyOrderRoles(ctx, {
        title: "Customer requested an overdue update",
        message: `${order.code} · ${order.clientName} is requesting an update for an overdue order.`,
        type: "overdue_order",
        relatedTable: "customerOrders",
        relatedId: args.orderId,
      });
      await ctx.db.patch(args.orderId, { overdueInquiryAt: now, updatedAt: now });
    }
    return { acknowledged: true };
  },
});

export const notifyOverdue = mutation({
  args: {},
  handler: async (ctx) => {
    const { identity } = await requirePermission(ctx, "order.manage");
    const now = Date.now();
    const overdue = (await ctx.db.query("customerOrders").withIndex("by_due_date").collect()).filter(
      (order) => order.status !== "Completed" && order.preferredDueDate < now,
    );
    let notified = 0;
    for (const order of overdue) {
      if (order.lastOverdueNotifiedAt && now - order.lastOverdueNotifiedAt < 24 * 60 * 60 * 1000) continue;
      await notifyOrderRoles(ctx, {
        title: "Overdue order alert",
        message: `${order.code} · ${order.clientName} passed its due date.`,
        type: "overdue_order",
        actorAuthUserId: identity._id,
        relatedTable: "customerOrders",
        relatedId: order._id,
      });
      await ctx.db.patch(order._id, { lastOverdueNotifiedAt: now });
      notified += 1;
    }
    return { notified };
  },
});

export const notifyOverdueInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const overdue = (await ctx.db.query("customerOrders").withIndex("by_due_date").collect()).filter(
      (order) => order.status !== "Completed" && order.preferredDueDate < now,
    );
    let notified = 0;
    for (const order of overdue) {
      if (order.lastOverdueNotifiedAt && now - order.lastOverdueNotifiedAt < 24 * 60 * 60 * 1000) continue;
      await notifyOrderRoles(ctx, {
        title: "Overdue order alert",
        message: `${order.code} · ${order.clientName} passed its due date.`,
        type: "overdue_order",
        relatedTable: "customerOrders",
        relatedId: order._id,
      });
      await ctx.db.patch(order._id, { lastOverdueNotifiedAt: now });
      notified += 1;
    }
    return { notified };
  },
});

export const recordExceptionStockOut = mutation({
  args: {
    materialId: v.id("materials"),
    quantity: v.number(),
    unit,
    reason: exceptionReason,
    authorizationNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireAnyPermission(ctx, ["stock.exception"]);
    const material = await ctx.db.get(args.materialId);
    if (!material || !material.active) throw new Error("Active material not found.");
    const baseUnit = material.baseUnit ?? material.unit;
    if (args.unit !== baseUnit) throw new Error(`Direct exception stock-out must use the material base unit (${baseUnit}).`);
    if (!Number.isFinite(args.quantity) || args.quantity <= 0) throw new Error("Exception quantity must be greater than zero.");
    if (args.quantity > material.quantity) throw new Error(`Insufficient ${material.name} stock for this exception.`);
    const now = Date.now();
    const nextQuantity = Number((material.quantity - args.quantity).toFixed(2));
    const exceptionId = await ctx.db.insert("stockExceptions", {
      materialId: args.materialId,
      quantity: args.quantity,
      unit: args.unit,
      baseQuantity: args.quantity,
      reason: args.reason,
      authorizationNote: args.authorizationNote?.trim() || undefined,
      createdBy: identity._id,
      createdAt: now,
    });
    await ctx.db.patch(args.materialId, { quantity: nextQuantity });
    await ctx.db.insert("stockMovements", {
      materialId: args.materialId,
      direction: "out",
      quantity: args.quantity,
      unit: args.unit,
      baseUnit,
      baseQuantity: args.quantity,
      movementType: "EXCEPTION_STOCK_OUT",
      exceptionReason: args.reason,
      note: `Direct exception stock-out · ${args.reason}${args.authorizationNote ? ` · ${args.authorizationNote.trim()}` : ""}`,
      createdBy: identity._id,
      createdAt: now,
    });
    await notifyRoles(ctx, ["owner", "manager"], {
      title: "Direct exception stock-out recorded",
      message: `${material.name} · ${args.quantity} ${baseUnit} · ${args.reason}.`,
      type: "exception_stock_out",
      actorAuthUserId: identity._id,
      relatedTable: "stockExceptions",
      relatedId: exceptionId,
    });
    return { exceptionId, remainingQuantity: nextQuantity, unit: baseUnit };
  },
});

export const listExceptions = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "audit.view");
    const [exceptions, materials] = await Promise.all([
      ctx.db.query("stockExceptions").withIndex("by_created").collect(),
      ctx.db.query("materials").collect(),
    ]);
    const materialNames = new Map(materials.map((material) => [material._id, material.name]));
    return exceptions
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((entry) => ({ ...entry, materialName: materialNames.get(entry.materialId) ?? "Unknown material" }));
  },
});
