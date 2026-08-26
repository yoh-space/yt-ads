import { query } from "./_generated/server";
import { authComponent } from "./auth";

/**
 * Single round-trip that returns everything the operations dashboard needs:
 * materials, machines, job cards, offcuts, and the scrap register. Reactive by
 * default, so the UI updates in real time as the team records activity.
 */
export const getState = query({
  args: {},
  handler: async (ctx) => {
    await authComponent.getAuthUser(ctx);
    const [materials, machines, jobs, offcuts, scraps, orders] = await Promise.all([
      ctx.db
        .query("materials")
        .filter((q) => q.eq(q.field("active"), true))
        .collect(),
      ctx.db
        .query("machines")
        .filter((q) => q.eq(q.field("active"), true))
        .collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db
        .query("offcuts")
        .filter((q) => q.eq(q.field("status"), "available"))
        .collect(),
      ctx.db.query("scraps").collect(),
      ctx.db.query("customerOrders").collect(),
    ]);
    const ordersById = new Map(orders.map((order) => [order._id, order]));
    const enrichedJobs = jobs.map((job) => {
      const order = job.orderId ? ordersById.get(job.orderId) : undefined;
      return {
        ...job,
        orderStatus: order?.status,
        orderOverdue: Boolean(order && order.status !== "Completed" && order.preferredDueDate < Date.now()),
      };
    });
    return { materials, machines, jobs: enrichedJobs, offcuts, scraps };
  },
});
