import type { QueryCtx } from "./_generated/server";
import {
  resolveRouteForService,
  compatibleMachines,
  selectMachineByLoad,
  computeStandardAllocation,
  type MaterialTypeRoute,
  type OrderForAllocation,
  type MaterialLike,
  type AllocationConfig,
  type StandardAllocation,
} from "./orderAutomation";
import type { Doc, Id } from "./_generated/dataModel";

export interface ResolvedJobBOMItem {
  materialId: Id<"materials">;
  materialName: string;
  packageUnit: "ROLL" | "SHEET" | "PACKAGE" | "CANISTER" | "PIECE";
  suggestedPackages: number;
  baseUnit: "m²" | "m" | "sheet" | "piece" | "pcs" | "L" | "mL";
  plannedBaseQuantity: number;
  approvedScrapQuantity: number;
  conversionRatioSnapshot: number;
}

export interface ResolvedInkRequirement {
  materialId?: Id<"materials">;
  materialName: string;
  inkColor?: string;
  rateMlPerSqM: number;
  requiredMl: number;
  requiredLitres: number;
}

/** Reads the active database routing row, with the versioned catalog as a bootstrap fallback. */
export async function resolveServiceRoute(ctx: QueryCtx, serviceType: string): Promise<MaterialTypeRoute | undefined> {
  const row = await ctx.db
    .query("materialTypeCatalog")
    .withIndex("by_service_active", (q) => q.eq("serviceType", serviceType as never).eq("active", true))
    .first();
  if (row) {
    return {
      serviceType: row.serviceType,
      materialType: row.materialType,
      preferredMaterialName: row.preferredMaterialName,
      machineCapabilities: row.machineCapabilities,
      operatorRole: row.operatorRole,
    };
  }
  return resolveRouteForService(serviceType);
}

/** Loads the active composite BOM used for job-card requirement snapshots. */
export async function loadActiveBomForService(ctx: QueryCtx, serviceType: string) {
  return ctx.db
    .query("serviceBOM")
    .withIndex("by_active_service", (q) => q.eq("active", true).eq("serviceType", serviceType as never))
    .collect();
}

/**
 * Resolves candidate machines and selects the optimal machine based on load balancing.
 */
export async function resolveMachineCandidates(ctx: QueryCtx, route: MaterialTypeRoute) {
  const allMachines = await ctx.db.query("machines").collect();
  const compatible = compatibleMachines(route, allMachines);
  if (compatible.length === 0) return { compatible: [], selected: undefined };

  const openJobs = await ctx.db.query("jobCards").collect();
  const loadByMachineId = new Map<string, number>();
  for (const job of openJobs) {
    if (job.status !== "Completed") {
      loadByMachineId.set(job.machineId, (loadByMachineId.get(job.machineId) ?? 0) + 1);
    }
  }

  const selected = selectMachineByLoad(compatible, loadByMachineId);
  return { compatible, selected };
}

/**
 * Computes standard material allocation for an order.
 */
export function resolveMaterialAllocation(
  order: OrderForAllocation,
  material: MaterialLike,
  config: AllocationConfig,
): StandardAllocation {
  return computeStandardAllocation(order, material, config);
}

/**
 * Resolves multi-material Bill of Materials (BOM) expansion for a service.
 * If serviceBOM rows exist, expands each row. If none exist, falls back to the
 * preferred primary material from the service route.
 */
export async function resolveJobBOM(
  ctx: QueryCtx,
  serviceType: string,
  dimensions: { length?: number; width?: number },
  quantityStr: string,
  config: {
    standardWasteMargin: number;
    maxAllowedScrapLimit: number;
    defaultMarginSquareMetres?: number;
  },
): Promise<ResolvedJobBOMItem[]> {
  const bomRows = await loadActiveBomForService(ctx, serviceType);
  const serviceUnitsMatch = quantityStr.match(/[0-9]+(?:\.[0-9]+)?/);
  const serviceUnits = serviceUnitsMatch ? Math.max(1, Number(serviceUnitsMatch[0])) : 1;
  const parsedArea = dimensions.length && dimensions.width ? dimensions.length * dimensions.width : 1;

  const items: ResolvedJobBOMItem[] = [];

  if (bomRows.length > 0) {
    for (const bom of bomRows) {
      const bomMaterial = await ctx.db.get(bom.materialId);
      if (!bomMaterial || !bomMaterial.active) continue;

      const margin = config.defaultMarginSquareMetres ?? 0;
      const driver =
        bom.consumptionMode === "fixed"
          ? 1
          : bom.consumptionMode === "area_rate"
            ? (parsedArea + margin) * serviceUnits
            : bom.consumptionMode === "linear_rate"
              ? (dimensions.length ?? 1) * serviceUnits
              : serviceUnits;

      const plannedBaseQuantity = Number((bom.quantityPerUnit * driver).toFixed(3));
      const allowancePercent = bom.wasteAllowancePercent ?? config.standardWasteMargin;
      const approvedScrapQuantity = Number(((plannedBaseQuantity * allowancePercent) / 100).toFixed(3));
      const ratio = bomMaterial.conversionRatio && bomMaterial.conversionRatio > 0 ? bomMaterial.conversionRatio : 1;

      const pkgUnit =
        bomMaterial.purchaseUnit === "sheet"
          ? "SHEET"
          : bomMaterial.purchaseUnit === "roll"
            ? "ROLL"
            : bomMaterial.purchaseUnit === "canister" || bomMaterial.purchaseUnit === "liter"
              ? "CANISTER"
              : bomMaterial.purchaseUnit === "piece"
                ? "PIECE"
                : "PACKAGE";

      items.push({
        materialId: bom.materialId,
        materialName: bomMaterial.name,
        packageUnit: pkgUnit,
        suggestedPackages: Math.ceil((plannedBaseQuantity + approvedScrapQuantity) / ratio),
        baseUnit: bomMaterial.baseUnit ?? bomMaterial.unit,
        plannedBaseQuantity,
        approvedScrapQuantity,
        conversionRatioSnapshot: ratio,
      });
    }
  } else {
    const route = await resolveServiceRoute(ctx, serviceType);
    if (route) {
      const allMaterials = await ctx.db.query("materials").collect();
      const primaryMaterial =
        allMaterials.find((m) => m.name.toLowerCase() === route.preferredMaterialName.toLowerCase()) ||
        allMaterials.find((m) => m.category.toLowerCase().includes(route.materialType.toLowerCase()));

      if (primaryMaterial) {
        const alloc = computeStandardAllocation(
          { length: dimensions.length, width: dimensions.width, quantity: quantityStr },
          primaryMaterial,
          config,
        );
        const ratio = primaryMaterial.conversionRatio && primaryMaterial.conversionRatio > 0 ? primaryMaterial.conversionRatio : 1;
        const pkgUnit =
          primaryMaterial.purchaseUnit === "sheet"
            ? "SHEET"
            : primaryMaterial.purchaseUnit === "roll"
              ? "ROLL"
              : primaryMaterial.purchaseUnit === "canister" || primaryMaterial.purchaseUnit === "liter"
                ? "CANISTER"
                : primaryMaterial.purchaseUnit === "piece"
                  ? "PIECE"
                  : "PACKAGE";

        items.push({
          materialId: primaryMaterial._id,
          materialName: primaryMaterial.name,
          packageUnit: pkgUnit,
          suggestedPackages: Math.ceil((alloc.plannedBaseQuantity + alloc.approvedScrapQuantity) / ratio),
          baseUnit: primaryMaterial.baseUnit ?? primaryMaterial.unit,
          plannedBaseQuantity: alloc.plannedBaseQuantity,
          approvedScrapQuantity: alloc.approvedScrapQuantity,
          conversionRatioSnapshot: ratio,
        });
      }
    }
  }

  return items;
}

/**
 * Resolves per-color ink requirements from machine config, active service BOM,
 * or system default ink rates.
 */
export async function resolveInkRequirements(
  ctx: QueryCtx,
  machine: Doc<"machines">,
  orderAreaM2: number,
  config: { inkMlPerSquareMetre: number },
): Promise<ResolvedInkRequirement[]> {
  const results: ResolvedInkRequirement[] = [];

  // 1. Structured machine ink requirements
  if (machine.inkRequirements && machine.inkRequirements.length > 0) {
    const allMaterials = await ctx.db.query("materials").collect();
    for (const req of machine.inkRequirements) {
      const material = allMaterials.find(
        (m) => m.name.toLowerCase() === req.materialName.toLowerCase() && m.active,
      );
      const rate = req.rateMlPerSqM && req.rateMlPerSqM > 0 ? req.rateMlPerSqM : config.inkMlPerSquareMetre;
      const requiredMl = Number((orderAreaM2 * rate).toFixed(2));
      results.push({
        materialId: material?._id,
        materialName: req.materialName,
        inkColor: req.inkColor,
        rateMlPerSqM: rate,
        requiredMl,
        requiredLitres: Number((requiredMl / 1000).toFixed(3)),
      });
    }
    return results;
  }

  // 2. Machine compatible inks or associated families
  const inkNames = machine.compatibleInks ?? machine.associatedInkFamilies ?? [];
  const trackedInks = inkNames.filter((name) => {
    const lower = name.toLowerCase();
    if (lower.includes("flush") || lower.includes("cleaning") || (lower.includes("solvent") && !lower.includes("ink"))) {
      return false;
    }
    return true;
  });
  if (trackedInks.length === 0) return [];

  const allMaterials = await ctx.db.query("materials").collect();
  const perInkRate = Number((config.inkMlPerSquareMetre / Math.max(1, trackedInks.length)).toFixed(2));

  for (const name of trackedInks) {
    const material = allMaterials.find(
      (m) => m.name.toLowerCase() === name.toLowerCase() && m.active,
    );
    if (material?.materialFamily === "SOLVENT" || material?.isSolvent) continue;
    const requiredMl = Number((orderAreaM2 * perInkRate).toFixed(2));
    results.push({
      materialId: material?._id,
      materialName: name,
      rateMlPerSqM: perInkRate,
      requiredMl,
      requiredLitres: Number((requiredMl / 1000).toFixed(3)),
    });
  }

  return results;
}
