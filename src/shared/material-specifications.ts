type MaterialPurchaseUnit = "roll" | "sheet" | "pack" | "liter" | "piece";
type MaterialBaseUnit = "m²" | "m" | "pcs" | "L";
export type MaterialCatalogFamily = "ROLL" | "RIGID_SHEET" | "INK_SOLVENT" | "HARDWARE";
export type MaterialFamily = "RAW_MATERIAL" | "INK" | "SOLVENT" | "HARDWARE";

export type MaterialSpecificationDefinition = {
  name: string;
  aliases?: readonly string[];
  category: string;
  purchaseUnit: MaterialPurchaseUnit;
  baseUnit: MaterialBaseUnit;
  conversionRatio?: number;
  packageSize?: number;
  packageLabel?: string;
  isSolvent?: boolean;
  materialFamily?: MaterialFamily;
  inkColor?: string;
  displayUnit: string;
  specification?: string;
  specificationOptions?: readonly string[];
  storageLocation?: string;
  averageUse?: string;
  /** Confirmed printable/usable width of one roll, in metres. */
  rollWidth?: number;
  /** Confirmed sheet width in metres (rigid boards). */
  sheetWidth?: number;
  /** Confirmed sheet length in metres (rigid boards). */
  sheetLength?: number;
  note?: string;
  catalogFamily?: MaterialCatalogFamily;
  catalogVariant?: string;
  catalogDimensions?: string;
  compatibleMachineTypes?: readonly string[];
};

/** Derives the operational MaterialFamily from catalog attributes */
export function resolveMaterialFamily(material: {
  catalogFamily?: MaterialCatalogFamily;
  isSolvent?: boolean;
  category?: string;
  name?: string;
}): MaterialFamily {
  if (material.isSolvent || material.name?.toLowerCase().includes("solvent")) {
    return "SOLVENT";
  }
  if (
    material.category === "Ink" ||
    material.catalogFamily === "INK_SOLVENT" ||
    material.name?.toLowerCase().includes("ink")
  ) {
    return "INK";
  }
  if (
    material.catalogFamily === "HARDWARE" ||
    material.category === "Hardware" ||
    material.category === "Accessories"
  ) {
    return "HARDWARE";
  }
  return "RAW_MATERIAL";
}

/**
 * Authoritative Raw Material Catalog for YT Advertisement:
 * Remediated Single-Source definitions with zero duplicated records.
 *
 * 1. Roll Materials (m² or Meters)
 * 2. Rigid Sheets (m² / 1.22m × 2.44m = 2.977m²)
 * 3. Inks & Solvents (Liters / Canisters)
 * 4. Hardware & Countable Accessories
 */
export const MATERIAL_SPECIFICATIONS: readonly MaterialSpecificationDefinition[] = [
  // ==========================================
  // 1. ROLL MATERIALS (Calculated in m² or Meters)
  // ==========================================
  {
    name: "Banner Flex",
    aliases: ["Banner", "Banner Flex Roll", "Flex Banner"],
    category: "Banner",
    purchaseUnit: "roll",
    baseUnit: "m²",
    conversionRatio: 160,
    displayUnit: "ሮል",
    rollWidth: 3.2,
    catalogFamily: "ROLL",
    catalogVariant: "Banner Flex",
    catalogDimensions: "3.2m × 50m; 2.07m × 50m",
    compatibleMachineTypes: ["Banner Printer", "Print and Cut"],
    specification: "Roll Dimensions",
    specificationOptions: ["3.2m × 50m", "2.07m × 50m"],
    storageLocation: "Store Rack A",
    averageUse: "Exterior signage and billboard banners",
    note: "Confirmed conversion basis: 3.2m × 50m = 160m² per roll; 2.07m × 50m = 103.5m².",
  },
  {
    name: "Frosted Sticker",
    aliases: ["Frosted", "Sticker: Frosted", "Frosted Vinyl", "Normal Sticker"],
    category: "Sticker roll",
    purchaseUnit: "roll",
    baseUnit: "m²",
    conversionRatio: 60,
    displayUnit: "ሮል",
    rollWidth: 1.2,
    catalogFamily: "ROLL",
    catalogVariant: "Frosted Sticker",
    catalogDimensions: "1.2m × 50m",
    compatibleMachineTypes: ["Print and Cut"],
    specification: "Roll Width / Type",
    specificationOptions: [
      "1.2 Meter × 50 Meter Roll",
      "1.52 Meter × 50 Meter Roll",
    ],
    storageLocation: "Sticker Rack B",
    averageUse: "Glass partitioning and decorative frosted privacy films",
    note: "Confirmed conversion basis: 1.2m × 50m = 60m² per roll.",
  },
  {
    name: "Mesh Sticker",
    aliases: ["Mush Sticker", "Mesh", "Sticker: Mesh", "One Way Vision"],
    category: "Sticker roll",
    purchaseUnit: "roll",
    baseUnit: "m²",
    conversionRatio: 76,
    displayUnit: "ሮል",
    rollWidth: 1.52,
    catalogFamily: "ROLL",
    catalogVariant: "Mesh Sticker",
    catalogDimensions: "1.2m × 50m; 1.52m × 50m",
    compatibleMachineTypes: ["Banner Printer", "Print and Cut"],
    specification: "Roll Width / Type",
    specificationOptions: [
      "1.2 Meter × 50 Meter Roll",
      "1.52 Meter × 50 Meter Roll",
    ],
    storageLocation: "Sticker Rack B",
    averageUse: "Perforated window graphics and vehicle rear glass advertisements",
    note: "Confirmed conversion basis: 1.52m × 50m = 76m²; 1.2m × 50m = 60m².",
  },
  {
    name: "Transparent Sticker",
    aliases: ["Transparent", "Sticker: Transparent", "Clear Vinyl"],
    category: "Sticker roll",
    purchaseUnit: "roll",
    baseUnit: "m²",
    conversionRatio: 76,
    displayUnit: "ሮል",
    rollWidth: 1.52,
    catalogFamily: "ROLL",
    catalogVariant: "Transparent Sticker",
    catalogDimensions: "1.07m × 50m; 1.52m × 50m",
    compatibleMachineTypes: ["Print and Cut"],
    specification: "Roll Width / Type",
    specificationOptions: [
      "1.07 Meter × 50 Meter Roll",
      "1.52 Meter × 50 Meter Roll",
    ],
    storageLocation: "Sticker Rack B",
    averageUse: "Clear product labels, window decals, and see-through promotional media",
    note: "Confirmed conversion basis: 1.52m × 50m = 76m²; 1.07m × 50m = 53.5m².",
  },
  {
    name: "Reflective Sticker",
    aliases: ["Reflective", "Sticker: Reflective"],
    category: "Sticker roll",
    purchaseUnit: "roll",
    baseUnit: "m²",
    conversionRatio: 63.5,
    displayUnit: "ሮል",
    rollWidth: 1.27,
    catalogFamily: "ROLL",
    catalogVariant: "Reflective Sticker",
    catalogDimensions: "1.07m × 50m; 1.52m × 50m",
    compatibleMachineTypes: ["Print and Cut"],
    specification: "Roll Width / Type",
    specificationOptions: [
      "1.07 Meter × 50 Meter Roll",
      "1.52 Meter × 50 Meter Roll",
    ],
    storageLocation: "Sticker Rack B",
    averageUse: "Traffic, safety, and nighttime high-visibility signage",
    note: "Confirmed conversion basis: 1.52m × 50m = 76m²; 1.07m × 50m = 53.5m².",
  },
  {
    name: "DTF Film",
    aliases: ["DTF Film Roll", "DTF PET Film", "Textile Film"],
    category: "Film",
    purchaseUnit: "roll",
    baseUnit: "m",
    conversionRatio: 100,
    displayUnit: "ሮል",
    rollWidth: 0.6,
    catalogFamily: "ROLL",
    catalogVariant: "DTF Film",
    catalogDimensions: "0.60m × 100m",
    compatibleMachineTypes: ["DTF"],
    specification: "Roll Width & Length",
    specificationOptions: ["60cm × 100m"],
    storageLocation: "Apparel Cabinet C",
    averageUse: "T-Shirt and garment direct heat transfer printing",
    note: "Confirmed conversion basis: 0.60m × 100m; track production usage in running metres.",
  },
  {
    name: "Canvas",
    aliases: ["Canvas (Canva)", "Canva", "Artist Canvas"],
    category: "Fabric roll",
    purchaseUnit: "roll",
    baseUnit: "m²",
    conversionRatio: 45,
    displayUnit: "ሮል",
    rollWidth: 1.50,
    catalogFamily: "ROLL",
    catalogVariant: "Canvas",
    catalogDimensions: "1.50m × 30m; 1.50m × 50m; 1.00m × 30m; 1.00m × 50m",
    compatibleMachineTypes: ["UV Flatbed", "Banner Printer"],
    specification: "Roll Width / Type (in meters)",
    specificationOptions: [
      "1.50m × 30m Roll",
      "1.50m × 50m Roll",
      "1.00m × 30m Roll",
      "1.00m × 50m Roll",
      "1.4 Meter",
      "1.0 Meter",
    ],
    storageLocation: "Roll Rack D",
    averageUse: "Fine art reproductions, photo printing, and luxury wall decor",
    note: "Confirmed conversion basis: 1.50m × 30m = 45m² per roll.",
  },

  // ==========================================
  // 2. RIGID SHEETS (Calculated in m² or Sheets)
  // ==========================================
  {
    name: "Mica",
    aliases: ["Mica Sheet", "Acrylic", "Acrylic Sheet", "Plexiglass"],
    category: "Rigid sheet",
    purchaseUnit: "sheet",
    baseUnit: "m²",
    conversionRatio: 2.977,
    displayUnit: "ቁጥር",
    sheetWidth: 1.22,
    sheetLength: 2.44,
    catalogFamily: "RIGID_SHEET",
    catalogVariant: "Mica Sheet",
    catalogDimensions: "1.22m × 2.44m",
    compatibleMachineTypes: ["UV Flatbed", "Laser Cutter"],
    specification: "Thickness & Colors",
    specificationOptions: [
      "3mm",
      "5mm",
      "8mm",
      "10mm",
      "18mm",
      "3mm Thickness",
      "5mm Thickness",
      "8mm Thickness",
      "10mm Thickness",
      "18mm Thickness",
      "White",
      "Red",
      "Black",
      "Blue Light",
      "Blue Dark",
      "Lemmen",
      "Green",
      "Yellow",
      "Orange",
      "Golden",
      "Transparent Mica",
      "Transparent",
      "Pink",
      "Ice Blue",
      "Purple",
      "RGB (Color-Changing)",
      "Neon Spot/Fluorescent Tones (Pink, Yellow, Orange, Green)",
    ],
    storageLocation: "Rigid Sheet Bay 1",
    averageUse: "Illuminated signs, letters, laser cutting, 3D emblems",
    note: "Standard rigid sheet basis: 1.22m × 2.44m = 2.977m² per sheet.",
  },
  {
    name: "Cladding",
    aliases: ["Cladding Sheet", "Aluminium Cladding", "ACP Sheet"],
    category: "Rigid sheet",
    purchaseUnit: "sheet",
    baseUnit: "m²",
    conversionRatio: 2.977,
    displayUnit: "ቁጥር",
    sheetWidth: 1.22,
    sheetLength: 2.44,
    catalogFamily: "RIGID_SHEET",
    catalogVariant: "Cladding",
    catalogDimensions: "1.22m × 2.44m",
    compatibleMachineTypes: ["UV Flatbed", "CNC Router"],
    specification: "Color Type",
    specificationOptions: ["White", "Gray", "Black"],
    storageLocation: "Rigid Sheet Bay 2",
    averageUse: "Architectural facade cladding, building signs, CNC grooving",
    note: "Standard sheet basis: 1.22m × 2.44m = 2.977m² per sheet.",
  },
  {
    name: "Foam Board",
    aliases: ["Foam", "Foam Sheet", "Forex", "PVC Foam Board"],
    category: "Foam board",
    purchaseUnit: "sheet",
    baseUnit: "m²",
    conversionRatio: 2.977,
    displayUnit: "ቁጥር",
    sheetWidth: 1.22,
    sheetLength: 2.44,
    catalogFamily: "RIGID_SHEET",
    catalogVariant: "Foam Board",
    catalogDimensions: "1.22m × 2.44m",
    compatibleMachineTypes: ["UV Flatbed", "Laser Cutter", "CNC Router"],
    specification: "Thickness / Size (in millimeters)",
    specificationOptions: ["18mm", "15mm", "10mm", "5mm", "3mm"],
    storageLocation: "Rigid Sheet Bay 3",
    averageUse: "CNC 3D cutout letters, photo mounting, indoor exhibitions",
    note: "Standard sheet basis: 1.22m × 2.44m = 2.977m² per sheet. Confirmed thicknesses: 3mm, 5mm, 10mm, 15mm, 18mm.",
  },
  {
    name: "MDF Sheet",
    aliases: ["MDF", "MDF Board", "Medium Density Fibreboard"],
    category: "Rigid sheet",
    purchaseUnit: "sheet",
    baseUnit: "m²",
    conversionRatio: 2.977,
    displayUnit: "ቁጥር",
    sheetWidth: 1.22,
    sheetLength: 2.44,
    catalogFamily: "RIGID_SHEET",
    catalogVariant: "MDF Sheet",
    catalogDimensions: "1.22m × 2.44m",
    compatibleMachineTypes: ["CNC Router"],
    specification: "Thickness / Size (in millimeters)",
    specificationOptions: ["18mm", "12mm", "9mm", "6mm", "3mm"],
    storageLocation: "Rigid Sheet Bay 4",
    averageUse: "Heavy 3D CNC carving, decorative screens, indoor architectural fixtures",
    note: "Standard sheet basis: 1.22m × 2.44m = 2.977m² per sheet.",
  },

  // ==========================================
  // 3. INKS & SOLVENTS (Calculated in Liters / Canisters)
  // Per-color independent raw materials according to owner confirmation
  // ==========================================

  // --- Banner Ink (5L Canister) ---
  {
    name: "Banner Ink 5L Canister - Cyan",
    aliases: ["Banner Ink 5L Canister (Cyan)", "Banner Ink Cyan", "Banner Ink 5L Cyan", "Banner Ink 5L Canister", "Banner Ink", "Banner Ink 5L", "Solvent Ink 5L"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "CYAN",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 5,
    packageSize: 5,
    packageLabel: "5L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "Banner Ink 5L",
    catalogDimensions: "5L canister",
    compatibleMachineTypes: ["Banner Printer"],
    specification: "Ink Color",
    specificationOptions: ["Cyan"],
    storageLocation: "Chemical Store Room",
    averageUse: "Crystal Jet 7K Series banner production (Cyan channel)",
    note: "Packaging: 5L canister. Deducted synchronously per job card based on m² printed.",
  },
  {
    name: "Banner Ink 5L Canister - Magenta",
    aliases: ["Banner Ink 5L Canister (Magenta)", "Banner Ink Magenta", "Banner Ink 5L Magenta"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "MAGENTA",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 5,
    packageSize: 5,
    packageLabel: "5L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "Banner Ink 5L",
    catalogDimensions: "5L canister",
    compatibleMachineTypes: ["Banner Printer"],
    specification: "Ink Color",
    specificationOptions: ["Magenta"],
    storageLocation: "Chemical Store Room",
    averageUse: "Crystal Jet 7K Series banner production (Magenta channel)",
    note: "Packaging: 5L canister. Deducted synchronously per job card based on m² printed.",
  },
  {
    name: "Banner Ink 5L Canister - Yellow",
    aliases: ["Banner Ink 5L Canister (Yellow)", "Banner Ink Yellow", "Banner Ink 5L Yellow"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "YELLOW",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 5,
    packageSize: 5,
    packageLabel: "5L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "Banner Ink 5L",
    catalogDimensions: "5L canister",
    compatibleMachineTypes: ["Banner Printer"],
    specification: "Ink Color",
    specificationOptions: ["Yellow"],
    storageLocation: "Chemical Store Room",
    averageUse: "Crystal Jet 7K Series banner production (Yellow channel)",
    note: "Packaging: 5L canister. Deducted synchronously per job card based on m² printed.",
  },
  {
    name: "Banner Ink 5L Canister - Black",
    aliases: ["Banner Ink 5L Canister (Black)", "Banner Ink Black", "Banner Ink 5L Black"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "BLACK",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 5,
    packageSize: 5,
    packageLabel: "5L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "Banner Ink 5L",
    catalogDimensions: "5L canister",
    compatibleMachineTypes: ["Banner Printer"],
    specification: "Ink Color",
    specificationOptions: ["Black"],
    storageLocation: "Chemical Store Room",
    averageUse: "Crystal Jet 7K Series banner production (Black channel)",
    note: "Packaging: 5L canister. Deducted synchronously per job card based on m² printed.",
  },

  // --- DTF Ink (1L Canister) ---
  {
    name: "DTF Ink 1L Canister - Cyan",
    aliases: ["DTF Ink 1L Canister (Cyan)", "DTF Ink Cyan", "DTF Ink 1L Cyan", "DTF Ink 1L Canister", "DTF Ink", "DTF Ink 1L", "Textile Ink 1L"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "CYAN",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    packageSize: 1,
    packageLabel: "1L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "DTF Ink 1L",
    catalogDimensions: "1L canister",
    compatibleMachineTypes: ["DTF"],
    specification: "Ink Color",
    specificationOptions: ["Cyan"],
    storageLocation: "Chemical Store Room",
    averageUse: "DTF i3200 garment printing (Cyan channel)",
    note: "Packaging: 1L bottle/canister. Deducted synchronously per job card.",
  },
  {
    name: "DTF Ink 1L Canister - Magenta",
    aliases: ["DTF Ink 1L Canister (Magenta)", "DTF Ink Magenta", "DTF Ink 1L Magenta"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "MAGENTA",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    packageSize: 1,
    packageLabel: "1L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "DTF Ink 1L",
    catalogDimensions: "1L canister",
    compatibleMachineTypes: ["DTF"],
    specification: "Ink Color",
    specificationOptions: ["Magenta"],
    storageLocation: "Chemical Store Room",
    averageUse: "DTF i3200 garment printing (Magenta channel)",
    note: "Packaging: 1L bottle/canister. Deducted synchronously per job card.",
  },
  {
    name: "DTF Ink 1L Canister - Yellow",
    aliases: ["DTF Ink 1L Canister (Yellow)", "DTF Ink Yellow", "DTF Ink 1L Yellow"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "YELLOW",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    packageSize: 1,
    packageLabel: "1L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "DTF Ink 1L",
    catalogDimensions: "1L canister",
    compatibleMachineTypes: ["DTF"],
    specification: "Ink Color",
    specificationOptions: ["Yellow"],
    storageLocation: "Chemical Store Room",
    averageUse: "DTF i3200 garment printing (Yellow channel)",
    note: "Packaging: 1L bottle/canister. Deducted synchronously per job card.",
  },
  {
    name: "DTF Ink 1L Canister - Black",
    aliases: ["DTF Ink 1L Canister (Black)", "DTF Ink Black", "DTF Ink 1L Black"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "BLACK",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    packageSize: 1,
    packageLabel: "1L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "DTF Ink 1L",
    catalogDimensions: "1L canister",
    compatibleMachineTypes: ["DTF"],
    specification: "Ink Color",
    specificationOptions: ["Black"],
    storageLocation: "Chemical Store Room",
    averageUse: "DTF i3200 garment printing (Black channel)",
    note: "Packaging: 1L bottle/canister. Deducted synchronously per job card.",
  },
  {
    name: "DTF Ink 1L Canister - White",
    aliases: ["DTF Ink 1L Canister (White)", "DTF Ink White", "DTF Ink 1L White"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "WHITE",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    packageSize: 1,
    packageLabel: "1L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "DTF Ink 1L",
    catalogDimensions: "1L canister",
    compatibleMachineTypes: ["DTF"],
    specification: "Ink Color",
    specificationOptions: ["White"],
    storageLocation: "Chemical Store Room",
    averageUse: "DTF i3200 garment printing (White underbase channel)",
    note: "Packaging: 1L bottle/canister. Deducted synchronously per job card.",
  },

  // --- Print & Cut Ink (1L Canister) ---
  {
    name: "Print & Cut Ink 1L Canister - Cyan",
    aliases: ["Print & Cut Ink 1L Canister (Cyan)", "Print and Cut INK Cyan", "Print & Cut Ink Cyan", "Print & Cut Ink 1L Canister", "Print and Cut INK", "Print & Cut Ink", "Eco-Solvent Ink 1L", "Eco-Solvent Ink"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "CYAN",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    packageSize: 1,
    packageLabel: "1L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "Print & Cut Ink 1L",
    catalogDimensions: "1L canister",
    compatibleMachineTypes: ["Print and Cut"],
    specification: "Ink Color",
    specificationOptions: ["Cyan"],
    storageLocation: "Chemical Store Room",
    averageUse: "Crystc Eco-Solvent precision printer sticker and grayback runs (Cyan channel)",
    note: "Packaging: 1L bottle/canister. Deducted synchronously per job card.",
  },
  {
    name: "Print & Cut Ink 1L Canister - Magenta",
    aliases: ["Print & Cut Ink 1L Canister (Magenta)", "Print and Cut INK Magenta", "Print & Cut Ink Magenta"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "MAGENTA",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    packageSize: 1,
    packageLabel: "1L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "Print & Cut Ink 1L",
    catalogDimensions: "1L canister",
    compatibleMachineTypes: ["Print and Cut"],
    specification: "Ink Color",
    specificationOptions: ["Magenta"],
    storageLocation: "Chemical Store Room",
    averageUse: "Crystc Eco-Solvent precision printer sticker and grayback runs (Magenta channel)",
    note: "Packaging: 1L bottle/canister. Deducted synchronously per job card.",
  },
  {
    name: "Print & Cut Ink 1L Canister - Yellow",
    aliases: ["Print & Cut Ink 1L Canister (Yellow)", "Print and Cut INK Yellow", "Print & Cut Ink Yellow"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "YELLOW",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    packageSize: 1,
    packageLabel: "1L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "Print & Cut Ink 1L",
    catalogDimensions: "1L canister",
    compatibleMachineTypes: ["Print and Cut"],
    specification: "Ink Color",
    specificationOptions: ["Yellow"],
    storageLocation: "Chemical Store Room",
    averageUse: "Crystc Eco-Solvent precision printer sticker and grayback runs (Yellow channel)",
    note: "Packaging: 1L bottle/canister. Deducted synchronously per job card.",
  },
  {
    name: "Print & Cut Ink 1L Canister - Black",
    aliases: ["Print & Cut Ink 1L Canister (Black)", "Print and Cut INK Black", "Print & Cut Ink Black"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "BLACK",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    packageSize: 1,
    packageLabel: "1L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "Print & Cut Ink 1L",
    catalogDimensions: "1L canister",
    compatibleMachineTypes: ["Print and Cut"],
    specification: "Ink Color",
    specificationOptions: ["Black"],
    storageLocation: "Chemical Store Room",
    averageUse: "Crystc Eco-Solvent precision printer sticker and grayback runs (Black channel)",
    note: "Packaging: 1L bottle/canister. Deducted synchronously per job card.",
  },

  // --- UV Ink (1L Canister) ---
  {
    name: "UV Ink 1L Canister - Cyan",
    aliases: ["UV Ink 1L Canister (Cyan)", "UV Ink Cyan", "UV Flat bed Ink Cyan", "UV Ink 1L Canister", "UV Flat bed Ink", "UV Ink", "UV Ink 1L"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "CYAN",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    packageSize: 1,
    packageLabel: "1L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "UV Ink 1L",
    catalogDimensions: "1L canister",
    compatibleMachineTypes: ["UV Flatbed"],
    specification: "Ink Color",
    specificationOptions: ["Cyan"],
    storageLocation: "Chemical Store Room",
    averageUse: "Ricoh Flatbed UV machine printing on mica, foam, cladding, canvas (Cyan channel)",
    note: "Packaging: 1L canister. Direct-to-rigid sheet UV curing.",
  },
  {
    name: "UV Ink 1L Canister - Magenta",
    aliases: ["UV Ink 1L Canister (Magenta)", "UV Ink Magenta", "UV Flat bed Ink Magenta"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "MAGENTA",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    packageSize: 1,
    packageLabel: "1L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "UV Ink 1L",
    catalogDimensions: "1L canister",
    compatibleMachineTypes: ["UV Flatbed"],
    specification: "Ink Color",
    specificationOptions: ["Magenta"],
    storageLocation: "Chemical Store Room",
    averageUse: "Ricoh Flatbed UV machine printing on mica, foam, cladding, canvas (Magenta channel)",
    note: "Packaging: 1L canister. Direct-to-rigid sheet UV curing.",
  },
  {
    name: "UV Ink 1L Canister - Yellow",
    aliases: ["UV Ink 1L Canister (Yellow)", "UV Ink Yellow", "UV Flat bed Ink Yellow"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "YELLOW",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    packageSize: 1,
    packageLabel: "1L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "UV Ink 1L",
    catalogDimensions: "1L canister",
    compatibleMachineTypes: ["UV Flatbed"],
    specification: "Ink Color",
    specificationOptions: ["Yellow"],
    storageLocation: "Chemical Store Room",
    averageUse: "Ricoh Flatbed UV machine printing on mica, foam, cladding, canvas (Yellow channel)",
    note: "Packaging: 1L canister. Direct-to-rigid sheet UV curing.",
  },
  {
    name: "UV Ink 1L Canister - Black",
    aliases: ["UV Ink 1L Canister (Black)", "UV Ink Black", "UV Flat bed Ink Black"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "BLACK",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    packageSize: 1,
    packageLabel: "1L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "UV Ink 1L",
    catalogDimensions: "1L canister",
    compatibleMachineTypes: ["UV Flatbed"],
    specification: "Ink Color",
    specificationOptions: ["Black"],
    storageLocation: "Chemical Store Room",
    averageUse: "Ricoh Flatbed UV machine printing on mica, foam, cladding, canvas (Black channel)",
    note: "Packaging: 1L canister. Direct-to-rigid sheet UV curing.",
  },
  {
    name: "UV Ink 1L Canister - White",
    aliases: ["UV Ink 1L Canister (White)", "UV Ink White", "UV Flat bed Ink White"],
    category: "Ink",
    materialFamily: "INK",
    inkColor: "WHITE",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    packageSize: 1,
    packageLabel: "1L canister",
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "UV Ink 1L",
    catalogDimensions: "1L canister",
    compatibleMachineTypes: ["UV Flatbed"],
    specification: "Ink Color",
    specificationOptions: ["White"],
    storageLocation: "Chemical Store Room",
    averageUse: "Ricoh Flatbed UV machine printing on mica, foam, cladding, canvas (White channel)",
    note: "Packaging: 1L canister. Direct-to-rigid sheet UV curing.",
  },
  {
    name: "Banner Solvent",
    aliases: ["Banner Solvent Canister"],
    category: "Solvent",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "Banner Solvent",
    catalogDimensions: "Canister",
    compatibleMachineTypes: ["Banner Printer"],
    isSolvent: true,
    storageLocation: "Chemical Store Room (Flammables Cabinet)",
    averageUse: "Printhead flush, maintenance, daily cleaning cycles on Crystal Jet",
    note: "Excluded from synchronous per-job card deduction; periodically adjusted through maintenance reconciliations.",
  },
  {
    name: "DTF Solvent",
    aliases: ["DTF Solvent Canister"],
    category: "Solvent",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "DTF Solvent",
    catalogDimensions: "Canister",
    compatibleMachineTypes: ["DTF"],
    isSolvent: true,
    storageLocation: "Chemical Store Room (Flammables Cabinet)",
    averageUse: "Printhead flush and cap station maintenance on DTF i3200",
    note: "Excluded from synchronous per-job deduction.",
  },
  {
    name: "Print & Cut Solvent",
    aliases: ["Print and Cut Solvent Canister"],
    category: "Solvent",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "Print & Cut Solvent",
    catalogDimensions: "Canister",
    compatibleMachineTypes: ["Print and Cut"],
    isSolvent: true,
    storageLocation: "Chemical Store Room (Flammables Cabinet)",
    averageUse: "Eco-solvent printhead flush and wiper cleaning on Crystc",
    note: "Excluded from synchronous per-job deduction.",
  },
  {
    name: "Solvents",
    aliases: ["Cleaning Solvent", "Flush Solvent"],
    category: "Solvent",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    displayUnit: "ሊትር",
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "General Solvent",
    catalogDimensions: "Canister",
    isSolvent: true,
    storageLocation: "Chemical Store Room (Flammables Cabinet)",
    averageUse: "Workshop equipment cleaning and general flush",
    note: "General maintenance solvent pool.",
  },

  // ==========================================
  // 4. HARDWARE & COUNTABLE ACCESSORIES
  // ==========================================
  {
    name: "Power Supply",
    aliases: ["Transformer", "LED Driver", "Power Supply Unit"],
    category: "Electrical",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
    catalogFamily: "HARDWARE",
    catalogVariant: "Power Supply",
    compatibleMachineTypes: ["Channel Letter Machine", "Assembly", "Laser Cutter", "CNC Router", "UV Flatbed"],
    specification: "Wattage",
    specificationOptions: [
      "60 Watt",
      "100 Watt",
      "200 Watt",
      "400 Watt",
      "60 watt",
      "100 watt",
      "200 watt",
      "400 watt",
    ],
    storageLocation: "Electrical Shelf E",
    averageUse: "LED lightboxes and illuminated channel letters",
  },
  {
    name: "Digital Screen",
    aliases: [
      "Digital Screen (A1, A2)",
      "LED LIGHT BOX A1",
      "LED LIGHT BOX A2",
      "Light Box",
      "Snap Frame Screen",
    ],
    category: "Display hardware",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
    catalogFamily: "HARDWARE",
    catalogVariant: "Digital Screen",
    compatibleMachineTypes: ["UV Flatbed", "Assembly", "Print and Cut"],
    specification: "Size",
    specificationOptions: [
      "A1 (594 × 841 mm)",
      "A2 (420 × 594 mm)",
      "Digital Screen A1",
      "Digital Screen A2",
    ],
    storageLocation: "Finished Goods Shelf F",
    averageUse: "Ultra-slim backlit posters and retail displays",
  },
  {
    name: "LED Modules",
    aliases: ["LED Module / Strip", "LED", "LEDs"],
    category: "Electrical",
    purchaseUnit: "pack",
    baseUnit: "pcs",
    conversionRatio: 20,
    displayUnit: "ቁጥር",
    catalogFamily: "HARDWARE",
    catalogVariant: "LED Modules",
    compatibleMachineTypes: ["Channel Letter Machine", "Assembly", "Laser Cutter", "CNC Router", "UV Flatbed"],
    specification: "Color Type",
    specificationOptions: [
      "White",
      "Warm",
      "Yellow",
      "Red",
      "Blue",
      "Green",
      "Cool White (6000K-6500K)",
      "Warm White (3000K)",
      "White (Warm White, Cool White)",
      "RGB (Multi-Color)",
    ],
    storageLocation: "Electrical Shelf E",
    averageUse: "Signage backlighting and letter illumination",
    note: "Pack conversion: 20 LED modules per pack.",
  },
  {
    name: "Zecolo",
    aliases: ["ZOCOLO", "Zocolo (Base / Skirting)", "Zocolo", "Base Skirting"],
    category: "Finished component",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
    catalogFamily: "HARDWARE",
    catalogVariant: "Zecolo",
    compatibleMachineTypes: ["CNC Router", "Channel Letter Machine", "Assembly"],
    specification: "Height (in centimeters)",
    specificationOptions: ["8 cm", "6 cm", "8 cm thickness", "6 cm thickness"],
    storageLocation: "Hardware Rack G",
    averageUse: "Base edging and architectural frame skirting",
  },
  {
    name: "Neon Light Flex",
    aliases: ["Neon Light", "Neon Flex", "LED Neon"],
    category: "Electrical",
    purchaseUnit: "roll",
    baseUnit: "m",
    conversionRatio: 5,
    displayUnit: "ሜትር",
    catalogFamily: "HARDWARE",
    catalogVariant: "Neon Light Flex",
    compatibleMachineTypes: ["Channel Letter Machine", "Assembly"],
    specification: "Color Type",
    specificationOptions: [
      "White (Warm White, Cool White)",
      "White",
      "Warm",
      "Yellow",
      "Red",
      "Blue",
      "Green",
      "Ice Blue",
      "Pink",
      "Orange",
      "Purple",
    ],
    storageLocation: "Electrical Shelf E",
    averageUse: "Custom neon signs, art words, and decorative accent lighting",
    note: "Confirmed purchase basis: 1 roll = 5m.",
  },
  {
    name: "Electric Wire",
    aliases: ["Wire", "Eelectric wire", "Electrical Cable", "Connecting Wire"],
    category: "Electrical",
    purchaseUnit: "roll",
    baseUnit: "m",
    conversionRatio: 100,
    displayUnit: "ሜትር",
    catalogFamily: "HARDWARE",
    catalogVariant: "Electric Wire",
    catalogDimensions: "Metres",
    compatibleMachineTypes: ["Channel Letter Machine", "Assembly", "Laser Cutter", "CNC Router", "UV Flatbed"],
    specification: "Gauge / Wire Type",
    specificationOptions: ["1.5mm Standard", "2.5mm Heavy Duty", "Measured in Meter"],
    storageLocation: "Electrical Shelf E",
    averageUse: "Internal wiring for LED modules and power supplies",
    note: "Calculated in running meters. Roll basis: 100m.",
  },
  {
    name: "T-Shirts",
    aliases: ["T-Shirt", "Tishert", "Tishert (Piece)", "Blank T-Shirts", "Cotton T-Shirts"],
    category: "Textile & Apparel",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
    catalogFamily: "HARDWARE",
    catalogVariant: "T-Shirts",
    compatibleMachineTypes: ["DTF"],
    specification: "Size & Fabric",
    specificationOptions: ["S", "M", "L", "XL", "XXL", "Piece"],
    storageLocation: "Apparel Cabinet C",
    averageUse: "Garment apparel branding and DTF print transfers",
  },
  {
    name: "Amire",
    aliases: ["AMIR", "Amir", "Amire (Packet (250 piece per package)", "Amire Fasteners", "Rivets"],
    category: "Hardware",
    purchaseUnit: "pack",
    baseUnit: "pcs",
    conversionRatio: 250,
    displayUnit: "ፓኬት",
    catalogFamily: "HARDWARE",
    catalogVariant: "Amire",
    compatibleMachineTypes: ["CNC Router", "Channel Letter Machine", "Assembly", "Banner Printer"],
    specification: "Packaging",
    specificationOptions: ["Packet of 250 pieces", "250 piece per package"],
    storageLocation: "Hardware Rack G",
    averageUse: "Metal sheet fixing, frame assembly, banner mounting",
    note: "Pack conversion: 250 pieces per packet.",
  },
  {
    name: "Roll-Up Stands",
    aliases: [
      "Roll up",
      "ROLE UP DELUX",
      "ROLE UP STANDARD",
      "Roll Up Standard",
      "Roll Up Deluxe",
      "Pull-Up Banner Stand",
    ],
    category: "Display hardware",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
    catalogFamily: "HARDWARE",
    catalogVariant: "Roll-Up Stands",
    compatibleMachineTypes: ["Print and Cut", "Banner Printer", "Assembly"],
    specification: "Stand Model",
    specificationOptions: ["Delux", "Standard", "Deluxe Roll-Up Stand", "Standard Roll-Up Stand"],
    storageLocation: "Finished Goods Shelf F",
    averageUse: "Portable promotional exhibition displays",
  },
];

export function findMaterialSpecification(name: string): MaterialSpecificationDefinition | undefined {
  const normalized = name.trim().toLowerCase();
  // 1. Exact match
  for (const material of MATERIAL_SPECIFICATIONS) {
    if (
      material.name.toLowerCase() === normalized ||
      material.aliases?.some((alias) => alias.toLowerCase() === normalized)
    ) {
      return material;
    }
  }
  // 2. Prefix / containment match for explicit variants (e.g. "Banner 3.2m × 50m", "Neon Light - Warm")
  for (const material of MATERIAL_SPECIFICATIONS) {
    const matName = material.name.toLowerCase();
    if (normalized.startsWith(matName) || normalized.includes(matName)) {
      return material;
    }
    if (
      material.aliases?.some((alias) => {
        const a = alias.toLowerCase();
        return normalized.startsWith(a) || normalized.includes(a);
      })
    ) {
      return material;
    }
  }
  return undefined;
}

export function isMaterialCompatibleWithMachine(
  materialNameOrSpec: string | { name: string; category?: string; compatibleMachineTypes?: readonly string[]; machineType?: string },
  machineSlugOrCode?: string
): boolean {
  if (!machineSlugOrCode) return true;
  const name = typeof materialNameOrSpec === "string" ? materialNameOrSpec : materialNameOrSpec.name;
  const machineType = typeof materialNameOrSpec === "object" ? materialNameOrSpec.machineType : undefined;
  const slug = machineSlugOrCode.toLowerCase().trim();

  // Direct machineType mapping if present
  if (machineType) {
    switch (machineType) {
      case "LARGE_FORMAT_PRINTER":
        return slug.includes("cj7k") || slug.includes("banner") || slug.includes("cesp") || slug.includes("print") || slug.includes("plotter");
      case "DTF_PRINTER":
        return slug.includes("dtf");
      case "PRINT_CUT_PRINTER":
        return slug.includes("cesp") || slug.includes("print") || slug.includes("plotter");
      case "UV_PRINTER":
        return slug.includes("ruv") || slug.includes("uv");
      case "CNC_LASER":
        return slug.includes("laser") || slug.includes("cnc") || slug.includes("ruv") || slug.includes("uv");
      case "SIGNAGE_ASSEMBLY":
        return slug.includes("channel") || slug.includes("assy") || slug.includes("assembly") || slug.includes("cnc") || slug.includes("laser");
      default:
        break;
    }
  }

  const spec = findMaterialSpecification(name);
  const types = spec?.compatibleMachineTypes ?? (typeof materialNameOrSpec === "object" ? materialNameOrSpec.compatibleMachineTypes : undefined);
  if (!types || types.length === 0) return true;

  return types.some((t) => {
    const target = t.toLowerCase();
    if (slug.includes("cj7k") || slug.includes("banner")) {
      return target.includes("banner") || target.includes("print and cut");
    }
    if (slug.includes("cesp") || slug.includes("plotter") || slug.includes("print")) {
      return target.includes("print and cut") || target.includes("banner");
    }
    if (slug.includes("dtf")) {
      return target.includes("dtf");
    }
    if (slug.includes("ruv") || slug.includes("uv")) {
      return target.includes("uv");
    }
    if (slug.includes("laser")) {
      return target.includes("laser");
    }
    if (slug.includes("cnc")) {
      return target.includes("cnc");
    }
    if (slug.includes("channel") || slug.includes("assy") || slug.includes("assembly")) {
      return target.includes("channel") || target.includes("assembly") || target.includes("hardware") || target.includes("electrical");
    }
    return true;
  });
}

