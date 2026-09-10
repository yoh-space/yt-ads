import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOwner } from "../users";
import { resolveEtbValueFromConfig } from "../materialUsage";
import { getStartOfDay } from "./common";

function round(value: number) { return Number(value.toFixed(2)); }
function inRange(value: number, from?: number, to?: number) { return (from === undefined || value >= from) && (to === undefined || value <= to); }
function methodLabel(value?: string) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized.includes("cbe")) return "CBE";
  if (normalized.includes("boa") || normalized.includes("abyssinia")) return "BOA";
  if (normalized.includes("telebirr")) return "Telebirr";
  if (normalized.includes("cash")) return "Cash";
  return value?.trim() || "Unspecified";
}
function shiftMatch(timestamp: number, shift?: string) {
  if (!shift || shift === "ALL") return true;
  const hour = new Date(timestamp).getHours();
  if (shift === "MORNING") return hour >= 6 && hour < 12;
  if (shift === "AFTERNOON") return hour >= 12 && hour < 18;
  if (shift === "EVENING") return hour >= 18 && hour < 24;
  return hour < 6;
}

export function calculateActualMaterialCost(
  movements: Array<{ eventType: string; baseQuantity: number; materialId: string }>,
  materials: Map<string, { name: string; baseUnit?: string; unit?: string; etbValue?: number }>,
  config: { etbPerSquareMetre: number; etbPerLitre: number; etbPerPiece: number; etbPerMetre: number; etbPerSheet: number; materialOverrides: Array<{ materialName: string; etbValue: number }> },
) {
  return round(movements
    .filter((movement) => movement.eventType === "PRODUCTION_CONSUMPTION")
    .reduce((sum, movement) => sum + movement.baseQuantity * resolveEtbValueFromConfig(materials.get(movement.materialId) ?? { name: "", baseUnit: "m²" }, config), 0));
}

/** Backwards-compatible summary used by existing overview consumers. */
export const getRevenueSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const startOfDay = getStartOfDay();
    const orders = await ctx.db.query("customerOrders").collect();
    const paidOrders = orders.filter((o) => o.paymentStatus === "PAID" || o.paymentStatus === "FULLY_PAID");
    const creditOrders = orders.filter((o) => o.paymentStatus === "APPROVED_CREDIT");
    const pendingPayment = orders.filter((o) => o.status === "PRICED_AND_PENDING_PAYMENT" || (o.paymentStatus === "APPROVED_CREDIT" && o.status !== "COMPLETED"));
    const totalRevenue = paidOrders.reduce((s, o) => s + (o.amount ?? 0), 0);
    const todayPaid = orders.filter((o) => (o.paymentStatus === "PAID" || o.paymentStatus === "FULLY_PAID") && o.createdAt >= startOfDay).reduce((s, o) => s + (o.amount ?? 0), 0);
    return {
      totalRevenue: round(totalRevenue), todayPaid: round(todayPaid), todayOrderCount: orders.filter((o) => o.createdAt >= startOfDay).length,
      pendingPaymentCount: pendingPayment.length, pendingPaymentTotal: round(pendingPayment.reduce((s, o) => s + (o.amount ?? 0), 0)),
      outstandingCredit: round(creditOrders.reduce((s, o) => s + (o.amount ?? 0), 0)), paidOrderCount: paidOrders.length,
      partialPaymentCount: orders.filter((o) => o.paymentStatus === "PARTIALLY_PAID").length,
      partialPaymentTotal: round(orders.reduce((s, o) => s + (o.advancePaidAmount ?? 0), 0)), generatedAt: Date.now(),
    };
  },
});

/** Owner financial workspace: payment collections plus COGS from completed production consumption only. */
export const getRevenueWorkspace = query({
  args: {
    from: v.optional(v.number()), to: v.optional(v.number()), hourStart: v.optional(v.number()), hourEnd: v.optional(v.number()), shift: v.optional(v.string()),
    paymentMethod: v.optional(v.string()), paymentStatus: v.optional(v.string()), selectedTransactionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const [orders, movements, materials, configs] = await Promise.all([
      ctx.db.query("customerOrders").collect(),
      ctx.db.query("stock_movements").collect(),
      ctx.db.query("materials").collect(),
      ctx.db.query("systemConfigs").withIndex("by_key", (q) => q.eq("key", "default")).first(),
    ]);
    const materialById = new Map(materials.map((material) => [material._id, material]));
    const config = configs ?? { etbPerSquareMetre: 0, etbPerLitre: 0, etbPerPiece: 0, etbPerMetre: 0, etbPerSheet: 0, materialOverrides: [] };
    const paymentMatches = (timestamp: number, method: string, status: string) => {
      if (!inRange(timestamp, args.from, args.to) || !shiftMatch(timestamp, args.shift)) return false;
      const hour = new Date(timestamp).getHours();
      if (args.hourStart !== undefined && args.hourEnd !== undefined && (hour < args.hourStart || hour >= args.hourEnd)) return false;
      if (args.paymentMethod && args.paymentMethod !== "ALL" && method !== args.paymentMethod) return false;
      if (args.paymentStatus && args.paymentStatus !== "ALL" && status !== args.paymentStatus) return false;
      return true;
    };
    const transactions = orders.flatMap((order) => {
      const rows: Array<any> = [];
      if (order.advancePaidAmount && order.advancePaymentConfirmedAt) rows.push({ id: `advance:${order._id}`, orderId: order._id, orderCode: order.code, customerName: order.clientName, paymentType: "ADVANCE_50%", paymentChannel: methodLabel(order.advancePaymentMethod), timestamp: order.advancePaymentConfirmedAt, amount: order.advancePaidAmount, status: "ADVANCE_50%", reference: order.advancePaymentReference, orderAmount: order.amount ?? 0 });
      if (order.finalPaidAmount && order.finalPaymentConfirmedAt) rows.push({ id: `settlement:${order._id}`, orderId: order._id, orderCode: order.code, customerName: order.clientName, paymentType: "SETTLEMENT", paymentChannel: methodLabel(order.finalPaymentMethod), timestamp: order.finalPaymentConfirmedAt, amount: order.finalPaidAmount, status: "SETTLEMENT", reference: order.finalPaymentReference, orderAmount: order.amount ?? 0 });
      if (order.paymentStatus === "PAID" && order.paymentConfirmedAt && !rows.length) rows.push({ id: `full:${order._id}`, orderId: order._id, orderCode: order.code, customerName: order.clientName, paymentType: "FULL_PAYMENT", paymentChannel: methodLabel(order.paymentMethod), timestamp: order.paymentConfirmedAt, amount: order.amount ?? 0, status: "FULL_PAYMENT", reference: undefined, orderAmount: order.amount ?? 0 });
      return rows.filter((row) => paymentMatches(row.timestamp, row.paymentChannel, row.status));
    }).sort((left, right) => right.timestamp - left.timestamp);
    const consumption = movements.filter((movement) => movement.eventType === "PRODUCTION_CONSUMPTION" && inRange(movement.createdAt, args.from, args.to) && shiftMatch(movement.createdAt, args.shift) && (args.hourStart === undefined || args.hourEnd === undefined || (new Date(movement.createdAt).getHours() >= args.hourStart && new Date(movement.createdAt).getHours() < args.hourEnd)));
    const materialCost = calculateActualMaterialCost(consumption, materialById, config);
    const realizedRevenue = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    const grossProfit = realizedRevenue - materialCost;
    const selected = args.selectedTransactionId ? transactions.find((transaction) => transaction.id === args.selectedTransactionId) : undefined;
    let detail = null;
    if (selected) {
      const order = orders.find((item) => item._id === selected.orderId);
      const orderMovements = consumption.filter((movement) => movement.jobCardId === order?.jobCardId);
      const job = order?.jobCardId ? await ctx.db.get(order.jobCardId) : null;
      const machine = job ? await ctx.db.get(job.machineId) : null;
      const jobs = job ? [job] : [];
      const costLines = orderMovements.map((movement) => { const material = materialById.get(movement.materialId); const unitCost = resolveEtbValueFromConfig(material ?? { name: "", baseUnit: movement.baseUnit }, config); return { materialName: material?.name ?? "Material", quantity: movement.baseQuantity, unit: movement.baseUnit, unitCost, cost: round(movement.baseQuantity * unitCost), createdAt: movement.createdAt }; });
      const orderTransactions = orders.flatMap((item) => { const result: Array<any> = []; if (item._id !== order?._id) return result; if (item.advancePaidAmount && item.advancePaymentConfirmedAt) result.push({ type: "Initial 50% advance", amount: item.advancePaidAmount, method: methodLabel(item.advancePaymentMethod), timestamp: item.advancePaymentConfirmedAt, reference: item.advancePaymentReference }); if (item.finalPaidAmount && item.finalPaymentConfirmedAt) result.push({ type: "Final settlement", amount: item.finalPaidAmount, method: methodLabel(item.finalPaymentMethod), timestamp: item.finalPaymentConfirmedAt, reference: item.finalPaymentReference }); return result; });
      detail = { ...selected, phone: order?.phone, serviceType: order?.serviceType, dimensions: order?.dimensions, paymentAudit: orderTransactions, jobs: jobs.map((item) => ({ code: item.code, title: item.title, status: item.status, machineName: machine?.name, due: item.due })), costLines, realizedCost: round(costLines.reduce((sum, line) => sum + line.cost, 0)), grossProfit: round((order?.amount ?? 0) - costLines.reduce((sum, line) => sum + line.cost, 0)) };
    }
    return { kpis: { realizedRevenue: round(realizedRevenue), materialCost: round(materialCost), grossProfit: round(grossProfit), margin: realizedRevenue ? round((grossProfit / realizedRevenue) * 100) : 0 }, transactions, detail, generatedAt: Date.now() };
  },
});
