import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { requireReceptionist } from "../users";

/**
 * Purpose-built receipt payload for the /dashboard/receptionist print flow.
 * Combines the order, its production assignment, and company identity so the
 * offline receipt sheet (Tauri `printNative()`) needs no further fetching.
 */
export const getReceiptData = query({
  args: { orderId: v.id("customerOrders") },
  handler: async (ctx, args) => {
    const { identity } = await requireReceptionist(ctx);
    const [order, machines, jobCards, companySettings, profile] = await Promise.all([
      ctx.db.get(args.orderId),
      ctx.db.query("machines").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("companySettings").withIndex("by_key", (q) => q.eq("key", "yt-advertisement")).unique(),
      ctx.db.query("users").withIndex("by_auth_user", (q) => q.eq("authUserId", identity._id)).unique(),
    ]);
    if (!order) throw new Error("Order not found.");

    const assignedMachine = order.machineId ? machines.find((entry) => entry._id === order.machineId) : undefined;
    const job = order.jobCardId ? jobCards.find((entry) => entry._id === order.jobCardId) : undefined;

    return {
      orderedBy: profile?.name ?? "Reception",
      printedAt: Date.now(),
      company: {
        name: companySettings?.companyName ?? "",
        address: companySettings?.address,
        phone: companySettings?.phone,
      },
      order: {
        id: order._id,
        code: order.code,
        clientName: order.clientName,
        phone: order.phone,
        serviceType: order.serviceType,
        dimensions: order.dimensions,
        quantity: order.quantity,
        amount: order.amount,
        paymentStatus: order.paymentStatus,
        status: order.status,
        createdAt: order.createdAt,
        preferredDueDate: order.preferredDueDate,
        notes: order.notes,
      },
      assignment: {
        machineName: assignedMachine?.name ?? undefined,
        jobCode: job?.code,
        jobStatus: job?.status,
        priority: order.priority,
      },
    };
  },
});