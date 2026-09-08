export type MaterialPurchaseUnit = "roll" | "sheet" | "pack" | "liter" | "piece";
export type MaterialBaseUnit = "m²" | "m" | "pcs" | "L";
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

const machineInkOptions = [
  "CMYK (Cyan, Magenta, Yellow, Key/Black)",
  "Expanded Gamut / Light Inks (Light Cyan, Light Magenta, Light Black)",
  "Specialty Inks (White Ink, Spot Gloss / Clear UV Varnish, Primer)",
  "Ink Formulations: Eco-Solvent, Solvent, UV-Curing Ink, Sublimation Ink",
] as const;

const stickerOptions = [
  "1.2 Meter × 50 Meter Roll",
  "1.07 Meter × 50 Meter Roll",
  "1.52 Meter × 50 Meter Roll",
] as const;

/**
 * Verified 23 Raw Material Categories across 4 Primary Units for YT Advertisement:
 * 1. Roll Materials (m² or Meters)
 * 2. Rigid Sheets (Pieces / 1.22m x 2.44m)
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
    note: "Confirmed conversion basis: 3.2m × 50m = 160m² per roll.",
  },
  {
    name: "DTF Film",
    category: "Film",
    purchaseUnit: "roll",
    baseUnit: "m",
    conversionRatio: 100,
    displayUnit: "ሮል",
    rollWidth: 0.6,
    storageLocation: "Store",
    averageUse: "Based on customer requirement",
    note: "Confirmed conversion basis: 0.60m × 100m; track production usage in running metres.",
    catalogFamily: "ROLL",
    catalogVariant: "DTF Film",
    catalogDimensions: "0.60m × 100m",
    compatibleMachineTypes: ["DTF"],
  },
  {
    name: "Acrylic",
    category: "Rigid sheet",
    purchaseUnit: "sheet",
    baseUnit: "m²",
    conversionRatio: 2.977,
    displayUnit: "ቁጥር",
    sheetWidth: 1.22,
    sheetLength: 2.44,
    specification: "Thickness (in millimeters)",
    specificationOptions: ["18mm", "10mm", "8mm", "5mm", "3mm"],
    note: "Confirmed sheet basis: 1.22m × 2.44m = 2.977m² per sheet.",
  },
  {
    name: "DTF Ink",
    category: "Ink",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    displayUnit: "ሊትር",
    specification: "Ink Type & Color Config",
    specificationOptions: machineInkOptions,
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "DTF Ink 1L",
    catalogDimensions: "1L canister",
    packageSize: 1,
    packageLabel: "1L canister",
    compatibleMachineTypes: ["DTF"],
  },
  {
    name: "Banner Ink",
    category: "Ink",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    displayUnit: "ሊትር",
    specification: "Ink Type & Color Config",
    specificationOptions: machineInkOptions,
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "Banner Ink 5L",
    catalogDimensions: "5L canister",
    packageSize: 5,
    packageLabel: "5L canister",
    compatibleMachineTypes: ["Banner Printer"],
  },
  {
    name: "Print and Cut INK",
    category: "Ink",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    displayUnit: "ሊትር",
    specification: "Ink Type & Color Config",
    specificationOptions: machineInkOptions,
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "Print & Cut Ink 1L",
    catalogDimensions: "1L canister",
    packageSize: 1,
    packageLabel: "1L canister",
    compatibleMachineTypes: ["Print and Cut"],
  },
  {
    name: "UV Flat bed Ink",
    category: "Ink",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    displayUnit: "ሊትር",
    specification: "Ink Type & Color Config",
    specificationOptions: machineInkOptions,
    catalogFamily: "INK_SOLVENT",
    catalogVariant: "UV Ink 1L",
    catalogDimensions: "1L canister",
    packageSize: 1,
    packageLabel: "1L canister",
    compatibleMachineTypes: ["UV Flatbed"],
  },
  {
    name: "LED Module / Strip",
    aliases: ["LED"],
    category: "Electrical",
    purchaseUnit: "pack",
    baseUnit: "pcs",
    conversionRatio: 20,
    displayUnit: "ቁጥር",
    specification: "Color Type",
    specificationOptions: [
      "3.2m × 50m (160 m²)",
      "2.07m × 50m (103.5 m²)",
    ],
    storageLocation: "Store Rack A",
    averageUse: "Exterior signage and billboard banners",
    note: "Confirmed conversion basis: 3.2m × 50m = 160m² per roll; 2.07m × 50m = 103.5m².",
  },
  {
    name: "Frosted Sticker",
    aliases: ["Frosted", "Sticker: Frosted", "Frosted Vinyl"],
    category: "Sticker roll",
    purchaseUnit: "roll",
    baseUnit: "m²",
    conversionRatio: 60,
    displayUnit: "ሮል",
    rollWidth: 1.27,
    specification: "Roll Width / Type",
    specificationOptions: stickerOptions,
    note: "Confirmed conversion basis: 1.27m × 50m = 63.5m² per roll.",
  },
  {
    name: "Mesh Sticker",
    aliases: ["Mush Sticker", "Mesh", "Sticker: Mesh", "One Way Vision"],
    category: "Sticker roll",
    purchaseUnit: "roll",
    baseUnit: "m²",
    conversionRatio: 76,
    displayUnit: "ሮል",
    rollWidth: 1.27,
    specification: "Roll Width / Type",
    specificationOptions: stickerOptions,
    note: "Confirmed conversion basis: 1.27m × 50m = 63.5m² per roll.",
  },
  {
    name: "Transparent Sticker",
    aliases: ["Transparent", "Sticker: Transparent", "Clear Vinyl"],
    category: "Sticker roll",
    purchaseUnit: "roll",
    baseUnit: "m²",
    conversionRatio: 76,
    displayUnit: "ሮል",
    rollWidth: 1.27,
    specification: "Roll Width / Type",
    specificationOptions: stickerOptions,
    note: "Confirmed conversion basis: 1.27m × 50m = 63.5m² per roll.",
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
    specification: "Roll Width / Type",
    specificationOptions: stickerOptions,
    note: "Confirmed conversion basis: 1.27m × 50m = 63.5m² per roll.",
  },
  {
    name: "Mush Sticker",
    category: "Sticker roll",
    purchaseUnit: "roll",
    baseUnit: "m²",
    conversionRatio: 63.5,
    displayUnit: "ሮል",
    rollWidth: 1.27,
    specification: "Roll Width / Type",
    specificationOptions: stickerOptions,
    note: "Source label retained as Mush Sticker; prompt conversion basis is the same 1.27m × 50m roll.",
  },
  {
    name: "Mica Sheet",
    aliases: ["Mica"],
    category: "Rigid sheet",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
    specification: "Color Type / Finish",
    specificationOptions: [
      "White",
      "Black",
      "Red",
      "Blue",
      "Green",
      "Yellow",
      "Clear/Transparent",
      "Translucent",
       "Silver Metallic",
       "Gold Metallic",
       "Blue Light",
       "Blue Dark",
       "Lemmen",
      "Mirror/Frosted",
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
    specification: "Roll Width & Length",
    specificationOptions: ["60cm × 100m"],
    storageLocation: "Apparel Cabinet C",
    averageUse: "T-Shirt and garment direct heat transfer printing",
    note: "Confirmed conversion basis: 0.60m × 100m; tracked in linear running meters.",
  },
  {
    name: "Canvas",
    aliases: ["Canvas (Canva)", "Canva", "Artist Canvas"],
    category: "Fabric roll",
    purchaseUnit: "roll",
    baseUnit: "m²",
    conversionRatio: 45,
    displayUnit: "ሮል",
    rollWidth: 1.52,
    specification: "Roll Width / Type (in meters)",
    specificationOptions: ["1.4 Meter", "1.0 Meter"],
    note: "Confirmed conversion basis for current roll: 1.52m × 30m = 45.6m².",
  },

  // ==========================================
  // 2. RIGID SHEETS (Calculated in Pieces / 1.22m x 2.44m = 2.977 m²)
  // ==========================================
  {
    name: "Mica",
    aliases: ["Mica Sheet", "Acrylic", "Acrylic Sheet", "Plexiglass"],
    category: "Rigid sheet",
    purchaseUnit: "sheet",
    baseUnit: "m²",
    conversionRatio: 2.977,
    displayUnit: "ቁጥር",
    specification: "Thickness & Colors",
    specificationOptions: [
      "3mm",
      "5mm",
      "8mm",
      "10mm",
      "18mm",
      "White",
      "Red",
      "Black",
      "Blue Light",
      "Blue Dark",
      "Lemmen",
      "Green",
       "Yellow",
       "Orange",
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
    specification: "Wattage",
     specificationOptions: ["60 Watt", "100 Watt", "200 Watt", "400 Watt"],
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
    specification: "Thickness / Size (in millimeters)",
    specificationOptions: ["18mm", "10mm", "8mm", "5mm", "3mm"],
    storageLocation: "Rigid Sheet Bay 3",
    averageUse: "CNC 3D cutout letters, photo mounting, indoor exhibitions",
    note: "Standard sheet basis: 1.22m × 2.44m = 2.977m² per sheet.",
  },

  // ==========================================
  // 3. INKS & SOLVENTS (Calculated in Liters / Canisters)
  // ==========================================
  {
    name: "Banner Ink 5L Canister",
    aliases: ["Banner Ink", "Banner Ink 5L", "Solvent Ink 5L"],
    category: "Ink",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 5,
    displayUnit: "ሊትር",
    specification: "Color Option",
    specificationOptions: [
      "Black",
      "Blue (Cyan)",
      "Red (Magenta)",
      "Yellow",
    ],
    storageLocation: "Chemical Store Room",
    averageUse: "Crystal Jet 7K Series banner production",
    note: "Packaging: 5L canister. Deducted synchronously per job card based on m² printed.",
  },
  {
    name: "DTF Ink 1L Canister",
    aliases: ["DTF Ink", "DTF Ink 1L", "Textile Ink 1L"],
    category: "Ink",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    displayUnit: "ሊትር",
    specification: "Color Option",
    specificationOptions: [
      "White",
      "Yellow",
      "Black",
      "Blue (Cyan)",
      "Red (Magenta)",
    ],
    storageLocation: "Chemical Store Room",
    averageUse: "DTF i3200 garment printing",
    note: "Packaging: 1L bottle/canister. Deducted synchronously per job card.",
  },
  {
    name: "Print & Cut Ink 1L Canister",
    aliases: ["Print and Cut INK", "Print & Cut Ink", "Eco-Solvent Ink 1L", "Eco-Solvent Ink"],
    category: "Ink",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    displayUnit: "ሊትር",
    specification: "Color Option",
    specificationOptions: [
      "Red (Magenta)",
      "Blue (Cyan)",
      "Black",
      "Yellow",
    ],
    storageLocation: "Chemical Store Room",
    averageUse: "Crystc Eco-Solvent printer sticker and vinyl printing",
    note: "Packaging: 1L canister. Deducted synchronously per job card.",
  },
  {
    name: "UV Ink 1L Canister",
    aliases: ["UV Flat bed Ink", "UV Ink", "UV Flatbed Ink", "UV Ink 1L"],
    category: "Ink",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    displayUnit: "ሊትር",
    specification: "Color Option",
    specificationOptions: [
      "Red (Magenta)",
      "Blue (Cyan)",
      "Black",
      "Yellow",
      "White",
    ],
    storageLocation: "Chemical Store Room",
    averageUse: "Ricoh Flatbed UV rigid sheet printing",
    note: "Packaging: 1L canister. Deducted synchronously per job card.",
  },
  {
    name: "Solvents",
    aliases: [
      "Banner Solvent",
      "DTF Solvent",
      "Print & Cut Solvent",
      "Solvent",
      "Cleaning Solvent",
    ],
    category: "Solvent",
    purchaseUnit: "liter",
    baseUnit: "L",
    conversionRatio: 1,
    displayUnit: "ሊትር",
    specification: "Solvent Type",
    specificationOptions: [
      "Banner Solvent (Crystal Jet)",
      "DTF Solvent (i3200)",
      "Print & Cut Solvent (Crystc)",
    ],
    storageLocation: "Chemical Store Room (Flammables Cabinet)",
    averageUse: "Printhead flush, maintenance, daily cleaning cycles",
    note: "Excluded from synchronous per-job card deduction; periodically adjusted through maintenance and weekly reconciliation.",
    isSolvent: true,
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
    specification: "Wattage",
    specificationOptions: ["60 Watt", "100 Watt", "200 Watt", "400 Watt"],
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
    specification: "Size",
    specificationOptions: [
      "A1 (594 × 841 mm)",
      "A2 (420 × 594 mm)",
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
    specification: "Color Type",
    specificationOptions: [
      "Cool White (6000K-6500K)",
      "Warm White (3000K)",
      "White (Warm White, Cool White)",
      "Yellow",
      "Red",
      "Blue",
      "Green",
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
    specification: "Height (in centimeters)",
    specificationOptions: ["8 cm", "6 cm"],
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
    specification: "Color Type",
    specificationOptions: [
      "White (Warm White, Cool White)",
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
    aliases: ["Wire", "Electrical Cable", "Connecting Wire"],
    category: "Electrical",
    purchaseUnit: "roll",
    baseUnit: "m",
    conversionRatio: 100,
    displayUnit: "ሜትር",
    specification: "Gauge / Wire Type",
    specificationOptions: ["1.5mm Standard", "2.5mm Heavy Duty"],
    storageLocation: "Electrical Shelf E",
    averageUse: "Internal wiring for LED modules and power supplies",
    note: "Calculated in running meters.",
  },
  {
    name: "T-Shirts",
    aliases: ["T-Shirt", "Blank T-Shirts", "Cotton T-Shirts"],
    category: "Textile & Apparel",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
    specification: "Size & Fabric",
    specificationOptions: ["S", "M", "L", "XL", "XXL"],
    storageLocation: "Apparel Cabinet C",
    averageUse: "Garment apparel branding and DTF print transfers",
  },
  {
    name: "Amire",
    aliases: ["AMIR", "Amir", "Amire Fasteners", "Rivets"],
    category: "Hardware",
    purchaseUnit: "pack",
    baseUnit: "pcs",
    conversionRatio: 250,
    displayUnit: "ፓኬት",
    specification: "Packaging",
    specificationOptions: ["Packet of 250 pieces"],
    storageLocation: "Hardware Rack G",
    averageUse: "Metal sheet fixing, frame assembly, banner mounting",
    note: "Pack conversion: 250 pieces per packet.",
  },
  {
    name: "Roll-Up Stands",
    aliases: [
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
    specification: "Stand Model",
    specificationOptions: ["Deluxe Roll-Up Stand", "Standard Roll-Up Stand"],
    storageLocation: "Finished Goods Shelf F",
    averageUse: "Portable promotional exhibition displays",
  },
  {
    name: "Mesh Sticker",
    category: "Sticker roll",
    purchaseUnit: "roll",
    baseUnit: "m²",
    conversionRatio: 60,
    displayUnit: "ሮል",
    catalogFamily: "ROLL",
    catalogVariant: "Mesh Sticker",
    catalogDimensions: "1.2m × 50m; 1.52m × 50m",
    compatibleMachineTypes: ["Banner Printer", "Print and Cut"],
    specification: "Roll Width / Type",
    specificationOptions: ["1.2 Meter × 50 Meter Roll", "1.52 Meter × 50 Meter Roll"],
  },
  {
    name: "Cladding",
    category: "Rigid sheet",
    purchaseUnit: "sheet",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
    catalogFamily: "RIGID_SHEET",
    catalogVariant: "Cladding",
    catalogDimensions: "1.22m × 2.44m",
    compatibleMachineTypes: ["UV Flatbed", "CNC Router"],
    specification: "Color Type",
    specificationOptions: ["White", "Gray", "Black"],
    sheetWidth: 1.22,
    sheetLength: 2.44,
  },
  {
    name: "Banner Solvent",
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
  },
  {
    name: "DTF Solvent",
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
  },
  {
    name: "Print & Cut Solvent",
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
  },
  {
    name: "Electric Wire",
    category: "Electrical",
    purchaseUnit: "roll",
    baseUnit: "m",
    conversionRatio: 1,
    displayUnit: "ሜትር",
    catalogFamily: "HARDWARE",
    catalogVariant: "Electric Wire",
    catalogDimensions: "Metres",
  },
  {
    name: "T-Shirts",
    category: "Finished component",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
    catalogFamily: "HARDWARE",
    catalogVariant: "T-Shirts",
    compatibleMachineTypes: ["DTF"],
  },
  {
    name: "Digital Screen",
    category: "Display hardware",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
    catalogFamily: "HARDWARE",
    catalogVariant: "Digital Screen",
    specification: "Screen Size",
    specificationOptions: ["A1", "A2"],
  },
];

export const materialNameOptions = MATERIAL_SPECIFICATIONS.map((material) => material.name);

export function findMaterialSpecification(name: string): MaterialSpecificationDefinition | undefined {
  const normalized = name.trim().toLowerCase();
  // Verified catalog definitions are appended after legacy aliases; prefer the
  // latest canonical record when both generations match the same name.
  for (let index = MATERIAL_SPECIFICATIONS.length - 1; index >= 0; index -= 1) {
    const material = MATERIAL_SPECIFICATIONS[index];
    if (
      material.name.toLowerCase() === normalized ||
      material.aliases?.some((alias) => alias.toLowerCase() === normalized)
    ) {
      return material;
    }
  }
  return undefined;
}

export function materialSpecificationOptions(name: string): readonly string[] {
  return findMaterialSpecification(name)?.specificationOptions ?? [];
}
