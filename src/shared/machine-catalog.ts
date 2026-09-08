import type { Role, Unit } from "../lib/operations-types";

export type MachineCatalogDefinition = {
  name: string;
  code: string;
  type: string;
  manufacturer?: string;
  model: string;
  capability: string;
  operatorRole: Role;
  materialUnit: Unit;
  displayUnit: string;
  primaryMaterialNames: readonly string[];
  compatibleInkNames: readonly string[];
  solventNames: readonly string[]; // Excluded from synchronous job card deduction
  defaultWasteMarginPercent: number;
  maxAllowedScrapLimitPercent: number;
  notes?: string;
};

/**
 * Authoritative 6 Production Machines & Auxiliary Fleet for YT Advertisement.
 * Maps machines to their primary media, ink consumables, and operator workstations.
 */
export const MACHINE_CATALOG: readonly MachineCatalogDefinition[] = [
  {
    name: "Crystal Jet 7K Series",
    code: "CJ7K-01",
    type: "Large Format Solvent Printer",
    manufacturer: "Crystal Jet",
    model: "Crystal Jet 7K Series 3.2m Solvent",
    capability: "3.2m Print Width · Heavy Duty Exterior Banner & Mesh",
    operatorRole: "printer_operator",
    materialUnit: "m²",
    displayUnit: "m²",
    primaryMaterialNames: ["Banner Flex", "Mesh Sticker"],
    compatibleInkNames: ["Banner Ink 5L Canister"],
    solventNames: ["Banner Solvent"],
    defaultWasteMarginPercent: 5,
    maxAllowedScrapLimitPercent: 10,
    notes: "Uses Banner Ink 5L Canister + Banner Solvent (Solvent adjusted periodically).",
  },
  {
    name: "Crystc Eco-Solvent Printer",
    code: "CESP-01",
    type: "Eco-Solvent Printer & Cutter",
    manufacturer: "Crystc",
    model: "Crystc 1.6m Precision Eco-Solvent Printer",
    capability: "1.6m Print Width · High Resolution Vinyl, Stickers & Grayback",
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
    notes: "Uses Eco / Print & Cut Ink 1L Canister + Print & Cut Solvent.",
  },
  {
    name: "Ricoh Flatbed UV Machine",
    code: "RUV-01",
    type: "Industrial UV Flatbed Printer",
    manufacturer: "Ricoh",
    model: "Ricoh Flatbed UV Industrial Series",
    capability: "Direct-to-Rigid Sheet Printing (Mica, Foam Board, Cladding, Canvas)",
    operatorRole: "printer_operator",
    materialUnit: "m²",
    displayUnit: "m²",
    primaryMaterialNames: ["Mica", "Foam Board", "Cladding", "Canvas"],
    compatibleInkNames: ["UV Ink 1L Canister"],
    solventNames: [],
    defaultWasteMarginPercent: 4,
    maxAllowedScrapLimitPercent: 8,
    notes: "Uses UV Ink 1L Canister (CMYK + White). No solvent consumption.",
  },
  {
    name: "DTF i3200",
    code: "DTF-01",
    type: "DTF Textile & Apparel Printer",
    manufacturer: "Crystal",
    model: "DTF i3200 Dual Head 60cm Roll-to-Roll",
    capability: "60cm Textile Films, T-Shirt Direct Transfer",
    operatorRole: "printer_operator",
    materialUnit: "m",
    displayUnit: "m",
    primaryMaterialNames: ["DTF Film", "T-Shirts"],
    compatibleInkNames: ["DTF Ink 1L Canister"],
    solventNames: ["DTF Solvent"],
    defaultWasteMarginPercent: 5,
    maxAllowedScrapLimitPercent: 10,
    notes: "Uses DTF Ink 1L Canister + DTF Solvent.",
  },
  {
    name: "Laser Cutter",
    code: "LAS-01",
    type: "CO2 Laser Cutter 1325",
    manufacturer: "Crystal",
    model: "1325 CO2 Precision Laser System",
    capability: "1.22m x 2.44m Bed · Precision Mica, Acrylic & Foam Board Cutting",
    operatorRole: "laser_operator",
    materialUnit: "m²",
    displayUnit: "m²",
    primaryMaterialNames: ["Mica", "Foam Board"],
    compatibleInkNames: [],
    solventNames: [],
    defaultWasteMarginPercent: 3,
    maxAllowedScrapLimitPercent: 7,
    notes: "Laser profile cutting for Mica and Foam Boards. Zero ink consumption.",
  },
  {
    name: "CNC Router",
    code: "CNC-01",
    type: "Heavy Duty CNC Router 2030",
    model: "2030 Heavy Duty 3-Axis CNC Router",
    capability: "2.0m x 3.0m Bed · Foam Board, Cladding, MDF Heavy Routing",
    operatorRole: "cnc_operator",
    materialUnit: "m²",
    displayUnit: "m²",
    primaryMaterialNames: ["Foam Board", "Cladding"],
    compatibleInkNames: [],
    solventNames: [],
    defaultWasteMarginPercent: 5,
    maxAllowedScrapLimitPercent: 10,
    notes: "Router cutting and 3D engraving for rigid cladding and foam boards.",
  },
  // Auxiliary Equipment
  {
    name: "Pneumatic Heat Press",
    code: "HPR-01",
    type: "Heat press",
    model: "Flatbed Heat Press 40x60cm",
    capability: "T-Shirt & Fabric Transfer Press",
    operatorRole: "printer_operator",
    materialUnit: "pcs",
    displayUnit: "pcs",
    primaryMaterialNames: ["T-Shirts", "DTF Film"],
    compatibleInkNames: [],
    solventNames: [],
    defaultWasteMarginPercent: 2,
    maxAllowedScrapLimitPercent: 5,
    notes: "Garment transfer curing.",
  },
  {
    name: "Paper Guillotine Cutter",
    code: "CON-01",
    type: "Guillotine",
    model: "Heavy Duty Paper Cutter",
    capability: "A3+ Sheet Trimming",
    operatorRole: "printer_operator",
    materialUnit: "pcs",
    displayUnit: "pcs",
    primaryMaterialNames: [],
    compatibleInkNames: [],
    solventNames: [],
    defaultWasteMarginPercent: 1,
    maxAllowedScrapLimitPercent: 3,
    notes: "Finished print trimming.",
  },
] as const;

/**
 * Service to Machine & Material Routing Matrix.
 * Automated assignment logic: removes manual receptionist guesswork.
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
  }
> = {
  banner_print: {
    preferredMachineCode: "CJ7K-01",
    primaryMaterialName: "Banner Flex",
    compatibleInkName: "Banner Ink 5L Canister",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 10,
  },
  sticker_white: {
    preferredMachineCode: "CESP-01",
    primaryMaterialName: "Frosted Sticker",
    compatibleInkName: "Print & Cut Ink 1L Canister",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 8,
  },
  sticker_transparent: {
    preferredMachineCode: "CESP-01",
    primaryMaterialName: "Transparent Sticker",
    compatibleInkName: "Print & Cut Ink 1L Canister",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 8,
  },
  sticker_reflective: {
    preferredMachineCode: "CESP-01",
    primaryMaterialName: "Reflective Sticker",
    compatibleInkName: "Print & Cut Ink 1L Canister",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 8,
  },
  sticker_mesh: {
    preferredMachineCode: "CJ7K-01",
    primaryMaterialName: "Mesh Sticker",
    compatibleInkName: "Banner Ink 5L Canister",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 10,
  },
  sticker_frosted: {
    preferredMachineCode: "CESP-01",
    primaryMaterialName: "Frosted Sticker",
    compatibleInkName: "Print & Cut Ink 1L Canister",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 8,
  },
  hq_print_and_cut: {
    preferredMachineCode: "CESP-01",
    primaryMaterialName: "Transparent Sticker",
    compatibleInkName: "Print & Cut Ink 1L Canister",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 6,
    maxScrapLimitPercent: 10,
  },
  light_box_a1: {
    preferredMachineCode: "LAS-01",
    primaryMaterialName: "Digital Screen",
    calculationUnit: "pcs",
    defaultWasteMarginPercent: 0,
    maxScrapLimitPercent: 5,
  },
  light_box_a2: {
    preferredMachineCode: "LAS-01",
    primaryMaterialName: "Digital Screen",
    calculationUnit: "pcs",
    defaultWasteMarginPercent: 0,
    maxScrapLimitPercent: 5,
  },
  neon_light: {
    preferredMachineCode: "CNC-01",
    primaryMaterialName: "Neon Light Flex",
    calculationUnit: "m",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 10,
  },
  roll_up_standard: {
    preferredMachineCode: "CESP-01",
    primaryMaterialName: "Roll-Up Stands",
    calculationUnit: "pcs",
    defaultWasteMarginPercent: 0,
    maxScrapLimitPercent: 5,
  },
  roll_up_deluxe: {
    preferredMachineCode: "CESP-01",
    primaryMaterialName: "Roll-Up Stands",
    calculationUnit: "pcs",
    defaultWasteMarginPercent: 0,
    maxScrapLimitPercent: 5,
  },
  uv_print_mica: {
    preferredMachineCode: "RUV-01",
    primaryMaterialName: "Mica",
    compatibleInkName: "UV Ink 1L Canister",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 4,
    maxScrapLimitPercent: 8,
  },
  uv_print_foam: {
    preferredMachineCode: "RUV-01",
    primaryMaterialName: "Foam Board",
    compatibleInkName: "UV Ink 1L Canister",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 4,
    maxScrapLimitPercent: 8,
  },
  uv_print_cladding: {
    preferredMachineCode: "RUV-01",
    primaryMaterialName: "Cladding",
    compatibleInkName: "UV Ink 1L Canister",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 4,
    maxScrapLimitPercent: 8,
  },
  uv_print_canvas: {
    preferredMachineCode: "RUV-01",
    primaryMaterialName: "Canvas",
    compatibleInkName: "UV Ink 1L Canister",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 8,
  },
  foam_cutout: {
    preferredMachineCode: "LAS-01",
    primaryMaterialName: "Foam Board",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 10,
  },
  foam_engrave: {
    preferredMachineCode: "CNC-01",
    primaryMaterialName: "Foam Board",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 10,
  },
  mica_cutout: {
    preferredMachineCode: "LAS-01",
    primaryMaterialName: "Mica",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 4,
    maxScrapLimitPercent: 8,
  },
  mica_engrave: {
    preferredMachineCode: "LAS-01",
    primaryMaterialName: "Mica",
    calculationUnit: "m²",
    defaultWasteMarginPercent: 4,
    maxScrapLimitPercent: 8,
  },
  dtf: {
    preferredMachineCode: "DTF-01",
    primaryMaterialName: "DTF Film",
    compatibleInkName: "DTF Ink 1L Canister",
    calculationUnit: "m",
    defaultWasteMarginPercent: 5,
    maxScrapLimitPercent: 10,
  },
  sublimation: {
    preferredMachineCode: "DTF-01",
    primaryMaterialName: "T-Shirts",
    compatibleInkName: "DTF Ink 1L Canister",
    calculationUnit: "pcs",
    defaultWasteMarginPercent: 3,
    maxScrapLimitPercent: 5,
  },
};

export function findMachineCatalogDefinition(codeOrName: string): MachineCatalogDefinition | undefined {
  const query = codeOrName.trim().toLowerCase();
  return MACHINE_CATALOG.find(
    (m) => m.code.toLowerCase() === query || m.name.toLowerCase() === query,
  );
}
