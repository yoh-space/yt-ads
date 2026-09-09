import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireManagerRole } from "../users";
import { orderPriority, orderSource, orderStatus } from "../schema";

const managerOrder = v.object({
  id: v.id("customerOrders"),
  code: v.string(),
  clientName: v.string(),
  serviceType: v.string(),
  dimensions: v.string(),
  quantity: v.string(),
  preferredDueDate: v.number(),
  status: v.string(),
  priority: orderPriority,
  source: orderSource,
  machineName: v.optional(v.string()),
  jobCardAssigned: v.boolean(),
  overdue: v.boolean(),
  createdAt: v.number(),
});

function operationalStatus(status: string) {
  if (status === "PRICED_AND_PENDING_PAYMENT") return "IN_REVIEW";
  if (status === "CONFIRMED_PAID_OR_CREDIT") return "READY_FOR_PRODUCTION";
  return status;
}

export const getOrders = query({
  args: {},
  returns: v.object({
    total: v.number(),
    active: v.number(),
    overdue: v.number(),
    orders: v.array(managerOrder),
  }),
  handler: async (ctx) => {
    await requireManagerRole(ctx);
    const orders = await ctx.db.query("customerOrders").order("desc").take(200);
    const machineIds = [...new Set(orders.flatMap((order) => (order.machineId ? [order.machineId] : [])))];
    const machines = await Promise.all(machineIds.map((machineId) => ctx.db.get(machineId)));
    const machineNames = new Map(machineIds.map((machineId, index) => [machineId, machines[index]?.name]));

    const operationalOrders = orders.map((order) => ({
      id: order._id,
      code: order.code,
      clientName: order.clientName,
      serviceType: order.serviceType,
      dimensions: order.dimensions,
      quantity: order.quantity,
      preferredDueDate: order.preferredDueDate,
      status: operationalStatus(order.status),
      priority: order.priority,
      source: order.source,
      machineName: order.machineId ? machineNames.get(order.machineId) : undefined,
      jobCardAssigned: Boolean(order.jobCardId),
      overdue: Boolean(order.expiresAt && order.expiresAt < Date.now() && !["COMPLETED", "EXPIRED", "EXPIRED_JUNK"].includes(order.status)),
      createdAt: order.createdAt,
    }));

    return {
      total: operationalOrders.length,
      active: operationalOrders.filter((order) => !["COMPLETED", "EXPIRED", "EXPIRED_JUNK"].includes(order.status)).length,
      overdue: operationalOrders.filter((order) => order.overdue).length,
      orders: operationalOrders,
    };
  },
});
