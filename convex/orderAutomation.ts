import { computeJobConsumption, type ProductionType } from "./materialUsage";

/**
 * Order → production automation.
 *
 * Canonical material-type routing catalog consumed by the job-card
 * auto-router. Every customer service type maps to the concrete material type
 * it consumes (Banner Flex, Vinyl Sticker, Acrylic, …), the preferred raw
 * material for the job card, and the machines capable of producing it.
 *
 * The same rows are seeded into the `materialTypeCatalog` table so owners can
 * inspect them; this constant is the versioned source of truth and a
 * synchronous fallback when the seeded catalog is empty (fresh workspace).
 */

export type MaterialTypeRoute = {
  serviceType: string;
  materialType: string;
  preferredMaterialName: string;
  machineCapabilities: readonly string[];
  operatorRole: string;
};

export const MATERIAL_TYPE_CATALOG = [
  { serviceType: "banner_print", materialType: "Banner Flex", preferredMaterialName: "Banner", machineCapabilities: ["3.2m Print Width"], operatorRole: "printer_operator" },
  { serviceType: "sticker_white", materialType: "Vinyl Sticker", preferredMaterialName: "Normal Sticker", machineCapabilities: ["1.6m Width"], operatorRole: "plotter_operator" },
  { serviceType: "sticker_transparent", materialType: "Vinyl Sticker", preferredMaterialName: "Transparent Sticker", machineCapabilities: ["1.6m Width"], operatorRole: "plotter_operator" },
  { serviceType: "sticker_reflective", materialType: "Vinyl Sticker", preferredMaterialName: "Reflective Sticker", machineCapabilities: ["1.6m Width"], operatorRole: "plotter_operator" },
  { serviceType: "sticker_mesh", materialType: "Vinyl Sticker", preferredMaterialName: "Mush Sticker", machineCapabilities: ["1.6m Width"], operatorRole: "plotter_operator" },
  { serviceType: "sticker_frosted", materialType: "Vinyl Sticker", preferredMaterialName: "Frosted Sticker", machineCapabilities: ["1.6m Width"], operatorRole: "plotter_operator" },
  { serviceType: "hq_print_and_cut", materialType: "Print & Cut Sticker", preferredMaterialName: "Normal Sticker", machineCapabilities: ["1.6m Width"], operatorRole: "plotter_operator" },
  { serviceType: "light_box_a1", materialType: "Acrylic", preferredMaterialName: "Acrylic", machineCapabilities: ["1.22m x 2.44m Standard Board"], operatorRole: "laser_operator" },
  { serviceType: "light_box_a2", materialType: "Acrylic", preferredMaterialName: "Acrylic", machineCapabilities: ["1.22m x 2.44m Standard Board"], operatorRole: "laser_operator" },
  { serviceType: "neon_light", materialType: "Neon Light", preferredMaterialName: "Neon Light", machineCapabilities: ["1.22m x 2.44m Standard Board"], operatorRole: "laser_operator" },
  { serviceType: "roll_up_standard", materialType: "Roll-Up Banner", preferredMaterialName: "ROLE UP STANDARD", machineCapabilities: ["3.2m Print Width"], operatorRole: "printer_operator" },
  { serviceType: "roll_up_deluxe", materialType: "Roll-Up Banner", preferredMaterialName: "ROLE UP DELUX", machineCapabilities: ["3.2m Print Width"], operatorRole: "printer_operator" },
  { serviceType: "uv_print_mica", materialType: "Acrylic", preferredMaterialName: "Mica Sheet", machineCapabilities: ["Direct-to-Rigid Board"], operatorRole: "printer_operator" },
  { serviceType: "uv_print_foam", materialType: "Foam", preferredMaterialName: "Foam", machineCapabilities: ["Direct-to-Rigid Board"], operatorRole: "printer_operator" },
  { serviceType: "uv_print_cladding", materialType: "Acrylic", preferredMaterialName: "Acrylic", machineCapabilities: ["Direct-to-Rigid Board"], operatorRole: "printer_operator" },
  { serviceType: "uv_print_canvas", materialType: "Canvas", preferredMaterialName: "Canvas (Canva)", machineCapabilities: ["3.2m Print Width"], operatorRole: "printer_operator" },
  { serviceType: "foam_cutout", materialType: "Foam", preferredMaterialName: "Foam", machineCapabilities: ["1.22m x 2.44m Standard Board", "2.0m x 3.0m Bed Size"], operatorRole: "laser_operator" },
  { serviceType: "foam_engrave", materialType: "Foam", preferredMaterialName: "Foam", machineCapabilities: ["1.22m x 2.44m Standard Board", "2.0m x 3.0m Bed Size"], operatorRole: "laser_operator" },
  { serviceType: "mica_cutout", materialType: "Mica", preferredMaterialName: "Mica Sheet", machineCapabilities: ["1.22m x 2.44m Standard Board", "2.0m x 3.0m Bed Size"], operatorRole: "laser_operator" },
  { serviceType: "mica_engrave", materialType: "Mica", preferredMaterialName: "Mica Sheet", machineCapabilities: ["1.22m x 2.44m Standard Board", "2.0m x 3.0m Bed Size"], operatorRole: "laser_operator" },
  { serviceType: "dtf", materialType: "DTF Film", preferredMaterialName: "DTF Film", machineCapabilities: ["0.60m Print Width"], operatorRole: "printer_operator" },
  { serviceType: "sublimation", materialType: "DTF Film", preferredMaterialName: "DTF Film", machineCapabilities: ["0.60m Print Width"], operatorRole: "printer_operator" },
] as const satisfies readonly MaterialTypeRoute[];

const CATALOG_INDEX = new Map<string, MaterialTypeRoute>(MATERIAL_TYPE_CATALOG.map((route) => [route.serviceType, route]));

/** Resolves the routing rule for a customer service type. */
export function resolveRouteForService(serviceType: string): MaterialTypeRoute | undefined {
  return CATALOG_INDEX.get(serviceType);
}

export type MachineLike = {
  _id: string;
  name: string;
  code: string;
  capability?: string;
  operatorRole: string;
  status: string;
  active: boolean;
  _creationTime: number;
};

/**
 * Filters the machine register down to the machines able to fabricate a given
 * material type: active, not in maintenance/unavailable, and matching the
 * route either by documented capability or by operator role.
 */
export function compatibleMachines(route: MaterialTypeRoute, machines: MachineLike[]): MachineLike[] {
  const capabilities = new Set(route.machineCapabilities);
  return machines.filter((machine) => {
    if (!machine.active) return false;
    if (machine.status === "Maintenance" || machine.status === "Unavailable") return false;
    if (machine.operatorRole === route.operatorRole) return true;
    return Boolean(machine.capability && capabilities.has(machine.capability));
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