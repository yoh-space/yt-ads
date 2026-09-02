import { internalMutation, internalAction, mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { exceptionReason, orderPriority, orderStatus, paymentStatus, unit } from "./schema";
import { requireAnyPermission, requirePermission } from "./users";
import { canViewFinancial } from "./authorization";
import { notifyRoles } from "./notificationHelpers";
import { ensureSystemConfig } from "./systemConfigs";

/** Statuses a customer may see through public tracking (Expired stays internal). */
const PUBLIC_TRACKING_STATUSES = new Set(["PENDING_REVIEW", "PRICED_AND_PENDING_PAYMENT", "CONFIRMED_PAID_OR_CREDIT", "JOB_CARD_CREATED", "IN_PRODUCTION", "COMPLETED", "READY_FOR_PICKUP"]);

/**
 * Allowed forward transitions for manual status updates. The payment-gated
 * stages are driven by `priceOrder` / `confirmOrderAndIssueJobCard`; this map
 * only guards reception's manual progress actions.
 */
const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING_REVIEW: ["PRICED_AND_PENDING_PAYMENT", "Expired"],
  PRICED_AND_PENDING_PAYMENT: ["CONFIRMED_PAID_OR_CREDIT", "Expired"],
  CONFIRMED_PAID_OR_CREDIT: ["JOB_CARD_CREATED"],
  JOB_CARD_CREATED: ["IN_PRODUCTION"],
  IN_PRODUCTION: ["COMPLETED"],
  COMPLETED: ["READY_FOR_PICKUP"],
  READY_FOR_PICKUP: [],
  Expired: [],
};
// convex/orders.ts

export const fixStatusCasing = mutation({
  args: {},
  handler: async (ctx) => {
    const orders = await ctx.db.query("customerOrders").collect();
    for (const order of orders) {
      if ((order.status as string) === "Completed") {
        await ctx.db.patch(order._id, { status: "COMPLETED" });
      }
    }
  },
});

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
  paymentStatus?: "UNPAID" | "PAID" | "APPROVED_CREDIT";
  paymentMethod?: string;
  paymentConfirmedAt?: number;
  paymentConfirmedBy?: string;
  fileStorageId?: string;
  fileName?: string;
  preferredDueDate: number;
  status: string;
  priority: "High" | "Medium" | "Low";
  source: "public_portal" | "walk_in";
  notes?: string;
  machineId?: string;
  jobCardId?: string;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  telegramChatId?: string;
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
    paymentStatus: order.paymentStatus,
    priority: order.priority,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    overdue: order.status !== "COMPLETED" && order.preferredDueDate < Date.now(),
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
    phone: v.optional(v.string()),
    telegramId: v.optional(v.string()),
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
    const serviceType = args.serviceType.trim();
    const dimensions = args.dimensions.trim();
    const quantity = args.quantity.trim();
    if (!clientName || !serviceType || !dimensions || !quantity) {
      throw new Error("Client, service, dimensions, and quantity are required.");
    }

    // The verified phone lives on the customer's Telegram profile; the manual
    // `phone` field only supports submissions from outside the Mini App.
    let phone: string;
    if (args.telegramId !== undefined && args.telegramId.trim() !== "") {
      const profile = await ctx.db
        .query("telegramUsers")
        .withIndex("by_telegram_id", (q) => q.eq("telegramId", args.telegramId!.trim()))
        .unique();
      if (!profile?.phone) {
        throw new Error("No phone number on file for this Telegram user. Send /start to the bot and share your contact first.");
      }
      phone = profile.phone;
    } else if (args.phone !== undefined && args.phone.trim() !== "") {
      phone = normalizePhone(args.phone);
    } else {
      throw new Error("A phone number is required.");
    }
    if (!/^\+?[\d ]{7,18}$/.test(phone)) throw new Error("Enter a valid phone number.");
    if (!Number.isFinite(args.preferredDueDate) || args.preferredDueDate < Date.now() - 60_000) {
      throw new Error("Preferred due date must be in the future.");
    }

    const identity = await authComponent.safeGetAuthUser(ctx);
    const code = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const now = Date.now();
    const systemConfig = await ensureSystemConfig(ctx, identity?._id);
    const expiresAt = now + (systemConfig.orderExpirationHours * 60 * 60 * 1000);
    const id = await ctx.db.insert("customerOrders", {
      code,
      clientName,
      phone,
      serviceType,
      dimensions,
      quantity,
      preferredDueDate: args.preferredDueDate,
      status: "PENDING_REVIEW",
      priority: args.priority ?? "Medium",
      source: "public_portal",
      notes: args.notes?.trim() || undefined,
      fileStorageId: args.fileStorageId,
      fileName: args.fileName?.trim() || undefined,
      createdBy: identity?._id,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      telegramChatId: args.telegramId,
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
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
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
    const systemConfig = await ensureSystemConfig(ctx, identity._id);
    const expiresAt = now + (systemConfig.orderExpirationHours * 60 * 60 * 1000);
    const id = await ctx.db.insert("customerOrders", {
      code,
      clientName,
      phone,
      serviceType,
      dimensions,
      quantity,
      amount: args.amount === undefined ? undefined : Number(args.amount.toFixed(2)),
      preferredDueDate: args.preferredDueDate,
      status: "PENDING_REVIEW",
      priority: args.priority ?? "Medium",
      source: "walk_in",
      notes: args.notes?.trim() || undefined,
      createdBy: identity._id,
      createdAt: now,
      updatedAt: now,
      expiresAt,
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
    const { profile } = await requirePermission(ctx, "order.view");
    const orders = await ctx.db.query("customerOrders").withIndex("by_due_date").collect();
    const machines = await ctx.db.query("machines").collect();
    const machineNames = new Map(machines.map((machine) => [machine._id, machine.name]));
    const ordered = [...orders].sort((left, right) => {
      const rank = { High: 0, Medium: 1, Low: 2 } as const;
      return rank[left.priority] - rank[right.priority] || left.preferredDueDate - right.preferredDueDate;
    });
    const canSeeFinancial = canViewFinancial(profile.role);
    return Promise.all(ordered.map(async (order) => ({
      ...order,
      amount: canSeeFinancial ? order.amount : undefined,
      machineName: order.machineId ? machineNames.get(order.machineId) : undefined,
      overdue: order.status !== "COMPLETED" && order.preferredDueDate < Date.now(),
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
    const allowed = ALLOWED_STATUS_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(args.status)) {
      throw new Error(`Orders cannot move from ${order.status} to ${args.status}.`);
    }
    if ((args.status === "JOB_CARD_CREATED" || args.status === "IN_PRODUCTION" || args.status === "COMPLETED") && !order.jobCardId) {
      throw new Error("A job card must be issued (payment confirmed) before an order can enter production stages.");
    }

    const previousStatus = order.status;
    await ctx.db.patch(args.orderId, { status: args.status, updatedAt: Date.now() });
    if (order.jobCardId && (args.status === "IN_PRODUCTION" || args.status === "COMPLETED")) {
      const jobStatus = args.status === "IN_PRODUCTION" ? "In production" : "Completed";
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
    
    if (order.telegramChatId && previousStatus !== args.status) {
      const systemConfig = await ensureSystemConfig(ctx, identity._id);
      let message = "";
      
      if (args.status === "IN_PRODUCTION") {
        message = `ማሳወቂያ 🖨️\n\nየትዕዛዝ ቁጥር #${order.code} ህትመት/ማዘጋጀት ስራ ላይ ይገኛል (In Production)።`;
      } else if (args.status === "COMPLETED") {
        message = `መልካም ዜና! 🎉\n\nየትዕዛዝ ቁጥር #${order.code} ስራ ሙሉ በሙሉ ተጠናቋል። መጥተው መረከብ ወይም በነጣቂ ማስወሰድ ይችላሉ። የደረሰኝ ቁጥር: #${order.code}። እናመሰግናለን!`;
      }
      
      if (message) {
        await ctx.scheduler.runAfter(0, internal.orders.sendTelegramNotificationInternal, {
          chatId: order.telegramChatId,
          message,
        });
      }
    }
  },
});

/**
 * Reception step 1 of checkout: records the final total price and moves the
 * order to PRICED_AND_PENDING_PAYMENT. Job card creation stays blocked until
 * `confirmOrderAndIssueJobCard` verifies payment.
 */
export const priceOrder = mutation({
  args: {
    orderId: v.id("customerOrders"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "order.manage");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    if (!["PENDING_REVIEW", "PRICED_AND_PENDING_PAYMENT"].includes(order.status)) {
      throw new Error(`Only orders awaiting review or payment can be priced (current status: ${order.status}).`);
    }
    if (!Number.isFinite(args.amount) || args.amount < 0) {
      throw new Error("Order price must be zero or greater.");
    }
    await ctx.db.patch(args.orderId, {
      amount: Number(args.amount.toFixed(2)),
      status: "PRICED_AND_PENDING_PAYMENT",
      updatedAt: Date.now(),
    });
    return { code: order.code, amount: Number(args.amount.toFixed(2)) };
  },
});

/**
 * Reception step 2 of checkout — the single payment-gated entry point to
 * production. Confirms advance payment (PAID) or approved credit
 * (APPROVED_CREDIT), creates the job card, and queues it on the selected
 * machine. Job card creation is impossible before this mutation runs, and it
 * additionally notifies the Telegram customer with their receipt when the
 * order carries a chat id.
 */
export const confirmOrderAndIssueJobCard = mutation({
  args: {
    orderId: v.id("customerOrders"),
    amount: v.optional(v.number()),
    paymentDecision: v.union(v.literal("PAID"), v.literal("APPROVED_CREDIT")),
    paymentMethod: v.optional(v.string()),
    machineId: v.id("machines"),
    materialId: v.id("materials"),
    quantity: v.number(),
    unit,
    priority: v.optional(orderPriority),
    deductOnComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "order.manage");
    const order = await ctx.db.get(args.orderId);
    const machine = await ctx.db.get(args.machineId);
    const material = await ctx.db.get(args.materialId);
    if (!order || !machine || !material || !machine.active || !material.active) {
      throw new Error("Order, machine, or material is unavailable.");
    }
    if (order.jobCardId) throw new Error("This order already has a job card.");
    if (!["PENDING_REVIEW", "PRICED_AND_PENDING_PAYMENT"].includes(order.status)) {
      throw new Error(`Only orders awaiting review or payment can be confirmed (current status: ${order.status}).`);
    }

    const amount = args.amount !== undefined ? args.amount : order.amount;
    if (amount === undefined || !Number.isFinite(amount) || amount < 0) {
      throw new Error("Confirm the final price before verifying payment.");
    }
    if (!Number.isFinite(args.quantity) || args.quantity <= 0) {
      throw new Error("Planned material quantity must be greater than zero.");
    }
    if (args.unit !== (material.baseUnit ?? material.unit)) {
      throw new Error("Job unit must match the selected material base unit.");
    }
    if (machine.status === "Maintenance" || machine.status === "Unavailable") {
      return { success: false as const, error: `${machine.name} is currently ${machine.status.toLowerCase()} and cannot accept new jobs.` };
    }
    if (args.quantity > material.quantity) {
      return { success: false as const, error: `Stock shortfall — ${material.name} has ${material.quantity} ${material.baseUnit ?? material.unit} available but ${args.quantity} ${args.unit} is required.` };
    }

    const now = Date.now();
    const roundedAmount = Number(amount.toFixed(2));
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
      createdAt: now,
      orderId: args.orderId,
      deductOnComplete: args.deductOnComplete,
    });
    await ctx.db.patch(args.orderId, {
      amount: roundedAmount,
      paymentStatus: args.paymentDecision,
      paymentMethod: args.paymentMethod?.trim() || undefined,
      paymentConfirmedAt: now,
      paymentConfirmedBy: identity._id,
      status: "JOB_CARD_CREATED",
      jobCardId: jobId,
      machineId: args.machineId,
      updatedAt: now,
    });
    if (machine.status !== "Running") await ctx.db.patch(machine._id, { status: "Running", activeJob: code });
    await notifyRoles(ctx, [machine.operatorRole, "owner", "manager", "admin"], {
      title: "Paid order issued to production",
      message: `${order.code} (${order.clientName}) is confirmed ${args.paymentDecision} and queued as ${code} on ${machine.name}.`,
      type: "order_status",
      actorAuthUserId: identity._id,
      relatedTable: "customerOrders",
      relatedId: args.orderId,
    });

    // Receipt to the Telegram customer: order id, receipt details, tracking link.
    if (order.telegramChatId) {
      const paymentLine = args.paymentDecision === "PAID" ? "ተከፍሏል ✅ (PAID)" : "ብዕር ደንበኛ ተገድዷል 📒 (APPROVED_CREDIT)";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
      const tracking = appUrl ? `\n\n📍 የትዕዛዝ ክትትል፦ ${appUrl}/track` : "";
      const message = [
        "✅ <b>ክፍያዎ ተረጋግጧል!</b>",
        "",
        `• የትዕዛዝ መለያ: <code>${order.code}</code>`,
        `• ጠቅላላ ዋጋ: <b>${roundedAmount.toFixed(2)} ብር</b>`,
        `• ክፍያ: ${paymentLine}`,
        `• የደረሰኝ ቁጥር: <code>${order.code}-${now}</code>`,
        `• ስራው በ${machine.name} ወደ ቅዝቃዜ ወረፋ ገብቷል።`,
        tracking,
      ].join("\n");
      await ctx.scheduler.runAfter(0, internal.orders.sendTelegramNotificationInternal, {
        chatId: order.telegramChatId,
        message,
      });
    }

    return { success: true as const, jobId, code, paymentStatus: args.paymentDecision };
  },
});

export const requestOverdueInquiry = mutation({
  args: { orderId: v.id("customerOrders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    if (order.status === "COMPLETED" || order.preferredDueDate >= Date.now()) throw new Error("This order is not overdue.");
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
      (order) => order.status !== "COMPLETED" && order.preferredDueDate < now,
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
      (order) => order.status !== "COMPLETED" && order.preferredDueDate < now,
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

export const createTelegramOrder = mutation({
  args: {
    telegramChatId: v.string(),
    customerName: v.string(),
    serviceType: v.string(),
    dimensions: v.optional(v.string()),
    quantity: v.optional(v.string()),
    phone: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const customerName = args.customerName.trim();
    const serviceType = args.serviceType.trim();
    if (!customerName || !serviceType) {
      throw new Error("Customer name and service type are required.");
    }
    const phone = args.phone?.trim();
    if (phone !== undefined && phone.trim() !== "" && !/^\+?[\d ]{7,18}$/.test(phone)) {
      throw new Error("Enter a valid phone number.");
    }

    const code = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const now = Date.now();
    const dueDate = now + 7 * 24 * 60 * 60 * 1000;
    const systemConfig = await ensureSystemConfig(ctx);
    const expiresAt = now + (systemConfig.orderExpirationHours * 60 * 60 * 1000);
    const noteParts = [`Telegram chat: ${args.telegramChatId}`];
    if (args.fileName?.trim()) noteParts.push(`Attached file: ${args.fileName.trim()}`);
    if (args.notes?.trim()) noteParts.push(args.notes.trim());

    const id = await ctx.db.insert("customerOrders", {
      code,
      clientName: customerName,
      phone: phone && phone.trim() !== "" ? phone.trim() : "telegram",
      serviceType,
      dimensions: args.dimensions?.trim() || "TBD",
      quantity: args.quantity?.trim() || "1",
      preferredDueDate: dueDate,
      status: "PENDING_REVIEW",
      priority: "Medium",
      source: "public_portal",
      notes: noteParts.join(" · "),
      fileStorageId: args.fileStorageId,
      fileName: args.fileName?.trim() || undefined,
      createdBy: undefined,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      telegramChatId: args.telegramChatId,
    });

    await notifyOrderRoles(ctx, {
      title: "New Telegram order received",
      message: `${code} · ${customerName} requested ${serviceType} via Telegram.`,
      type: "order_received",
      relatedTable: "customerOrders",
      relatedId: id,
    });

    return { code, orderId: id };
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

export const expireOrdersInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredOrders = await ctx.db
      .query("customerOrders")
      .withIndex("by_expires_at")
      .collect();
    
    const systemConfig = await ensureSystemConfig(ctx);
    let expiredCount = 0;
    
    for (const order of expiredOrders) {
      if (order.status === "Expired" || !order.expiresAt || order.expiresAt >= now) {
        continue;
      }
      
      await ctx.db.patch(order._id, { 
        status: "Expired", 
        updatedAt: now 
      });
      
      if (order.telegramChatId) {
        const message = `የሰጡት ትዕዛዝ በተቀመጠው የሰዓት ገደብ (${systemConfig.orderExpirationHours} ሰዓት) ውስጥ ክፍያ ስላልተፈጸመለት በሲስተሙ አውቶማቲክ ተሰርዟል። እባክዎን እንደገና ይዘዙ።`;
        
        await ctx.scheduler.runAfter(0, internal.orders.sendTelegramNotificationInternal, {
          chatId: order.telegramChatId,
          message,
        });
      }
      
      expiredCount++;
    }
    return { expiredCount };
  },
});

export const sendTelegramNotification = action({
  args: {
    chatId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.error("TELEGRAM_BOT_TOKEN is not configured");
      return { success: false };
    }
    
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: args.chatId,
          text: args.message,
          parse_mode: "HTML",
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error("Telegram notification failed:", error);
        return { success: false };
      }
      
      return { success: true };
    } catch (error) {
      console.error("Telegram notification error:", error);
      return { success: false };
    }
  },
});

export const sendTelegramNotificationInternal = internalMutation({
  args: {
    chatId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.error("TELEGRAM_BOT_TOKEN is not configured");
      return { success: false };
    }
    
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: args.chatId,
          text: args.message,
          parse_mode: "HTML",
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error("Telegram notification failed:", error);
        return { success: false };
      }
      
      return { success: true };
    } catch (error) {
      console.error("Telegram notification error:", error);
      return { success: false };
    }
  },
});
