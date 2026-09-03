import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { PurchaseUnit, Unit } from "./types";

export type InventoryEventType =
  | "STOCK_IN"
  | "STORE_TO_OPERATOR_TRANSFER"
  | "PRODUCTION_CONSUMPTION"
  | "OFFCUT_RETURN"
  | "SCRAP_LOG"
  | "RECONCILIATION_ADJUSTMENT"
  | "EXCEPTION_STOCK_OUT";

export type InventoryCustody = "parent" | "operator";
export type InventoryBalanceEffect = "in" | "out" | "transfer" | "none";
type InputUnit = PurchaseUnit | Unit;

export type InventoryEventInput = {
  materialId: Id<"materials">;
  eventType: InventoryEventType;
  custody: InventoryCustody;
  balanceEffect: InventoryBalanceEffect;
  quantity: number;
  unit: InputUnit;
  baseUnit: Unit;
  baseQuantity: number;
  packageQuantity?: number;
  packageUnit?: "ROLL" | "SHEET" | "LITER";
  conversionRatio?: number;
  parentInventoryId?: Id<"parentInventory">;
  operatorSubStockId?: Id<"operatorSubStock">;
  operatorId?: string;
  machineId?: Id<"machines">;
  jobCardId?: Id<"jobCards">;
  materialRequestId?: Id<"materialRequests">;
  offcutId?: Id<"offcuts">;
  reconciliationId?: Id<"weeklyReconciliations">;
  materialReconciliationId?: Id<"reconciliations">;
  note: string;
  createdBy: string;
};

function round(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

/**
 * Appends one authoritative inventory event and updates only the materialized
 * custody projections. Callers must never patch inventory balances directly.
 */
export async function recordInventoryEvent(
  ctx: MutationCtx,
  input: InventoryEventInput,
): Promise<Id<"stock_movements">> {
  if (!Number.isFinite(input.baseQuantity) || input.baseQuantity <= 0) {
    throw new Error("Inventory event quantity must be greater than zero.");
  }
  if (!input.note.trim()) throw new Error("Inventory event note is required.");

  const material = await ctx.db.get(input.materialId);
  if (!material || !material.active) throw new Error("Active material not found.");

  let materialDelta = 0;
  if (input.custody === "parent" || input.eventType === "STORE_TO_OPERATOR_TRANSFER") {
    if (input.balanceEffect === "in") materialDelta = input.baseQuantity;
    if (input.balanceEffect === "out" || input.balanceEffect === "transfer") materialDelta = -input.baseQuantity;
  }

  const nextMaterialQuantity = round(material.quantity + materialDelta);
  if (nextMaterialQuantity < -0.0001) {
    throw new Error(`Insufficient ${material.name} stock for this inventory event.`);
  }
  if (materialDelta !== 0) {
    await ctx.db.patch(material._id, { quantity: Math.max(0, nextMaterialQuantity) });
  }

  if (input.parentInventoryId && input.packageQuantity !== undefined) {
    const parent = await ctx.db.get(input.parentInventoryId);
    if (!parent) throw new Error("Parent inventory item not found.");
    let packageDelta = 0;
    if (input.eventType === "STOCK_IN") packageDelta = input.packageQuantity;
    if (input.eventType === "STORE_TO_OPERATOR_TRANSFER") packageDelta = -input.packageQuantity;
    if (input.eventType === "RECONCILIATION_ADJUSTMENT") {
      packageDelta = input.balanceEffect === "in" ? input.packageQuantity : -input.packageQuantity;
    }
    if (packageDelta !== 0) {
      const nextPackages = round(parent.totalStockQuantity + packageDelta);
      if (nextPackages < -0.0001) throw new Error("Insufficient central packaging stock.");
      await ctx.db.patch(parent._id, { totalStockQuantity: Math.max(0, nextPackages), updatedAt: Date.now() });
    }
  }

  if (input.operatorSubStockId) {
    const subStock = await ctx.db.get(input.operatorSubStockId);
    if (!subStock) throw new Error("Operator sub-stock not found.");

    let remainingDelta = 0;
    if (input.eventType === "STORE_TO_OPERATOR_TRANSFER") remainingDelta = input.baseQuantity;
    if (
      input.eventType === "PRODUCTION_CONSUMPTION" ||
      input.eventType === "SCRAP_LOG" ||
      (input.eventType === "OFFCUT_RETURN" && input.custody === "operator")
    ) {
      remainingDelta = -input.baseQuantity;
    }
    if (input.eventType === "RECONCILIATION_ADJUSTMENT") {
      remainingDelta = input.balanceEffect === "in" ? input.baseQuantity : -input.baseQuantity;
    }

    const nextRemaining = round(subStock.currentRemaining + remainingDelta);
    if (nextRemaining < -0.0001) throw new Error("Operator sub-stock cannot go below zero.");
    const isTransfer = input.eventType === "STORE_TO_OPERATOR_TRANSFER";
    await ctx.db.patch(subStock._id, {
      issuedUnits: isTransfer ? round(subStock.issuedUnits + (input.packageQuantity ?? 0)) : subStock.issuedUnits,
      issuedQuantity: isTransfer ? round(subStock.issuedQuantity + input.baseQuantity) : subStock.issuedQuantity,
      currentRemaining: Math.max(0, nextRemaining),
      status: nextRemaining <= 0.0001 ? "EXHAUSTED" : "ACTIVE",
      updatedAt: Date.now(),
    });
  }

  return ctx.db.insert("stock_movements", {
    materialId: input.materialId,
    eventType: input.eventType,
    custody: input.custody,
    balanceEffect: input.balanceEffect,
    quantity: input.quantity,
    unit: input.unit,
    baseUnit: input.baseUnit,
    baseQuantity: input.baseQuantity,
    packageQuantity: input.packageQuantity,
    packageUnit: input.packageUnit,
    conversionRatio: input.conversionRatio,
    parentInventoryId: input.parentInventoryId,
    operatorSubStockId: input.operatorSubStockId,
    operatorId: input.operatorId,
    machineId: input.machineId,
    jobCardId: input.jobCardId,
    materialRequestId: input.materialRequestId,
    offcutId: input.offcutId,
    reconciliationId: input.reconciliationId,
    materialReconciliationId: input.materialReconciliationId,
    note: input.note.trim(),
    createdBy: input.createdBy,
    createdAt: Date.now(),
  });
}
