import type { Role, Unit } from "../lib/operations-types";
import type { ServiceId } from "./services";

// ============================================================================
// 1. TYPES ONLY — no static data. Machines & roles live in the database.
// ============================================================================

export type CanonicalOperatorRole = string;

export type CapabilityId = string;

export type CapabilityDefinition = {
  id: string;
  name: string;
  description: string;
  category: "PRINTING" | "CUTTING_ROUTING" | "FINISHING_AUXILIARY";
};

// ============================================================================
// 2. CAPABILITY REGISTRY — seed-time config, referenced by catalog.ts / seed.ts
// ============================================================================

export const CAPABILITY_IDS = [
  "PRINT_ROLL_3_2M",
  "PRINT_ROLL_1_6M",
  "PRINT_ROLL_0_6M_DTF",
  "PRINT_RIGID_UV_122_244",
  "CUT_RIGID_122_244_LASER",
  "CUT_RIGID_2030_CNC",
  "TRANSFER_TEXTILE",
  "TRIM_A3_PLUS",
] as const;

export const CAPABILITY_REGISTRY: Record<string, CapabilityDefinition> = {
  PRINT_ROLL_3_2M: {
    id: "PRINT_ROLL_3_2M",
    name: "3.2m Roll Printing",
    description: "3.2m solvent roll printing for heavy-duty exterior banners and mesh",
    category: "PRINTING",
  },
  PRINT_ROLL_1_6M: {
    id: "PRINT_ROLL_1_6M",
    name: "1.6m Eco-Solvent Printing",
    description: "1.6m eco-solvent precision printing and cutting for vinyl, stickers & grayback",
    category: "PRINTING",
  },
  PRINT_ROLL_0_6M_DTF: {
    id: "PRINT_ROLL_0_6M_DTF",
    name: "0.60m DTF Film Printing",
    description: "60cm roll-to-roll direct-to-film textile and apparel printing",
    category: "PRINTING",
  },
  PRINT_RIGID_UV_122_244: {
    id: "PRINT_RIGID_UV_122_244",
    name: "1.22m × 2.44m UV Flatbed Printing",
    description: "Direct-to-rigid sheet UV flatbed printing (Mica, Foam Board, Cladding, Canvas)",
    category: "PRINTING",
  },
  CUT_RIGID_122_244_LASER: {
    id: "CUT_RIGID_122_244_LASER",
    name: "1.22m × 2.44m Laser Cutting",
    description: "Precision CO2 laser profile cutting and engraving for mica and foam board",
    category: "CUTTING_ROUTING",
  },
  CUT_RIGID_2030_CNC: {
    id: "CUT_RIGID_2030_CNC",
    name: "2.0m × 3.0m CNC Routing",
    description: "3-axis heavy-duty CNC routing and 3D engraving for foam board, cladding, and MDF",
    category: "CUTTING_ROUTING",
  },
  TRANSFER_TEXTILE: {
    id: "TRANSFER_TEXTILE",
    name: "Heat Transfer Pressing",
    description: "Auxiliary pneumatic heat press for garment transfer curing",
    category: "FINISHING_AUXILIARY",
  },
  TRIM_A3_PLUS: {
    id: "TRIM_A3_PLUS",
    name: "A3+ Sheet Trimming",
    description: "Auxiliary heavy-duty guillotine sheet trimming",
    category: "FINISHING_AUXILIARY",
  },
};

/**
 * Normalizes free-text or legacy capability strings to canonical CapabilityId.
 */
export function normalizeCapabilityId(raw: string): string {
  const normalized = raw.trim().toUpperCase();
  if (normalized in CAPABILITY_REGISTRY) return normalized;
  const lower = raw.trim().toLowerCase();
  if (lower.includes("3.2m") || lower.includes("crystal jet") || lower.includes("exterior banner")) return "PRINT_ROLL_3_2M";
  if (lower.includes("1.6m") || lower.includes("eco-solvent") || lower.includes("vinyl, stickers")) return "PRINT_ROLL_1_6M";
  if (lower.includes("0.60m") || lower.includes("60cm") || lower.includes("dtf")) return "PRINT_ROLL_0_6M_DTF";
  if (lower.includes("flatbed") || lower.includes("direct-to-rigid") || lower.includes("uv industrial")) return "PRINT_RIGID_UV_122_244";
  if (lower.includes("laser") || lower.includes("1325 co2") || lower.includes("laser cutting") || lower.includes("1.22m x 2.44m")) return "CUT_RIGID_122_244_LASER";
  if (lower.includes("cnc") || lower.includes("2030") || lower.includes("heavy routing")) return "CUT_RIGID_2030_CNC";
  if (lower.includes("heat press") || lower.includes("transfer press")) return "TRANSFER_TEXTILE";
  if (lower.includes("guillotine") || lower.includes("trimming") || lower.includes("a3+")) return "TRIM_A3_PLUS";
  return raw;
}

// ============================================================================
// 3. CANONICAL SERVICE ROUTING MATRIX — static business rules, read at runtime
// ============================================================================

export type CanonicalServiceRoute = {
  serviceId: ServiceId;
  materialType: string;
  preferredMaterialName: string;
  primaryMaterialName?: string;
  requiredCapabilities: readonly string[];
  legacyCapabilities: readonly string[];
  operatorRole: string;
  preferredMachineCode: string;
  calculationUnit: Unit;
  defaultWasteMarginPercent: number;
  maxScrapLimitPercent: number;
};

export const CANONICAL_SERVICE_ROUTES: Record<ServiceId, CanonicalServiceRoute> = {
  banner_print: {
    serviceId: "banner_print",
    materialType: "Banner Flex",
    preferredMaterialName: "Banner",
    primaryMaterialName: "Banner Flex",
    requiredCapabilities: ["PRINT_ROLL_3_2M"],
    legacyCapabilities: ["3.2m Print Width"],
    operatorRole: "crystal_jet_operator",
    preferredMachineCode: "CJ7K-01",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 10,
  },
  sticker_white: {
    serviceId: "sticker_white",
    materialType: "Vinyl Sticker",
    preferredMaterialName: "Frosted Sticker",
    requiredCapabilities: ["PRINT_ROLL_1_6M"],
    legacyCapabilities: ["1.6m Width"],
    operatorRole: "crystek_operator",
    preferredMachineCode: "CESP-01",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 8,
  },
  sticker_transparent: {
    serviceId: "sticker_transparent",
    materialType: "Vinyl Sticker",
    preferredMaterialName: "Transparent Sticker",
    requiredCapabilities: ["PRINT_ROLL_1_6M"],
    legacyCapabilities: ["1.6m Width"],
    operatorRole: "crystek_operator",
    preferredMachineCode: "CESP-01",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 8,
  },
  sticker_reflective: {
    serviceId: "sticker_reflective",
    materialType: "Vinyl Sticker",
    preferredMaterialName: "Reflective Sticker",
    requiredCapabilities: ["PRINT_ROLL_1_6M"],
    legacyCapabilities: ["1.6m Width"],
    operatorRole: "crystek_operator",
    preferredMachineCode: "CESP-01",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 8,
  },
  sticker_mesh: {
    serviceId: "sticker_mesh",
    materialType: "Vinyl Sticker",
    preferredMaterialName: "Mesh Sticker",
    requiredCapabilities: ["PRINT_ROLL_3_2M"],
    legacyCapabilities: ["3.2m Print Width", "1.6m Width"],
    operatorRole: "crystal_jet_operator",
    preferredMachineCode: "CJ7K-01",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 10,
  },
  sticker_frosted: {
    serviceId: "sticker_frosted",
    materialType: "Vinyl Sticker",
    preferredMaterialName: "Frosted Sticker",
    requiredCapabilities: ["PRINT_ROLL_1_6M"],
    legacyCapabilities: ["1.6m Width"],
    operatorRole: "crystek_operator",
    preferredMachineCode: "CESP-01",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 8,
  },
  hq_print_and_cut: {
    serviceId: "hq_print_and_cut",
    materialType: "Print & Cut Sticker",
    preferredMaterialName: "Transparent Sticker",
    requiredCapabilities: ["PRINT_ROLL_1_6M"],
    legacyCapabilities: ["1.6m Width"],
    operatorRole: "crystek_operator",
    preferredMachineCode: "CESP-01",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 6,
    maxScrapLimitPercent: 10,
  },
  light_box_a1: {
    serviceId: "light_box_a1",
    materialType: "Acrylic",
    preferredMaterialName: "Digital Screen",
    requiredCapabilities: ["CUT_RIGID_122_244_LASER"],
    legacyCapabilities: ["1.22m x 2.44m Standard Board"],
    operatorRole: "laser_operator",
    preferredMachineCode: "LAS-01",
    calculationUnit: "pcs",
    defaultWasteMarginPercent: 0,
    maxScrapLimitPercent: 5,
  },
  light_box_a2: {
    serviceId: "light_box_a2",
    materialType: "Acrylic",
    preferredMaterialName: "Digital Screen",
    requiredCapabilities: ["CUT_RIGID_122_244_LASER"],
    legacyCapabilities: ["1.22m x 2.44m Standard Board"],
    operatorRole: "laser_operator",
    preferredMachineCode: "LAS-01",
    calculationUnit: "pcs",
    defaultWasteMarginPercent: 0,
    maxScrapLimitPercent: 5,
  },
  neon_light: {
    serviceId: "neon_light",
    materialType: "Neon Light",
    preferredMaterialName: "Neon Light Flex",
    requiredCapabilities: ["CUT_RIGID_2030_CNC"],
    legacyCapabilities: ["2.0m x 3.0m Bed Size", "1.22m x 2.44m Standard Board"],
    operatorRole: "cnc_operator",
    preferredMachineCode: "CNC-01",
    calculationUnit: "m",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 10,
  },
  roll_up_standard: {
    serviceId: "roll_up_standard",
    materialType: "Roll-Up Banner",
    preferredMaterialName: "Roll-Up Stands",
    requiredCapabilities: ["PRINT_ROLL_1_6M"],
    legacyCapabilities: ["3.2m Print Width", "1.6m Width"],
    operatorRole: "crystek_operator",
    preferredMachineCode: "CESP-01",
    calculationUnit: "pcs",
    defaultWasteMarginPercent: 0,
    maxScrapLimitPercent: 5,
  },
  roll_up_deluxe: {
    serviceId: "roll_up_deluxe",
    materialType: "Roll-Up Banner",
    preferredMaterialName: "Roll-Up Stands",
    requiredCapabilities: ["PRINT_ROLL_1_6M"],
    legacyCapabilities: ["3.2m Print Width", "1.6m Width"],
    operatorRole: "crystek_operator",
    preferredMachineCode: "CESP-01",
    calculationUnit: "pcs",
    defaultWasteMarginPercent: 0,
    maxScrapLimitPercent: 5,
  },
  uv_print_mica: {
    serviceId: "uv_print_mica",
    materialType: "Acrylic",
    preferredMaterialName: "Mica",
    requiredCapabilities: ["PRINT_RIGID_UV_122_244"],
    legacyCapabilities: ["Direct-to-Rigid Board"],
    operatorRole: "ricoh_uv_operator",
    preferredMachineCode: "RUV-01",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 4,
    maxScrapLimitPercent: 8,
  },
  uv_print_foam: {
    serviceId: "uv_print_foam",
    materialType: "Foam",
    preferredMaterialName: "Foam Board",
    requiredCapabilities: ["PRINT_RIGID_UV_122_244"],
    legacyCapabilities: ["Direct-to-Rigid Board"],
    operatorRole: "ricoh_uv_operator",
    preferredMachineCode: "RUV-01",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 4,
    maxScrapLimitPercent: 8,
  },
  uv_print_cladding: {
    serviceId: "uv_print_cladding",
    materialType: "Cladding",
    preferredMaterialName: "Cladding",
    requiredCapabilities: ["PRINT_RIGID_UV_122_244"],
    legacyCapabilities: ["Direct-to-Rigid Board"],
    operatorRole: "ricoh_uv_operator",
    preferredMachineCode: "RUV-01",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 4,
    maxScrapLimitPercent: 8,
  },
  uv_print_canvas: {
    serviceId: "uv_print_canvas",
    materialType: "Canvas",
    preferredMaterialName: "Canvas",
    requiredCapabilities: ["PRINT_RIGID_UV_122_244"],
    legacyCapabilities: ["Direct-to-Rigid Board", "3.2m Print Width"],
    operatorRole: "ricoh_uv_operator",
    preferredMachineCode: "RUV-01",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 8,
  },
  foam_cutout: {
    serviceId: "foam_cutout",
    materialType: "Foam",
    preferredMaterialName: "Foam Board",
    requiredCapabilities: ["CUT_RIGID_122_244_LASER"],
    legacyCapabilities: ["1.22m x 2.44m Standard Board", "2.0m x 3.0m Bed Size"],
    operatorRole: "laser_operator",
    preferredMachineCode: "LAS-01",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 10,
  },
  foam_engrave: {
    serviceId: "foam_engrave",
    materialType: "Foam",
    preferredMaterialName: "Foam Board",
    requiredCapabilities: ["CUT_RIGID_2030_CNC"],
    legacyCapabilities: ["2.0m x 3.0m Bed Size", "1.22m x 2.44m Standard Board"],
    operatorRole: "cnc_operator",
    preferredMachineCode: "CNC-01",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 10,
  },
  mica_cutout: {
    serviceId: "mica_cutout",
    materialType: "Mica",
    preferredMaterialName: "Mica",
    requiredCapabilities: ["CUT_RIGID_122_244_LASER"],
    legacyCapabilities: ["1.22m x 2.44m Standard Board", "2.0m x 3.0m Bed Size"],
    operatorRole: "laser_operator",
    preferredMachineCode: "LAS-01",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 4,
    maxScrapLimitPercent: 8,
  },
  mica_engrave: {
    serviceId: "mica_engrave",
    materialType: "Mica",
    preferredMaterialName: "Mica",
    requiredCapabilities: ["CUT_RIGID_122_244_LASER"],
    legacyCapabilities: ["1.22m x 2.44m Standard Board", "2.0m x 3.0m Bed Size"],
    operatorRole: "laser_operator",
    preferredMachineCode: "LAS-01",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 4,
    maxScrapLimitPercent: 8,
  },
  dtf: {
    serviceId: "dtf",
    materialType: "DTF Film",
    preferredMaterialName: "DTF Film",
    requiredCapabilities: ["PRINT_ROLL_0_6M_DTF"],
    legacyCapabilities: ["0.60m Print Width"],
    operatorRole: "dtf_operator",
    preferredMachineCode: "DTF-01",
    calculationUnit: "m",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 10,
  },
  sublimation: {
    serviceId: "sublimation",
    materialType: "DTF Film",
    preferredMaterialName: "T-Shirts",
    requiredCapabilities: ["PRINT_ROLL_0_6M_DTF"],
    legacyCapabilities: ["0.60m Print Width"],
    operatorRole: "dtf_operator",
    preferredMachineCode: "DTF-01",
    calculationUnit: "pcs",
    defaultWasteMarginPercent: 3,
    maxScrapLimitPercent: 5,
  },
};

export function resolveManifestRoute(serviceId: string): CanonicalServiceRoute | undefined {
  return CANONICAL_SERVICE_ROUTES[serviceId as ServiceId];
}
