import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireAnyPermission, requirePermission } from "./users";
import { canAccessMachine } from "./authorization";
import { notifyRoles } from "./notificationHelpers";

/**
 * Two-tier inventory. Tier 1 (`parentInventory`) tracks whole packaging units
 * in the central store; the storekeeper issues whole units to tier 2
 * (`operatorMachineStock`), which tracks the exact base-unit balance at each
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
    await requirePermission(ctx, "material.edit");
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
      totalStockQuantity: args.totalStockQuantity,
      lengthPerRoll: args.lengthPerRoll !== undefined && args.lengthPerRoll > 0 ? args.lengthPerRoll : undefined,
      areaPerSheet: args.areaPerSheet !== undefined && args.areaPerSheet > 0 ? args.areaPerSheet : undefined,
      volumePerContainer: args.volumePerContainer !== undefined && args.volumePerContainer > 0 ? args.volumePerContainer : undefined,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return ctx.db.insert("parentInventory", { ...patch, materialId: args.materialId });
  },
});

/**
 * Tier 1 → tier 2 transfer: the storekeeper issues whole packaging units from
 * the central store to an operator's machine. The floor balance is recorded in
 * base units via the item's conversion factor (e.g. 1 roll = 50 m).
 */
export const issueStockToOperator = mutation({
  args: {
    itemId: v.id("parentInventory"),
    machineId: v.id("machines"),
    operatorId: v.optional(v.string()),
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
    const factor = conversionFactorFor(item);
    if (factor === null) {
      throw new Error(`Set the ${item.unitType === "ROLL" ? "length per roll" : "area per sheet"} conversion factor before issuing stock.`);
    }
    const baseQuantity = Number((args.units * factor).toFixed(3));
    const now = Date.now();

    await ctx.db.patch(item._id, {
      totalStockQuantity: item.totalStockQuantity - args.units,
      updatedAt: now,
    });
    const stockId = await ctx.db.insert("operatorMachineStock", {
      itemId: item._id,
      materialId: item.materialId,
      operatorId: args.operatorId?.trim() || machine.operatorRole,
      machineId: args.machineId,
      issuedUnits: args.units,
      issuedQuantity: baseQuantity,
      currentRemaining: baseQuantity,
      status: "ACTIVE",
      issuedBy: identity._id,
      issuedAt: now,
      updatedAt: now,
    });
    await notifyRoles(ctx, [machine.operatorRole, "owner", "manager", "admin"], {
      title: "Stock issued to machine",
      message: `${args.units} ${item.unitType} (${baseQuantity} ${material.baseUnit ?? material.unit}) of ${material.name} issued to ${machine.name}.`,
      type: "material_issue",
      actorAuthUserId: identity._id,
      relatedTable: "operatorMachineStock",
      relatedId: stockId,
    });
    return { stockId, baseQuantity, unit: material.baseUnit ?? material.unit };
  },
});

/**
 * Deducts consumed base units from the ACTIVE floor batches of a machine +
 * material (FIFO by issue time). Returns the quantity actually deducted, which
 * can be less than requested when the floor runs dry — the weekly
 * reconciliation surfaces that variance. Never blocks production: the catalog
 * tier keeps its own audited deduction.
 */
export async function deductOperatorStock(
  ctx: MutationCtx,
  machineId: string,
  materialId: string,
  baseQuantity: number,
): Promise<number> {
  if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) return 0;
  const batches = (await ctx.db
    .query("operatorMachineStock")
    .withIndex("by_material_machine", (q) => q.eq("materialId", materialId as never).eq("machineId", machineId as never))
    .collect())
    .filter((batch) => batch.status === "ACTIVE" && batch.currentRemaining > 0)
    .sort((left, right) => left.issuedAt - right.issuedAt);
  let remainingToDeduct = baseQuantity;
  for (const batch of batches) {
    if (remainingToDeduct <= 0) break;
    const take = Math.min(batch.currentRemaining, remainingToDeduct);
    const next = Number((batch.currentRemaining - take).toFixed(3));
    remainingToDeduct = Number((remainingToDeduct - take).toFixed(3));
    await ctx.db.patch(batch._id, {
      currentRemaining: next,
      status: next <= 0.0001 ? "EXHAUSTED" : "ACTIVE",
      updatedAt: Date.now(),
    });
  }
  return Number((baseQuantity - remainingToDeduct).toFixed(3));
}

export const listOperatorMachineStock = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireAnyPermission(ctx, ["material.view", "machine.view", "job.view"]);
    const batches = await ctx.db.query("operatorMachineStock").collect();
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
        return !machine || !isFloorRole || canAccessMachine(profile.role, machine);
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
    operatorStockId: v.id("operatorMachineStock"),
    physicalActualRemaining: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "reconciliation.record");
    const batch = await ctx.db.get(args.operatorStockId);
    if (!batch) throw new Error("Issued stock batch not found.");
    const material = await ctx.db.get(batch.materialId);
    if (!material) throw new Error("Material not found.");
    const machine = await ctx.db.get(batch.machineId);
    if (!Number.isFinite(args.physicalActualRemaining) || args.physicalActualRemaining < 0) {
      throw new Error("Physical count must be zero or greater.");
    }

    const baseUnit = material.baseUnit ?? material.unit;
    const systemCalculatedRemaining = batch.currentRemaining;
    const discrepancy = Number((args.physicalActualRemaining - systemCalculatedRemaining).toFixed(3));
    const now = Date.now();

    await ctx.db.insert("weeklyReconciliations", {
      machineId: batch.machineId,
      operatorId: batch.operatorId,
      operatorStockId: batch._id,
      systemCalculatedRemaining,
      physicalActualRemaining: args.physicalActualRemaining,
      discrepancy,
      unit: baseUnit,
      reconciledBy: identity._id,
      reconciledAt: now,
      notes: args.notes?.trim() || undefined,
    });

    await ctx.db.patch(batch._id, {
      currentRemaining: args.physicalActualRemaining,
      status: args.physicalActualRemaining <= 0.0001 ? "EXHAUSTED" : "ACTIVE",
      updatedAt: now,
    });

    if (discrepancy !== 0) {
      await ctx.db.patch(material._id, {
        quantity: Math.max(0, Number((material.quantity + discrepancy).toFixed(3))),
      });
      await ctx.db.insert("stockMovements", {
        materialId: material._id,
        direction: discrepancy < 0 ? "out" : "in",
        quantity: Math.abs(discrepancy),
        unit: baseUnit,
        baseUnit,
        baseQuantity: Math.abs(discrepancy),
        movementType: "STANDARD",
        note: `Weekly floor reconciliation · ${machine?.name ?? batch.machineId} · physical ${args.physicalActualRemaining} vs system ${systemCalculatedRemaining} ${baseUnit}`,
        createdBy: identity._id,
        createdAt: now,
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
    stockId: v.id("operatorMachineStock"),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "stock.record");
    const batch = await ctx.db.get(args.stockId);
    if (!batch) throw new Error("Stock batch not found.");
    if (batch.status !== "ACTIVE") throw new Error("Only active stock can be exhausted.");
    
    const now = Date.now();
    const remaining = batch.currentRemaining;
    
    await ctx.db.patch(batch._id, {
      status: "EXHAUSTED",
      currentRemaining: 0,
      updatedAt: now,
    });
    
    // Write off remaining to catalog tier
    const material = await ctx.db.get(batch.materialId);
    if (material && remaining > 0) {
      await ctx.db.patch(material._id, {
        quantity: Math.max(0, Number((material.quantity - remaining).toFixed(3))),
      });
      await ctx.db.insert("stockMovements", {
        materialId: material._id,
        direction: "out",
        quantity: remaining,
        unit: material.baseUnit ?? material.unit,
        baseUnit: material.baseUnit ?? material.unit,
        baseQuantity: remaining,
        movementType: "STANDARD",
        note: `Manual floor exhaustion · ${batch.machineId} · ${remaining} ${material.baseUnit ?? material.unit} written off`,
        createdBy: identity._id,
        createdAt: now,
      });
    }
    
    return { exhausted: true, remaining };
  },
});
