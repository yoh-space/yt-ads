import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireOwner } from "../users";
import { resolveEtbValueFromConfig } from "../materialUsage";

const DAY = 24 * 60 * 60 * 1000;
const analyticsArgs = { from: v.number(), to: v.number(), compare: v.optional(v.boolean()) };

function round(value: number) { return Number(value.toFixed(2)); }
function isLiveOrder(status: string) { return !["EXPIRED", "EXPIRED_JUNK"].includes(status); }
function dayKey(timestamp: number) { return new Date(timestamp).toISOString().slice(0, 10); }
function labelFor(timestamp: number) { return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }

export const getExecutiveAnalytics = query({
  args: analyticsArgs,
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const from = Math.min(args.from, args.to);
    const to = Math.max(args.from, args.to);
    const previousFrom = from - (to - from);
    const [orders, movements, materials, reconciliations, jobs, configRows] = await Promise.all([
      ctx.db.query("customerOrders").collect(),
      ctx.db.query("stock_movements").collect(),
      ctx.db.query("materials").collect(),
      ctx.db.query("reconciliations").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("systemConfigs").collect(),
    ]);
    const config = configRows.find((row) => row.key === "default");
    const valuationConfig = config ?? {
      etbPerSquareMetre: 250, etbPerLitre: 900, etbPerPiece: 120, etbPerMetre: 150, etbPerSheet: 400, materialOverrides: [],
    };
    const materialMap = new Map(materials.map((material) => [material._id, material]));
    const jobMap = new Map(jobs.map((job) => [job._id, job]));
    // Financial production cost is recognized only when an operator deduction
    // records actual production consumption. Store transfers and exception
    // stock-outs are inventory movements, not consumed production cost.
    const costEvents = new Set(["PRODUCTION_CONSUMPTION"]);
    const consumptionEvents = new Set(["PRODUCTION_CONSUMPTION", "STORE_TO_OPERATOR_TRANSFER", "EXCEPTION_STOCK_OUT"]);
    const inRange = (timestamp: number, start = from, end = to) => timestamp >= start && timestamp < end;
    const revenueAt = (start: number, end: number) => orders.filter((order) => inRange(order.createdAt, start, end) && isLiveOrder(order.status)).reduce((sum, order) => sum + (order.amount ?? 0), 0);
    const costAt = (start: number, end: number) => movements.filter((movement) => inRange(movement.createdAt, start, end) && costEvents.has(movement.eventType)).reduce((sum, movement) => {
      const material = materialMap.get(movement.materialId);
      return sum + Math.max(0, movement.baseQuantity) * resolveEtbValueFromConfig(material ?? { name: "Material", baseUnit: movement.baseUnit }, valuationConfig);
    }, 0);
    const lossAt = (start: number, end: number) => reconciliations.filter((item) => inRange(item.createdAt, start, end) && item.variance < 0).reduce((sum, item) => sum + Math.abs(item.monetaryLoss ?? item.etbValue ?? 0), 0);
    const buildMetrics = (start: number, end: number) => {
      const revenue = revenueAt(start, end); const materialCost = costAt(start, end); const loss = lossAt(start, end); const profit = revenue - materialCost - loss;
      return { revenue: round(revenue), materialCost: round(materialCost), loss: round(loss), profit: round(profit), margin: revenue ? round((profit / revenue) * 100) : 0 };
    };
    const metrics = buildMetrics(from, to);
    const previous = args.compare ? buildMetrics(previousFrom, from) : null;
    const buckets = new Map<string, { timestamp: number; revenue: number; materialCost: number; loss: number }>();
    for (let timestamp = from; timestamp < to; timestamp += DAY) buckets.set(dayKey(timestamp), { timestamp, revenue: 0, materialCost: 0, loss: 0 });
    for (const order of orders) { const bucket = buckets.get(dayKey(order.createdAt)); if (bucket && isLiveOrder(order.status)) bucket.revenue += order.amount ?? 0; }
    for (const movement of movements) { const bucket = buckets.get(dayKey(movement.createdAt)); if (bucket && costEvents.has(movement.eventType)) { const material = materialMap.get(movement.materialId); bucket.materialCost += Math.max(0, movement.baseQuantity) * resolveEtbValueFromConfig(material ?? { name: "Material", baseUnit: movement.baseUnit }, valuationConfig); } }
    for (const item of reconciliations) { const bucket = buckets.get(dayKey(item.createdAt)); if (bucket && item.variance < 0) bucket.loss += Math.abs(item.monetaryLoss ?? item.etbValue ?? 0); }
    const trend = [...buckets.values()].map((bucket) => ({ date: labelFor(bucket.timestamp), revenue: round(bucket.revenue), materialCost: round(bucket.materialCost), profit: round(bucket.revenue - bucket.materialCost - bucket.loss), margin: bucket.revenue ? round(((bucket.revenue - bucket.materialCost - bucket.loss) / bucket.revenue) * 100) : 0 }));

    const consumption = new Map<string, number>();
    for (const movement of movements) if (movement.createdAt >= to - 30 * DAY && movement.createdAt < to && consumptionEvents.has(movement.eventType)) consumption.set(movement.materialId, (consumption.get(movement.materialId) ?? 0) + Math.max(0, movement.baseQuantity));
    const runwayMaterials = materials.filter((material) => material.active).map((material) => { const consumed = consumption.get(material._id) ?? 0; const daily = consumed / 30; const stock = material.quantity ?? 0; const runway = daily > 0 ? Math.round(stock / daily) : stock <= 0 ? 0 : null; const health = stock <= 0 || (runway !== null && runway < 7) ? "Critical" : runway !== null && runway <= 14 ? "Warning" : "Healthy"; return { name: material.name, category: material.category ?? "Other", consumption: round(consumed), runway, health }; }).sort((a, b) => (a.runway ?? 9999) - (b.runway ?? 9999));

    const serviceRevenue = new Map<string, number>(); const serviceCost = new Map<string, number>();
    for (const order of orders) if (inRange(order.createdAt) && isLiveOrder(order.status)) serviceRevenue.set(order.serviceType, (serviceRevenue.get(order.serviceType) ?? 0) + (order.amount ?? 0));
    for (const movement of movements) if (inRange(movement.createdAt) && costEvents.has(movement.eventType)) { const service = movement.jobCardId ? (jobMap.get(movement.jobCardId)?.serviceType ?? "Other") : "Other"; const material = materialMap.get(movement.materialId); serviceCost.set(service, (serviceCost.get(service) ?? 0) + Math.max(0, movement.baseQuantity) * resolveEtbValueFromConfig(material ?? { name: "Material", baseUnit: movement.baseUnit }, valuationConfig)); }
    const services = [...new Set([...serviceRevenue.keys(), ...serviceCost.keys()])].map((service) => { const revenue = serviceRevenue.get(service) ?? 0; const cost = serviceCost.get(service) ?? 0; return { service, revenue: round(revenue), cost: round(cost), margin: revenue ? round(((revenue - cost) / revenue) * 100) : 0 }; }).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
    return { from, to, metrics, previous, trend, services, runway: { critical: runwayMaterials.filter((item) => item.health === "Critical").length, warning: runwayMaterials.filter((item) => item.health === "Warning").length, healthy: runwayMaterials.filter((item) => item.health === "Healthy").length, materials: runwayMaterials.slice(0, 12) } };
  },
});
