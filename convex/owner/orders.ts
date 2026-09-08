import { query } from "../_generated/server";
import { requireOwner } from "../users";

/**
 * Order tracking summary: counts per status plus a recent orders list with
 * simple everyday labels for the owner's order page.
 */
export const getOrderSummary = query({
  handler: async (ctx) => {
    await requireOwner(ctx);
    const orders = await ctx.db.query("customerOrders").collect();
    const now = Date.now();

    const byStatus = new Map<string, number>();
    for (const order of orders) {
      byStatus.set(order.status, (byStatus.get(order.status) ?? 0) + 1);
    }

    const overdue = orders.filter(
      (o) =>
        !["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"].includes(o.status) &&
        o.preferredDueDate < now,
    ).length;

    const recent = orders
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 12)
      .map((o) => ({
        id: o._id,
        code: o.code,
        clientName: o.clientName,
        serviceType: o.serviceType,
        amount: o.amount ?? 0,
        status: o.status,
        priority: o.priority,
        preferredDueDate: o.preferredDueDate,
        createdAt: o.createdAt,
      }));

    return { totalOrders: orders.length, byStatus: Object.fromEntries(byStatus), overdue, recent };
  },
});