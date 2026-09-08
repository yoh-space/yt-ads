import { query } from "../_generated/server";
import { requireAdminRole } from "../users";

/**
 * Reconciliation & clearance summary for the admin approval page. Lists floor
 * batches pending clearance along with recent reconciliation counts.
 */
export const getReconciliationSummary = query({
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    const [subStock, machines, users, reconciliations] = await Promise.all([
      ctx.db.query("operatorSubStock").collect(),
      ctx.db.query("machines").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("reconciliations").collect(),
    ]);
    const machineMap = new Map(machines.map((m) => [m._id, m]));
    const nameByUser = new Map(users.map((u) => [u.authUserId, u.name]));

    const pending = subStock
      .filter((b) => b.status === "PENDING_CLEARANCE")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((b) => ({
        id: b._id,
        machineName: machineMap.get(b.machineId)?.name ?? "Machine",
        operatorName: nameByUser.get(b.operatorId) ?? "Assigned operator",
        issued: b.issuedBaseQuantity ?? b.issuedQuantity,
        remaining: b.remainingBaseQuantity ?? b.currentRemaining ?? 0,
        unit: b.baseUnit ?? "units",
        updatedAt: b.updatedAt,
      }));

    const shortages = reconciliations.filter((r) => r.variance < 0);
    const surpluses = reconciliations.filter((r) => r.variance > 0);

    return {
      pendingClearances: pending,
      pendingCount: pending.length,
      shortagesCount: shortages.length,
      surplusesCount: surpluses.length,
      totalReconciliations: reconciliations.length,
    };
  },
});