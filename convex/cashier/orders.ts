import { mutation, query } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { orderPriority, unit } from "../schema";
import { requireRoles } from "../users";
import { notifyRoles } from "../notificationHelpers";
import { confirmOrderAndIssueJobCardInternal } from "../orders";

const CASHIER_ROLES = ["cashier", "owner", "admin"] as const;

export const listOrdersWaitingForPayment = query({
  args: {},
  handler: async (ctx) => {
    await requireRoles(ctx, CASHIER_ROLES);

    const orders = await ctx.db
      .query("customerOrders")
      .withIndex("by_status", (q) => q.eq("status", "PRICED_AND_PENDING_PAYMENT"))
      .collect();

    const readyOrders = orders.filter((order) => {
      if (order.jobCardId) return false;
      if (!order.amount || order.amount <= 0) return false;
      if (order.designRequired && order.designStatus !== "APPROVED") return false;
      return true;
    });

    const now = Date.now();

    return Promise.all(
      readyOrders.map(async (order) => {
        const fileUrl = order.fileStorageId ? await ctx.storage.getUrl(order.fileStorageId) : null;
        let approvedDesignUrl: string | null = null;
        let approvedDesignName: string | null = null;

        if (order.activeDesignTaskId) {
          const task = await ctx.db.get(order.activeDesignTaskId);
          if (task?.latestSubmissionId) {
            const sub = await ctx.db.get(task.latestSubmissionId);
            if (sub && sub.status === "APPROVED") {
              approvedDesignUrl = await ctx.storage.getUrl(sub.fileStorageId);
              approvedDesignName = sub.fileName;
            }
          }
        }

        const waitingTimeMs = now - (order.pricedAt ?? order.updatedAt ?? order.createdAt);

        return {
          ...order,
          fileUrl,
          approvedDesignUrl,
          approvedDesignName,
          waitingTimeMs,
        };
      }),
    );
  },
});

export const getPaymentReview = query({
  args: { orderId: v.id("customerOrders") },
  handler: async (ctx, args) => {
    await requireRoles(ctx, CASHIER_ROLES);

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Order not found.");

    const fileUrl = order.fileStorageId ? await ctx.storage.getUrl(order.fileStorageId) : null;
    const attachmentUrls = order.attachmentStorageIds
      ? await Promise.all(order.attachmentStorageIds.map((id) => ctx.storage.getUrl(id)))
      : [];

    let designSubmissions: any[] = [];
    if (order.activeDesignTaskId) {
      const subs = await ctx.db
        .query("designSubmissions")
        .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
        .collect();

      designSubmissions = await Promise.all(
        subs.map(async (sub) => ({
          ...sub,
          fileUrl: await ctx.storage.getUrl(sub.fileStorageId),
        })),
      );
    }

    const events = await ctx.db
      .query("orderEvents")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    return {
      ...order,
      fileUrl,
      attachmentUrls,
      designSubmissions: designSubmissions.sort((a, b) => b.versionNumber - a.versionNumber),
      events: events.sort((a, b) => b.createdAt - a.createdAt),
    };
  },
});

export const verifyPaymentAndIssueJobCard = mutation({
  args: {
    orderId: v.id("customerOrders"),
    amount: v.number(),
    paymentDecision: v.union(v.literal("ADVANCE_PAID"), v.literal("APPROVED_CREDIT")),
    paymentMethod: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    advancePaidAmount: v.optional(v.number()),
    cashierNotes: v.optional(v.string()),
    machineId: v.optional(v.id("machines")),
    materialId: v.optional(v.id("materials")),
    quantity: v.optional(v.number()),
    unit: v.optional(unit),
    priority: v.optional(orderPriority),
    deductOnComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireRoles(ctx, CASHIER_ROLES);

    if (args.cashierNotes) {
      await ctx.db.patch(args.orderId, {
        cashierNotes: args.cashierNotes.trim(),
      });
    }

    return confirmOrderAndIssueJobCardInternal(ctx, identity, args);
  },
});

export const returnPaymentToReception = mutation({
  args: {
    orderId: v.id("customerOrders"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireRoles(ctx, CASHIER_ROLES);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Order not found.");

    if (order.jobCardId) {
      throw new ConvexError("Cannot return an order that already has an issued job card.");
    }

    const cleanReason = args.reason.trim();
    if (!cleanReason) throw new ConvexError("Reason for returning payment to reception is required.");

    const now = Date.now();
    await ctx.db.patch(args.orderId, {
      status: "RECEPTION_REVIEW",
      returnedToReceptionReason: cleanReason,
      returnedToReceptionAt: now,
      returnedToReceptionBy: identity._id,
      updatedAt: now,
    });

    await ctx.db.insert("orderEvents", {
      orderId: args.orderId,
      actorId: identity._id,
      actorLabel: `Cashier · ${identity.name ?? "Staff"}`,
      action: "RETURNED_TO_RECEPTION",
      detail: `Payment returned to reception: ${cleanReason}`,
      createdAt: now,
    });

    await notifyRoles(ctx, ["receptionist", "owner", "admin"], {
      title: "Order payment returned to reception",
      message: `${order.code} · Cashier returned order: ${cleanReason}`,
      type: "payment_returned",
      actorAuthUserId: identity._id,
      relatedTable: "customerOrders",
      relatedId: args.orderId,
    });

    return { success: true };
  },
});

export const listRecentPaymentVerifications = query({
  args: {},
  handler: async (ctx) => {
    await requireRoles(ctx, CASHIER_ROLES);

    const orders = await ctx.db.query("customerOrders").collect();
    const verified = orders
      .filter((o) => o.paymentVerifiedAt !== undefined || (o.paymentConfirmedAt !== undefined && o.jobCardId !== undefined))
      .sort((a, b) => (b.paymentVerifiedAt ?? b.paymentConfirmedAt ?? 0) - (a.paymentVerifiedAt ?? a.paymentConfirmedAt ?? 0))
      .slice(0, 20);

    return Promise.all(
      verified.map(async (order) => {
        let jobCardCode: string | undefined = undefined;
        if (order.jobCardId) {
          const job = await ctx.db.get(order.jobCardId);
          jobCardCode = job?.code;
        }
        return {
          ...order,
          jobCardCode,
        };
      }),
    );
  },
});
