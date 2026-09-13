import { mutation } from "../_generated/server";
import { requireOwner } from "../users";
import { SERVICE_IDS } from "../../src/shared/services";

/**
 * One-shot migration to populate the new normalized tables from legacy fields.
 * Idempotent: checks for existing records before inserting.
 */
export const migrateMachineConfig = mutation({
  args: {},
  handler: async (ctx) => {
    const { identity } = await requireOwner(ctx);
    const now = Date.now();

    // Check if already migrated
    const existingMigration = await ctx.db
      .query("migrations")
      .withIndex("by_key", (q) => q.eq("key", "machine_config_v1"))
      .first();
    if (existingMigration) {
      return { alreadyMigrated: true, ranAt: existingMigration.ranAt };
    }

    const machines = await ctx.db.query("machines").collect();
    const materials = await ctx.db.query("materials").collect();
    const capabilities = await ctx.db.query("capabilities").collect();
    const existingServiceDefs = await ctx.db.query("serviceDefinitions").collect();

    let inkRulesCreated = 0;
    let materialLinksCreated = 0;
    let serviceDefsCreated = 0;
    let routesCreated = 0;

    // 1. Migrate machine ink requirements → machineInkConsumptionRules
    for (const machine of machines) {
      if (!machine.active || !machine.inkRequirements || machine.inkRequirements.length === 0) continue;

      for (const inkReq of machine.inkRequirements) {
        const material = materials.find(
          (m) => m.name.toLowerCase() === inkReq.materialName.toLowerCase() && m.active
        );
        if (!material) continue;

        // Check if rule already exists
        const existingRule = (await ctx.db
          .query("machineInkConsumptionRules")
          .withIndex("by_machine_material_color", (q) =>
            q.eq("machineId", machine._id).eq("materialId", material._id).eq("inkColor", inkReq.inkColor ?? "CMYK")
          )
          .collect())[0];

        if (!existingRule) {
          await ctx.db.insert("machineInkConsumptionRules", {
            machineId: machine._id,
            materialId: material._id,
            inkColor: inkReq.inkColor ?? "CMYK",
            consumptionUnit: "ml_per_sqm",
            rate: inkReq.rateMlPerSqM ?? 10,
            isDefault: true,
            active: true,
            createdAt: now,
            updatedAt: now,
            createdBy: identity._id,
            updatedBy: identity._id,
          });
          inkRulesCreated++;
        }
      }
    }

    // 2. Create service definitions from canonical SERVICE_IDS
    const SERVICE_LABELS: Record<string, { en: string; am: string; category: string; sortOrder: number }> = {
      banner_print: { en: "Banner Print", am: "ባነር ህትመት", category: "LARGE_FORMAT_PRINTING", sortOrder: 1 },
      sticker_white: { en: "White Sticker", am: "ነጭ ስቲከር", category: "LARGE_FORMAT_PRINTING", sortOrder: 2 },
      sticker_transparent: { en: "Transparent Sticker", am: "ትርንስፓሬንት ስቲከር", category: "LARGE_FORMAT_PRINTING", sortOrder: 3 },
      sticker_reflective: { en: "Reflective Sticker", am: "አንጸባራቂ ስቲከር", category: "LARGE_FORMAT_PRINTING", sortOrder: 4 },
      sticker_mesh: { en: "Mesh Sticker", am: "መሽ ስቲከር", category: "LARGE_FORMAT_PRINTING", sortOrder: 5 },
      sticker_frosted: { en: "Frosted Sticker", am: "ፍሮስት ስቲከር", category: "LARGE_FORMAT_PRINTING", sortOrder: 6 },
      hq_print_and_cut: { en: "High Quality Print & Cut", am: "ከፍተኛ ጥራት ህትመት", category: "LARGE_FORMAT_PRINTING", sortOrder: 7 },
      light_box_a1: { en: "Light Box - A1", am: "ላይት ቦክስ - A1", category: "SIGNAGE_AND_DISPLAYS", sortOrder: 8 },
      light_box_a2: { en: "Light Box - A2", am: "ላይት ቦክስ - A2", category: "SIGNAGE_AND_DISPLAYS", sortOrder: 9 },
      neon_light: { en: "Neon Light", am: "ኒዮን መብራት", category: "SIGNAGE_AND_DISPLAYS", sortOrder: 10 },
      roll_up_standard: { en: "Roll Up Standard", am: "ሮል አፕ ስታንዳርድ", category: "SIGNAGE_AND_DISPLAYS", sortOrder: 11 },
      roll_up_deluxe: { en: "Roll Up Deluxe", am: "ሮል አፕ ዲላክስ", category: "SIGNAGE_AND_DISPLAYS", sortOrder: 12 },
      uv_print_mica: { en: "Mica UV Print", am: "ሚካ UV ህትመት", category: "FLATBED_UV_PRINTING", sortOrder: 13 },
      uv_print_foam: { en: "Foam UV Print", am: "ፎም UV ህትመት", category: "FLATBED_UV_PRINTING", sortOrder: 14 },
      uv_print_cladding: { en: "Cladding UV Print", am: "ክላዲንግ UV ህትመት", category: "FLATBED_UV_PRINTING", sortOrder: 15 },
      uv_print_canvas: { en: "Canvas UV Print", am: "ካንቫስ UV ህትመት", category: "FLATBED_UV_PRINTING", sortOrder: 16 },
      foam_cutout: { en: "Foam Cut-out", am: "ፎም ከት", category: "CNC_AND_LASER", sortOrder: 17 },
      foam_engrave: { en: "Foam Engrave", am: "ፎም ኢንግሬቭ", category: "CNC_AND_LASER", sortOrder: 18 },
      mica_cutout: { en: "Mica Cut-out", am: "ሚካ ከት", category: "CNC_AND_LASER", sortOrder: 19 },
      mica_engrave: { en: "Mica Engrave", am: "ሚካ ኢንግሬቭ", category: "CNC_AND_LASER", sortOrder: 20 },
      dtf: { en: "DTF Printing", am: "DTF ህትመት", category: "TEXTILE_AND_APPAREL", sortOrder: 21 },
      sublimation: { en: "Sublimation Printing", am: "Sublimation ህትመት", category: "TEXTILE_AND_APPAREL", sortOrder: 22 },
    };

    for (const serviceKey of SERVICE_IDS) {
      const existingDef = existingServiceDefs.find((s) => s.serviceKey === serviceKey);
      if (existingDef) continue;

      const labels = SERVICE_LABELS[serviceKey];
      if (!labels) continue;

      await ctx.db.insert("serviceDefinitions", {
        serviceKey,
        categoryKey: labels.category,
        nameEn: labels.en,
        nameAm: labels.am,
        sortOrder: labels.sortOrder,
        active: true,
        publishable: true,
        requiresQuote: false,
        createdAt: now,
        updatedAt: now,
        createdBy: identity._id,
        updatedBy: identity._id,
      });
      serviceDefsCreated++;
    }

    // 3. Create machine-service routes from production manifest
    // This requires importing CANONICAL_SERVICE_ROUTES, but to avoid circular deps,
    // we'll create routes based on existing materialTypeCatalog entries
    const materialTypeCatalog = await ctx.db.query("materialTypeCatalog").collect();
    const serviceDefs = await ctx.db.query("serviceDefinitions").collect();

    for (const catalogEntry of materialTypeCatalog) {
      if (!catalogEntry.active) continue;

      const serviceDef = serviceDefs.find((s) => s.serviceKey === catalogEntry.serviceType);
      if (!serviceDef) continue;

      // Find compatible machines based on capabilities
      const requiredCapabilities = catalogEntry.machineCapabilities;
      for (const machine of machines) {
        if (!machine.active) continue;

        // Check if machine has required capabilities
        const machineCaps = await ctx.db
          .query("machineCapabilities")
          .withIndex("by_machine", (q) => q.eq("machineId", machine._id))
          .collect();

        const machineCapCodes = new Set<string>();
        for (const mc of machineCaps) {
          if (!mc.active) continue;
          const cap = capabilities.find((c) => c._id === mc.capabilityId);
          if (cap) machineCapCodes.add(cap.code);
        }

        const hasRequiredCap = requiredCapabilities.some((req) =>
          machineCapCodes.has(req) || machine.capability?.toLowerCase().includes(req.toLowerCase())
        );

        if (!hasRequiredCap && requiredCapabilities.length > 0) continue;

        // Find the primary capability
        const primaryCap = capabilities.find((c) => machineCapCodes.has(c.code));
        if (!primaryCap) continue;

        // Check if route already exists
        const existingRoute = (await ctx.db
          .query("machineServiceRoutes")
          .withIndex("by_service", (q) => q.eq("serviceId", serviceDef._id))
          .collect())
          .find((r) => r.machineId === machine._id && r.active);

        if (!existingRoute) {
          await ctx.db.insert("machineServiceRoutes", {
            machineId: machine._id,
            serviceId: serviceDef._id,
            capabilityId: primaryCap._id,
            priority: 1,
            active: true,
            requiresManualReview: false,
            calculationUnit: catalogEntry.materialType.includes("ROLL") ? "m²" : "pcs",
            customerVisible: true,
            createdAt: now,
            updatedAt: now,
            createdBy: identity._id,
            updatedBy: identity._id,
          });
          routesCreated++;
        }
      }
    }

    // Record migration
    await ctx.db.insert("migrations", {
      key: "machine_config_v1",
      ranAt: now,
    });

    return {
      alreadyMigrated: false,
      inkRulesCreated,
      materialLinksCreated,
      serviceDefsCreated,
      routesCreated,
    };
  },
});
