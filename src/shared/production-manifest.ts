import type { Role, Unit, PurchaseUnit } from "../lib/operations-types";
import type { ServiceId } from "./services";

// ============================================================================
// 1. CANONICAL OPERATOR ROLES
// ============================================================================

export const CANONICAL_OPERATOR_ROLES = [
  "laser_operator",
  "cnc_operator",
  "plotter_operator",
  "printer_operator",
] as const satisfies readonly Role[];

export type CanonicalOperatorRole = (typeof CANONICAL_OPERATOR_ROLES)[number];

// ============================================================================
// 2. CANONICAL MACHINE CAPABILITY IDS & REGISTRY
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

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export type CapabilityDefinition = {
  id: CapabilityId;
  name: string;
  description: string;
  category: "PRINTING" | "CUTTING_ROUTING" | "FINISHING_AUXILIARY";
};

export const CAPABILITY_REGISTRY: Record<CapabilityId, CapabilityDefinition> = {
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
 * Guarantees that free-text and enum-based capabilities match safely without divergence.
 */
export function normalizeCapabilityId(raw: string): CapabilityId | string {
  const normalized = raw.trim().toUpperCase();
  if (normalized in CAPABILITY_REGISTRY) {
    return normalized as CapabilityId;
  }
  const lower = raw.trim().toLowerCase();
  if (lower.includes("3.2m") || lower.includes("crystal jet") || lower.includes("exterior banner")) {
    return "PRINT_ROLL_3_2M";
  }
  if (lower.includes("1.6m") || lower.includes("eco-solvent") || lower.includes("vinyl, stickers")) {
    return "PRINT_ROLL_1_6M";
  }
  if (lower.includes("0.60m") || lower.includes("60cm") || lower.includes("dtf")) {
    return "PRINT_ROLL_0_6M_DTF";
  }
  if (lower.includes("flatbed") || lower.includes("direct-to-rigid") || lower.includes("uv industrial")) {
    return "PRINT_RIGID_UV_122_244";
  }
  if (
    lower.includes("laser") ||
    lower.includes("1325 co2") ||
    lower.includes("laser cutting") ||
    lower.includes("1.22m x 2.44m bed") ||
    lower.includes("1.22m x 2.44m standard board")
  ) {
    return "CUT_RIGID_122_244_LASER";
  }
  if (
    lower.includes("cnc") ||
    lower.includes("2030") ||
    lower.includes("heavy routing") ||
    lower.includes("2.0m x 3.0m")
  ) {
    return "CUT_RIGID_2030_CNC";
  }
  if (lower.includes("heat press") || lower.includes("transfer press")) {
    return "TRANSFER_TEXTILE";
  }
  if (lower.includes("guillotine") || lower.includes("trimming") || lower.includes("a3+")) {
    return "TRIM_A3_PLUS";
  }
  return raw;
}

// ============================================================================
// 3. CANONICAL MACHINE REGISTER (Owner-Confirmed 6 Production + 2 Auxiliary)
// ============================================================================

export type CanonicalMachineDefinition = {
  id: string;
  code: string;
  name: string;
  businessName?: string;
  type: string;
  manufacturer?: string;
  model: string;
  capabilities: readonly CapabilityId[];
  /** Legacy free-text capability string for backward compatibility */
  legacyCapabilityText: string;
  operatorRole: CanonicalOperatorRole;
  materialUnit: Unit;
  displayUnit: string;
  primaryMaterialNames: readonly string[];
  compatibleInkNames: readonly string[];
  solventNames: readonly string[];
  defaultWasteMarginPercent: number;
  maxAllowedScrapLimitPercent: number;
  isProductionFleet: boolean;
  notes?: string;
};

export const CANONICAL_MACHINES: readonly CanonicalMachineDefinition[] = [
  {
    id: "crystal_jet_7k",
    code: "CJ7K-01",
    name: "Crystal Jet 7K Series",
    businessName: "Crystal Jet 7K Series",
    type: "Large Format Solvent Printer",
    manufacturer: "Crystal Jet",
    model: "Crystal Jet 7K Series 3.2m Solvent",
    capabilities: ["PRINT_ROLL_3_2M"],
    legacyCapabilityText: "3.2m Print Width · Heavy Duty Exterior Banner & Mesh",
    operatorRole: "printer_operator",
    materialUnit: "m²",
    displayUnit: "m²",
    primaryMaterialNames: ["Banner Flex", "Mesh Sticker"],
    compatibleInkNames: ["Banner Ink 5L Canister"],
    solventNames: ["Banner Solvent"],
    defaultWasteMarginPercent: 5,
    maxAllowedScrapLimitPercent: 10,
    isProductionFleet: true,
    notes: "Uses Banner Ink 5L Canister + Banner Solvent (Solvent adjusted periodically).",
  },
  {
    id: "crystc_eco_solvent",
    code: "CESP-01",
    name: "Crystc Eco-Solvent Printer",
    businessName: "Crystc Eco-Solvent Printer",
    type: "Eco-Solvent Printer & Cutter",
    manufacturer: "Crystc",
    model: "Crystc 1.6m Precision Eco-Solvent Printer",
    capabilities: ["PRINT_ROLL_1_6M"],
    legacyCapabilityText: "1.6m Print Width · High Resolution Vinyl, Stickers & Grayback",
    operatorRole: "plotter_operator",
    materialUnit: "m²",
    displayUnit: "m²",
    primaryMaterialNames: [
      "Frosted Sticker",
      "Transparent Sticker",
      "Reflective Sticker",
      "Mesh Sticker",
    ],
    compatibleInkNames: ["Print & Cut Ink 1L Canister"],
    solventNames: ["Print & Cut Solvent"],
    defaultWasteMarginPercent: 5,
    maxAllowedScrapLimitPercent: 8,
    isProductionFleet: true,
    notes: "Uses Eco / Print & Cut Ink 1L Canister + Print & Cut Solvent.",
  },
  {
    id: "ricoh_uv_flatbed",
    code: "RUV-01",
    name: "Ricoh Flatbed UV Machine",
    businessName: "Recho Flatbed UV Machine",
    type: "Industrial UV Flatbed Printer",
    manufacturer: "Ricoh",
    model: "Ricoh Flatbed UV Industrial Series",
    capabilities: ["PRINT_RIGID_UV_122_244"],
    legacyCapabilityText: "Direct-to-Rigid Sheet Printing (Mica, Foam Board, Cladding, Canvas)",
    operatorRole: "printer_operator",
    materialUnit: "m²",
    displayUnit: "m²",
    primaryMaterialNames: ["Mica", "Foam Board", "Cladding", "Canvas"],
    compatibleInkNames: ["UV Ink 1L Canister"],
    solventNames: [],
    defaultWasteMarginPercent: 4,
    maxAllowedScrapLimitPercent: 8,
    isProductionFleet: true,
    notes: "Uses UV Ink 1L Canister (CMYK + White). No solvent consumption.",
  },
  {
    id: "dtf_i3200",
    code: "DTF-01",
    name: "DTF i3200",
    businessName: "DTF I32",
    type: "DTF Textile & Apparel Printer",
    manufacturer: "Crystal",
    model: "DTF i3200 Dual Head 60cm Roll-to-Roll",
    capabilities: ["PRINT_ROLL_0_6M_DTF"],
    legacyCapabilityText: "60cm Textile Films, T-Shirt Direct Transfer",
    operatorRole: "printer_operator",
    materialUnit: "m",
    displayUnit: "m",
    primaryMaterialNames: ["DTF Film", "T-Shirts"],
    compatibleInkNames: ["DTF Ink 1L Canister"],
    solventNames: ["DTF Solvent"],
    defaultWasteMarginPercent: 5,
    maxAllowedScrapLimitPercent: 10,
    isProductionFleet: true,
    notes: "Uses DTF Ink 1L Canister + DTF Solvent.",
  },
  {
    id: "laser_cutter_1325",
    code: "LAS-01",
    name: "Laser Cutter",
    businessName: "Laser Cut",
    type: "CO2 Laser Cutter 1325",
    manufacturer: "Crystal",
    model: "1325 CO2 Precision Laser System",
    capabilities: ["CUT_RIGID_122_244_LASER"],
    legacyCapabilityText: "1.22m x 2.44m Bed · Precision Mica, Acrylic & Foam Board Cutting",
    operatorRole: "laser_operator",
    materialUnit: "m²",
    displayUnit: "m²",
    primaryMaterialNames: ["Mica", "Foam Board"],
    compatibleInkNames: [],
    solventNames: [],
    defaultWasteMarginPercent: 3,
    maxAllowedScrapLimitPercent: 7,
    isProductionFleet: true,
    notes: "Laser profile cutting for Mica and Foam Boards. Zero ink consumption.",
  },
  {
    id: "cnc_router_2030",
    code: "CNC-01",
    name: "CNC Router",
    businessName: "CNC Router",
    type: "Heavy Duty CNC Router 2030",
    model: "2030 Heavy Duty 3-Axis CNC Router",
    capabilities: ["CUT_RIGID_2030_CNC"],
    legacyCapabilityText: "2.0m x 3.0m Bed · Foam Board, Cladding, MDF Heavy Routing",
    operatorRole: "cnc_operator",
    materialUnit: "m²",
    displayUnit: "m²",
    primaryMaterialNames: ["Foam Board", "Cladding", "MDF Sheet"],
    compatibleInkNames: [],
    solventNames: [],
    defaultWasteMarginPercent: 5,
    maxAllowedScrapLimitPercent: 10,
    isProductionFleet: true,
    notes: "Router cutting and 3D engraving for rigid cladding, foam boards, and MDF.",
  },
  // Auxiliary Equipment (non-production routing fleet)
  {
    id: "heat_press_4060",
    code: "HPR-01",
    name: "Pneumatic Heat Press",
    type: "Heat press",
    model: "Flatbed Heat Press 40x60cm",
    capabilities: ["TRANSFER_TEXTILE"],
    legacyCapabilityText: "T-Shirt & Fabric Transfer Press",
    operatorRole: "printer_operator",
    materialUnit: "pcs",
    displayUnit: "pcs",
    primaryMaterialNames: ["T-Shirts", "DTF Film"],
    compatibleInkNames: [],
    solventNames: [],
    defaultWasteMarginPercent: 2,
    maxAllowedScrapLimitPercent: 5,
    isProductionFleet: false,
    notes: "Garment transfer curing.",
  },
  {
    id: "paper_guillotine",
    code: "CON-01",
    name: "Paper Guillotine Cutter",
    type: "Guillotine",
    model: "Heavy Duty Paper Cutter",
    capabilities: ["TRIM_A3_PLUS"],
    legacyCapabilityText: "A3+ Sheet Trimming",
    operatorRole: "printer_operator",
    materialUnit: "pcs",
    displayUnit: "pcs",
    primaryMaterialNames: [],
    compatibleInkNames: [],
    solventNames: [],
    defaultWasteMarginPercent: 1,
    maxAllowedScrapLimitPercent: 3,
    isProductionFleet: false,
    notes: "Finished print trimming.",
  },
] as const;

export const CONFIRMED_PRODUCTION_MACHINES = CANONICAL_MACHINES.filter(
  (m) => m.isProductionFleet,
);

export function findManifestMachine(codeOrName: string): CanonicalMachineDefinition | undefined {
  const query = codeOrName.trim().toLowerCase();
  return CANONICAL_MACHINES.find(
    (m) =>
      m.code.toLowerCase() === query ||
      m.name.toLowerCase() === query ||
      m.businessName?.toLowerCase() === query ||
      m.id.toLowerCase() === query,
  );
}

// ============================================================================
// 4. CANONICAL SERVICE ROUTING MATRIX
// ============================================================================

export type CanonicalServiceRoute = {
  serviceId: ServiceId;
  materialType: string;
  preferredMaterialName: string;
  primaryMaterialName?: string;
  requiredCapabilities: readonly CapabilityId[];
  legacyCapabilities: readonly string[];
  operatorRole: CanonicalOperatorRole;
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
    operatorRole: "printer_operator",
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
    operatorRole: "plotter_operator",
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
    operatorRole: "plotter_operator",
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
    operatorRole: "plotter_operator",
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
    operatorRole: "printer_operator",
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
    operatorRole: "plotter_operator",
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
    operatorRole: "plotter_operator",
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
    operatorRole: "plotter_operator",
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
    operatorRole: "plotter_operator",
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
    operatorRole: "printer_operator",
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
    operatorRole: "printer_operator",
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
    operatorRole: "printer_operator",
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
    operatorRole: "printer_operator",
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
    operatorRole: "printer_operator",
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
    operatorRole: "printer_operator",
    preferredMachineCode: "DTF-01",
    calculationUnit: "pcs",
    defaultWasteMarginPercent: 3,
    maxScrapLimitPercent: 5,
  },
};

export function resolveManifestRoute(serviceId: string): CanonicalServiceRoute | undefined {
  return CANONICAL_SERVICE_ROUTES[serviceId as ServiceId];
}
