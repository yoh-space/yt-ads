import { query } from "../_generated/server";
import { requireAdminRole } from "../users";

/**
 * Reconciliation & clearance summary for the admin approval page. Lists floor
 * batches pending clearance along with recent reconciliation counts and the
 * full reconciliation history enriched with material and user names.
 */
export const getReconciliationSummary = query({
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    const [subStock, machines, users, reconciliations, materials] = await Promise.all([
      ctx.db.query("operatorSubStock").collect(),
      ctx.db.query("machines").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("reconciliations").collect(),
      ctx.db.query("materials").collect(),
    ]);
    const machineMap = new Map(machines.map((m) => [m._id, m]));
    const nameByUser = new Map(users.map((u) => [u.authUserId, u.name]));
    const materialMap = new Map(materials.map((m) => [m._id, m]));

    const pending = subStock
      .filter((b) => b.status === "PENDING_CLEARANCE")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((b) => ({
        id: b._id,
        machineName: machineMap.get(b.machineId)?.name ?? "Machine",
        operatorName: nameByUser.get(b.operatorId) ?? "Assigned operator",
        issued: b.issuedBaseQuantity ?? b.issuedQuantity,
        remaining: b.issuedBaseQuantity ?? b.currentRemaining ?? 0,
        unit: b.baseUnit ?? "units",
        updatedAt: b.updatedAt,
      }));

    const allReconciliations = reconciliations
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({
        id: r._id,
        materialName: materialMap.get(r.materialId)?.name ?? "Material",
        status: r.status,
        systemQuantity: r.systemQuantity,
        countedQuantity: r.countedQuantity,
        variance: r.variance,
        etbValue: r.etbValue ?? 0,
        monetaryLoss: r.monetaryLoss ?? 0,
        countedBy: nameByUser.get(r.countedBy) ?? r.countedBy,
        note: r.note,
        createdAt: r.createdAt,
      }));

    const shortages = reconciliations.filter((r) => r.variance < 0);
    const surpluses = reconciliations.filter((r) => r.variance > 0);

    return {
      pendingClearances: pending,
      pendingCount: pending.length,
      shortagesCount: shortages.length,
      surplusesCount: surpluses.length,
      totalReconciliations: reconciliations.length,
      allReconciliations,
    };
  },
});
