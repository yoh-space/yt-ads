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

/**
 * Production-floor summary for the owner inventory dashboard.
 * Groups all ACTIVE and PENDING_CLEARANCE operator sub-stock batches by
 * machine, enriches them with material names, operator names, the current
 * active job card, scrap/offcut counts, and the last 10 stock-movement events
 * for that machine so the owner can inspect any workstation without leaving the
 * inventory page.
 */
export const getOwnerFloorSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);

    const [batches, materials, machines, users, jobCards, scraps, offcuts, movements] =
      await Promise.all([
        ctx.db
          .query("operatorSubStock")
          .filter((q) =>
            q.or(
              q.eq(q.field("status"), "ACTIVE"),
              q.eq(q.field("status"), "PENDING_CLEARANCE"),
            ),
          )
          .collect(),
        ctx.db.query("materials").collect(),
        ctx.db.query("machines").collect(),
        ctx.db.query("users").collect(),
        ctx.db
          .query("jobCards")
          .filter((q) =>
            q.or(
              q.eq(q.field("status"), "In production"),
              q.eq(q.field("status"), "Queued"),
            ),
          )
          .collect(),
        ctx.db.query("scraps").collect(),
        ctx.db
          .query("offcuts")
          .filter((q) => q.eq(q.field("status"), "available"))
          .collect(),
        ctx.db.query("stock_movements").order("desc").take(500),
      ]);

    const materialById = new Map(materials.map((m) => [m._id, m]));
    const machineById = new Map(machines.map((m) => [m._id, m]));
    const nameByUser = new Map(users.map((u) => [u.authUserId, u.name]));

    // Index job cards by machineId — pick the most recent "In production" one
    const activeJobByMachine = new Map<string, { title: string; code: string; client: string }>();
    for (const job of jobCards) {
      const key = job.machineId as string;
      if (!activeJobByMachine.has(key) || job.status === "In production") {
        activeJobByMachine.set(key, { title: job.title, code: job.code, client: job.client });
      }
    }

    // Scrap count per machine
    const scrapCountByMachine = new Map<string, number>();
    for (const scrap of scraps) {
      if (!scrap.machineId) continue;
      const key = scrap.machineId as string;
      scrapCountByMachine.set(key, (scrapCountByMachine.get(key) ?? 0) + 1);
    }

    // Offcut count per machine
    const offcutCountByMachine = new Map<string, number>();
    for (const offcut of offcuts) {
      if (!offcut.machineId) continue;
      const key = offcut.machineId as string;
      offcutCountByMachine.set(key, (offcutCountByMachine.get(key) ?? 0) + 1);
    }

    // Last 10 movements per machine (movements are already ordered desc)
    const movementsByMachine = new Map<string, typeof movements>();
    for (const mv of movements) {
      if (!mv.machineId) continue;
      const key = mv.machineId as string;
      const existing = movementsByMachine.get(key) ?? [];
      if (existing.length < 10) {
        existing.push(mv);
        movementsByMachine.set(key, existing);
      }
    }

    // Group batches by machine
    const grouped = new Map<
      string,
      {
        machineId: string;
        batches: typeof batches;
      }
    >();
    for (const batch of batches) {
      const key = batch.machineId as string;
      const group = grouped.get(key) ?? { machineId: key, batches: [] };
      group.batches.push(batch);
      grouped.set(key, group);
    }

    // Include machines with no active batches so the table still shows them
    for (const machine of machines) {
      if (!machine.active) continue;
      const key = machine._id as string;
      if (!grouped.has(key)) {
        grouped.set(key, { machineId: key, batches: [] });
      }
    }

    const rows = [...grouped.values()].map(({ machineId, batches: machineBatches }) => {
      const machine = machineById.get(machineId as never);
      // Derive operator from the first batch that has one; fall back to empty
      const primaryBatch = machineBatches[0];
      const operatorId = primaryBatch?.operatorId ?? "";
      const operatorName = operatorId ? (nameByUser.get(operatorId) ?? operatorId) : "Unassigned";

      // Aggregates across all batches for this machine
      let totalIssued = 0;
      let totalRemaining = 0;
      for (const b of machineBatches) {
        totalIssued += b.issuedBaseQuantity ?? b.issuedQuantity;
        totalRemaining += b.remainingBaseQuantity ?? b.currentRemaining ?? 0;
      }
      const totalConsumed = Number(Math.max(0, totalIssued - totalRemaining).toFixed(3));
      const usagePercent =
        totalIssued > 0 ? Math.round(((totalIssued - totalRemaining) / totalIssued) * 100) : 0;

      // Derive dominant base unit from primary batch material
      const primaryMaterial = primaryBatch
        ? materialById.get(primaryBatch.materialId)
        : undefined;
      const dominantUnit = primaryMaterial?.baseUnit ?? primaryMaterial?.unit ?? "m²";

      // Per-batch detail rows
      const batchRows = machineBatches.map((b) => {
        const mat = materialById.get(b.materialId);
        const baseUnit = mat?.baseUnit ?? mat?.unit ?? "m²";
        const issued = b.issuedBaseQuantity ?? b.issuedQuantity;
        const remaining = b.remainingBaseQuantity ?? b.currentRemaining ?? 0;
        const consumed = Number(Math.max(0, issued - remaining).toFixed(3));
        return {
          id: b._id as string,
          materialName: mat?.name ?? "Unknown material",
          materialCategory: mat?.category ?? "",
          baseUnit,
          issuedQuantity: Number(issued.toFixed(3)),
          currentRemaining: Number(remaining.toFixed(3)),
          consumedQuantity: consumed,
          usagePercent: issued > 0 ? Math.round(((issued - remaining) / issued) * 100) : 0,
          status: b.status,
          usageAllowanceStatus: b.usageAllowanceStatus ?? "NORMAL",
          // Ink mL precision fields
          issuedMillilitres: b.issuedMillilitres,
          consumedMillilitres: b.consumedMillilitres,
          remainingMillilitres: b.remainingMillilitres,
          issuedAt: b.issuedAt,
        };
      });

      // Ink batches only (baseUnit === "L")
      const inkBatches = batchRows.filter((b) => b.baseUnit === "L");

      // Recent movements for this machine
      const recentMovements = (movementsByMachine.get(machineId) ?? []).map((mv) => {
        const mat = materialById.get(mv.materialId);
        return {
          eventType: mv.eventType,
          materialName: mat?.name ?? "Unknown material",
          quantity: Number((mv.baseQuantity ?? mv.quantity).toFixed(3)),
          baseUnit: mv.baseUnit,
          note: mv.note,
          createdAt: mv.createdAt,
        };
      });

      const hasPendingClearance = machineBatches.some((b) => b.status === "PENDING_CLEARANCE");
      const activeJob = activeJobByMachine.get(machineId);

      return {
        machineId,
        machineName: machine?.name ?? "Unknown machine",
        machineCode: machine?.code ?? "—",
        machineType: machine?.type ?? "Machine",
        machineStatus: machine?.status ?? "Unavailable",
        operatorId,
        operatorName,
        dominantUnit,
        totalIssued: Number(totalIssued.toFixed(3)),
        totalRemaining: Number(totalRemaining.toFixed(3)),
        totalConsumed,
        usagePercent,
        scrapCount: scrapCountByMachine.get(machineId) ?? 0,
        offcutCount: offcutCountByMachine.get(machineId) ?? 0,
        hasPendingClearance,
        activeJob: activeJob ?? null,
        batches: batchRows,
        inkBatches,
        recentMovements,
      };
    });

    // Sort: PENDING_CLEARANCE machines first, then by machine name
    rows.sort((a, b) => {
      if (a.hasPendingClearance !== b.hasPendingClearance) {
        return a.hasPendingClearance ? -1 : 1;
      }
      return a.machineName.localeCompare(b.machineName);
    });

    return {
      machines: rows,
      activeMachineCount: rows.filter((r) => r.batches.length > 0).length,
      pendingClearanceCount: rows.filter((r) => r.hasPendingClearance).length,
    };
  },
});
