import { query } from "./_generated/server";
import { requireActiveProfile } from "./users";

/**
 * Single round-trip that returns everything the operations dashboard needs:
 * materials, machines, job cards, offcuts, and the scrap register. Reactive by
 * default, so the UI updates in real time as the team records activity.
 */
export const getState = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireActiveProfile(ctx);
    const canSeeAllMachines = ["owner", "manager", "admin", "storekeeper"].includes(profile.role);
    const [materials, allMachines, allJobs, offcuts, scraps, orders] = await Promise.all([
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
    const machines = allMachines.filter((machine) => canSeeAllMachines || machine.operatorRole === profile.role);
    const allowedMachineIds = new Set(machines.map((machine) => machine._id));
    const jobs = allJobs.filter((job) => canSeeAllMachines || allowedMachineIds.has(job.machineId));
    const jobMaterialIds = new Set(jobs.map((job) => job.materialId));
    const visibleMaterials = canSeeAllMachines ? materials : materials.filter((material) => jobMaterialIds.has(material._id));
    const visibleOffcuts = canSeeAllMachines ? offcuts : offcuts.filter((offcut) => jobMaterialIds.has(offcut.materialId));
    const visibleScraps = canSeeAllMachines ? scraps : scraps.filter((scrap) => jobMaterialIds.has(scrap.materialId));
    const ordersById = new Map(orders.map((order) => [order._id, order]));
    const enrichedJobs = jobs.map((job) => {
      const order = job.orderId ? ordersById.get(job.orderId) : undefined;
      return {
        ...job,
        orderStatus: order?.status,
        orderOverdue: Boolean(order && order.status !== "Completed" && order.preferredDueDate < Date.now()),
      };
    });
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todaysOrders = orders.filter((order) => order.createdAt >= startOfDay).length;
    const completedOrders = orders.filter((order) => order.status === "Completed").length;
    const queueOrders = orders.filter((order) => order.status === "Received").length;
    const activeProductionOrders = orders.filter((order) => order.status === "In Production").length;
    return {
      materials: visibleMaterials,
      machines,
      jobs: enrichedJobs,
      offcuts: visibleOffcuts,
      scraps: visibleScraps,
      orderStats: { todaysOrders, completedOrders, queueOrders, activeProductionOrders },
    };
  },
});
