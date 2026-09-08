export type MaterialPurchaseUnit = "roll" | "sheet" | "pack" | "liter" | "piece";
export type MaterialBaseUnit = "m²" | "m" | "pcs" | "L";

export type MaterialSpecificationDefinition = {
  name: string;
  aliases?: readonly string[];
  category: string;
  purchaseUnit: MaterialPurchaseUnit;
  baseUnit: MaterialBaseUnit;
  conversionRatio?: number;
  displayUnit: string;
  specification?: string;
  specificationOptions?: readonly string[];
  storageLocation?: string;
  averageUse?: string;
  note?: string;
  isSolvent?: boolean; // Solvents are excluded from synchronous per-job card deduction
};

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
    specification: "Roll Dimensions",
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
    specification: "Roll Dimensions",
    specificationOptions: ["1.2m × 50m (60 m²)"],
    storageLocation: "Sticker Rack B",
    averageUse: "Glass partitioning and privacy graphics",
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
    specification: "Roll Dimensions",
    specificationOptions: [
      "1.2m × 50m (60 m²)",
      "1.52m × 50m (76 m²)",
    ],
    storageLocation: "Sticker Rack B",
    averageUse: "Building and vehicle window perforated graphics",
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
    specification: "Roll Dimensions",
    specificationOptions: [
      "1.07m × 50m (53.5 m²)",
      "1.52m × 50m (76 m²)",
    ],
    storageLocation: "Sticker Rack B",
    averageUse: "Clear window and packaging stickers",
    note: "Confirmed conversion basis: 1.52m × 50m = 76m²; 1.07m × 50m = 53.5m².",
  },
  {
    name: "Reflective Sticker",
    aliases: ["Reflective", "Sticker: Reflective"],
    category: "Sticker roll",
    purchaseUnit: "roll",
    baseUnit: "m²",
    conversionRatio: 76,
    displayUnit: "ሮል",
    specification: "Roll Dimensions",
    specificationOptions: [
      "1.07m × 50m (53.5 m²)",
      "1.52m × 50m (76 m²)",
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
    specification: "Roll Width & Length",
    specificationOptions: [
      "1.50m × 30m (45 m²)",
      "1.50m × 50m (75 m²)",
      "1.00m × 30m (30 m²)",
      "1.00m × 50m (50 m²)",
    ],
    storageLocation: "Fabric Rack D",
    averageUse: "Fine art, portraits, and indoor wall decorations",
    note: "Confirmed conversion basis: 1.50m × 30m = 45m² standard roll.",
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
      "Golden",
      "Transparent",
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
    specification: "Color Finish",
    specificationOptions: ["White", "Gray", "Black"],
    storageLocation: "Rigid Sheet Bay 2",
    averageUse: "Building exterior facades, pylon signage, CNC routed panels",
    note: "Standard rigid sheet basis: 1.22m × 2.44m = 2.977m² per sheet.",
  },
  {
    name: "Foam Board",
    aliases: ["Foam", "Foam Sheet", "Forex", "PVC Foam Board"],
    category: "Foam board",
    purchaseUnit: "sheet",
    baseUnit: "m²",
    conversionRatio: 2.977,
    displayUnit: "ቁጥር",
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
] as const;

export const materialNameOptions = MATERIAL_SPECIFICATIONS.map((material) => material.name);

export function findMaterialSpecification(name: string): MaterialSpecificationDefinition | undefined {
  const normalized = name.trim().toLowerCase();
  return MATERIAL_SPECIFICATIONS.find(
    (material) =>
      material.name.toLowerCase() === normalized ||
      material.aliases?.some((alias) => alias.toLowerCase() === normalized),
  );
}

export function materialSpecificationOptions(name: string): readonly string[] {
  return findMaterialSpecification(name)?.specificationOptions ?? [];
}
