import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireOwner } from "../users";
import { resolveEtbValue } from "../materialUsage";
import { recordInventoryEvent } from "../inventoryLedger";

/**
 * High-level stock value & balance for the owner inventory page. Values are
 * estimated in ETB using each material's per-unit rate and on-hand quantity;
 * separate figures are provided for the central store and production-floor stock.
 */
export const getInventorySummary = query({
  handler: async (ctx) => {
    await requireOwner(ctx);
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
      // Use base remaining if available, else currentRemaining; ink tracked in mL
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

const pendingException = v.object({
  id: v.id("stockExceptions"),
  materialId: v.id("materials"),
  materialName: v.string(),
  quantity: v.number(),
  unit: v.string(),
  reason: v.string(),
  authorizationNote: v.optional(v.string()),
  requestedBy: v.optional(v.string()),
  requesterName: v.optional(v.string()),
  requestedValue: v.number(),
  createdAt: v.number(),
});

export const getPendingStockOuts = query({
  args: {},
  returns: v.array(pendingException),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const exceptions = (await ctx.db.query("stockExceptions").order("desc").take(100))
      .filter((exception) => exception.status === "PENDING_OWNER_APPROVAL");
    const [materials, users] = await Promise.all([
      Promise.all(exceptions.map((exception) => ctx.db.get(exception.materialId))),
      ctx.db.query("users").take(200),
    ]);
    const userNames = new Map(users.map((user) => [user.authUserId, user.name]));
    return exceptions.flatMap((exception, index) => {
      const material = materials[index];
      if (!material || exception.requestedValue === undefined) return [];
      return [{
        id: exception._id,
        materialId: exception.materialId,
        materialName: material.name,
        quantity: exception.quantity,
        unit: exception.unit,
        reason: exception.reason,
        authorizationNote: exception.authorizationNote,
        requestedBy: exception.requestedBy,
        requesterName: exception.requestedBy ? userNames.get(exception.requestedBy) : undefined,
        requestedValue: exception.requestedValue,
        createdAt: exception.createdAt,
      }];
    });
  },
});

export const approveStockOut = mutation({
  args: { exceptionId: v.id("stockExceptions") },
  returns: v.object({ remainingQuantity: v.number() }),
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const exception = await ctx.db.get(args.exceptionId);
    if (!exception || exception.status !== "PENDING_OWNER_APPROVAL") throw new Error("Pending stock-out request not found.");
    const material = await ctx.db.get(exception.materialId);
    if (!material || !material.active) throw new Error("Active material not found.");
    if (exception.baseQuantity > material.quantity) throw new Error(`Insufficient ${material.name} stock for this request.`);
    await recordInventoryEvent(ctx, {
      materialId: material._id,
      eventType: "EXCEPTION_STOCK_OUT",
      custody: "parent",
      balanceEffect: "out",
      quantity: exception.quantity,
      unit: exception.unit,
      baseUnit: material.baseUnit ?? material.unit,
      baseQuantity: exception.baseQuantity,
      note: `Owner-approved exception stock-out · ${exception.reason}`,
      createdBy: identity._id,
    });
    await ctx.db.patch(exception._id, { status: "APPROVED", approvedBy: identity._id, approvedAt: Date.now() });
    const updatedMaterial = await ctx.db.get(material._id);
    return { remainingQuantity: updatedMaterial?.quantity ?? 0 };
  },
});

export const rejectStockOut = mutation({
  args: { exceptionId: v.id("stockExceptions"), note: v.string() },
  returns: v.object({ rejected: v.boolean() }),
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const exception = await ctx.db.get(args.exceptionId);
    if (!exception || exception.status !== "PENDING_OWNER_APPROVAL") throw new Error("Pending stock-out request not found.");
    const note = args.note.trim();
    if (!note) throw new Error("Add a reason for rejecting this request.");
    await ctx.db.patch(exception._id, {
      status: "REJECTED",
      authorizationNote: exception.authorizationNote ? `${exception.authorizationNote} · Owner: ${note}` : `Owner: ${note}`,
      approvedBy: identity._id,
      approvedAt: Date.now(),
    });
    return { rejected: true };
  },
});