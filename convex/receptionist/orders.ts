import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { orderPriority, orderStatus, serviceType } from "../schema";
import { requireReceptionist } from "../users";
import {
  createWalkInInternal,
  lockOrderForReviewInternal,
  priceOrderInternal,
  setStatusInternal,
} from "../orders";
import { normalizePhone as normalizeSharedPhone } from "../../src/shared/phone-normalization";

/**
 * Receptionist order surface for the /dashboard/receptionist namespace. Strictly
 * gated to the receptionist role. Reads enrich the shared order docs the same
 * way the generic `orders.list` does; the key mutations (create walk-in, status
 * transitions, quote commit) re-gate with the strict guard and delegate to the
 * shared internal bodies so generic + namespace behavior never drifts.
 */

async function enrichOrders(ctx: any, orders: Doc<"customerOrders">[]) {
  const machines = (await ctx.db.query("machines").collect()) as Doc<"machines">[];
  const machineNames = new Map(machines.map((machine) => [machine._id, machine.name]));
  return Promise.all(orders.map(async (order) => ({
    ...order,
    tinNumber: order.tinNumber,
    companyLegalName: order.companyLegalName,
    machineName: order.machineId ? machineNames.get(order.machineId) : undefined,
    overdue: !["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"].includes(order.status) &&
      order.preferredDueDate < Date.now(),
    fileUrl: order.fileStorageId ? await ctx.storage.getUrl(order.fileStorageId) : undefined,
  })));
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireReceptionist(ctx);
    const orders = await ctx.db.query("customerOrders").withIndex("by_due_date").collect();
    const ordered = [...orders].sort((left, right) => {
      const rank = { High: 0, Medium: 1, Low: 2 } as const;
      return rank[left.priority] - rank[right.priority] || left.preferredDueDate - right.preferredDueDate;
    });
    return enrichOrders(ctx, ordered);
  },
});

/**
 * Reception-desk order lookup by code (ORD-...) or phone number. Gated to the
 * receptionist role; mirror of the existing public `orders.track` shape but for
 * internal desk use (no public-status filtering).
 */
export const lookup = query({
  args: { lookup: v.string() },
  handler: async (ctx, args) => {
    await requireReceptionist(ctx);
    const term = args.lookup.trim();
    if (!term) return [];
    const byCode = term.toUpperCase().startsWith("ORD-")
      ? await ctx.db.query("customerOrders").withIndex("by_code", (q) => q.eq("code", term.toUpperCase())).collect()
      : [];
    const byPhone = byCode.length > 0
      ? []
      : await ctx.db.query("customerOrders").withIndex("by_phone", (q) => q.eq("phone", normalizeSharedPhone(term) ?? term.replace(/[^+\d]/g, "").trim())).collect();
    const results = [...byCode, ...byPhone]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 10);
    return enrichOrders(ctx, results);
  },
});

/** Walk-in order creation re-gated for the reception desk. */
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
    const { identity } = await requireReceptionist(ctx);
    return createWalkInInternal(ctx, identity, args);
  },
});

/** Reception-desk status progression (PENDING_REVIEW → PRICED → …). */
export const setStatus = mutation({
  args: { orderId: v.id("customerOrders"), status: orderStatus },
  handler: async (ctx, args) => {
    const { identity } = await requireReceptionist(ctx);
    return setStatusInternal(ctx, identity, args);
  },
});

/** Quote commit: records the final price and moves the order awaiting payment. */
export const priceOrder = mutation({
  args: { orderId: v.id("customerOrders"), amount: v.number() },
  handler: async (ctx, args) => {
    const { identity } = await requireReceptionist(ctx);
    return priceOrderInternal(ctx, identity, args);
  },
});

/**
 * First review action at the reception desk: atomically locks customer editing
 * and moves the order to RECEPTION_REVIEW. Subsequent pricing and payment
 * confirmation require this lock.
 */
export const lockOrderForReview = mutation({
  args: { orderId: v.id("customerOrders"), reviewLockReason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { identity } = await requireReceptionist(ctx);
    return lockOrderForReviewInternal(ctx, identity, args);
  },
});