import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Reusable Admin / Developer Purge & Reseed Mutation.
 * Clears legacy operational records and populates the authoritative 23-category raw material catalog.
 */
export const purgeAndReseedCatalog = mutation({
  args: { confirmKey: v.string() }, // Protection key: "PURGE_YT_2026"
  handler: async (ctx, args) => {
    if (args.confirmKey !== "PURGE_YT_2026") {
      throw new Error("Invalid confirmation key for database purge.");
    }

    // 1. Wipe old legacy data
    const tablesToWipe = [
      "materials",
      "operatorSubStock",
      "materialRequests",
      "jobCards",
      "jobMaterialRequirements",
      "materialRequestLines",
      "parentInventory",
      "stock_movements",
      "offcuts",
      "offcutConsumptions",
      "scraps",
      "reconciliations",
      "reservations",
      "productionLogs",
      "overuseExceptions",
      "stockExceptions",
      "weeklyReconciliations",
      "floor_stocks",
      "material_requests",
      "job_cards",
    ];

    for (const table of tablesToWipe) {
      try {
        const records = await ctx.db.query(table as any).collect();
        for (const rec of records) {
          await ctx.db.delete(rec._id);
        }
      } catch {
        // Safe fallback if table is not declared in current schema
      }
    }

    // 2. Exact 23 Categories & All Variants
    const FULL_CATALOG = [
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

      // 8. DTF Ink (1L)
      { name: "DTF Ink - White (1L)", category: "Ink", machineType: "DTF_PRINTER", unit: "canister" },
      { name: "DTF Ink - Yellow (1L)", category: "Ink", machineType: "DTF_PRINTER", unit: "canister" },
      { name: "DTF Ink - Black (1L)", category: "Ink", machineType: "DTF_PRINTER", unit: "canister" },
      { name: "DTF Ink - Blue (1L)", category: "Ink", machineType: "DTF_PRINTER", unit: "canister" },
      { name: "DTF Ink - Red (1L)", category: "Ink", machineType: "DTF_PRINTER", unit: "canister" },

      // 9. Print and Cut Solvent
      { name: "Print & Cut Solvent", category: "Solvent", machineType: "PRINT_CUT_PRINTER", unit: "canister" },

      // 10. Print and Cut Ink (1L)
      { name: "Print & Cut Ink - Red (1L)", category: "Ink", machineType: "PRINT_CUT_PRINTER", unit: "canister" },
      { name: "Print & Cut Ink - Blue (1L)", category: "Ink", machineType: "PRINT_CUT_PRINTER", unit: "canister" },
      { name: "Print & Cut Ink - Black (1L)", category: "Ink", machineType: "PRINT_CUT_PRINTER", unit: "canister" },
      { name: "Print & Cut Ink - Yellow (1L)", category: "Ink", machineType: "PRINT_CUT_PRINTER", unit: "canister" },

      // 11. UV Ink (1L)
      { name: "UV Ink - Red (1L)", category: "Ink", machineType: "UV_PRINTER", unit: "canister" },
      { name: "UV Ink - Blue (1L)", category: "Ink", machineType: "UV_PRINTER", unit: "canister" },
      { name: "UV Ink - Black (1L)", category: "Ink", machineType: "UV_PRINTER", unit: "canister" },
      { name: "UV Ink - Yellow (1L)", category: "Ink", machineType: "UV_PRINTER", unit: "canister" },
      { name: "UV Ink - White (1L)", category: "Ink", machineType: "UV_PRINTER", unit: "canister" },

      // 12. Mica (1.22m × 2.44m)
      { name: "Mica White (1.22m × 2.44m)", category: "Mica", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Mica Red (1.22m × 2.44m)", category: "Mica", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Mica Black (1.22m × 2.44m)", category: "Mica", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Mica Blue Light (1.22m × 2.44m)", category: "Mica", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Mica Blue Dark (1.22m × 2.44m)", category: "Mica", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Mica Lemon (1.22m × 2.44m)", category: "Mica", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Mica Green (1.22m × 2.44m)", category: "Mica", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Mica Yellow (1.22m × 2.44m)", category: "Mica", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Mica Orange (1.22m × 2.44m)", category: "Mica", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Mica Golden (1.22m × 2.44m)", category: "Mica", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Transparent Mica 3mm (1.22m × 2.44m)", category: "Mica", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Transparent Mica 5mm (1.22m × 2.44m)", category: "Mica", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Transparent Mica 8mm (1.22m × 2.44m)", category: "Mica", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Transparent Mica 10mm (1.22m × 2.44m)", category: "Mica", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Transparent Mica 18mm (1.22m × 2.44m)", category: "Mica", machineType: "CNC_LASER", unit: "sheet" },

      // 13. Cladding (1.22m × 2.44m)
      { name: "Cladding White (1.22m × 2.44m)", category: "Cladding", machineType: "SIGNAGE_ASSEMBLY", unit: "sheet" },
      { name: "Cladding Gray (1.22m × 2.44m)", category: "Cladding", machineType: "SIGNAGE_ASSEMBLY", unit: "sheet" },
      { name: "Cladding Black (1.22m × 2.44m)", category: "Cladding", machineType: "SIGNAGE_ASSEMBLY", unit: "sheet" },

      // 14. Foam
      { name: "Foam 3mm", category: "Foam", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Foam 5mm", category: "Foam", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Foam 10mm", category: "Foam", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Foam 15mm", category: "Foam", machineType: "CNC_LASER", unit: "sheet" },
      { name: "Foam 18mm", category: "Foam", machineType: "CNC_LASER", unit: "sheet" },

      // 15. Power Supply
      { name: "Power Supply 60W", category: "Electrical", machineType: "SIGNAGE_ASSEMBLY", unit: "piece" },
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

    const getCompatibleMachineTypes = (machineType: string): string[] => {
      switch (machineType) {
        case "LARGE_FORMAT_PRINTER":
          return ["Banner Printer", "Print and Cut"];
        case "DTF_PRINTER":
          return ["DTF"];
        case "PRINT_CUT_PRINTER":
          return ["Print and Cut"];
        case "UV_PRINTER":
          return ["UV Flatbed"];
        case "CNC_LASER":
          return ["Laser Cutter", "CNC Router", "UV Flatbed"];
        case "SIGNAGE_ASSEMBLY":
          return ["Channel Letter Machine", "Assembly", "CNC Router", "Laser Cutter", "UV Flatbed"];
        default:
          return [];
      }
    };

    for (const item of FULL_CATALOG) {
      const standardUnit = (
        item.unit === "roll" ? "m²" :
        item.unit === "meter" ? "m" :
        item.unit === "canister" ? "L" :
        item.unit === "packet" ? "pcs" :
        item.unit
      ) as "m²" | "m" | "sheet" | "piece" | "pcs" | "L" | "mL";

      await ctx.db.insert("materials", {
        name: item.name,
        category: item.category,
        machineType: item.machineType,
        unit: standardUnit,
        baseUnit: standardUnit,
        purchaseUnit: (item.unit === "canister" ? "canister" : item.unit === "roll" ? "roll" : item.unit === "sheet" ? "sheet" : item.unit === "packet" ? "pack" : "piece") as any,
        packageUnit: (item.unit === "canister" ? "CANISTER" : item.unit === "roll" ? "ROLL" : item.unit === "sheet" ? "SHEET" : item.unit === "packet" ? "PACKAGE" : "PIECE") as any,
        sqmPerUnit: (item as any).sqmPerUnit,
        conversionRatio: (item as any).sqmPerUnit ?? (item.unit === "canister" ? (item.name.includes("5L") ? 5 : 1) : 1),
        quantity: 0,
        reorderAt: 10,
        accent: "cyan",
        active: true,
        compatibleMachineTypes: getCompatibleMachineTypes(item.machineType),
      });
    }

    return { status: "SUCCESS", insertedCount: FULL_CATALOG.length };
  },
});
