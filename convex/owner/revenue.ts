import { query } from "../_generated/server";
import { requireOwner } from "../users";
import { getStartOfDay } from "./common";

/**
 * Income / Money-in summary. Splits paid vs pending amounts and gives a simple
 * revenue figure from confirmed order totals.
 */
export const getRevenueSummary = query({
  handler: async (ctx) => {
    await requireOwner(ctx);
    const startOfDay = getStartOfDay();
    const orders = await ctx.db.query("customerOrders").collect();
    const todayOrders = orders.filter((o) => o.createdAt >= startOfDay);

    const paidOrders = orders.filter((o) => o.paymentStatus === "PAID");
    const creditOrders = orders.filter((o) => o.paymentStatus === "APPROVED_CREDIT");
    const pendingPayment = orders.filter((o) =>
      o.status === "PRICED_AND_PENDING_PAYMENT" ||
      (o.paymentStatus === "APPROVED_CREDIT" && o.status !== "COMPLETED"),
    );

    const totalRevenue = paidOrders.reduce((s, o) => s + (o.amount ?? 0), 0);
    const todayPaid = todayOrders
      .filter((o) => o.paymentStatus === "PAID")
      .reduce((s, o) => s + (o.amount ?? 0), 0);
    const pendingPaymentTotal = pendingPayment.reduce((s, o) => s + (o.amount ?? 0), 0);
    const outstandingCredit = creditOrders.reduce((s, o) => s + (o.amount ?? 0), 0);

    return {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      todayPaid: Number(todayPaid.toFixed(2)),
      todayOrderCount: todayOrders.length,
      pendingPaymentCount: pendingPayment.length,
      pendingPaymentTotal: Number(pendingPaymentTotal.toFixed(2)),
      outstandingCredit: Number(outstandingCredit.toFixed(2)),
      paidOrderCount: paidOrders.length,
      generatedAt: Date.now(),
    };
  },
});