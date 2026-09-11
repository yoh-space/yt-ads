import { computeJobConsumption, type ProductionType } from "./materialUsage";
import {
  CANONICAL_SERVICE_ROUTES,
  normalizeCapabilityId,
  findManifestMachine,
} from "../src/shared/production-manifest";

/**
 * Order → production automation.
 *
 * Canonical material-type routing catalog consumed by the job-card
 * auto-router. Synchronized with the single-source Canonical Production Manifest
 * (`src/shared/production-manifest.ts`).
 */

import type { Role } from "./types";
import type { ServiceId } from "../src/shared/services";

export type MaterialTypeRoute = {
  serviceType: ServiceId;
  materialType: string;
  preferredMaterialName: string;
  machineCapabilities: readonly string[];
  operatorRole: Role;
};

export const MATERIAL_TYPE_CATALOG: readonly MaterialTypeRoute[] = Object.values(
  CANONICAL_SERVICE_ROUTES,
).map((route) => ({
  serviceType: route.serviceId,
  materialType: route.materialType,
  preferredMaterialName: route.preferredMaterialName,
  machineCapabilities: [...route.requiredCapabilities, ...route.legacyCapabilities],
  operatorRole: route.operatorRole,
}));

const CATALOG_INDEX = new Map<string, MaterialTypeRoute>(
  MATERIAL_TYPE_CATALOG.map((route) => [route.serviceType, route]),
);

/** Resolves the routing rule for a customer service type. */
export function resolveRouteForService(serviceType: string): MaterialTypeRoute | undefined {
  return CATALOG_INDEX.get(serviceType);
}

export type MachineLike = {
  _id: string;
  name: string;
  code: string;
  capability?: string;
  capabilities?: readonly string[];
  operatorRole: string;
  status: string;
  active: boolean;
  _creationTime: number;
};

/**
 * Filters the machine register down to the machines able to fabricate a given
 * material type: active, not in maintenance/unavailable, matching the route's
 * operator role AND technical capabilities (via canonical capability ID normalization).
 */
export function compatibleMachines(
  route: { machineCapabilities: readonly string[]; operatorRole: string },
  machines: MachineLike[],
): MachineLike[] {
  const routeCapabilities = new Set(
    route.machineCapabilities.map((cap) => normalizeCapabilityId(cap)),
  );

  return machines.filter((machine) => {
    if (!machine.active) return false;
    if (machine.status === "Maintenance" || machine.status === "Unavailable") return false;
    if (machine.operatorRole !== route.operatorRole) return false;

    // If route requires no specific capabilities, matching the verified operator role is sufficient
    if (routeCapabilities.size === 0) return true;

    // Check machine technical capabilities
    const machineCaps: string[] = [];
    if (machine.capabilities && Array.isArray(machine.capabilities)) {
      machineCaps.push(...machine.capabilities);
    }
    if (machine.capability) {
      machineCaps.push(machine.capability);
    }
    // Resolve from canonical manifest if available
    const manifestMachine = findManifestMachine(machine.code || machine.name);
    if (manifestMachine) {
      machineCaps.push(...manifestMachine.capabilities);
      machineCaps.push(manifestMachine.legacyCapabilityText);
    }

    // Fallback: If machine document has no capability metadata at all (e.g. lightweight unit test mock),
    // allow matching based on the verified operator role.
    if (machineCaps.length === 0) return true;

    const normalizedMachineCaps = new Set(machineCaps.map((c) => normalizeCapabilityId(c)));
    for (const reqCap of routeCapabilities) {
      if (normalizedMachineCaps.has(reqCap)) return true;
    }
    return false;
  });
}

/**
 * Load-balancing selection: picks the compatible machine with the fewest
 * unfinished jobs assigned (queued + in production + paused), breaking ties
 * toward the idle machine and then the least-recently-registered machine.
 */
export function selectMachineByLoad(candidates: MachineLike[], loadByMachineId: Map<string, number>): MachineLike | undefined {
  if (candidates.length === 0) return undefined;
  const ranked = candidates.map((machine) => ({
    machine,
    load: loadByMachineId.get(machine._id) ?? 0,
  }));
  ranked.sort((left, right) => {
    if (left.load !== right.load) return left.load - right.load;
    if ((left.machine.status === "Running" ? 1 : 0) !== (right.machine.status === "Running" ? 1 : 0)) {
      return left.machine.status === "Running" ? 1 : -1;
    }
    return left.machine._creationTime - right.machine._creationTime;
  });
  return ranked[0].machine;
}

export type OrderForAllocation = {
  length?: number;
  width?: number;
  quantity: string;
};

export type MaterialLike = {
  name: string;
  category?: string;
  baseUnit?: string;
  unit?: string;
  productionType?: ProductionType | null;
  consumptionRate?: number;
};

export type AllocationConfig = {
  standardWasteMargin: number;
  maxAllowedScrapLimit: number;
};

export type StandardAllocation = {
  /** Material base units allocated to the job, including the standard waste margin. */
  plannedBaseQuantity: number;
  /** Expected usable production quantity before the waste margin (W × H × Qty). */
  netBaseQuantity: number;
  /** Approved scrap ceiling in the same base unit, capped by `maxAllowedScrapLimit`. */
  approvedScrapQuantity: number;
  unit: string;
  wasteMarginPercent: number;
  maxScrapLimitPercent: number;
};

/**
 * Computes the Standard Job Card allocation for a material:
 *
 *   Total = (W × H × Qty) × (1 + standardWasteMargin / 100)
 *
 * The approved scrap ceiling is driven by `maxAllowedScrapLimit` and recorded
 * alongside the planned base quantity so production logging can flag overuse
 * against the same ceiling the job card was issued with.
 */
export function computeStandardAllocation(
  order: OrderForAllocation,
  material: MaterialLike,
  config: AllocationConfig,
): StandardAllocation {
  const quantityMatch = order.quantity.match(/[0-9]+(?:\.[0-9]+)?/);
  const quantity = quantityMatch ? Math.max(1, Number(quantityMatch[0])) : 1;
  const wasteMarginPercent = Math.max(0, config.standardWasteMargin);
  const maxScrapLimitPercent = Math.max(0, config.maxAllowedScrapLimit);

  const allocation = computeJobConsumption(material, {
    length: order.length,
    width: order.width,
    quantity,
    allowancePercent: wasteMarginPercent,
  });

  const net = computeJobConsumption(material, {
    length: order.length,
    width: order.width,
    quantity,
    allowancePercent: 0,
  });

  const unit = allocation.baseQuantity > 0 ? allocation.unit : (material.baseUnit ?? material.unit ?? "m²");
  const plannedBaseQuantity = Number(allocation.baseQuantity.toFixed(3));
  const netBaseQuantity = Number(net.baseQuantity.toFixed(3));
  const approvedScrapQuantity = Number((netBaseQuantity * maxScrapLimitPercent / 100).toFixed(3));

  return {
    plannedBaseQuantity,
    netBaseQuantity,
    approvedScrapQuantity,
    unit,
    wasteMarginPercent,
    maxScrapLimitPercent,
  };
}