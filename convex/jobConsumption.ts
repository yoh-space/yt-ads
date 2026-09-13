import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { recordInventoryEvent } from "./inventoryLedger";
import { ensureSystemConfig } from "./systemConfigs";
import { classifyMaterialProductionType } from "./materialUsage";

export interface DeductJobRequirementsArgs {
  jobCardId: Id<"jobCards">;
  actorId: string;
  mode: "incremental" | "completion";
  actualInputQuantity?: number;
  actualOutputQuantity?: number;
  wasteQuantity?: number;
}

export interface DeductionResult {
  deductedCount: number;
  completedRequirements: number;
  totalDeductedBase: number;
  movements: Id<"stock_movements">[];
}

/**
 * Authoritative single-engine deduction for job card requirements.
 * Handles both "incremental" (production logging) and "completion" (job completion) modes.
 *
 * Invariants:
 * 1. Deducts FIFO from active operatorSubStock first; falls back to parent warehouse if exhausted.
 * 2. Deducts ink in mL base internally and in L for package movements.
 * 3. Never automatically deducts solvents (family = SOLVENT or isSolvent = true).
 * 4. Prevents double-deductions using the `consumedBaseQuantity` accumulator.
 * 5. Marks fulfilled requirements as COMPLETED and preserves all ledger audit trails.
 */
export async function deductJobRequirements(
  ctx: MutationCtx,
  args: DeductJobRequirementsArgs,
): Promise<DeductionResult> {
  const job = await ctx.db.get(args.jobCardId);
  if (!job) throw new Error("Job card not found.");

  const machine = await ctx.db.get(job.machineId);
  if (!machine) throw new Error("Job machine not found.");

  const config = await ensureSystemConfig(ctx, args.actorId);
  const requirements = await ctx.db
    .query("jobMaterialRequirements")
    .withIndex("by_job_card", (q) => q.eq("jobCardId", args.jobCardId))
    .collect();

  const movements: Id<"stock_movements">[] = [];
  let totalDeductedBase = 0;
  let completedRequirements = 0;
  let deductedCount = 0;

  for (const req of requirements) {
    if (req.status === "COMPLETED") continue;

    const material = await ctx.db.get(req.materialId);
    if (!material || !material.active) continue;

    // Invariant 3: Skip solvents from automatic consumption
    const isSolvent = material.isSolvent || material.materialFamily === "SOLVENT" || material.name.toLowerCase().includes("solvent");
    if (isSolvent) continue;

    const isInk = material.materialFamily === "INK" || classifyMaterialProductionType(material) === "ink";
    const totalPlanned = Number((req.plannedBaseQuantity + req.approvedScrapQuantity).toFixed(3));
    const alreadyConsumed = req.consumedBaseQuantity ?? 0;

    let toDeduct = 0;
    if (args.mode === "incremental") {
      if (isInk) {
        // Check for machine-specific ink consumption rules first
        const machineInkRules = await ctx.db
          .query("machineInkConsumptionRules")
          .withIndex("by_machine", (q) => q.eq("machineId", job.machineId))
          .collect();

        const activeInkRules = machineInkRules.filter((r) => r.active && r.materialId === req.materialId);
        
        if (activeInkRules.length > 0) {
          // Use machine-specific ink rule matching the material's ink color if available
          const normalizedColor = material.inkColor ? material.inkColor.toUpperCase() : null;
          const rule = (normalizedColor
            ? activeInkRules.find((r) => r.inkColor.toUpperCase() === normalizedColor)
            : null) ?? activeInkRules[0];
          const printedArea = args.actualOutputQuantity ?? 0;
          const rate = rule.rate;
          const requiredMl = printedArea * rate;
          const wasteFactor = rule.wasteAllowancePercent ? 1 + rule.wasteAllowancePercent / 100 : 1;
          toDeduct = Number(((requiredMl * wasteFactor) / 1000).toFixed(3)); // in Litres
        } else {
          // Fallback to global config
          const printedArea = args.actualOutputQuantity ?? 0;
          const rate = material.consumptionRate ?? config.inkMlPerSquareMetre;
          const requiredMl = printedArea * rate;
          toDeduct = Number((requiredMl / 1000).toFixed(3)); // in Litres
        }
      } else {
        toDeduct = args.actualInputQuantity ?? 0;
      }
    } else {
      // "completion" mode: deduct remaining unconsumed balance
      toDeduct = Number(Math.max(0, totalPlanned - alreadyConsumed).toFixed(3));
    }

    if (toDeduct <= 0) {
      if (args.mode === "completion") {
        await ctx.db.patch(req._id, { status: "COMPLETED", updatedAt: Date.now() });
        completedRequirements += 1;
      }
      continue;
    }

    // Invariant 1: Deduct from operator floor sub-stock FIFO
    const activeSubStocks = await ctx.db
      .query("operatorSubStock")
      .withIndex("by_material_machine", (q) => q.eq("materialId", req.materialId).eq("machineId", job.machineId))
      .collect();

    let remainingToDeduct = toDeduct;
    for (const subStock of activeSubStocks) {
      if (subStock.status !== "ACTIVE" || subStock.currentRemaining <= 0) continue;

      const deductFromBatch = Math.min(remainingToDeduct, subStock.currentRemaining);
      if (deductFromBatch > 0) {
        const movementId = await recordInventoryEvent(ctx, {
          materialId: req.materialId,
          eventType: "PRODUCTION_CONSUMPTION",
          custody: "operator",
          balanceEffect: "out",
          quantity: deductFromBatch,
          unit: req.baseUnit,
          baseUnit: req.baseUnit,
          baseQuantity: deductFromBatch,
          operatorSubStockId: subStock._id,
          operatorId: subStock.operatorId,
          machineId: job.machineId,
          jobCardId: job._id,
          note: `Production consumption (${job.code}, ${args.mode})`,
          createdBy: args.actorId,
        });

        movements.push(movementId);
        remainingToDeduct = Number((remainingToDeduct - deductFromBatch).toFixed(3));
        if (remainingToDeduct <= 0) break;
      }
    }

    // Deduct remaining directly from parent inventory if floor stock is exhausted
    if (remainingToDeduct > 0) {
      const parentInv = await ctx.db
        .query("parentInventory")
        .withIndex("by_material", (q) => q.eq("materialId", req.materialId))
        .first();

      const ratio = material.conversionRatio && material.conversionRatio > 0 ? material.conversionRatio : 1;
      const packageQty = parentInv ? Number((remainingToDeduct / ratio).toFixed(3)) : undefined;

      const movementId = await recordInventoryEvent(ctx, {
        materialId: req.materialId,
        eventType: "PRODUCTION_CONSUMPTION",
        custody: "parent",
        balanceEffect: "out",
        quantity: remainingToDeduct,
        unit: req.baseUnit,
        baseUnit: req.baseUnit,
        baseQuantity: remainingToDeduct,
        packageQuantity: packageQty,
        packageUnit: parentInv?.unitType,
        conversionRatio: ratio,
        parentInventoryId: parentInv?._id,
        jobCardId: job._id,
        note: `Direct store production consumption (${job.code}, floor stock exhausted)`,
        createdBy: args.actorId,
      });

      movements.push(movementId);
    }

    // Invariant 4: Prevent double-deduction by updating consumedBaseQuantity
    const newConsumed = Number((alreadyConsumed + toDeduct).toFixed(3));
    const isNowCompleted = args.mode === "completion" || newConsumed >= totalPlanned;

    await ctx.db.patch(req._id, {
      consumedBaseQuantity: newConsumed,
      status: isNowCompleted ? "COMPLETED" : req.status,
      updatedAt: Date.now(),
    });

    if (isNowCompleted) completedRequirements += 1;
    totalDeductedBase = Number((totalDeductedBase + toDeduct).toFixed(3));
    deductedCount += 1;
  }

  // Update any active reservations for this job card to COMMITTED
  if (args.mode === "completion") {
    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_job_card", (q) => q.eq("jobCardId", job._id))
      .collect();

    for (const res of reservations) {
      if (res.status === "RESERVED") {
        await ctx.db.patch(res._id, { status: "COMMITTED", updatedAt: Date.now() });
      }
    }
  }

  return {
    deductedCount,
    completedRequirements,
    totalDeductedBase,
    movements,
  };
}
