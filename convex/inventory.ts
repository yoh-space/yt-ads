import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireActiveProfile, requireAnyPermission, requirePermission } from "./users";
import { canAccessMachine } from "./authorization";
import { notifyRoles, notifyUser } from "./notificationHelpers";
import { ensureSystemConfig } from "./systemConfigs";
import { resolveConversionRatio } from "./materialUsage";
import { recordInventoryEvent } from "./inventoryLedger";

/**
 * Two-tier inventory. Tier 1 (`parentInventory`) tracks whole packaging units
 * in the central store; the storekeeper issues whole units to tier 2
 * (`operatorSubStock`), which tracks the exact base-unit balance at each
 * operator's machine. Production deducts from the floor tier, and the weekly
 * reconciliation audits the floor count against the system balance.
 */

/** Resolves the base-units-per-packaging-unit factor for a parent item. */
function conversionFactorFor(item: {
  unitType: "ROLL" | "SHEET" | "LITER";
  lengthPerRoll?: number;
  areaPerSheet?: number;
  volumePerContainer?: number;
}): number | null {
  if (item.unitType === "ROLL") {
    return item.lengthPerRoll !== undefined && item.lengthPerRoll > 0 ? item.lengthPerRoll : null;
  }
  if (item.unitType === "SHEET") {
    return item.areaPerSheet !== undefined && item.areaPerSheet > 0 ? item.areaPerSheet : null;
  }
  return item.volumePerContainer !== undefined && item.volumePerContainer > 0
    ? item.volumePerContainer
    : 1;
}

export const listParentInventory = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "material.view");
    const items = await ctx.db.query("parentInventory").collect();
    const materials = await ctx.db.query("materials").collect();
    const byId = new Map(materials.map((material) => [material._id, material]));
    return items
      .sort((left, right) => left.unitType.localeCompare(right.unitType))
      .map((item) => {
        const material = byId.get(item.materialId);
        const factor = conversionFactorFor(item);
        return {
          ...item,
          materialName: material?.name ?? "Unknown material",
          materialCategory: material?.category ?? "—",
          baseUnit: material?.baseUnit ?? material?.unit ?? "m²",
          conversionFactor: factor,
          baseUnitsInStock: factor ? Number((item.totalStockQuantity * factor).toFixed(3)) : undefined,
        };
      });
  },
});

/** Creates or updates the central-store item for a material. */
export const upsertParentInventoryItem = mutation({
  args: {
    materialId: v.id("materials"),
    unitType: v.union(v.literal("ROLL"), v.literal("SHEET"), v.literal("LITER")),
    totalStockQuantity: v.number(),
    lengthPerRoll: v.optional(v.number()),
    areaPerSheet: v.optional(v.number()),
    volumePerContainer: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "material.edit");
    const material = await ctx.db.get(args.materialId);
    if (!material || !material.active) throw new Error("Active material not found.");
    if (!Number.isFinite(args.totalStockQuantity) || args.totalStockQuantity < 0) {
      throw new Error("Central stock must be zero or greater.");
    }
    const existing = await ctx.db
      .query("parentInventory")
      .withIndex("by_material", (q) => q.eq("materialId", args.materialId))
      .unique();
    const patch = {
      unitType: args.unitType,
      lengthPerRoll: args.lengthPerRoll !== undefined && args.lengthPerRoll > 0 ? args.lengthPerRoll : undefined,
      areaPerSheet: args.areaPerSheet !== undefined && args.areaPerSheet > 0 ? args.areaPerSheet : undefined,
      volumePerContainer: args.volumePerContainer !== undefined && args.volumePerContainer > 0 ? args.volumePerContainer : undefined,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      const delta = Number((args.totalStockQuantity - existing.totalStockQuantity).toFixed(3));
      if (delta !== 0) {
        const config = await ensureSystemConfig(ctx, identity._id);
        const purchaseUnit = args.unitType === "ROLL" ? "roll" : args.unitType === "SHEET" ? "sheet" : "liter";
        const baseUnit = material.baseUnit ?? material.unit;
        const ratio = conversionRatioForParent(material, patch, config, purchaseUnit);
        if (ratio === null) throw new Error("Set a positive conversion ratio before adjusting parent stock.");
        await recordInventoryEvent(ctx, {
          materialId: material._id,
          eventType: delta > 0 ? "STOCK_IN" : "RECONCILIATION_ADJUSTMENT",
          custody: "parent",
          balanceEffect: delta > 0 ? "in" : "out",
          quantity: Math.abs(delta),
          unit: purchaseUnit,
          baseUnit,
          baseQuantity: Math.abs(delta * ratio),
          packageQuantity: Math.abs(delta),
          packageUnit: args.unitType,
          conversionRatio: ratio,
          parentInventoryId: existing._id,
          note: delta > 0 ? "Central packaging stock received" : "Central packaging stock reconciliation",
          createdBy: identity._id,
        });
      }
      return existing._id;
    }
    const id = await ctx.db.insert("parentInventory", { ...patch, materialId: args.materialId, totalStockQuantity: 0 });
    if (args.totalStockQuantity > 0) {
      const config = await ensureSystemConfig(ctx, identity._id);
      const purchaseUnit = args.unitType === "ROLL" ? "roll" : args.unitType === "SHEET" ? "sheet" : "liter";
      const baseUnit = material.baseUnit ?? material.unit;
      const ratio = conversionRatioForParent(material, patch, config, purchaseUnit);
      if (ratio === null) throw new Error("Set a positive conversion ratio before adding parent stock.");
      await recordInventoryEvent(ctx, {
        materialId: material._id,
        eventType: "STOCK_IN",
        custody: "parent",
        balanceEffect: "in",
        quantity: args.totalStockQuantity,
        unit: purchaseUnit,
        baseUnit,
        baseQuantity: Number((args.totalStockQuantity * ratio).toFixed(3)),
        packageQuantity: args.totalStockQuantity,
        packageUnit: args.unitType,
        conversionRatio: ratio,
        parentInventoryId: id,
        note: "Central packaging stock received",
        createdBy: identity._id,
      });
    }
    return id;
  },
});

function conversionRatioForParent(
  material: { name: string; baseUnit?: string; unit: string; purchaseUnit?: string; conversionRatio?: number; rollEquivalent?: number; sheetEquivalent?: number },
  parent: { unitType: "ROLL" | "SHEET" | "LITER"; lengthPerRoll?: number; areaPerSheet?: number; volumePerContainer?: number },
  config: Awaited<ReturnType<typeof ensureSystemConfig>>,
  purchaseUnit: string,
) {
  const explicit = parent.unitType === "ROLL" ? parent.lengthPerRoll : parent.unitType === "SHEET" ? parent.areaPerSheet : parent.volumePerContainer;
  return explicit && explicit > 0
    ? explicit
    : resolveConversionRatio(material, config, purchaseUnit) ?? (purchaseUnit === "roll" ? material.rollEquivalent : purchaseUnit === "sheet" ? material.sheetEquivalent : material.conversionRatio) ?? (purchaseUnit === "liter" ? 1 : null);
}

/**
 * Tier 1 → tier 2 transfer: the storekeeper issues whole packaging units from
 * the central store to an operator's machine. The floor balance is recorded in
 * base units via the item's conversion factor (e.g. 1 roll = 50 m).
 */
export const issueStockToOperator = mutation({
  args: {
    itemId: v.id("parentInventory"),
    machineId: v.id("machines"),
    operatorId: v.string(),
    units: v.number(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "stock.record");
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Parent inventory item not found.");
    const material = await ctx.db.get(item.materialId);
    if (!material || !material.active) throw new Error("Active material not found.");
    const machine = await ctx.db.get(args.machineId);
    if (!machine || !machine.active) throw new Error("Active machine not found.");
    if (!Number.isFinite(args.units) || args.units <= 0 || !Number.isInteger(args.units)) {
      throw new Error("Issue whole packaging units only (e.g. 1 roll, 2 sheets).");
    }
    if (args.units > item.totalStockQuantity) {
      throw new Error(`Insufficient ${material.name} in the central store — ${item.totalStockQuantity} ${item.unitType} available.`);
    }
    const config = await ensureSystemConfig(ctx, identity._id);
    const purchaseUnit = item.unitType === "ROLL" ? "roll" : item.unitType === "SHEET" ? "sheet" : "liter";
    const factor = conversionFactorFor(item) ?? resolveConversionRatio(material, config, purchaseUnit);
    if (factor === undefined || factor === null || factor <= 0) {
      throw new Error(`Set the ${item.unitType === "ROLL" ? "length per roll" : "area per sheet"} conversion factor before issuing stock.`);
    }
    const baseQuantity = Number((args.units * factor).toFixed(3));
    const now = Date.now();
    const newStockId = await ctx.db.insert("operatorSubStock", {
      parentInventoryId: item._id,
      materialId: item.materialId,
      operatorId: args.operatorId.trim(),
      machineId: args.machineId,
      issuedUnits: 0,
      issuedQuantity: 0,
      currentRemaining: 0,
      status: "ACTIVE",
      issuedBy: identity._id,
      issuedAt: now,
      updatedAt: now,
    });
    await recordInventoryEvent(ctx, {
      materialId: item.materialId,
      eventType: "STORE_TO_OPERATOR_TRANSFER",
      custody: "operator",
      balanceEffect: "transfer",
      quantity: args.units,
      unit: purchaseUnit,
      baseUnit: material.baseUnit ?? material.unit,
      baseQuantity,
      packageQuantity: args.units,
      packageUnit: item.unitType,
      conversionRatio: factor,
      parentInventoryId: item._id,
      operatorSubStockId: newStockId,
      operatorId: args.operatorId.trim(),
      machineId: args.machineId,
      note: `Central stock issued to ${machine.name}`,
      createdBy: identity._id,
    });
    await notifyRoles(ctx, [machine.operatorRole, "owner", "manager", "admin"], {
      title: "Stock issued to machine",
      message: `${args.units} ${item.unitType} (${baseQuantity} ${material.baseUnit ?? material.unit}) of ${material.name} issued to ${machine.name}.`,
      type: "material_issue",
      actorAuthUserId: identity._id,
      relatedTable: "operatorSubStock",
      relatedId: newStockId,
    });
    return { stockId: newStockId, baseQuantity, unit: material.baseUnit ?? material.unit };
  },
});

/**
 * Deducts consumed base units from ACTIVE operator sub-stock batches in FIFO
 * order. Every deduction is an event, so the projection is never patched by a
 * production handler directly.
 */
export async function deductOperatorStock(
  ctx: MutationCtx,
  machineId: string,
  materialId: string,
  baseQuantity: number,
  actorId = "system",
  jobCardId?: string,
): Promise<number> {
  if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) return 0;
  const batches = (await ctx.db
    .query("operatorSubStock")
    .withIndex("by_material_machine", (q) => q.eq("materialId", materialId as never).eq("machineId", machineId as never))
    .collect())
    .filter((batch) => batch.status === "ACTIVE" && batch.currentRemaining > 0)
    .sort((left, right) => left.issuedAt - right.issuedAt);
  let remainingToDeduct = baseQuantity;
  for (const batch of batches) {
    if (remainingToDeduct <= 0) break;
    const take = Math.min(batch.currentRemaining, remainingToDeduct);
    remainingToDeduct = Number((remainingToDeduct - take).toFixed(3));
    await recordInventoryEvent(ctx, {
      materialId: batch.materialId,
      eventType: "PRODUCTION_CONSUMPTION",
      custody: "operator",
      balanceEffect: "none",
      quantity: take,
      unit: (await ctx.db.get(batch.materialId))?.baseUnit ?? "m²",
      baseUnit: (await ctx.db.get(batch.materialId))?.baseUnit ?? "m²",
      baseQuantity: take,
      operatorSubStockId: batch._id,
      operatorId: batch.operatorId,
      machineId: batch.machineId,
      jobCardId: jobCardId as Id<"jobCards"> | undefined,
      note: `Production consumption${jobCardId ? ` for ${jobCardId}` : ""}`,
      createdBy: actorId,
    });
  }
  return Number((baseQuantity - remainingToDeduct).toFixed(3));
}

export const listOperatorMachineStock = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireAnyPermission(ctx, ["material.view", "machine.view", "job.view"]);
    const batches = await ctx.db.query("operatorSubStock").collect();
    const [materials, machines] = await Promise.all([
      ctx.db.query("materials").collect(),
      ctx.db.query("machines").collect(),
    ]);
    const materialById = new Map(materials.map((material) => [material._id, material]));
    const machineById = new Map(machines.map((machine) => [machine._id, machine]));
    const isFloorRole = !["owner", "manager", "admin", "storekeeper"].includes(profile.role);
    return batches
      .filter((batch) => {
        const machine = machineById.get(batch.machineId);
        return !machine || !isFloorRole || (canAccessMachine(profile.role, machine) && (batch.operatorId === profile.authUserId || batch.operatorId === profile.role));
      })
      .sort((left, right) => right.issuedAt - left.issuedAt)
      .map((batch) => {
        const material = materialById.get(batch.materialId);
        const machine = machineById.get(batch.machineId);
        const baseUnit = material?.baseUnit ?? material?.unit ?? "m²";
        return {
          ...batch,
          materialName: material?.name ?? "Unknown material",
          machineName: machine?.name ?? "Unknown machine",
          baseUnit,
          consumed: Number((batch.issuedQuantity - batch.currentRemaining).toFixed(3)),
          usagePercent: batch.issuedQuantity > 0
            ? Math.round(((batch.issuedQuantity - batch.currentRemaining) / batch.issuedQuantity) * 100)
            : 0,
        };
      });
  },
});

/**
 * Weekly audit: compares a physical floor count against the system balance for
 * one issued batch, logs the result, writes the physical count back to the
 * floor tier, and writes any discrepancy off to the catalog tier through an
 * audited `stockMovements` entry.
 */
export const performWeeklyReconciliation = mutation({
  args: {
    operatorSubStockId: v.id("operatorSubStock"),
    physicalActualRemaining: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity, profile } = await requirePermission(ctx, "reconciliation.operator");
    const batch = await ctx.db.get(args.operatorSubStockId);
    if (!batch) throw new Error("Issued stock batch not found.");
    const material = await ctx.db.get(batch.materialId);
    if (!material) throw new Error("Material not found.");
    const machine = await ctx.db.get(batch.machineId);
    if (!machine || !canAccessMachine(profile.role, machine)) throw new Error("You cannot reconcile stock on this machine.");
    if (!["owner", "manager", "admin", "storekeeper"].includes(profile.role) && batch.operatorId !== identity._id) {
      throw new Error("Only the assigned operator can reconcile this floor stock.");
    }
    if (!Number.isFinite(args.physicalActualRemaining) || args.physicalActualRemaining < 0) {
      throw new Error("Physical count must be zero or greater.");
    }

    const baseUnit = material.baseUnit ?? material.unit;
    const systemCalculatedRemaining = batch.currentRemaining;
    const discrepancy = Number((args.physicalActualRemaining - systemCalculatedRemaining).toFixed(3));
    const now = Date.now();

    const reconciliationId = await ctx.db.insert("weeklyReconciliations", {
      machineId: batch.machineId,
      operatorId: batch.operatorId,
      operatorSubStockId: batch._id,
      systemCalculatedRemaining,
      physicalActualRemaining: args.physicalActualRemaining,
      discrepancy,
      unit: baseUnit,
      reconciledBy: identity._id,
      reconciledAt: now,
      notes: args.notes?.trim() || undefined,
    });

    if (discrepancy !== 0) {
      await recordInventoryEvent(ctx, {
        materialId: material._id,
        eventType: "RECONCILIATION_ADJUSTMENT",
        custody: "operator",
        balanceEffect: discrepancy < 0 ? "out" : "in",
        quantity: Math.abs(discrepancy),
        unit: baseUnit,
        baseUnit,
        baseQuantity: Math.abs(discrepancy),
        operatorSubStockId: batch._id,
        operatorId: batch.operatorId,
        machineId: batch.machineId,
        reconciliationId,
        note: `Floor reconciliation · ${machine.name} · physical ${args.physicalActualRemaining} vs system ${systemCalculatedRemaining} ${baseUnit}`,
        createdBy: identity._id,
      });
    }

    if (batch.status === "ACTIVE") {
      await ctx.db.patch(batch._id, {
        status: "PENDING_CLEARANCE",
        updatedAt: now,
      });
    }

    await notifyRoles(ctx, ["owner", "manager", "admin"], {
      title: discrepancy === 0 ? "Weekly floor reconciliation recorded" : "Floor stock discrepancy found",
      message: `${material.name} on ${machine?.name ?? "machine"}: physical ${args.physicalActualRemaining} vs system ${systemCalculatedRemaining} ${baseUnit} (${discrepancy > 0 ? "+" : ""}${discrepancy}).`,
      type: "discrepancy",
      actorAuthUserId: identity._id,
      relatedTable: "weeklyReconciliations",
      relatedId: batch._id,
    });
    return { discrepancy, unit: baseUnit };
  },
});

export const listWeeklyReconciliations = query({
  args: {},
  handler: async (ctx) => {
    await requireAnyPermission(ctx, ["reconciliation.record", "audit.view"]);
    const [records, machines] = await Promise.all([
      ctx.db.query("weeklyReconciliations").collect(),
      ctx.db.query("machines").collect(),
    ]);
    const machineNames = new Map(machines.map((machine) => [machine._id, machine.name]));
    return records
      .sort((left, right) => right.reconciledAt - left.reconciledAt)
      .map((record) => ({
        ...record,
        machineName: machineNames.get(record.machineId) ?? "Unknown machine",
      }));
  },
});

/**
 * Manual exhaustion: operator marks an active floor batch as exhausted
 * (e.g., roll finished mid-print, damaged, or needs return to store).
 */
export const exhaustOperatorStock = mutation({
  args: {
    stockId: v.id("operatorSubStock"),
  },
  handler: async (ctx, args) => {
    const { identity, profile } = await requirePermission(ctx, "reconciliation.operator");
    const batch = await ctx.db.get(args.stockId);
    if (!batch) throw new Error("Stock batch not found.");
    if (batch.status !== "ACTIVE") throw new Error("Only active stock can be exhausted.");
    const machine = await ctx.db.get(batch.machineId);
    if (!machine || !canAccessMachine(profile.role, machine)) throw new Error("You cannot exhaust stock on this machine.");
    if (!["owner", "manager", "admin", "storekeeper"].includes(profile.role) && batch.operatorId !== identity._id) {
      throw new Error("Only the assigned operator can exhaust this floor stock.");
    }

    const remaining = batch.currentRemaining;

    if (remaining > 0) {
      const material = await ctx.db.get(batch.materialId);
      if (material) {
        await recordInventoryEvent(ctx, {
          materialId: material._id,
          eventType: "SCRAP_LOG",
          custody: "operator",
          balanceEffect: "none",
          quantity: remaining,
          unit: material.baseUnit ?? material.unit,
          baseUnit: material.baseUnit ?? material.unit,
          baseQuantity: remaining,
          operatorSubStockId: batch._id,
          operatorId: batch.operatorId,
          machineId: batch.machineId,
          note: `Manual floor exhaustion · ${machine.name}`,
          createdBy: identity._id,
        });
      }
    }

    await ctx.db.patch(batch._id, {
      status: "PENDING_CLEARANCE",
      updatedAt: Date.now(),
    });
    await notifyRoles(ctx, ["owner", "admin"], {
      title: "Floor stock awaiting owner clearance",
      message: `${machine.name}: an operator exhausted a floor batch. New requests are blocked until clearance is approved.`,
      type: "discrepancy",
      actorAuthUserId: identity._id,
      relatedTable: "operatorSubStock",
      relatedId: batch._id,
    });

    return { exhausted: true, remaining };
  },
});

/**
 * Reconcile-to-request lifecycle: an operator may not request new stock while
 * any of their floor batches is still ACTIVE or awaiting owner clearance.
 */
export const myUnclearedStock = query({
  args: {},
  handler: async (ctx) => {
    const { identity } = await requireActiveProfile(ctx);
    const [batches, materials, machines] = await Promise.all([
      ctx.db.query("operatorSubStock").withIndex("by_operator", (q) => q.eq("operatorId", identity._id)).collect(),
      ctx.db.query("materials").collect(),
      ctx.db.query("machines").collect(),
    ]);
    const materialById = new Map(materials.map((material) => [material._id, material]));
    const machineById = new Map(machines.map((machine) => [machine._id, machine]));
    return batches
      .filter((batch): batch is typeof batch & { status: "ACTIVE" | "PENDING_CLEARANCE" } =>
        batch.status === "ACTIVE" || batch.status === "PENDING_CLEARANCE")
      .sort((left, right) => right.issuedAt - left.issuedAt)
      .map((batch) => {
        const material = materialById.get(batch.materialId);
        const machine = machineById.get(batch.machineId);
        const baseUnit = material?.baseUnit ?? material?.unit ?? "m²";
        return {
          id: batch._id,
          status: batch.status,
          materialName: material?.name ?? "Unknown material",
          machineName: machine?.name ?? "Unknown machine",
          issuedQuantity: batch.issuedQuantity,
          currentRemaining: batch.currentRemaining,
          baseUnit,
          issuedAt: batch.issuedAt,
        };
      });
  },
});

/**
 * Owner/admin floor audit: every live (ACTIVE or PENDING_CLEARANCE) floor
 * batch with real-time usage metrics — allocated vs reported production
 * output vs scrap — grouped client-side by operator and machine.
 */
export const operatorClearanceAudit = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "reconciliation.clearance");
    const [activeBatches, pendingBatches, clearedBatches, materials, machines, users, movements, reconciliations] = await Promise.all([
      ctx.db.query("operatorSubStock").withIndex("by_status", (q) => q.eq("status", "ACTIVE")).collect(),
      ctx.db.query("operatorSubStock").withIndex("by_status", (q) => q.eq("status", "PENDING_CLEARANCE")).collect(),
      ctx.db.query("operatorSubStock").withIndex("by_status", (q) => q.eq("status", "CLEARED")).collect(),
      ctx.db.query("materials").collect(),
      ctx.db.query("machines").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("stock_movements").collect(),
      ctx.db.query("weeklyReconciliations").withIndex("by_reconciled_at").order("desc").collect(),
    ]);
    const materialById = new Map(materials.map((material) => [material._id, material]));
    const machineById = new Map(machines.map((machine) => [machine._id, machine]));
    const userNames = new Map(users.map((user) => [user.authUserId, user.name]));
    const latestReconByBatch = new Map<string, (typeof reconciliations)[number]>();
    for (const record of reconciliations) {
      if (record.operatorSubStockId && !latestReconByBatch.has(record.operatorSubStockId)) {
        latestReconByBatch.set(record.operatorSubStockId, record);
      }
    }
    const producedByBatch = new Map<string, number>();
    const scrapByBatch = new Map<string, number>();
    for (const movement of movements) {
      if (!movement.operatorSubStockId) continue;
      const key = movement.operatorSubStockId as string;
      const amount = movement.baseQuantity ?? movement.quantity;
      if (movement.eventType === "PRODUCTION_CONSUMPTION") {
        producedByBatch.set(key, (producedByBatch.get(key) ?? 0) + amount);
      }
      if (movement.eventType === "OFFCUT_RETURN") {
        producedByBatch.set(key, (producedByBatch.get(key) ?? 0) - amount);
      }
      if (movement.eventType === "SCRAP_LOG") {
        scrapByBatch.set(key, (scrapByBatch.get(key) ?? 0) + amount);
      }
    }
    const statusRank: Record<string, number> = { PENDING_CLEARANCE: 0, ACTIVE: 1, CLEARED: 2 };
    return [...activeBatches, ...pendingBatches, ...clearedBatches]
      .sort((left, right) =>
        (statusRank[left.status] ?? 3) - (statusRank[right.status] ?? 3) || right.issuedAt - left.issuedAt,
      )
      .map((batch) => {
        const material = materialById.get(batch.materialId);
        const machine = machineById.get(batch.machineId);
        const baseUnit = material?.baseUnit ?? material?.unit ?? "m²";
        const reconciliation = latestReconByBatch.get(batch._id);
        const produced = Number((producedByBatch.get(batch._id as string) ?? 0).toFixed(3));
        const scrap = Number((scrapByBatch.get(batch._id as string) ?? 0).toFixed(3));
        return {
          id: batch._id,
          status: batch.status,
          machineCode: machine?.code ?? "—",
          materialName: material?.name ?? "Unknown material",
          machineId: batch.machineId,
          machineName: machine?.name ?? "Unknown machine",
          machineType: machine?.type ?? "Machine",
          operatorName: userNames.get(batch.operatorId) ?? batch.operatorId,
          operatorId: batch.operatorId,
          issuedUnits: batch.issuedUnits,
          issuedQuantity: batch.issuedQuantity,
          currentRemaining: batch.currentRemaining,
          producedOutput: Math.max(0, produced),
          scrapQuantity: scrap,
          wastePercent: batch.issuedQuantity > 0 ? Math.round((scrap / batch.issuedQuantity) * 100) : 0,
          usagePercent: batch.issuedQuantity > 0
            ? Math.round(((batch.issuedQuantity - batch.currentRemaining) / batch.issuedQuantity) * 100)
            : 0,
          baseUnit,
          issuedAt: batch.issuedAt,
          lastPhysicalCount: reconciliation?.physicalActualRemaining,
          lastDiscrepancy: reconciliation?.discrepancy,
          reconciledAt: reconciliation?.reconciledAt,
        };
      });
  },
});

/** Owner/admin grants clearance: unlocks the operator's request flow again. */
export const approveOperatorClearance = mutation({
  args: {
    subStockId: v.id("operatorSubStock"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "reconciliation.clearance");
    const batch = await ctx.db.get(args.subStockId);
    if (!batch) throw new Error("Floor stock batch not found.");
    if (batch.status !== "PENDING_CLEARANCE") {
      throw new Error("Only a reconciled batch awaiting clearance can be approved.");
    }
    const now = Date.now();
    await ctx.db.patch(batch._id, {
      status: "CLEARED",
      clearedBy: identity._id,
      clearedAt: now,
      clearanceNote: args.note?.trim() || undefined,
      updatedAt: now,
    });
    const material = await ctx.db.get(batch.materialId);
    await notifyUser(ctx, batch.operatorId, {
      title: "Owner clearance granted — you can request new stock",
      message: `Your reconciled ${material?.name ?? "floor stock"} batch was cleared. New material requests are unlocked.`,
      type: "clearance_granted",
      actorAuthUserId: identity._id,
      relatedTable: "operatorSubStock",
      relatedId: batch._id,
    });
    return (await ctx.db.get(batch._id))!;
  },
});

/** Owner/admin rejects clearance: returns the reconciled batch to ACTIVE so the operator can re-count/reconcile before a new request is unlocked. */
export const rejectOperatorClearance = mutation({
  args: {
    subStockId: v.id("operatorSubStock"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "reconciliation.clearance");
    const batch = await ctx.db.get(args.subStockId);
    if (!batch) throw new Error("Floor stock batch not found.");
    if (batch.status !== "PENDING_CLEARANCE") {
      throw new Error("Only a reconciled batch awaiting clearance can be rejected.");
    }
    const now = Date.now();
    await ctx.db.patch(batch._id, {
      status: "ACTIVE",
      clearanceNote: args.note?.trim() || undefined,
      updatedAt: now,
    });
    const material = await ctx.db.get(batch.materialId);
    await notifyUser(ctx, batch.operatorId, {
      title: "Clearance returned — please re-reconcile",
      message: `Your reconciled ${material?.name ?? "floor stock"} batch was returned by the owner. Review the discrepancy and re-submit clearance.`,
      type: "clearance_rejected",
      actorAuthUserId: identity._id,
      relatedTable: "operatorSubStock",
      relatedId: batch._id,
    });
    return (await ctx.db.get(batch._id))!;
  },
});
