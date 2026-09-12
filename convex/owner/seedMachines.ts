import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireOwner } from "../users";
import { CAPABILITY_REGISTRY } from "../../src/shared/production-manifest";

// ============================================================================
// Seed data — 6 confirmed machines, 6 capabilities, 6 operator roles
// ============================================================================

type MachineSeed = {
  name: string;
  code: string;
  type: string;
  manufacturer?: string;
  model?: string;
  capability: string;
  operatorRole: string;
  materialUnit: "m²" | "m" | "pcs" | "sheet";
  displayUnit: string;
  primaryMaterialFamilies: string[];
  associatedInkFamilies?: string[];
  primaryMaterials?: string[];
  compatibleInks?: string[];
  solventNames?: string[];
  defaultWasteMarginPercent: number;
  maxAllowedScrapLimitPercent: number;
};

const CONFIRMED_MACHINES: MachineSeed[] = [
  {
    name: "Crystal Jet 7K Series", code: "CJ7K-01", type: "Large Format Solvent Printer",
    manufacturer: "Crystal", model: "Crystal Jet 7K Series",
    capability: "3.2m Print Width · Heavy Duty Exterior Banner & Mesh",
    operatorRole: "crystal_jet_operator", materialUnit: "m²", displayUnit: "m²",
    primaryMaterialFamilies: ["ROLL"], associatedInkFamilies: ["Banner Ink 5L", "Banner Solvent"],
    primaryMaterials: ["Banner Flex", "Mesh Sticker"],
    compatibleInks: ["Banner Ink 5L Canister"],
    solventNames: ["Banner Solvent"],
    defaultWasteMarginPercent: 5, maxAllowedScrapLimitPercent: 10,
  },
  {
    name: "Crystc Eco-Solvent Printer", code: "CESP-01", type: "Eco-Solvent Printer & Cutter",
    manufacturer: "Crystal", model: "Eco-Solvent Print & Cut",
    capability: "1.6m Print Width · High Resolution Vinyl, Stickers & Grayback",
    operatorRole: "crystek_operator", materialUnit: "m²", displayUnit: "m²",
    primaryMaterialFamilies: ["ROLL"], associatedInkFamilies: ["Print & Cut Ink 1L", "Print & Cut Solvent"],
    primaryMaterials: ["Frosted Sticker", "Transparent Sticker", "Reflective Sticker"],
    compatibleInks: ["Print & Cut Ink 1L Canister"],
    solventNames: ["Print & Cut Solvent"],
    defaultWasteMarginPercent: 5, maxAllowedScrapLimitPercent: 8,
  },
  {
    name: "Ricoh Flatbed UV Machine", code: "RUV-01", type: "UV Flatbed Printer",
    manufacturer: "Ricoh", model: "Flatbed UV",
    capability: "Direct-to-Rigid Board · UV Industrial Flatbed",
    operatorRole: "ricoh_uv_operator", materialUnit: "m²", displayUnit: "m²",
    primaryMaterialFamilies: ["RIGID_SHEET", "HARDWARE"], associatedInkFamilies: ["UV Ink 1L"],
    primaryMaterials: ["Mica", "Foam Board", "Cladding", "Canvas (Canva)"],
    compatibleInks: ["UV Ink 1L Canister"],
    defaultWasteMarginPercent: 4, maxAllowedScrapLimitPercent: 8,
  },
  {
    name: "DTF I32", code: "DTF-01", type: "DTF Printer",
    manufacturer: "i3200", model: "DTF i3200",
    capability: "0.60m Print Width · 60cm Textile Films, T-Shirt Direct Transfer",
    operatorRole: "dtf_operator", materialUnit: "m", displayUnit: "m",
    primaryMaterialFamilies: ["ROLL", "HARDWARE"], associatedInkFamilies: ["DTF Ink 1L", "DTF Solvent"],
    primaryMaterials: ["DTF Film", "T-Shirts"],
    compatibleInks: ["DTF Ink 1L Canister"],
    solventNames: ["DTF Solvent"],
    defaultWasteMarginPercent: 5, maxAllowedScrapLimitPercent: 10,
  },
  {
    name: "Laser cutting machine 1325", code: "LAS-01", type: "CO2 Laser Cutter",
    capability: "1.22m x 2.44m Bed · Precision Mica, Acrylic & Foam Board Cutting",
    operatorRole: "laser_operator", materialUnit: "m²", displayUnit: "m²",
    primaryMaterialFamilies: ["RIGID_SHEET"],
    primaryMaterials: ["Mica", "Foam Board", "Acrylic"],
    defaultWasteMarginPercent: 4, maxAllowedScrapLimitPercent: 8,
  },
  {
    name: "CNC Router", code: "CNC-01", type: "Heavy Duty CNC Router",
    model: "CNC Router 2030",
    capability: "2.0m x 3.0m Bed · Foam Board, Cladding, MDF Heavy Routing",
    operatorRole: "cnc_operator", materialUnit: "m²", displayUnit: "m²",
    primaryMaterialFamilies: ["RIGID_SHEET"],
    primaryMaterials: ["Foam Board", "Cladding", "MDF Sheet"],
    defaultWasteMarginPercent: 5, maxAllowedScrapLimitPercent: 10,
  },
];

const CONFIRMED_ROLE_CODES = [
  "crystal_jet_operator",
  "crystek_operator",
  "ricoh_uv_operator",
  "dtf_operator",
  "laser_operator",
  "cnc_operator",
] as const;

// ============================================================================
// Idempotent seed mutation
// ============================================================================

/**
 * Seeds the 6 confirmed production machines, 8 capabilities, and 6 operator
 * roles into the database. Idempotent — skips rows that already exist (matched
 * by machine code, capability code, or role code). Pass `force` to wipe and
 * re-seed all three tables.
 */
export const seedMachines = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    const now = Date.now();
    const createdById = identity._id;

    const counts = { machines: 0, capabilities: 0, operatorRoles: 0, machineCapabilities: 0 };

    // ── 1. Capabilities ────────────────────────────────────────────────
    const existingCaps = await ctx.db.query("capabilities").collect();
    if (args.force) {
      for (const row of existingCaps) await ctx.db.delete(row._id);
    }
    const capIds = new Map<string, Id<"capabilities">>();
    for (const [code, def] of Object.entries(CAPABILITY_REGISTRY)) {
      const existing = existingCaps.find((c) => c.code === code && !args.force);
      if (existing) {
        capIds.set(code, existing._id);
        continue;
      }
      const id = await ctx.db.insert("capabilities", {
        code: def.id,
        name: def.name,
        description: def.description,
        category: def.category,
        active: true,
        createdAt: now,
        updatedAt: now,
        createdBy: createdById,
        updatedBy: createdById,
      });
      capIds.set(code, id);
      counts.capabilities++;
    }

    // ── 2. Operator roles ──────────────────────────────────────────────
    const existingRoles = await ctx.db.query("operatorRoles").collect();
    if (args.force) {
      for (const row of existingRoles) await ctx.db.delete(row._id);
    }
    for (const code of CONFIRMED_ROLE_CODES) {
      const existing = existingRoles.find((r) => r.code === code && !args.force);
      if (existing) continue;
      const allowedCapabilityIds = Object.values(CAPABILITY_REGISTRY)
        .filter((def) => def.category === "PRINTING" || def.category === "CUTTING_ROUTING" || def.category === "FINISHING_AUXILIARY")
        .map((def) => capIds.get(def.id))
        .filter((id): id is Id<"capabilities"> => Boolean(id));
      await ctx.db.insert("operatorRoles", {
        code,
        name: code.replace(/_operator$/, " operator").replace(/_/g, " "),
        description: `Canonical production role: ${code}`,
        allowedCapabilityIds,
        active: true,
        createdAt: now,
        updatedAt: now,
        createdBy: createdById,
        updatedBy: createdById,
      });
      counts.operatorRoles++;
    }

    // ── 3. Machines + machineCapabilities ──────────────────────────────
    const existingMachines = await ctx.db.query("machines").collect();
    if (args.force) {
      for (const row of existingMachines) await ctx.db.delete(row._id);
    }
    const MACHINE_CAPS: Record<string, string[]> = {
      "CJ7K-01": ["PRINT_ROLL_3_2M"],
      "CESP-01": ["PRINT_ROLL_1_6M"],
      "RUV-01":  ["PRINT_RIGID_UV_122_244"],
      "DTF-01":  ["PRINT_ROLL_0_6M_DTF"],
      "LAS-01":  ["CUT_RIGID_122_244_LASER"],
      "CNC-01":  ["CUT_RIGID_2030_CNC"],
    };

    for (const seed of CONFIRMED_MACHINES) {
      const existing = existingMachines.find((m) => m.code === seed.code && !args.force);
      let machineId: Id<"machines">;
      if (existing) {
        machineId = existing._id;
        await ctx.db.patch(existing._id, {
          name: seed.name,
          type: seed.type,
          manufacturer: seed.manufacturer,
          model: seed.model,
          capability: seed.capability,
          operatorRole: seed.operatorRole as any,
          materialUnit: seed.materialUnit as any,
          displayUnit: seed.displayUnit,
          primaryMaterialFamilies: seed.primaryMaterialFamilies,
          associatedInkFamilies: seed.associatedInkFamilies,
          primaryMaterials: seed.primaryMaterials,
          compatibleInks: seed.compatibleInks,
          solventNames: seed.solventNames,
          defaultWasteMarginPercent: seed.defaultWasteMarginPercent,
          maxAllowedScrapLimitPercent: seed.maxAllowedScrapLimitPercent,
          catalogKey: seed.code,
        });
      } else {
        machineId = await ctx.db.insert("machines", {
          name: seed.name,
          code: seed.code,
          type: seed.type,
          manufacturer: seed.manufacturer,
          model: seed.model,
          capability: seed.capability,
          operatorRole: seed.operatorRole as any,
          materialUnit: seed.materialUnit as any,
          displayUnit: seed.displayUnit,
          status: "Available",
          primaryMaterialFamilies: seed.primaryMaterialFamilies,
          associatedInkFamilies: seed.associatedInkFamilies,
          primaryMaterials: seed.primaryMaterials,
          compatibleInks: seed.compatibleInks,
          solventNames: seed.solventNames,
          defaultWasteMarginPercent: seed.defaultWasteMarginPercent,
          maxAllowedScrapLimitPercent: seed.maxAllowedScrapLimitPercent,
          catalogKey: seed.code,
          active: true,
        });
        counts.machines++;
      }

      // Link capabilities
      const capCodes = MACHINE_CAPS[seed.code] ?? [];
      for (const capCode of capCodes) {
        const capId = capIds.get(capCode);
        if (!capId) continue;
        const existingLink = (await ctx.db.query("machineCapabilities").withIndex("by_machine", (q) => q.eq("machineId", machineId)).collect())
          .find((link) => link.capabilityId === capId);
        if (!existingLink) {
          await ctx.db.insert("machineCapabilities", {
            machineId,
            capabilityId: capId,
            active: true,
            createdAt: now,
            updatedAt: now,
            createdBy: createdById,
            updatedBy: createdById,
          });
          counts.machineCapabilities++;
        }
      }
    }

    return { seeded: true, ...counts };
  },
});
