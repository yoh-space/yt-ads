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
  source: "route_bom" | "service_bom" | "legacy_fallback";
}

export interface ResolvedInkRequirement {
  materialId?: Id<"materials">;
  materialName: string;
  inkColor?: string;
  rateMlPerSqM: number;
  requiredMl: number;
  requiredLitres: number;
  source: "machine_rule" | "machine_config" | "system_default";
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
 * Loads route-specific BOM rows, falling back to service-level BOM.
 * Route-specific rows override service-level rows for the same materialId.
 */
export async function loadBomWithRouteOverride(
  ctx: QueryCtx,
  serviceType: string,
  machineServiceRouteId?: Id<"machineServiceRoutes">,
) {
  // Load service-level BOM (where machineServiceRouteId is null/undefined)
  const serviceBomRows = await ctx.db
    .query("serviceBOM")
    .withIndex("by_active_service", (q) => q.eq("active", true).eq("serviceType", serviceType as never))
    .collect();
  
  const serviceLevelRows = serviceBomRows.filter((r) => !r.machineServiceRouteId);
  
  if (!machineServiceRouteId) {
    return serviceLevelRows;
  }

  // Load route-specific BOM rows
  const routeBomRows = await ctx.db
    .query("serviceBOM")
    .withIndex("by_route", (q) => q.eq("machineServiceRouteId", machineServiceRouteId))
    .collect();

  const activeRouteRows = routeBomRows.filter((r) => r.active);
  
  // Merge: route-specific rows override service-level rows for the same materialId
  const merged = new Map<string, typeof serviceLevelRows[0]>();
  
  // Start with service-level rows
  for (const row of serviceLevelRows) {
    merged.set(row.materialId, row);
  }
  
  // Override with route-specific rows
  for (const row of activeRouteRows) {
    merged.set(row.materialId, row);
  }

  return Array.from(merged.values());
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
 * Priority: route-specific BOM > service-level BOM > legacy single-material fallback.
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
  machineServiceRouteId?: Id<"machineServiceRoutes">,
): Promise<ResolvedJobBOMItem[]> {
  const bomRows = await loadBomWithRouteOverride(ctx, serviceType, machineServiceRouteId);
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
        source: bom.machineServiceRouteId ? "route_bom" : "service_bom",
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
          source: "legacy_fallback",
        });
      }
    }
  }

  return items;
}

/**
 * Resolves per-color ink requirements from machine-specific rules,
 * machine config, or system default ink rates.
 * Priority: machineInkConsumptionRules > machine.inkRequirements > system default.
 */
export async function resolveInkRequirements(
  ctx: QueryCtx,
  machine: Doc<"machines">,
  orderAreaM2: number,
  config: { inkMlPerSquareMetre: number },
): Promise<ResolvedInkRequirement[]> {
  const results: ResolvedInkRequirement[] = [];

  // 1. Check machine-specific ink consumption rules (new normalized table)
  const machineRules = await ctx.db
    .query("machineInkConsumptionRules")
    .withIndex("by_machine", (q) => q.eq("machineId", machine._id))
    .collect();

  const activeRules = machineRules.filter((r) => r.active);
  if (activeRules.length > 0) {
    const allMaterials = await ctx.db.query("materials").collect();
    
    for (const rule of activeRules) {
      const material = allMaterials.find((m) => m._id === rule.materialId);
      if (!material || !material.active) continue;

      let requiredMl: number;
      switch (rule.consumptionUnit) {
        case "ml_per_sqm":
          requiredMl = Number((orderAreaM2 * rule.rate).toFixed(2));
          break;
        case "ml_per_linear_m":
          // For linear consumption, we'd need length dimension; approximate with area
          requiredMl = Number((orderAreaM2 * rule.rate).toFixed(2));
          break;
        case "ml_per_piece":
          requiredMl = rule.rate;
          break;
        case "fixed_per_job":
          requiredMl = rule.rate;
          break;
        default:
          requiredMl = Number((orderAreaM2 * rule.rate).toFixed(2));
      }

      const wasteFactor = rule.wasteAllowancePercent ? 1 + rule.wasteAllowancePercent / 100 : 1;
      const adjustedMl = requiredMl * wasteFactor;

      results.push({
        materialId: rule.materialId,
        materialName: material.name,
        inkColor: rule.inkColor,
        rateMlPerSqM: rule.rate,
        requiredMl: adjustedMl,
        requiredLitres: Number((adjustedMl / 1000).toFixed(3)),
        source: "machine_rule",
      });
    }
    return results;
  }

  // 2. Fallback to legacy machine ink requirements
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
        source: "machine_config",
      });
    }
    return results;
  }

  // 3. Fallback to machine compatible inks or associated families
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
      source: "system_default",
    });
  }

  return results;
}
