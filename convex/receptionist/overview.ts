import { query } from "../_generated/server";
import { requireReceptionist } from "../users";

const TERMINAL_STATUSES = new Set(["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"]);

/**
 * Receptionist workspace snapshot for /dashboard/receptionist. Strictly gated to
 * the receptionist role; returns the desk-facing intake / payment / production
 * picture without any machinery or inventory details.
 */
export const getOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireReceptionist(ctx);
    const orders = await ctx.db.query("customerOrders").collect();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayStart = startOfDay.getTime();

    const todaysIntake = orders.filter((order) => order.createdAt >= todayStart);
    const pendingReview = orders.filter((order) => order.status === "PENDING_REVIEW");
    const awaitingPayment = orders.filter((order) => order.status === "PRICED_AND_PENDING_PAYMENT");
    const inProduction = orders.filter((order) => order.status === "IN_PRODUCTION");
    const overdue = orders.filter(
      (order) => !TERMINAL_STATUSES.has(order.status) && order.preferredDueDate < Date.now(),
    );

    const awaitingPaymentAmount = awaitingPayment.reduce(
      (sum, order) => sum + (Number.isFinite(order.amount) ? (order.amount ?? 0) : 0),
      0,
    );

    const recentOrders = [...orders]
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 5)
      .map((order) => ({
        id: order._id,
        code: order.code,
        clientName: order.clientName,
        serviceType: order.serviceType,
        status: order.status,
        amount: order.amount,
        createdAt: order.createdAt,
      }));

    return {
      todaysIntakeCount: todaysIntake.length,
      pendingReviewCount: pendingReview.length,
      awaitingPaymentCount: awaitingPayment.length,
      awaitingPaymentAmount: Number(awaitingPaymentAmount.toFixed(2)),
      inProductionCount: inProduction.length,
      overdueCount: overdue.length,
      recentOrders,
    };
  },
});