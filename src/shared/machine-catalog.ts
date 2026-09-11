import type { Role, Unit } from "../lib/operations-types";
import {
  CANONICAL_MACHINES,
  CANONICAL_SERVICE_ROUTES,
  findManifestMachine,
  normalizeCapabilityId,
  type CapabilityId,
  type CanonicalMachineDefinition,
  type CanonicalServiceRoute,
} from "./production-manifest";
import type { ServiceId } from "./services";

export type MachineCatalogDefinition = {
  name: string;
  code: string;
  type: string;
  manufacturer?: string;
  model: string;
  capability: string;
  capabilities: readonly CapabilityId[];
  operatorRole: Role;
  materialUnit: Unit;
  displayUnit: string;
  primaryMaterialNames: readonly string[];
  compatibleInkNames: readonly string[];
  solventNames: readonly string[]; // Excluded from synchronous job card deduction
  defaultWasteMarginPercent: number;
  maxAllowedScrapLimitPercent: number;
  isProductionFleet: boolean;
  notes?: string;
};

/**
 * Authoritative 6 Production Machines & Auxiliary Fleet for YT Advertisement.
 * Synchronized with the Canonical Production Manifest (`src/shared/production-manifest.ts`).
 */
export const MACHINE_CATALOG: readonly MachineCatalogDefinition[] = CANONICAL_MACHINES.map((m) => ({
  name: m.name,
  code: m.code,
  type: m.type,
  manufacturer: m.manufacturer,
  model: m.model,
  capability: m.legacyCapabilityText,
  capabilities: m.capabilities,
  operatorRole: m.operatorRole,
  materialUnit: m.materialUnit,
  displayUnit: m.displayUnit,
  primaryMaterialNames: m.primaryMaterialNames,
  compatibleInkNames: m.compatibleInkNames,
  solventNames: m.solventNames,
  defaultWasteMarginPercent: m.defaultWasteMarginPercent,
  maxAllowedScrapLimitPercent: m.maxAllowedScrapLimitPercent,
  isProductionFleet: m.isProductionFleet,
  notes: m.notes,
}));

/** The 6 Owner-Confirmed Production Fleet Machines (excluding auxiliary finishing equipment) */
export const CONFIRMED_FLEET_MACHINES = MACHINE_CATALOG.filter((m) => m.isProductionFleet);

/**
 * Service to Machine & Material Routing Matrix.
 * Automated assignment logic: removes manual receptionist guesswork.
 * Derived from canonical service routes in the production manifest.
 */
export const SERVICE_ROUTING_MAP: Record<
  string,
  {
    preferredMachineCode: string;
    primaryMaterialName: string;
    compatibleInkName?: string;
    calculationUnit: Unit;
    defaultWasteMarginPercent: number;
    maxScrapLimitPercent: number;
    requiredCapabilities: readonly CapabilityId[];
  }
> = Object.fromEntries(
  Object.entries(CANONICAL_SERVICE_ROUTES).map(([serviceId, route]) => {
    let compatibleInkName: string | undefined;
    if (route.preferredMachineCode === "CJ7K-01") compatibleInkName = "Banner Ink 5L Canister";
    else if (route.preferredMachineCode === "CESP-01") compatibleInkName = "Print & Cut Ink 1L Canister";
    else if (route.preferredMachineCode === "RUV-01") compatibleInkName = "UV Ink 1L Canister";
    else if (route.preferredMachineCode === "DTF-01") compatibleInkName = "DTF Ink 1L Canister";

    return [
      serviceId,
      {
        preferredMachineCode: route.preferredMachineCode,
        primaryMaterialName: route.primaryMaterialName ?? route.preferredMaterialName,
        compatibleInkName,
        calculationUnit: route.calculationUnit,
        defaultWasteMarginPercent: route.defaultWasteMarginPercent,
        maxScrapLimitPercent: route.maxScrapLimitPercent,
        requiredCapabilities: route.requiredCapabilities,
      },
    ];
  }),
);

export function findMachineCatalogDefinition(codeOrName: string): MachineCatalogDefinition | undefined {
  const query = codeOrName.trim().toLowerCase();
  return MACHINE_CATALOG.find(
    (m) =>
      m.code.toLowerCase() === query ||
      m.name.toLowerCase() === query ||
      m.model.toLowerCase() === query,
  );
}

export { findManifestMachine, normalizeCapabilityId };
