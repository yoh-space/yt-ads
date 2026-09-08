import { query } from "../_generated/server";
import { requireManagerRole } from "../users";
import { conversionFactorFor } from "../inventory";

/**
 * Manager workspace operational snapshot for the /dashboard/manager namespace.
 * Strictly gated to the manager role; purpose-built shape replaces the full
 * `dashboard.getState` payload on the manager home page.
 */
export const getOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireManagerRole(ctx);
    const [machines, jobs, orders, requests, items, materials] = await Promise.all([
      ctx.db.query("machines").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("customerOrders").collect(),
      ctx.db.query("materialRequests").collect(),
      ctx.db.query("parentInventory").collect(),
      ctx.db.query("materials").collect(),
    ]);

    const materialById = new Map(materials.map((material) => [material._id, material]));
    const lowStockItems = items
      .map((item) => {
        const material = materialById.get(item.materialId);
        const factor = conversionFactorFor(item);
        const threshold = factor && factor > 0 ? (material?.reorderAt ?? 0) / factor : material?.reorderAt ?? 0;
        return {
          materialName: material?.name ?? "Unknown material",
          unitType: item.unitType,
          totalStockQuantity: item.totalStockQuantity,
          storageLocation: material?.storageLocation ?? "Central store",
          threshold,
        };
      })
      .filter((item) => item.threshold > 0 && item.totalStockQuantity <= item.threshold)
      .sort((left, right) => left.totalStockQuantity - right.totalStockQuantity);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayStart = startOfDay.getTime();
    const todaysOrderCount = orders.filter((order) => order.createdAt >= todayStart).length;

    return {
      machinesCount: machines.length,
      runningMachines: machines.filter((machine) => machine.status === "Running").length,
      availableMachines: machines.filter((machine) => machine.status === "Available").length,
      maintenanceMachines: machines.filter((machine) => machine.status === "Maintenance").length,
      queuedJobs: jobs.filter((job) => job.status === "Queued").length,
      activeJobs: jobs.filter((job) => job.status === "In production").length,
      pausedJobs: jobs.filter((job) => job.status === "Paused").length,
      completedJobs: jobs.filter((job) => job.status === "Completed").length,
      todaysOrderCount,
      activeOrderCount: orders.filter((order) => order.status === "IN_PRODUCTION").length,
      pendingRequests: requests.filter(
        (request) => request.status === "Requested" || request.status === "Partially Issued",
      ).length,
      lowStockCount: lowStockItems.length,
      lowStockItems,
    };
  },
});