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
  /** Confirmed printable/usable width of one roll, in metres. */
  rollWidth?: number;
  /** Confirmed sheet width in metres (rigid boards). */
  sheetWidth?: number;
  /** Confirmed sheet length in metres (rigid boards). */
  sheetLength?: number;
  note?: string;
};

const machineInkOptions = [
  "CMYK (Cyan, Magenta, Yellow, Key/Black)",
  "Expanded Gamut / Light Inks (Light Cyan, Light Magenta, Light Black)",
  "Specialty Inks (White Ink, Spot Gloss / Clear UV Varnish, Primer)",
  "Ink Formulations: Eco-Solvent, Solvent, UV-Curing Ink, Sublimation Ink",
] as const;

const stickerOptions = [
  "1.27 Meter × 50 Meter Roll",
] as const;

/**
 * Canonical raw-material definitions for YT Advertisement. These are master
 * definitions, not opening stock or historical activity. `aliases` let the
 * non-destructive migration recognize the earlier short names.
 */
export const MATERIAL_SPECIFICATIONS: readonly MaterialSpecificationDefinition[] = [
  {
    name: "Banner",
    category: "Banner",
    purchaseUnit: "roll",
    baseUnit: "m²",
    conversionRatio: 160,
    displayUnit: "ሮል",
    rollWidth: 3.2,
    specification: "Roll Weight & Size",
    specificationOptions: ["2 Meter Roll Weight", "3 Meter Roll Weight"],
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
      "Cool White (6000K-6500K)",
      "Warm White (3000K)",
      "Red",
      "Green",
      "Blue",
      "Yellow",
      "Amber",
      "RGB (Multi-Color)",
      "RGBW",
    ],
    note: "Pack conversion: 20 LED modules per pack.",
  },
  {
    name: "Normal Sticker",
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
    name: "Frosted Sticker",
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
    name: "Transparent Sticker",
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
    name: "Reflective Sticker",
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
      "Mirror/Frosted",
    ],
  },
  {
    name: "PVC Film",
    category: "Film",
    purchaseUnit: "roll",
    baseUnit: "m²",
    displayUnit: "ሮል",
    specification: "Roll Width / Type",
    note: "Roll dimensions and conversion ratio require physical confirmation before stock-in.",
  },
  {
    name: "Canvas (Canva)",
    aliases: ["Canvas"],
    category: "Fabric roll",
    purchaseUnit: "roll",
    baseUnit: "m²",
    conversionRatio: 45.6,
    displayUnit: "ሮል",
    rollWidth: 1.52,
    specification: "Roll Width / Type (in meters)",
    specificationOptions: ["1.4 Meter", "1.0 Meter"],
    note: "Confirmed conversion basis for current roll: 1.52m × 30m = 45.6m².",
  },
  {
    name: "Neon Light",
    category: "Electrical",
    purchaseUnit: "roll",
    baseUnit: "m",
    conversionRatio: 5,
    displayUnit: "ሜትር",
    specification: "Color Type",
    specificationOptions: [
      "White (Warm White, Cool White)",
      "Red",
      "Blue",
      "Green",
      "Yellow",
      "Orange",
      "Pink",
      "Purple",
      "RGB (Color-Changing)",
      "Neon Spot/Fluorescent Tones (Pink, Yellow, Orange, Green)",
    ],
    note: "Confirmed purchase basis: one roll contains 5m.",
  },
  {
    name: "Power Supply",
    category: "Electrical",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
    specification: "Wattage",
    specificationOptions: ["60 Watt", "400 Watt"],
  },
  {
    name: "Foam",
    category: "Foam board",
    purchaseUnit: "sheet",
    baseUnit: "m²",
    conversionRatio: 2.977,
    displayUnit: "ቁጥር",
    sheetWidth: 1.22,
    sheetLength: 2.44,
    specification: "Thickness / Size (in millimeters)",
    specificationOptions: ["18mm", "10mm", "8mm", "5mm", "3mm"],
    note: "Confirmed sheet basis: 1.22m × 2.44m = 2.977m² per sheet.",
  },
  {
    name: "AMIR",
    category: "Finished component",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
  },
  {
    name: "ROLE UP DELUX",
    category: "Finished component",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
  },
  {
    name: "ROLE UP STANDARD",
    category: "Finished component",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
  },
  {
    name: "VINNER",
    category: "Finished component",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
  },
  {
    name: "Zocolo (Base / Skirting)",
    aliases: ["ZOCOLO"],
    category: "Finished component",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
    specification: "Height (in centimeters)",
    specificationOptions: ["8 cm", "6 cm"],
  },
  {
    name: "LED LIGHT BOX A1",
    category: "Display hardware",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
  },
  {
    name: "LED LIGHT BOX A2",
    category: "Display hardware",
    purchaseUnit: "piece",
    baseUnit: "pcs",
    conversionRatio: 1,
    displayUnit: "ቁጥር",
  },
];

export const materialNameOptions = MATERIAL_SPECIFICATIONS.map((material) => material.name);

export function findMaterialSpecification(name: string): MaterialSpecificationDefinition | undefined {
  const normalized = name.trim().toLowerCase();
  return MATERIAL_SPECIFICATIONS.find(
    (material) => material.name.toLowerCase() === normalized || material.aliases?.some((alias) => alias.toLowerCase() === normalized),
  );
}

export function materialSpecificationOptions(name: string): readonly string[] {
  return findMaterialSpecification(name)?.specificationOptions ?? [];
}
