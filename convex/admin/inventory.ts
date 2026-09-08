import { query } from "../_generated/server";
import { requireAdminRole } from "../users";
import { resolveEtbValue } from "../materialUsage";

/**
 * High-level stock value & balance for the admin inventory page. Values are
 * estimated in ETB using each material's per-unit rate and on-hand quantity;
 * separate figures are provided for the central store and production-floor stock.
 */
export const getInventorySummary = query({
  handler: async (ctx) => {
    await requireAdminRole(ctx);
    const [materials, subStock, machines, users] = await Promise.all([
      ctx.db.query("materials").filter((q) => q.eq(q.field("active"), true)).collect(),
      ctx.db.query("operatorSubStock").collect(),
      ctx.db.query("machines").collect(),
      ctx.db.query("users").collect(),
    ]);

    const materialMap = new Map(materials.map((m) => [m._id, m]));
    const machineMap = new Map(machines.map((m) => [m._id, m]));
    const nameByUser = new Map(users.map((u) => [u.authUserId, u.name]));

    let totalValue = 0;
    let mainStoreValue = 0;
    for (const material of materials) {
      const unitValue = resolveEtbValue(material);
      const onHand = material.quantity ?? 0;
      mainStoreValue += onHand * unitValue;
    }

    let floorValue = 0;
    let unclearedValue = 0;
    const issues: Array<{
      id: string;
      itemName: string;
      operatorName: string;
      machineName: string;
      amount: number;
      status: string;
    }> = [];

    for (const batch of subStock) {
      const material = materialMap.get(batch.materialId);
      if (!material) continue;
      const unitValue = resolveEtbValue(material);
      const remaining = batch.remainingBaseQuantity ?? batch.currentRemaining ?? 0;
      const remainingValue = remaining * unitValue;
      floorValue += Math.max(0, remainingValue);

      if (batch.status === "PENDING_CLEARANCE") {
        const discrepancy = (batch.issuedBaseQuantity ?? batch.issuedQuantity) - (batch.remainingBaseQuantity ?? batch.currentRemaining ?? 0);
        unclearedValue += Math.max(0, discrepancy) * unitValue;
        issues.push({
          id: batch._id,
          itemName: material.name,
          operatorName: nameByUser.get(batch.operatorId) ?? "Assigned operator",
          machineName: machineMap.get(batch.machineId)?.name ?? "Machine",
          amount: Number((Math.max(0, discrepancy) * unitValue).toFixed(2)),
          status: batch.status,
        });
      }
    }

    totalValue = mainStoreValue + floorValue;

    return {
      totalValue: Number(totalValue.toFixed(2)),
      mainStoreValue: Number(mainStoreValue.toFixed(2)),
      floorValue: Number(floorValue.toFixed(2)),
      unclearedValue: Number(unclearedValue.toFixed(2)),
      issues,
    };
  },
});