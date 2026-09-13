import { internalMutation, internalAction, mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { Unit } from "./types";
import { authComponent } from "./auth";
import { exceptionReason, orderPriority, orderStatus, paymentStatus, unit, serviceType } from "./schema";
import { requireAnyPermission, requirePermission } from "./users";
import { notifyRoles } from "./notificationHelpers";
import { ensureSystemConfig, CONFIG_KEY } from "./systemConfigs";
import { DEFAULT_SYSTEM_CONFIG } from "./materialUsage";
import {
  compatibleMachines,
  computeStandardAllocation,
  selectMachineByLoad,
  type MaterialTypeRoute,
  type StandardAllocation,
} from "./orderAutomation";
import { recordInventoryEvent } from "./inventoryLedger";
import { verifyTelegramInitData } from "./telegramAuth";
import { loadActiveBomForService, resolveServiceRoute, resolveInkRequirements, resolveJobBOM } from "./bomResolver";
import { calculateOffCutAndScrap, type OffCutScrapResult } from "../src/shared/material-calc";
import { assertPaymentAmount, paymentBreakdown, snapshotPaymentInstructions, type PaymentInstructions } from "./payment";
import { validateServiceSpecifications } from "../src/shared/service-specifications";
import { resolveRollSubstrate, type RollResolution } from "../src/shared/roll-width";
import { normalizePhone as normalizePhoneUtil } from "../src/shared/phone-normalization";

/** Statuses a customer may see through public tracking (EXPIRED stays internal). */
const PUBLIC_TRACKING_STATUSES = new Set(["PENDING_REVIEW", "RECEPTION_REVIEW", "WAITING_FOR_MATERIAL", "PRICED_AND_PENDING_PAYMENT", "CONFIRMED_PAID_OR_CREDIT", "JOB_CARD_CREATED", "IN_PRODUCTION", "COMPLETED", "READY_FOR_PICKUP"]);

/**
 * Allowed forward transitions for manual status updates. The payment-gated
 * stages are driven by `priceOrder` / `confirmOrderAndIssueJobCard`; this map
 * only guards reception's manual progress actions.
 */
const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING_REVIEW: ["RECEPTION_REVIEW", "EXPIRED"],
  RECEPTION_REVIEW: ["PRICED_AND_PENDING_PAYMENT", "EXPIRED"],
  PRICED_AND_PENDING_PAYMENT: ["CONFIRMED_PAID_OR_CREDIT", "EXPIRED"],
  CONFIRMED_PAID_OR_CREDIT: ["JOB_CARD_CREATED"],
  JOB_CARD_CREATED: ["WAITING_FOR_MATERIAL", "IN_PRODUCTION"],
  WAITING_FOR_MATERIAL: ["IN_PRODUCTION"],
  IN_PRODUCTION: ["COMPLETED"],
  COMPLETED: ["READY_FOR_PICKUP"],
  READY_FOR_PICKUP: [],
  EXPIRED: [],
  EXPIRED_JUNK: [],
};

export function canTransitionOrderStatus(from: string, to: string): boolean {
  return (ALLOWED_STATUS_TRANSITIONS[from] ?? []).includes(to);
}
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
  serviceId?: string;
  specifications?: Record<string, string>;
  dimensions: string;
  length?: number;
  width?: number;
  quantity: string;
  amount?: number;
  paymentStatus?: "UNPAID" | "PARTIALLY_PAID" | "FULLY_PAID" | "PAID" | "APPROVED_CREDIT";
  advanceDueAmount?: number;
  advancePaidAmount?: number;
  remainingDueAmount?: number;
  paymentInstructionsSnapshot?: { version: number; capturedAt: number; accounts: Array<{ label: string; channel: string; name: string; identifier: string }> };
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
  tinNumber?: string;
  companyLegalName?: string;
  accountType?: "individual" | "corporate" | "government";
  editRevision?: number;
  customerEditLockedAt?: number;
  customerEditLockedBy?: string;
  reviewLockReason?: string;
  lastCustomerEditedAt?: number;
  lastCustomerEditedBy?: string;
};

function normalizePhone(phone: string) {
  return normalizePhoneUtil(phone) ?? phone.replace(/[^+\d]/g, "").trim();
}

function parseDimensions(dimensions: string): { length: number; width: number } | undefined {
  const match = dimensions.trim().match(/^([0-9]+(?:\.[0-9]{1,3})?)\s*m?\s*[x×]\s*([0-9]+(?:\.[0-9]{1,3})?)\s*m?$/i);
  if (!match) return undefined;
  const length = Number(match[1]);
  const width = Number(match[2]);
  return Number.isFinite(length) && length > 0 && Number.isFinite(width) && width > 0 ? { length, width } : undefined;
}

/**
 * Resolves the roll substrate from the job width and merges it into the
 * customer's validated specifications. This runs transactionally on the
 * backend so operators always receive the exact raw material the job consumes;
 * the customer never selects a roll. Returns the (possibly annotated)
 * specification record.
 */
function withDerivedRollSubstrate(
  serviceId: string,
  specifications: Record<string, string> | undefined,
  widthM: number | undefined,
): Record<string, string> | undefined {
  if (widthM === undefined || !Number.isFinite(widthM) || widthM <= 0) return specifications;
  const resolved: RollResolution | null = resolveRollSubstrate(serviceId, widthM);
  if (!resolved) return specifications;
  return { ...(specifications ?? {}), rollWidth: resolved.option };
}

function publicOrder(order: OrderDoc) {
     return {
    id: order._id,
    code: order.code,
    clientName: order.clientName,
    serviceType: order.serviceType,
    serviceId: order.serviceId ?? order.serviceType,
    specifications: order.specifications,
    dimensions: order.dimensions,
    quantity: order.quantity,
    preferredDueDate: order.preferredDueDate,
    status: order.status,
    paymentStatus: order.paymentStatus,
    amount: order.amount,
    advanceDueAmount: order.advanceDueAmount,
    advancePaidAmount: order.advancePaidAmount,
    remainingDueAmount: order.remainingDueAmount,
    paymentInstructionsSnapshot: order.paymentInstructionsSnapshot,
    priority: order.priority,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
      accountType: order.accountType,
      editRevision: order.editRevision,
      customerEditable: order.status === "PENDING_REVIEW" && !order.customerEditLockedAt,
      customerEditLockedAt: order.customerEditLockedAt,
      customerEditLockedBy: order.customerEditLockedBy,
      reviewLockReason: order.reviewLockReason,
      lastCustomerEditedAt: order.lastCustomerEditedAt,
      overdue: !["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"].includes(order.status) && order.preferredDueDate < Date.now(),
  };
}

async function notifyOrderRoles(ctx: any, input: Parameters<typeof notifyRoles>[2]) {
  await notifyRoles(ctx, ["owner", "manager", "admin"], input);
}

/**
 * Pushes a customer-facing status update over Telegram. STRICT GATE: this
 * helper fires ONLY when the receptionist (or scheduled system) drives the
 * order past PENDING_REVIEW — it never runs from the public/Mini App create
 * path. Centralising it here keeps the success/failure messaging consistent
 * regardless of which mutation performs the transition (priceOrder, confirm,
 * setStatus, scheduled expirations, etc.).
 */
const CUSTOMER_PUSH_STATUSES = new Set([
  "PRICED_AND_PENDING_PAYMENT",
  "JOB_CARD_CREATED",
  "IN_PRODUCTION",
  "COMPLETED",
  "READY_FOR_PICKUP",
]);

export interface CustomerStatusOrder {
  code: string;
  status: string;
  amount?: number;
  telegramChatId?: string;
  paymentStatus?: string;
  advanceDueAmount?: number;
  advancePaidAmount?: number;
  remainingDueAmount?: number;
  paymentInstructionsSnapshot?: PaymentInstructions;
}

/**
 * Builds the customer-facing Telegram status message for a given order state.
 * Pure and exported so the exact copy (amounts, half-payment, account numbers)
 * can be asserted in tests without a Convex context.
 */
export function buildCustomerStatusMessage(order: CustomerStatusOrder, tracking = ""): string {
  if (order.status === "PRICED_AND_PENDING_PAYMENT") {
    const paymentAccounts = order.paymentInstructionsSnapshot?.accounts ?? [];
    return (
      `💰 <b>የትዕዛዝ ዋጋ ተቀምጧል</b>\n\n` +
      `• የትዕዛዝ መለያ: <code>${order.code}</code>\n` +
      (order.amount !== undefined
        ? `• ጠቅላላ ዋጋ: <b>${order.amount.toFixed(2)} ብር</b>\n`
        : "") +
      (order.advanceDueAmount !== undefined
        ? `• የመጀመሪያ ክፍያ (50%): <b>${order.advanceDueAmount.toFixed(2)} ብር</b>\n`
        : "") +
      (order.remainingDueAmount !== undefined
        ? `• ቀሪ ክፍያ: <b>${order.remainingDueAmount.toFixed(2)} ብር</b>\n`
        : "") +
      (paymentAccounts.length
        ? `\n<b>የክፍያ መረጃ</b>\n${paymentAccounts.map((account) => `• ${account.label}: <code>${account.identifier}</code> (${account.name})`).join("\n")}\n`
        : "") +
      `\nእባክዎ ክፍያዎን ያረጋግጡ ወይም ወደ ሪሴፕሽን ይላኩ።${tracking}`
    );
  }
  if (order.status === "JOB_CARD_CREATED") {
    const paymentLine =
      order.paymentStatus === "APPROVED_CREDIT" || order.paymentStatus === "APPROVED"
        ? "ብዕር ደንበኛ ተገድዷል 📒 (APPROVED_CREDIT)"
        : "ተከፍሏል ✅ (PAID)";
    return (
      `✅ <b>የእርስዎ ትዕዛዝ ተረጋግጧል!</b>\n\n` +
      `• የትዕዛዝ መለያ: <code>${order.code}</code>\n` +
      (order.amount !== undefined
        ? `• ጠቅላላ ዋጋ: <b>${order.amount.toFixed(2)} ብር</b>\n`
        : "") +
      `• ክፍያ: ${paymentLine}\n` +
      `ስራው አሁን ወደ ምርት ሂደት ገብቷል።${tracking}`
    );
  }
  if (order.status === "IN_PRODUCTION") {
    return (
      `🖨️ <b>ህትመት ተጀምሯል</b>\n\n` +
      `• የትዕዛዝ መለያ: <code>${order.code}</code>\n` +
      `ስራው የማተራተር/የህትመት ሂደት ላይ ይገኛል።${tracking}`
    );
  }
  if (order.status === "COMPLETED") {
    return (
      `🎉 <b>ስራው ተጠናቋል!</b>\n\n` +
      `• የትዕዛዝ መለያ: <code>${order.code}</code>\n` +
      `የመጨረሻ ማጠናቀቂያ ተከናውኗል። ሲዘጋጅ የመረከቢያ ማሳወቂያ ይደርስዎታል።${tracking}`
    );
  }
  if (order.status === "READY_FOR_PICKUP") {
    return (
      `📦 <b>ትዕዛዝዎ ለመረከብ ዝግጁ ነው!</b>\n\n` +
      `• የትዕዛዝ መለያ: <code>${order.code}</code>\n` +
      (order.amount !== undefined ? `• ጠቅላላ: <b>${order.amount.toFixed(2)} ብር</b>\n• የተከፈለ: <b>${(order.advancePaidAmount ?? 0).toFixed(2)} ብር</b>\n• ቀሪ: <b>${(order.remainingDueAmount ?? 0).toFixed(2)} ብር</b>\n` : "") +
      (order.paymentInstructionsSnapshot?.accounts.length ? `\n<b>የክፍያ መረጃ</b>\n${order.paymentInstructionsSnapshot.accounts.map((account) => `• ${account.label}: <code>${account.identifier}</code> (${account.name})`).join("\n")}\n` : "") +
      `\nእባክዎ ቀሪውን ክፍያ በሪሴፕሽን ይክፈሉ ወይም በባንክ ያስተላልፉ።${tracking}`
    );
  }
  return "";
}

async function pushCustomerOrderStatus(
  ctx: { scheduler: { runAfter: (delay: number, fn: any, args: any) => Promise<unknown> } },
  order: CustomerStatusOrder,
  previousStatus: string,
) {
  if (!order.telegramChatId) return;
  if (!CUSTOMER_PUSH_STATUSES.has(order.status)) return;
  if (previousStatus === order.status) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const tracking = appUrl ? `\n\n📍 የትዕዛዝ ክትትል፦ ${appUrl}/track` : "";

  const message = buildCustomerStatusMessage(order, tracking);

  if (!message) return;
  await ctx.scheduler.runAfter(0, internal.orders.sendTelegramNotificationInternal, {
    chatId: order.telegramChatId,
    message,
  });
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
    telegramInitData: v.optional(v.string()),
    serviceType: serviceType,
    serviceId: v.optional(serviceType),
    specifications: v.optional(v.record(v.string(), v.string())),
    dimensions: v.string(),
    quantity: v.string(),
    length: v.optional(v.number()),
    width: v.optional(v.number()),
    preferredDueDate: v.number(),
    priority: v.optional(orderPriority),
    notes: v.optional(v.string()),
    accountType: v.optional(v.union(v.literal("individual"), v.literal("corporate"), v.literal("government"))),
    tinNumber: v.optional(v.string()),
    companyLegalName: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clientName = args.clientName.trim();
    const serviceTypeRaw = (args.serviceType as string).trim();
    const serviceType = serviceTypeRaw as typeof args.serviceType;
    const serviceId = (args.serviceId ?? serviceType) as string;
    const dimensions = args.dimensions.trim();
    const parsedDimensions = parseDimensions(dimensions);
    const orderWidth = args.width ?? parsedDimensions?.width;
    const specifications = withDerivedRollSubstrate(
      serviceId,
      validateServiceSpecifications(serviceId, args.specifications),
      orderWidth,
    );
    const quantity = args.quantity.trim();
    if (!clientName || clientName.length > 160 || !serviceType || !dimensions || !quantity) {
      throw new Error("Client, service, dimensions, and quantity are required.");
    }
    const dimensionMatch = dimensions.match(/^([0-9]+(?:\.[0-9]{1,2})?)m\s*x\s*([0-9]+(?:\.[0-9]{1,2})?)m$/i);
    if (!dimensionMatch || Number(dimensionMatch[1]) <= 0 || Number(dimensionMatch[2]) <= 0) {
      throw new Error("Dimensions must be positive width and height in meters.");
    }
    if (!/^[1-9]\d*$/.test(quantity) || Number(quantity) > 100000) {
      throw new Error("Quantity must be a positive whole number.");
    }
    const accountType = (args.accountType ?? "") as "" | "individual" | "corporate" | "government";
    const normalizedTin = args.tinNumber?.trim();
    const normalizedCompany = args.companyLegalName?.trim();
    if (accountType === "corporate" || accountType === "government") {
      if (!normalizedCompany || normalizedCompany.length < 2) {
        throw new Error("Company/legal name is required for Corporate and Government accounts.");
      }
      if (!normalizedTin || !/^\d{10}$/.test(normalizedTin)) {
        throw new Error("A valid 10-digit TIN number is required for Corporate and Government accounts.");
      }
    } else {
      if (normalizedTin && !/^\d{10}$/.test(normalizedTin)) {
        throw new Error("TIN must contain exactly 10 digits.");
      }
    }
    if (normalizedTin && !/^\d{10}$/.test(normalizedTin)) {
      throw new Error("TIN must contain exactly 10 digits.");
    }
    if (args.companyLegalName && args.companyLegalName.trim().length > 160) {
      throw new Error("Company name is too long.");
    }
    if (args.notes && args.notes.trim().length > 2000) {
      throw new Error("Notes are too long.");
    }

    // The verified phone lives on the customer's Telegram profile; the manual
    // `phone` field only supports submissions from outside the Mini App.
    let phone: string;
    let verifiedTelegramId: string | undefined;
    if (args.telegramId !== undefined && args.telegramId.trim() !== "") {
      if (!args.telegramInitData) throw new Error("A verified Telegram session is required.");
      const verified = await verifyTelegramInitData(args.telegramInitData);
      verifiedTelegramId = verified.telegramId;
      if (verifiedTelegramId !== args.telegramId.trim()) throw new Error("Telegram identity mismatch.");
      const profile = await ctx.db
        .query("telegramUsers")
        .withIndex("by_telegram_id", (q) => q.eq("telegramId", verifiedTelegramId!))
        .unique();
      if (!profile?.phone) {
        throw new Error("No phone number on file for this Telegram user. Send /start to the bot and share your contact first.");
      }
      phone = profile.phone;
      await ctx.db.patch(profile._id, { verifiedAt: Date.now(), updatedAt: Date.now() });
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
      serviceId: serviceId as typeof serviceType,
      specifications,
      length: args.length ?? parsedDimensions?.length,
      width: args.width ?? parsedDimensions?.width,
      quantity,
      preferredDueDate: args.preferredDueDate,
      status: "PENDING_REVIEW",
      priority: args.priority ?? "Medium",
      source: "public_portal",
      notes: args.notes?.trim() || undefined,
      accountType: accountType || undefined,
      tinNumber: accountType === "individual" ? undefined : normalizedTin || undefined,
      companyLegalName: accountType === "individual" ? undefined : normalizedCompany || undefined,
      editRevision: 1,
      fileStorageId: args.fileStorageId,
      fileName: args.fileName?.trim() || undefined,
      createdBy: identity?._id,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      telegramChatId: verifiedTelegramId,
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

const accountTypeValidator = v.union(v.literal("individual"), v.literal("corporate"), v.literal("government"));

/** Verifies the customer owns the order and returns the verified Telegram id. */
async function assertCustomerOwnsOrder(
  ctx: any,
  args: { telegramId: string; initData: string; orderId: Id<"customerOrders"> },
  order: { telegramChatId?: string },
) {
  const verified = await verifyTelegramInitData(args.initData);
  const telegramId = args.telegramId.trim();
  if (!telegramId || verified.telegramId !== telegramId) throw new Error("Telegram identity mismatch.");
  if (!order.telegramChatId) {
    throw new Error("This order cannot be edited from Telegram because it was not created through the Mini App.");
  }
  if (order.telegramChatId !== telegramId) {
    throw new Error("You can only edit orders placed from your own Telegram account.");
  }
  return telegramId;
}

async function recordOrderEvent(
  ctx: any,
  input: {
    orderId: Id<"customerOrders">;
    actorId: string;
    actorLabel: string;
    action: "LOCKED_FOR_REVIEW" | "CUSTOMER_EDIT" | "EDIT_REJECTED_LOCKED" | "EDIT_REJECTED_STALE";
    detail?: string;
  },
) {
  await ctx.db.insert("orderEvents", {
    orderId: input.orderId,
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    action: input.action,
    detail: input.detail,
    createdAt: Date.now(),
  });
}

/**
 * Reception's first review action. Atomically locks customer editing, records
 * the receptionist and timestamp, bumps the edit revision, and moves the order
 * to RECEPTION_REVIEW. All later pricing, payment, and Job Card actions are
 * required to happen on an order that carries this lock.
 */
export const lockOrderForReview = mutation({
  args: {
    orderId: v.id("customerOrders"),
    reviewLockReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "order.manage");
    return lockOrderForReviewInternal(ctx, identity, args);
  },
});

export async function lockOrderForReviewInternal(
  ctx: any,
  identity: { _id: string; name?: string },
  args: { orderId: Id<"customerOrders">; reviewLockReason?: string },
) {
  const order = await ctx.db.get(args.orderId);
  if (!order) throw new Error("Order not found.");
  if (order.jobCardId) throw new Error("This order already has a job card and can no longer be reviewed.");
  if (order.status !== "PENDING_REVIEW") {
    throw new Error(`Only pending orders can be locked for review (current status: ${order.status}).`);
  }
  if (order.customerEditLockedAt) {
    throw new Error("This order is already locked for review.");
  }

  const now = Date.now();
  const nextRevision = (order.editRevision ?? 1) + 1;
  await ctx.db.patch(args.orderId, {
    status: "RECEPTION_REVIEW",
    customerEditLockedAt: now,
    customerEditLockedBy: identity._id,
    reviewLockReason: args.reviewLockReason?.trim() || undefined,
    editRevision: nextRevision,
    updatedAt: now,
  });

  await recordOrderEvent(ctx, {
    orderId: args.orderId,
    actorId: identity._id,
    actorLabel: `Reception · ${identity.name ?? "staff"}`,
    action: "LOCKED_FOR_REVIEW",
    detail: args.reviewLockReason?.trim() || undefined,
  });

  await notifyOrderRoles(ctx, {
    title: "Order locked for review",
    message: `${order.code} · ${order.clientName} review started; customer editing is now locked.`,
    type: "order_status",
    actorAuthUserId: identity._id,
    relatedTable: "customerOrders",
    relatedId: args.orderId,
  });

  if (order.telegramChatId) {
    await ctx.scheduler.runAfter(0, internal.orders.sendTelegramNotificationInternal, {
      chatId: order.telegramChatId,
      message:
        `📋 <b>ትዕዛዝዎ በግምገማ ላይ ነው</b>\n\n` +
        `• የትዕዛዝ መለያ: <code>${order.code}</code>\n` +
        `የእርስዎ ጥያቄ በአገልግሎት ሰጪው ቡድን እየተገመገመ ነው። እስከዚያው ድረስ ማስተካከያ ማድረግ አይቻልም።`,
    });
  }

  return { success: true as const, order: publicOrder((await ctx.db.get(args.orderId)) as OrderDoc) };
}

/**
 * Customer self-service edit while the order is still PENDING_REVIEW and not
 * locked by Reception. Enforces ownership via verified Telegram initData and
 * optimistic concurrency via `editRevision`. Only customer-intake fields are
 * accepted — pricing, payment, machine, job card, and internal fields are not
 * part of this mutation's argument validator.
 */
export const updateCustomerOrder = mutation({
  args: {
    orderId: v.id("customerOrders"),
    telegramId: v.string(),
    initData: v.string(),
    editRevision: v.number(),
    customerName: v.optional(v.string()),
    phone: v.optional(v.string()),
    accountType: v.optional(accountTypeValidator),
    companyLegalName: v.optional(v.string()),
    tinNumber: v.optional(v.string()),
    serviceId: v.optional(serviceType),
    specifications: v.optional(v.record(v.string(), v.string())),
    dimensions: v.optional(v.string()),
    quantity: v.optional(v.string()),
    length: v.optional(v.number()),
    width: v.optional(v.number()),
    notes: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    const telegramId = await assertCustomerOwnsOrder(ctx, args, order);

    if (order.customerEditLockedAt || order.status !== "PENDING_REVIEW") {
      await recordOrderEvent(ctx, {
        orderId: args.orderId,
        actorId: telegramId,
        actorLabel: `Customer · Telegram ${telegramId}`,
        action: "EDIT_REJECTED_LOCKED",
        detail: `Edit attempt rejected while status was ${order.status}`,
      });
      throw new Error("This order is under review and can no longer be edited. Contact Reception if you need to change something.");
    }

    const currentRevision = order.editRevision ?? 1;
    if (args.editRevision !== currentRevision) {
      await recordOrderEvent(ctx, {
        orderId: args.orderId,
        actorId: telegramId,
        actorLabel: `Customer · Telegram ${telegramId}`,
        action: "EDIT_REJECTED_STALE",
        detail: `Stale revision ${args.editRevision} (current ${currentRevision})`,
      });
      throw new Error("This order was updated elsewhere. Please reload and try again.");
    }

    const nextServiceId = (args.serviceId ?? order.serviceId ?? order.serviceType) as string;

    let nextPhone = order.phone;
    if (args.phone !== undefined && args.phone.trim() !== "") {
      const normalized = normalizePhone(args.phone);
      if (!normalized) throw new Error("Enter a valid Ethiopian mobile number.");
      nextPhone = normalized;
    }

    const nextAccountType = (args.accountType ?? order.accountType ?? "individual") as "individual" | "corporate" | "government";
    const normalizedCompany = args.companyLegalName?.trim() ?? order.companyLegalName?.trim();
    const normalizedTin = args.tinNumber?.trim() ?? order.tinNumber?.trim();
    if (nextAccountType === "corporate" || nextAccountType === "government") {
      if (!normalizedCompany || normalizedCompany.length < 2) {
        throw new Error("Company/legal name is required for Corporate and Government accounts.");
      }
      if (!normalizedTin || !/^\d{10}$/.test(normalizedTin)) {
        throw new Error("A valid 10-digit TIN number is required for Corporate and Government accounts.");
      }
    } else if (normalizedTin && !/^\d{10}$/.test(normalizedTin)) {
      throw new Error("TIN must contain exactly 10 digits.");
    }

    const nextCustomerName = args.customerName?.trim() ?? order.clientName;
    if (!nextCustomerName) throw new Error("Customer name is required.");
let nextDimensions = order.dimensions;
    let nextLength = order.length;
    let nextWidth = order.width;
    if (args.dimensions !== undefined) {
      const trimmed = args.dimensions.trim();
      const merged = parseDimensions(trimmed);
      if (!merged) throw new Error("Dimensions must be positive width and height in meters.");
      nextDimensions = trimmed;
      nextLength = args.length ?? merged?.length;
      nextWidth = args.width ?? merged?.width;
    } else if (args.length !== undefined || args.width !== undefined) {
      nextLength = args.length ?? order.length;
      nextWidth = args.width ?? order.width;
      if (!nextLength || !nextWidth || nextLength <= 0 || nextWidth <= 0) {
        throw new Error("Length and width must be positive values.");
      }
    }

    const nextQuantity = args.quantity?.trim() ?? order.quantity;
    if (!/^[1-9]\d*$/.test(nextQuantity) || Number(nextQuantity) > 100000) {
      throw new Error("Quantity must be a positive whole number.");
    }

    const nextSpecifications = withDerivedRollSubstrate(
      nextServiceId,
      validateServiceSpecifications(nextServiceId, args.specifications ?? order.specifications),
      nextWidth,
    );

    const now = Date.now();
    await ctx.db.patch(args.orderId, {
      clientName: nextCustomerName,
      phone: nextPhone,
      serviceType: nextServiceId as typeof order.serviceType,
      serviceId: nextServiceId as typeof order.serviceType,
      specifications: nextSpecifications,
      dimensions: nextDimensions,
      length: nextLength,
      width: nextWidth,
      quantity: nextQuantity,
      accountType: nextAccountType,
      companyLegalName: nextAccountType === "individual" ? undefined : normalizedCompany || undefined,
      tinNumber: nextAccountType === "individual" ? undefined : normalizedTin || undefined,
      notes: args.notes !== undefined ? (args.notes.trim() || undefined) : order.notes,
      fileStorageId: args.fileStorageId !== undefined ? args.fileStorageId : order.fileStorageId,
      fileName: args.fileName !== undefined ? (args.fileName.trim() || undefined) : order.fileName,
      editRevision: currentRevision + 1,
      lastCustomerEditedAt: now,
      lastCustomerEditedBy: `Telegram ${telegramId}`,
      updatedAt: now,
    });

    await recordOrderEvent(ctx, {
      orderId: args.orderId,
      actorId: telegramId,
      actorLabel: `Customer · Telegram ${telegramId}`,
      action: "CUSTOMER_EDIT",
      detail: `Revision ${currentRevision} → ${currentRevision + 1}`,
    });

    await notifyOrderRoles(ctx, {
      title: "Customer edited their order",
      message: `${order.code} · ${nextCustomerName} updated their request (revision ${currentRevision + 1}).`,
      type: "order_status",
      actorAuthUserId: order.createdBy,
      relatedTable: "customerOrders",
      relatedId: args.orderId,
    });

    return { success: true as const, order: publicOrder((await ctx.db.get(args.orderId)) as OrderDoc) };
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
    serviceType: serviceType,
    dimensions: v.string(),
    quantity: v.string(),
    length: v.optional(v.number()),
    width: v.optional(v.number()),
    amount: v.optional(v.number()),
    preferredDueDate: v.number(),
    priority: v.optional(orderPriority),
    notes: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    accountType: v.optional(v.union(v.literal("individual"), v.literal("corporate"), v.literal("government"))),
    tinNumber: v.optional(v.string()),
    companyLegalName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "order.create");
    return createWalkInInternal(ctx, identity, args);
  },
});

/**
 * Shared walk-in order creation body. Exposed for the receptionist namespace so
 * the workspace mutation re-gates with the strict role guard while reusing the
 * exact validation / notification / insert behavior of the generic surface.
 */
export async function createWalkInInternal(
  ctx: any,
  identity: { _id: string },
  args: {
    clientName: string;
    phone: string;
    serviceType: any;
    dimensions: string;
    quantity: string;
    length?: number;
    width?: number;
    amount?: number;
    preferredDueDate: number;
    priority?: "High" | "Medium" | "Low";
    notes?: string;
    fileStorageId?: Id<"_storage">;
    fileName?: string;
    accountType?: "individual" | "corporate" | "government";
    tinNumber?: string;
    companyLegalName?: string;
  },
) {
    const clientName = args.clientName.trim();
    const phone = normalizePhone(args.phone);
    const serviceTypeRaw = (args.serviceType as string).trim();
    const serviceType = serviceTypeRaw as typeof args.serviceType;
    const dimensions = args.dimensions.trim();
    const parsedDimensions = parseDimensions(dimensions);
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
    const accountType = (args.accountType ?? "") as "" | "individual" | "corporate" | "government";
    const normalizedTin = args.tinNumber?.trim();
    const normalizedCompany = args.companyLegalName?.trim();
    if (accountType === "corporate" || accountType === "government") {
      if (!normalizedCompany || normalizedCompany.length < 2) {
        throw new Error("Company/legal name is required for Corporate and Government accounts.");
      }
      if (!normalizedTin || !/^\d{10}$/.test(normalizedTin)) {
        throw new Error("A valid 10-digit TIN number is required for Corporate and Government accounts.");
      }
    } else if (normalizedTin && !/^\d{10}$/.test(normalizedTin)) {
      throw new Error("TIN must contain exactly 10 digits.");
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
       length: args.length ?? parsedDimensions?.length,
       width: args.width ?? parsedDimensions?.width,
      quantity,
      amount: args.amount === undefined ? undefined : Number(args.amount.toFixed(2)),
      preferredDueDate: args.preferredDueDate,
      status: "PENDING_REVIEW",
      priority: args.priority ?? "Medium",
      source: "walk_in",
      notes: args.notes?.trim() || undefined,
      accountType: accountType || undefined,
      editRevision: 1,
      tinNumber: accountType === "individual" ? undefined : normalizedTin || undefined,
      companyLegalName: accountType === "individual" ? undefined : normalizedCompany || undefined,
      fileStorageId: args.fileStorageId,
      fileName: args.fileName?.trim() || undefined,
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
}

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

/** Session-scoped customer order list for the verified Telegram Mini App. */
export const listForTelegramUser = query({
  args: { telegramId: v.string(), initData: v.string() },
  handler: async (ctx, args) => {
    const verified = await verifyTelegramInitData(args.initData);
    const telegramId = args.telegramId.trim();
    if (!telegramId || verified.telegramId !== telegramId) throw new Error("Telegram identity mismatch.");
    const orders = await ctx.db
      .query("customerOrders")
      .withIndex("by_telegram_chat_id", (q) => q.eq("telegramChatId", telegramId))
      .collect();
    return orders
      .filter((order) => PUBLIC_TRACKING_STATUSES.has(order.status))
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 20)
      .map(publicOrder);
  },
});

/** Bot-only lookup used by the trusted webhook for the `/my-orders` command. */
export const listByTelegramChat = query({
  args: { telegramChatId: v.string() },
  handler: async (ctx, args) => {
    const telegramChatId = args.telegramChatId.trim();
    if (!telegramChatId) return [];
    const orders = await ctx.db
      .query("customerOrders")
      .withIndex("by_telegram_chat_id", (q) => q.eq("telegramChatId", telegramChatId))
      .collect();
    return orders
      .filter((order) => PUBLIC_TRACKING_STATUSES.has(order.status))
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 20)
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
      tinNumber: order.tinNumber,
      companyLegalName: order.companyLegalName,
      machineName: order.machineId ? machineNames.get(order.machineId) : undefined,
     overdue: !["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"].includes(order.status) && order.preferredDueDate < Date.now(),
      fileUrl: order.fileStorageId ? await ctx.storage.getUrl(order.fileStorageId) : undefined,
    })));
  },
});

export const setStatus = mutation({
  args: { orderId: v.id("customerOrders"), status: orderStatus },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "order.manage");
    return setStatusInternal(ctx, identity, args);
  },
});

/**
 * Shared order status transition body (reception desk drive). Exposed for the
 * receptionist namespace so the workspace mutation re-gates strictly while
 * keeping the transition map, job-card cascade, and customer push identical.
 */
export async function setStatusInternal(
  ctx: any,
  identity: { _id: string },
  args: { orderId: Id<"customerOrders">; status: any },
) {
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

    // Customer notification is gated to the same set of statuses the centralised
    // helper covers (PRICED, JOB_CARD_CREATED, IN_PRODUCTION, COMPLETED). It
    // never runs from the public create path, only when reception (or a
    // scheduled job) drives the order forward.
    await pushCustomerOrderStatus(
      ctx,
      {
        code: order.code,
        status: args.status,
        amount: order.amount,
        telegramChatId: order.telegramChatId,
        paymentStatus: order.paymentStatus,
        advancePaidAmount: order.advancePaidAmount,
        remainingDueAmount: order.remainingDueAmount,
        paymentInstructionsSnapshot: order.paymentInstructionsSnapshot,
      },
      previousStatus,
    );
}

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
    return priceOrderInternal(ctx, identity, args);
  },
});

/**
 * Shared quote-commit body (reception step 1 of checkout): records the final
 * price and moves the order to PRICED_AND_PENDING_PAYMENT. Exposed for the
 * receptionist namespace so the workspace mutation re-gates strictly while
 * reusing the exact price / customer-push behavior.
 */
export async function priceOrderInternal(
  ctx: any,
  identity: { _id: string },
  args: { orderId: Id<"customerOrders">; amount: number },
) {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    // Review-lock gate: pricing is only allowed once Reception has started the
    // review (customer editing locked). A bare PENDING_REVIEW order cannot be
    // priced directly — the receptionist must run the first review action first.
    if (!order.customerEditLockedAt) {
      throw new Error("Begin the review of this order first — customer editing must be locked before pricing.");
    }
    if (!["RECEPTION_REVIEW", "PRICED_AND_PENDING_PAYMENT"].includes(order.status)) {
      throw new Error(`Only orders under review or awaiting payment can be priced (current status: ${order.status}).`);
    }
    if (!Number.isFinite(args.amount) || args.amount <= 0) {
      throw new Error("Order price must be greater than zero.");
    }
    const breakdown = paymentBreakdown(args.amount);
    const settings = await ctx.db.query("companySettings").withIndex("by_key", (q: any) => q.eq("key", "yt-advertisement")).unique();
    const paymentInstructionsSnapshot = snapshotPaymentInstructions(settings);
    await ctx.db.patch(args.orderId, {
      amount: breakdown.total,
      advanceDueAmount: breakdown.advanceDueAmount,
      advancePaidAmount: 0,
      remainingDueAmount: breakdown.remainingDueAmount,
      paymentStatus: "UNPAID",
      paymentInstructionsSnapshot,
      status: "PRICED_AND_PENDING_PAYMENT",
      updatedAt: Date.now(),
    });
    await pushCustomerOrderStatus(
      ctx,
      {
        code: order.code,
        status: "PRICED_AND_PENDING_PAYMENT",
        amount: Number(args.amount.toFixed(2)),
        telegramChatId: order.telegramChatId,
        paymentStatus: order.paymentStatus,
        advanceDueAmount: breakdown.advanceDueAmount,
        advancePaidAmount: 0,
        remainingDueAmount: breakdown.remainingDueAmount,
        paymentInstructionsSnapshot,
      },
      order.status,
    );
    return { code: order.code, amount: Number(args.amount.toFixed(2)) };
}

/**
 * Resolves the production assignment for an order without requiring reception
 * to pick a machine or a material: the material-type catalog decides which raw
 * material the service consumes, the machine register is filtered by
 * capability / operator role and load-balanced by unfinished job count, and a
 * Standard allocation is computed with the configured waste margin.
 */
async function resolveAutoRouting(
  ctx: any,
  order: OrderDoc,
  config: { standardWasteMargin?: number; maxAllowedScrapLimit?: number },
): Promise<{
  route: MaterialTypeRoute;
  machineId: string;
  machineName: string;
  materialId: string;
  materialName: string;
  materialType: string;
  allocation: StandardAllocation;
}> {
  const route = await resolveServiceRoute(ctx, order.serviceType);
  if (!route) {
    throw new Error(`No production routing is defined for the ${order.serviceType} service.`);
  }
   const [namedMaterials, categoryMaterials] = await Promise.all([
     ctx.db.query("materials").withIndex("by_name", (q: any) => q.eq("name", route.preferredMaterialName)).collect(),
     ctx.db.query("materials").withIndex("by_category", (q: any) => q.eq("category", route.materialType)).take(100),
   ]);
   const materials = [...namedMaterials, ...categoryMaterials.filter((candidate: any) => !namedMaterials.some((named: any) => named._id === candidate._id))];
   const activeMaterials = materials.filter((m: any) => m.active);

   // When the order carries an auto-derived roll width, prefer the registered
   // material whose roll width matches it so the operator receives the exact
   // raw material the job was sized against. Routing never throws on oversize
   // legacy orders; it falls back to the preferred material.
   let matchedRoll: any;
   if (order.width !== undefined) {
     try {
       const derivedRoll = resolveRollSubstrate(order.serviceId ?? order.serviceType, order.width);
       if (derivedRoll) {
         matchedRoll = activeMaterials.find((m: any) => m.rollWidth !== undefined && Math.abs(m.rollWidth - derivedRoll.rollWidth) < 0.001);
       }
     } catch {
       matchedRoll = undefined;
     }
   }
   const preferred = matchedRoll
     ?? materials.find((m: any) => m.active && m.name === route.preferredMaterialName)
     ?? activeMaterials[0];
  if (!preferred) {
    throw new Error(`No active raw material is registered for ${route.materialType}.`);
  }

  const [machines, jobs, machineOptions] = await Promise.all([
    ctx.db.query("machines").collect(),
    ctx.db.query("jobCards").collect(),
    ctx.db
      .query("serviceMachineOptions")
      .withIndex("by_service", (q: any) =>
        q.eq("serviceId", order.serviceId ?? order.serviceType).eq("active", true),
      )
      .collect(),
  ]);
  const loadByMachineId = new Map<string, number>();
  for (const job of jobs) {
    if (job.status === "Completed") continue;
    loadByMachineId.set(job.machineId, (loadByMachineId.get(job.machineId) ?? 0) + 1);
  }

  // Explicit owner-configured serviceMachineOptions take precedence over heuristic role matching
  let candidates: any[];
  if (machineOptions.length > 0) {
    const allowedCodes = new Set(machineOptions.map((o: any) => o.machineCode));
    candidates = machines.filter(
      (m: any) =>
        m.active &&
        m.status !== "Maintenance" &&
        m.status !== "Unavailable" &&
        allowedCodes.has(m.code),
    );
    const priorityMap = new Map(machineOptions.map((o: any) => [o.machineCode, o.priority]));
    candidates.sort((a, b) => Number(priorityMap.get(a.code) ?? 999) - Number(priorityMap.get(b.code) ?? 999));
  } else {
    candidates = compatibleMachines(route, machines);
  }

  const machine = selectMachineByLoad(candidates, loadByMachineId);
  if (!machine) {
    throw new Error(`No available machine can produce ${route.materialType} right now.`);
  }
  const allocation = computeStandardAllocation(order, preferred, {
    standardWasteMargin: config.standardWasteMargin ?? DEFAULT_SYSTEM_CONFIG.standardWasteMargin ?? 0,
    maxAllowedScrapLimit: config.maxAllowedScrapLimit ?? DEFAULT_SYSTEM_CONFIG.maxAllowedScrapLimit ?? 0,
  });
  return {
    route,
    machineId: machine._id,
    machineName: machine.name,
    materialId: preferred._id,
    materialName: preferred.name,
    materialType: route.materialType,
    allocation,
  };
}

export type InkCheckItem = {
  materialId?: string;
  materialName: string;
  inkColor?: string;
  requiredMl: number;
  requiredLitres: number;
  availableLitres: number;
  sufficient: boolean;
};

type DispatchResourceCheck = {
  canDispatch: boolean;
  errors: string[];
  material: {
    materialId: string;
    materialName: string;
    requiredQuantity: number;
    availableQuantity: number;
    unit: string;
    sufficient: boolean;
  };
  ink: {
    required: boolean;
    requiredMl: number;
    requiredLitres: number;
    availableLitres: number;
    materialNames: string[];
    sufficient: boolean;
    message?: string;
    items: InkCheckItem[];
  };
};

async function validateDispatchResources(ctx: any, order: OrderDoc, routed: Awaited<ReturnType<typeof resolveAutoRouting>>, config: any): Promise<DispatchResourceCheck> {
  const material = await ctx.db.get(routed.materialId as Id<"materials">);
  if (!material || !material.active) throw new Error("The routed raw material is no longer active.");

  const requiredQuantity = routed.allocation.plannedBaseQuantity;
  const materialSufficient = material.quantity >= requiredQuantity;
  const errors: string[] = [];
  if (!materialSufficient) {
    errors.push(`Insufficient ${material.name}: ${material.quantity} ${material.baseUnit ?? material.unit} available, ${requiredQuantity} required.`);
  }

  const machine = await ctx.db.get(routed.machineId as Id<"machines">);
  const quantityMatch = order.quantity.match(/[0-9]+(?:\.[0-9]+)?/);
  const serviceUnits = quantityMatch ? Math.max(1, Number(quantityMatch[0])) : 1;
  const printedArea = order.length && order.width
    ? order.length * order.width * serviceUnits
    : routed.allocation.netBaseQuantity;

  const inkRequirements = machine
    ? await resolveInkRequirements(ctx, machine, printedArea, {
        inkMlPerSquareMetre: config.inkMlPerSquareMetre ?? 12,
      })
    : [];

  const inkRequired = inkRequirements.length > 0;
  const inkItems: InkCheckItem[] = [];
  let allInksSufficient = true;
  let totalRequiredMl = 0;
  let totalRequiredLitres = 0;
  let totalAvailableLitres = 0;

  for (const req of inkRequirements) {
    totalRequiredMl += req.requiredMl;
    totalRequiredLitres += req.requiredLitres;
    let available = 0;
    let foundMaterial = req.materialId ? await ctx.db.get(req.materialId) : null;
    if (!foundMaterial) {
      const allInkMaterials = await ctx.db.query("materials").collect();
      foundMaterial = allInkMaterials.find(
        (m: any) =>
          m.active &&
          (m.name.toLowerCase() === req.materialName.toLowerCase() ||
           (req.inkColor && m.inkColor?.toLowerCase() === req.inkColor.toLowerCase()))
      ) ?? null;
    }
    if (foundMaterial && foundMaterial.active) {
      available = foundMaterial.quantity ?? 0;
    }
    totalAvailableLitres += available;
    const sufficient = available >= req.requiredLitres;
    if (!sufficient) {
      allInksSufficient = false;
      const colorDesc = req.inkColor ? ` (${req.inkColor})` : "";
      errors.push(
        foundMaterial
          ? `Insufficient ${req.materialName}${colorDesc}: ${available} L available, ${req.requiredLitres} L required.`
          : `Required ink ${req.materialName}${colorDesc} is not registered or active in inventory.`
      );
    }
    inkItems.push({
      materialId: foundMaterial?._id,
      materialName: req.materialName,
      inkColor: req.inkColor,
      requiredMl: req.requiredMl,
      requiredLitres: req.requiredLitres,
      availableLitres: available,
      sufficient,
    });
  }

  const inkSufficient = !inkRequired || (allInksSufficient && inkItems.length > 0);

  return {
    canDispatch: errors.length === 0,
    errors,
    material: {
      materialId: routed.materialId,
      materialName: routed.materialName,
      requiredQuantity,
      availableQuantity: material.quantity,
      unit: material.baseUnit ?? material.unit,
      sufficient: materialSufficient,
    },
    ink: {
      required: inkRequired,
      requiredMl: Number(totalRequiredMl.toFixed(1)),
      requiredLitres: Number(totalRequiredLitres.toFixed(3)),
      availableLitres: Number(totalAvailableLitres.toFixed(3)),
      materialNames: inkItems.map((i) => i.materialName),
      sufficient: inkSufficient,
      message: errors.find((error) => error.includes("ink") || error.includes("Ink")),
      items: inkItems,
    },
  };
}

/**
 * Resolves the deterministic scrap & off-cut breakdown for a material against
 * the customer's net job dimensions. Uses the same pure engine that the
 * dispatch mutation consumes so the preview and the registered ledger never
 * diverge.
 */
function resolveMaterialBreakdown(material: any, order: OrderDoc, config: any): OffCutScrapResult {
  const isRigidSheet =
    material.materialFamily === "RIGID_SHEET" ||
    material.catalogFamily === "RIGID_SHEET" ||
    (material.sheetWidth && material.sheetLength) ||
    (!material.rollWidth && (material.sheetWidth || material.sheetLength));

  // Prefer the roll width the order was actually sized against (derived from
  // the job width) so off-cut/scrap math matches the assigned roll even when a
  // single generic material row is registered.
  let rollWidth = material.rollWidth;
  if (!isRigidSheet && order.width !== undefined) {
    try {
      const derived = resolveRollSubstrate(order.serviceId ?? order.serviceType, order.width);
      if (derived) rollWidth = derived.rollWidth;
    } catch {
      // Oversize legacy order: keep the material's registered roll width.
    }
  }

  return calculateOffCutAndScrap(
    {
      rollWidth,
      sheetWidth: material.sheetWidth,
      sheetLength: material.sheetLength,
      isRigidSheet,
    },
    {
      width: order.width,
      length: order.length,
      quantity: order.quantity,
    },
    {
      minUsableOffcutWidth: 0.3,
      defaultMarginSquareMetres: config?.defaultMarginSquareMetres ?? 0,
      standardWasteMargin: config?.standardWasteMargin ?? 0,
    },
  );
}

/**
 * Read-only preview of the automatic production assignment used by the confirm
 * step. Surfaces the machine, raw material, and Standard allocation that
 * `confirmOrderAndIssueJobCard` will issue so reception can review the routing
 * without mutating anything.
 */
export const previewAutoRouting = query({
  args: { orderId: v.id("customerOrders") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "order.manage");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    const configRow = await ctx.db
      .query("systemConfigs")
      .withIndex("by_key", (q) => q.eq("key", CONFIG_KEY))
      .unique();
    const routed = await resolveAutoRouting(ctx, order, configRow ?? {});
    const resources = await validateDispatchResources(ctx, order, routed, configRow ?? {});
    const material = await ctx.db.get(routed.materialId as Id<"materials">);
    const breakdown = material ? resolveMaterialBreakdown(material, order, configRow ?? {}) : null;
    return {
      machineId: routed.machineId,
      machineName: routed.machineName,
      materialId: routed.materialId,
      materialName: routed.materialName,
      materialType: routed.materialType,
      netBaseQuantity: routed.allocation.netBaseQuantity,
      plannedBaseQuantity: routed.allocation.plannedBaseQuantity,
      approvedScrapQuantity: routed.allocation.approvedScrapQuantity,
      unit: routed.allocation.unit,
      standardWasteMargin: routed.allocation.wasteMarginPercent,
      maxAllowedScrapLimit: routed.allocation.maxScrapLimitPercent,
      // Reception assigns and queues work even when inventory is empty. The
      // operator start mutation performs the authoritative machine-stock gate.
      canDispatch: true,
      errors: [],
      stockWarnings: resources.errors,
      materialCheck: resources.material,
      inkCheck: resources.ink,
      breakdown,
    };
  },
});

/**
 * Reception step 2 of checkout — the single payment-gated entry point to
 * production. Confirms advance payment (PAID) or approved credit
 * (APPROVED_CREDIT), creates the job card, and queues it on the selected
 * machine. Job card creation is impossible before this mutation runs, and it
 *  additionally notifies the Telegram customer when payment is confirmed and
 * order carries a chat id.
 */
export const confirmOrderAndIssueJobCard = mutation({
  args: {
    orderId: v.id("customerOrders"),
    amount: v.optional(v.number()),
    paymentDecision: v.union(v.literal("ADVANCE_PAID"), v.literal("APPROVED_CREDIT")),
    paymentMethod: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    advancePaidAmount: v.optional(v.number()),
    machineId: v.optional(v.id("machines")),
    materialId: v.optional(v.id("materials")),
    quantity: v.optional(v.number()),
    unit: v.optional(unit),
    priority: v.optional(orderPriority),
    deductOnComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "order.manage");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    if (order.jobCardId) throw new Error("This order already has a job card.");
    if (!order.customerEditLockedAt) {
      throw new Error("Begin the review of this order first — customer editing must be locked before confirming.");
    }
    if (!["RECEPTION_REVIEW", "PRICED_AND_PENDING_PAYMENT"].includes(order.status)) {
      throw new Error(`Only orders under review or awaiting payment can be confirmed (current status: ${order.status}).`);
    }

    const amount = args.amount !== undefined ? args.amount : order.amount;
    if (amount === undefined || !Number.isFinite(amount) || amount < 0) {
      throw new Error("Confirm the final price before verifying payment.");
    }
    const paymentAmounts = paymentBreakdown(amount);
    if (args.paymentDecision === "ADVANCE_PAID") {
      if (!args.paymentMethod?.trim()) throw new Error("Advance payment method is required.");
      assertPaymentAmount(args.advancePaidAmount ?? 0, order.advanceDueAmount ?? paymentAmounts.advanceDueAmount, "Advance payment");
    }

    // Automated Machine & Material resolution based on service catalog
    const routing = await resolveServiceRoute(ctx, order.serviceType);
    const sysConfig = await ensureSystemConfig(ctx);

    let targetMachine = args.machineId ? await ctx.db.get(args.machineId) : null;
    if (!targetMachine && routing) {
      const allMachines = await ctx.db.query("machines").collect();
      targetMachine = allMachines.find((m) => m.active && m.operatorRole === routing.operatorRole) ?? null;
    }
    if (!targetMachine) {
      targetMachine = (await ctx.db.query("machines").collect()).find((m) => m.active) ?? null;
    }

    const config = await ensureSystemConfig(ctx, identity._id);

    // Production assignment. Explicit machine/material/quantity remain
    // supported for backwards compatibility; otherwise the auto-router picks a
    // compatible, least-loaded machine and computes the Standard allocation
    // (Total = W×H×Qty × (1 + standardWasteMargin)).
    let machine: any;
    let material: any;
    let allocation: StandardAllocation;
    if (args.machineId || args.materialId) {
      if (!args.machineId || !args.materialId || args.quantity === undefined || args.unit === undefined) {
        throw new Error("Explicit assignment requires machine, material, quantity, and unit.");
      }
      machine = await ctx.db.get(args.machineId);
      material = await ctx.db.get(args.materialId);
      if (!machine || !material || !machine.active || !material.active) {
        throw new Error("Order, machine, or material is unavailable.");
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
      const planned = Number(args.quantity.toFixed(3));
      allocation = {
        plannedBaseQuantity: planned,
        netBaseQuantity: planned,
        approvedScrapQuantity: Number((planned * (config.maxAllowedScrapLimit ?? DEFAULT_SYSTEM_CONFIG.maxAllowedScrapLimit ?? 0) / 100).toFixed(3)),
        unit: args.unit,
        wasteMarginPercent: 0,
        maxScrapLimitPercent: config.maxAllowedScrapLimit ?? DEFAULT_SYSTEM_CONFIG.maxAllowedScrapLimit ?? 0,
      };
    } else {
      const routed = await resolveAutoRouting(ctx, order, config);
      machine = await ctx.db.get(routed.machineId as Id<"machines">);
      material = await ctx.db.get(routed.materialId as Id<"materials">);
      if (!machine || !material || !machine.active || !material.active) {
        throw new Error("The auto-routed machine or material is no longer available.");
      }
      allocation = routed.allocation;
    }

    // Deterministic scrap & off-cut breakdown — never taken from client input.
    const breakdown = material
      ? resolveMaterialBreakdown(material, order, config)
      : null;

    const now = Date.now();
    const roundedAmount = Number(amount.toFixed(2));
    const code = `JC-${String(430 + Math.floor(Math.random() * 500)).padStart(4, "0")}`;

    // Step 39 & 40: Create reservations BEFORE job insertion
    const reservationIds: Array<Id<"reservations">> = [];
    if (material) {
      const rawRes = await ctx.db.insert("reservations", {
        orderId: args.orderId,
        materialId: material._id,
        reservedQuantity: allocation.plannedBaseQuantity,
        unit: allocation.unit as Unit,
        status: "RESERVED",
        createdAt: now,
        updatedAt: now,
      });
      reservationIds.push(rawRes);
    }
    // Step 40: Insert jobCards only after reservation succeeds
    const jobId = await ctx.db.insert("jobCards", {
      code,
      client: order.clientName,
      title: order.serviceType,
      machineId: machine._id,
      materialId: material._id,
      quantity: allocation.plannedBaseQuantity,
      unit: allocation.unit as Unit,
      status: "Queued",
      due: new Date(order.preferredDueDate).toLocaleString("en-ET", { dateStyle: "medium", timeStyle: "short" }),
      priority: args.priority ?? "Medium",
      createdBy: identity._id,
      createdAt: now,
      orderId: args.orderId,
      deductOnComplete: args.deductOnComplete,
      length: order.length,
      width: order.width,
      serviceType: order.serviceType,
      specifications: order.specifications,
      grossDeductedQuantity: breakdown ? Number(breakdown.grossArea.toFixed(3)) : undefined,
      netProductArea: breakdown ? Number(breakdown.netArea.toFixed(3)) : undefined,
      offcutArea: breakdown?.usableOffcut
        ? Number(breakdown.usableOffcut.area.toFixed(3))
        : undefined,
      scrapArea: breakdown ? Number(breakdown.totalScrapArea.toFixed(3)) : undefined,
      scrapPercentage: breakdown && breakdown.grossArea > 0
        ? Number(((breakdown.totalScrapArea / breakdown.grossArea) * 100).toFixed(2))
        : undefined,
    });

    for (const rId of reservationIds) {
      await ctx.db.patch(rId, { jobCardId: jobId, updatedAt: now });
    }

    // Step 7: Expand BOM via resolveJobBOM
    const bomItems = await resolveJobBOM(
      ctx,
      order.serviceType,
      { length: order.length, width: order.width },
      order.quantity,
      {
        standardWasteMargin: config.standardWasteMargin ?? DEFAULT_SYSTEM_CONFIG.standardWasteMargin ?? 5,
        maxAllowedScrapLimit: config.maxAllowedScrapLimit ?? DEFAULT_SYSTEM_CONFIG.maxAllowedScrapLimit ?? 10,
        defaultMarginSquareMetres: config.defaultMarginSquareMetres,
      }
    );
    for (const item of bomItems) {
      await ctx.db.insert("jobMaterialRequirements", {
        jobCardId: jobId,
        materialId: item.materialId,
        packageUnit: item.packageUnit,
        suggestedPackages: item.suggestedPackages,
        baseUnit: item.baseUnit,
        plannedBaseQuantity: item.plannedBaseQuantity,
        approvedScrapQuantity: item.approvedScrapQuantity,
        consumedBaseQuantity: 0,
        conversionRatioSnapshot: item.conversionRatioSnapshot,
        status: "PLANNED",
        createdAt: now,
        updatedAt: now,
      });
    }
    if (!bomItems.some((b) => b.materialId === material._id)) {
      const primaryRatio = material.conversionRatio && material.conversionRatio > 0 ? material.conversionRatio : 1;
      const primaryPackageUnit = material.purchaseUnit === "sheet"
        ? "SHEET"
        : material.purchaseUnit === "roll"
          ? "ROLL"
          : material.purchaseUnit === "canister" || material.purchaseUnit === "liter"
            ? "CANISTER"
            : material.purchaseUnit === "piece" ? "PIECE" : "PACKAGE";
      await ctx.db.insert("jobMaterialRequirements", {
        jobCardId: jobId,
        materialId: material._id,
        packageUnit: primaryPackageUnit,
        suggestedPackages: Math.ceil((allocation.plannedBaseQuantity + allocation.approvedScrapQuantity) / primaryRatio),
        baseUnit: material.baseUnit ?? material.unit ?? allocation.unit,
        plannedBaseQuantity: allocation.plannedBaseQuantity,
        approvedScrapQuantity: allocation.approvedScrapQuantity,
        consumedBaseQuantity: 0,
        conversionRatioSnapshot: primaryRatio,
        status: "PLANNED",
        createdAt: now,
        updatedAt: now,
      });
    }
    const paymentNow = Date.now();
    await ctx.db.patch(args.orderId, {
      amount: roundedAmount,
      paymentStatus: args.paymentDecision === "ADVANCE_PAID" ? "PARTIALLY_PAID" : "APPROVED_CREDIT",
      paymentMethod: args.paymentMethod?.trim() || undefined,
      paymentConfirmedAt: paymentNow,
      paymentConfirmedBy: identity._id,
      advanceDueAmount: paymentAmounts.advanceDueAmount,
      advancePaidAmount: args.paymentDecision === "ADVANCE_PAID" ? paymentAmounts.advanceDueAmount : 0,
      remainingDueAmount: paymentAmounts.remainingDueAmount,
      advancePaymentMethod: args.paymentDecision === "ADVANCE_PAID" ? args.paymentMethod?.trim() : undefined,
      advancePaymentReference: args.paymentDecision === "ADVANCE_PAID" ? args.paymentReference?.trim() || undefined : undefined,
      advancePaymentConfirmedAt: args.paymentDecision === "ADVANCE_PAID" ? paymentNow : undefined,
      advancePaymentConfirmedBy: args.paymentDecision === "ADVANCE_PAID" ? identity._id : undefined,
      status: "JOB_CARD_CREATED",
      jobCardId: jobId,
      machineId: machine._id,
      updatedAt: now,
    });
    // Reception only assigns and queues the work. Inventory consumption,
    // off-cut registration, and scrap accounting happen during operator
    // execution/completion after the machine-stock gate succeeds.

    await notifyRoles(ctx, [machine.operatorRole, "owner", "manager", "admin"], {
      title: "Paid order issued to production",
      message: `${order.code} (${order.clientName}) is confirmed ${args.paymentDecision} and queued as ${code} on ${machine.name}.`,
      type: "order_status",
      actorAuthUserId: identity._id,
      relatedTable: "customerOrders",
      relatedId: args.orderId,
    });

    // Payment confirmation to the Telegram customer: the customer push is centralised in
    // `pushCustomerOrderStatus` and fires only when reception explicitly
    // transitions the order past PENDING_REVIEW. It never runs from the
    // public/Mini App create path.
    await pushCustomerOrderStatus(
      ctx,
      {
        code: order.code,
        status: "JOB_CARD_CREATED",
        amount: roundedAmount,
        telegramChatId: order.telegramChatId,
        paymentStatus: args.paymentDecision === "ADVANCE_PAID" ? "PARTIALLY_PAID" : "APPROVED_CREDIT",
        advancePaidAmount: args.paymentDecision === "ADVANCE_PAID" ? paymentAmounts.advanceDueAmount : 0,
        remainingDueAmount: paymentAmounts.remainingDueAmount,
        paymentInstructionsSnapshot: order.paymentInstructionsSnapshot,
      },
      order.status,
    );

    return {
      success: true as const,
      jobId,
      code,
      paymentStatus: args.paymentDecision,
      machineId: machine._id,
      machineName: machine.name,
      materialId: material._id,
      materialName: material.name,
      allocatedBaseQuantity: allocation.plannedBaseQuantity,
      unit: allocation.unit,
      approvedScrapQuantity: allocation.approvedScrapQuantity,
      standardWasteMargin: allocation.wasteMarginPercent,
      breakdown,
    };
  },
});

/** Records the remaining balance exactly once after production is ready for pickup. */
export const settleOrder = mutation({
  args: {
    orderId: v.id("customerOrders"),
    amount: v.number(),
    paymentMethod: v.string(),
    paymentReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "order.manage");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    if (order.paymentStatus === "FULLY_PAID") return { success: true as const, alreadySettled: true as const };
    if (order.status !== "READY_FOR_PICKUP") throw new Error("Final settlement is available when the order is ready for pickup.");
    if (!args.paymentMethod.trim()) throw new Error("Final payment method is required.");
    const total = paymentBreakdown(order.amount ?? 0);
    const remaining = order.remainingDueAmount ?? total.remainingDueAmount;
    const paid = assertPaymentAmount(args.amount, remaining, "Final payment");
    const now = Date.now();
    await ctx.db.patch(args.orderId, {
      paymentStatus: "FULLY_PAID",
      finalPaidAmount: paid,
      remainingDueAmount: 0,
      finalPaymentMethod: args.paymentMethod.trim(),
      finalPaymentReference: args.paymentReference?.trim() || undefined,
      finalPaymentConfirmedAt: now,
      finalPaymentConfirmedBy: identity._id,
      updatedAt: now,
    });
    await notifyOrderRoles(ctx, {
      title: "Order fully paid",
      message: `${order.code} · ${order.clientName} final balance settled (${paid.toFixed(2)} ETB).`,
      type: "order_status",
      actorAuthUserId: identity._id,
      relatedTable: "customerOrders",
      relatedId: args.orderId,
    });
    return { success: true as const, alreadySettled: false as const, paymentStatus: "FULLY_PAID" as const };
  },
});

/**
 * Receptionist-initiated rejection triggered from the inline Telegram action
 * keyboard ("Reject" button on the new-order alert). Transitions the order to
 * `EXPIRED` and pushes a polite customer-facing notification so the customer
 * immediately knows their order was declined.
 */
export const rejectFromReception = mutation({
  args: { orderId: v.id("customerOrders"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "order.manage");
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    if (["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"].includes(order.status)) {
      throw new Error(`Cannot reject an order already in status ${order.status}.`);
    }
    await ctx.db.patch(args.orderId, {
      status: "EXPIRED",
      updatedAt: Date.now(),
    });
    await notifyOrderRoles(ctx, {
      title: "Order rejected by reception",
      message: `${order.code} · ${order.clientName} was rejected from the receptionist console.`,
      type: "order_status",
      actorAuthUserId: identity._id,
      relatedTable: "customerOrders",
      relatedId: args.orderId,
    });
    if (order.telegramChatId) {
      const trimmed = args.note?.trim();
      const tail = trimmed ? `\n\n📝 ${trimmed}` : "";
      await ctx.scheduler.runAfter(0, internal.orders.sendTelegramNotificationInternal, {
        chatId: order.telegramChatId,
        message:
          `❌ <b>ትዕዛዝዎ ተከለከለ</b>\n\n` +
          `• የትዕዛዝ መለያ: <code>${order.code}</code>\n` +
          `ለበለጠ መረጃ እባክዎ ከሪሴፕሽን ጋር ይገናኙ።${tail}`,
      });
    }
    return { success: true as const };
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
      (order) => !["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"].includes(order.status) && order.preferredDueDate < now,
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
      (order) => !["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"].includes(order.status) && order.preferredDueDate < now,
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

    const config = await ensureSystemConfig(ctx);
    if (config.requireAdminPinForExceptions) {
      if (!args.authorizationNote || !args.authorizationNote.trim()) {
        throw new Error("ADMIN_PIN_REQUIRED: Authorization note or PIN reference is required for direct exception stock-outs.");
      }
    }
    if (config.maxDirectStockOutEtb > 0) {
      const etbRate = typeof material.etbValue === "number" && material.etbValue > 0 ? material.etbValue : 0;
      const totalEtb = args.quantity * etbRate;
      if (totalEtb > config.maxDirectStockOutEtb) {
        throw new Error(`EXCEEDS_MAX_DIRECT_STOCK_OUT: Direct exception value (${totalEtb.toFixed(2)} ETB) exceeds maximum direct stock-out limit (${config.maxDirectStockOutEtb} ETB). Admin or owner elevation required.`);
      }
    }
    const now = Date.now();
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
    await recordInventoryEvent(ctx, {
      materialId: args.materialId,
      eventType: "EXCEPTION_STOCK_OUT",
      custody: "parent",
      balanceEffect: "out",
      quantity: args.quantity,
      unit: args.unit,
      baseUnit,
      baseQuantity: args.quantity,
      note: `Direct exception stock-out · ${args.reason}${args.authorizationNote ? ` · ${args.authorizationNote.trim()}` : ""}`,
      createdBy: identity._id,
    });
    const updatedMaterial = await ctx.db.get(args.materialId);
    const nextQuantity = updatedMaterial?.quantity ?? 0;
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
    serviceType: serviceType,
    serviceId: v.optional(serviceType),
    specifications: v.optional(v.record(v.string(), v.string())),
    dimensions: v.optional(v.string()),
    quantity: v.optional(v.string()),
    length: v.optional(v.number()),
    width: v.optional(v.number()),
    phone: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const customerName = args.customerName.trim();
    const serviceTypeRaw = (args.serviceType as string).trim();
    const serviceType = serviceTypeRaw as typeof args.serviceType;
    const serviceId = (args.serviceId ?? serviceType) as string;
    const orderWidth = args.width ?? (args.dimensions ? parseDimensions(args.dimensions)?.width : undefined);
    const specifications = withDerivedRollSubstrate(
      serviceId,
      validateServiceSpecifications(serviceId, args.specifications),
      orderWidth,
    );
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
      serviceId: serviceId as typeof serviceType,
      specifications,
      dimensions: args.dimensions?.trim() || "TBD",
      length: args.length,
      width: args.width,
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
      const canExpire = order.status === "PENDING_REVIEW" || order.status === "RECEPTION_REVIEW" || order.status === "PRICED_AND_PENDING_PAYMENT";
      if (!canExpire || order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_PAID" || order.paymentStatus === "FULLY_PAID" || order.paymentStatus === "APPROVED_CREDIT" || !order.expiresAt || order.expiresAt >= now) {
        continue;
      }

      if (order.fileStorageId) await ctx.storage.delete(order.fileStorageId);
      await ctx.db.patch(order._id, {
        status: "EXPIRED_JUNK",
        archivedAt: now,
        archiveReason: "Unpaid order expired",
        fileStorageId: undefined,
        fileName: undefined,
        updatedAt: now,
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
  returns: v.object({ success: v.boolean() }),
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

export const sendTelegramNotificationInternal = internalAction({
  args: {
    chatId: v.string(),
    message: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
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
