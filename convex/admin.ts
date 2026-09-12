import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireOwner } from "./users";

const CONFIRMATION_KEY = "PURGE_YT_2026";

/**
 * Maps the plan's unit strings to the schema's purchaseUnit / baseUnit pair so
 * every seeded material stores valid Convex validator values.
 */
type PlanUnit = "roll" | "canister" | "piece" | "meter" | "packet" | "liter" | "sheet";

function resolveUnits(unit: PlanUnit): {
  purchaseUnit: "roll" | "sheet" | "pack" | "liter" | "piece";
  baseUnit: "m²" | "m" | "pcs" | "L";
} {
  switch (unit) {
    case "roll":
      return { purchaseUnit: "roll", baseUnit: "m²" };
    case "canister":
      return { purchaseUnit: "liter", baseUnit: "L" };
    case "meter":
      return { purchaseUnit: "piece", baseUnit: "m" };
    case "packet":
      return { purchaseUnit: "pack", baseUnit: "pcs" };
    case "liter":
      return { purchaseUnit: "liter", baseUnit: "L" };
    case "sheet":
      return { purchaseUnit: "sheet", baseUnit: "m²" };
    case "piece":
    default:
      return { purchaseUnit: "piece", baseUnit: "pcs" };
  }
}

type CatalogItem = {
  name: string;
  category: string;
  machineType: string;
  unit: PlanUnit;
  sqmPerUnit?: number;
};

/**
 * Exact 23 raw-material categories with every variant specified by the owner.
 * Each entry maps cleanly onto the `materials` schema fields.
 */
const FULL_CATALOG: CatalogItem[] = [
  // 1. Banner
  { name: "Banner 3.2m × 50m", category: "Banner", machineType: "LARGE_FORMAT_PRINTER", unit: "roll", sqmPerUnit: 160 },
  { name: "Banner 2.07m × 50m", category: "Banner", machineType: "LARGE_FORMAT_PRINTER", unit: "roll", sqmPerUnit: 103.5 },

  // 2. Sticker
  { name: "Frosted Sticker (1.2m × 50m)", category: "Sticker", machineType: "LARGE_FORMAT_PRINTER", unit: "roll" },
  { name: "Mesh Sticker (1.2m × 50m)", category: "Sticker", machineType: "LARGE_FORMAT_PRINTER", unit: "roll" },
  { name: "Mesh Sticker (1.52m × 50m)", category: "Sticker", machineType: "LARGE_FORMAT_PRINTER", unit: "roll" },
  { name: "Transparent Sticker (1.07m × 50m)", category: "Sticker", machineType: "LARGE_FORMAT_PRINTER", unit: "roll" },
  { name: "Transparent Sticker (1.52m × 50m)", category: "Sticker", machineType: "LARGE_FORMAT_PRINTER", unit: "roll" },
  { name: "Reflective Sticker (1.07m × 50m)", category: "Sticker", machineType: "LARGE_FORMAT_PRINTER", unit: "roll" },
  { name: "Reflective Sticker (1.52m × 50m)", category: "Sticker", machineType: "LARGE_FORMAT_PRINTER", unit: "roll" },

  // 3. Film
  { name: "DTF Film (60cm × 100m)", category: "Film", machineType: "DTF_PRINTER", unit: "roll" },

  // 4. Canvas
  { name: "Canvas (1.50m × 30m)", category: "Canvas", machineType: "LARGE_FORMAT_PRINTER", unit: "roll" },
  { name: "Canvas (1.50m × 50m)", category: "Canvas", machineType: "LARGE_FORMAT_PRINTER", unit: "roll" },
  { name: "Canvas (1.00m × 30m)", category: "Canvas", machineType: "LARGE_FORMAT_PRINTER", unit: "roll" },
  { name: "Canvas (1.00m × 50m)", category: "Canvas", machineType: "LARGE_FORMAT_PRINTER", unit: "roll" },

  // 5. Banner Ink (5L)
  { name: "Banner Ink - Black (5L)", category: "Ink", machineType: "LARGE_FORMAT_PRINTER", unit: "canister" },
  { name: "Banner Ink - Blue (5L)", category: "Ink", machineType: "LARGE_FORMAT_PRINTER", unit: "canister" },
  { name: "Banner Ink - Red (5L)", category: "Ink", machineType: "LARGE_FORMAT_PRINTER", unit: "canister" },
  { name: "Banner Ink - Yellow (5L)", category: "Ink", machineType: "LARGE_FORMAT_PRINTER", unit: "canister" },

  // 6. Banner Solvent
  { name: "Banner Solvent", category: "Solvent", machineType: "LARGE_FORMAT_PRINTER", unit: "canister" },

  // 7. DTF Solvent
  { name: "DTF Solvent", category: "Solvent", machineType: "DTF_PRINTER", unit: "canister" },

  // 8. DTF Ink
  { name: "DTF Ink - Black (1L)", category: "Ink", machineType: "DTF_PRINTER", unit: "canister" },
  { name: "DTF Ink - Blue (1L)", category: "Ink", machineType: "DTF_PRINTER", unit: "canister" },
  { name: "DTF Ink - Red (1L)", category: "Ink", machineType: "DTF_PRINTER", unit: "canister" },
  { name: "DTF Ink - Yellow (1L)", category: "Ink", machineType: "DTF_PRINTER", unit: "canister" },

  // 9. Sticker Ink (5L)
  { name: "Sticker Ink - Black (5L)", category: "Ink", machineType: "LARGE_FORMAT_PRINTER", unit: "canister" },
  { name: "Sticker Ink - Blue (5L)", category: "Ink", machineType: "LARGE_FORMAT_PRINTER", unit: "canister" },
  { name: "Sticker Ink - Red (5L)", category: "Ink", machineType: "LARGE_FORMAT_PRINTER", unit: "canister" },
  { name: "Sticker Ink - Yellow (5L)", category: "Ink", machineType: "LARGE_FORMAT_PRINTER", unit: "canister" },

  // 10. Sticker Solvent
  { name: "Sticker Solvent", category: "Solvent", machineType: "LARGE_FORMAT_PRINTER", unit: "canister" },

  // 11. Rigid Sheet
  { name: "Acrylic 3mm (1.22m × 2.44m)", category: "Rigid Sheet", machineType: "LASER_CUTTER", unit: "sheet" },
  { name: "Forex 3mm (1.22m × 2.44m)", category: "Rigid Sheet", machineType: "CNC_ROUTER", unit: "sheet" },
  { name: "Forex 5mm (1.22m × 2.44m)", category: "Rigid Sheet", machineType: "CNC_ROUTER", unit: "sheet" },
  { name: "Forex 10mm (1.22m × 2.44m)", category: "Rigid Sheet", machineType: "CNC_ROUTER", unit: "sheet" },
  { name: "MDF 3mm (1.22m × 2.44m)", category: "Rigid Sheet", machineType: "CNC_ROUTER", unit: "sheet" },
  { name: "MDF 5mm (1.22m × 2.44m)", category: "Rigid Sheet", machineType: "CNC_ROUTER", unit: "sheet" },
  { name: "Corrugated Plastic (1.22m × 2.44m)", category: "Rigid Sheet", machineType: "CNC_ROUTER", unit: "sheet" },
  { name: "Galvanized 1.2mm (1.22m × 2.44m)", category: "Rigid Sheet", machineType: "CNC_ROUTER", unit: "sheet" },
  { name: "Black Acrylic 3mm (1.22m × 2.44m)", category: "Rigid Sheet", machineType: "LASER_CUTTER", unit: "sheet" },
  { name: "Transparent Mica 3mm (1.22m × 2.44m)", category: "Rigid Sheet", machineType: "LASER_CUTTER", unit: "sheet" },
  { name: "Transparent Mica 5mm (1.22m × 2.44m)", category: "Rigid Sheet", machineType: "LASER_CUTTER", unit: "sheet" },

  // 12. Wood
  { name: "Plywood 1.22m × 2.44m", category: "Wood", machineType: "CNC_ROUTER", unit: "sheet" },

  // 13. Mica
  { name: "Mica 1.00m × 1.00m", category: "Rigid Sheet", machineType: "LASER_CUTTER", unit: "sheet" },

  // 14. Alucobond
  { name: "Alucobond 3mm (1.22m × 2.44m)", category: "Composite Panel", machineType: "CNC_ROUTER", unit: "sheet" },
  { name: "Alucobond 4mm (1.22m × 2.44m)", category: "Composite Panel", machineType: "CNC_ROUTER", unit: "sheet" },

  // 15. Electrical
  { name: "Power Supply 100W", category: "Electrical", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },
  { name: "Power Supply 200W", category: "Electrical", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },
  { name: "Power Supply 400W", category: "Electrical", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },

  // 16. Digital Screen
  { name: "Digital Screen A1", category: "Hardware", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },
  { name: "Digital Screen A2", category: "Hardware", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },

  // 17. LED
  { name: "LED Module - White", category: "Lighting", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },
  { name: "LED Module - Warm", category: "Lighting", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },
  { name: "LED Module - Yellow", category: "Lighting", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },
  { name: "LED Module - Red", category: "Lighting", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },
  { name: "LED Module - Blue", category: "Lighting", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },
  { name: "LED Module - Green", category: "Lighting", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },

  // 18. Zecolo
  { name: "Zecolo 8cm Thickness", category: "Hardware", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },
  { name: "Zecolo 6cm Thickness", category: "Hardware", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },

  // 19. Neon Light
  { name: "Neon Light - White", category: "Lighting", machineType: "SIGNAGE_ASSEMBLY", unit: "meter" },
  { name: "Neon Light - Warm", category: "Lighting", machineType: "SIGNAGE_ASSEMBLY", unit: "meter" },
  { name: "Neon Light - Yellow", category: "Lighting", machineType: "SIGNAGE_ASSEMBLY", unit: "meter" },
  { name: "Neon Light - Red", category: "Lighting", machineType: "SIGNAGE_ASSEMBLY", unit: "meter" },
  { name: "Neon Light - Blue", category: "Lighting", machineType: "SIGNAGE_ASSEMBLY", unit: "meter" },
  { name: "Neon Light - Green", category: "Lighting", machineType: "SIGNAGE_ASSEMBLY", unit: "meter" },
  { name: "Neon Light - Ice Blue", category: "Lighting", machineType: "SIGNAGE_ASSEMBLY", unit: "meter" },
  { name: "Neon Light - Pink", category: "Lighting", machineType: "SIGNAGE_ASSEMBLY", unit: "meter" },

  // 20. Electric Wire
  { name: "Electric Wire", category: "Electrical", machineType: "SIGNAGE_ASSEMBLY", unit: "meter" },

  // 21. T-Shirt
  { name: "T-Shirt (Piece)", category: "Apparel", machineType: "DTF_PRINTER", unit: "piece" },

  // 22. Amire
  { name: "Amire (Packet - 250 pcs/pkg)", category: "Hardware", machineType: "SIGNAGE_ASSEMBLY", unit: "packet" },

  // 23. Roll Up
  { name: "Roll-Up Stand - Delux", category: "Display", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },
  { name: "Roll-Up Stand - Standard", category: "Display", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },
];

function catalogFamily(item: CatalogItem): "ROLL" | "RIGID_SHEET" | "INK_SOLVENT" | "HARDWARE" {
  if (item.unit === "roll") return "ROLL";
  if (item.unit === "sheet") return "RIGID_SHEET";
  if (item.unit === "canister") return "INK_SOLVENT";
  return "HARDWARE";
}

function materialFamily(item: CatalogItem): "RAW_MATERIAL" | "INK" | "SOLVENT" | "HARDWARE" {
  if (item.category === "Ink") return "INK";
  if (item.category === "Solvent") return "SOLVENT";
  if (item.unit === "canister") return item.name.toLowerCase().includes("solvent") ? "SOLVENT" : "INK";
  return "RAW_MATERIAL";
}

/**
 * Reusable owner trigger that completely wipes all operational data and re-seeds
 * the exact 23 raw-material catalog categories with every variant. Guarded by
 * role (owner) plus an exact confirmation key so it can be invoked repeatedly
 * but never accidentally.
 */
export const purgeAndReseedCatalog = mutation({
  args: { confirmKey: v.string() },
  handler: async (ctx, args) => {
    if (args.confirmKey !== CONFIRMATION_KEY) {
      throw new Error("Invalid confirmation key for database purge.");
    }
    await requireOwner(ctx);

    // 1. Wipe every operational table so the catalog starts from a clean slate.
    const tablesToWipe = [
      "notifications",
      "materialRequests",
      "customerOrders",
      "stockExceptions",
      "stock_movements",
      "jobCards",
      "productionLogs",
      "overuseExceptions",
      "offcuts",
      "offcutConsumptions",
      "scraps",
      "reconciliations",
      "configurationChanges",
      "parentInventory",
      "operatorSubStock",
      "jobMaterialRequirements",
      "reservations",
      "materialRequestLines",
      "weeklyReconciliations",
      "telegramUsers",
      "telegramSessions",
      "migrations",
      "materials",
    ] as const;

    for (const table of tablesToWipe) {
      const records = await ctx.db.query(table).collect();
      for (const rec of records) {
        await ctx.db.delete(rec._id);
      }
    }

    // 2. Seed the exact 23 categories with all variants.
    let insertedCount = 0;
    for (const item of FULL_CATALOG) {
      const { purchaseUnit, baseUnit } = resolveUnits(item.unit);
      await ctx.db.insert("materials", {
        name: item.name,
        category: item.category,
        catalogFamily: catalogFamily(item),
        materialFamily: materialFamily(item),
        compatibleMachineTypes: [item.machineType],
        unit: baseUnit,
        baseUnit,
        purchaseUnit,
        accent: "cyan",
        conversionRatio: item.sqmPerUnit,
        quantity: 0,
        reorderAt: 0,
        active: true,
      });
      insertedCount += 1;
    }

    return { status: "SUCCESS", insertedCount };
  },
});
