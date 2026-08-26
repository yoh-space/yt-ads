import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Role } from "./types";
import { authComponent, createAuth } from "./auth";
import { requireAdmin } from "./users";

/**
 * Populates the demo operations dataset (materials, machines, job cards,
 * offcuts). No-op when materials already exist so it is safe to call
 * repeatedly. `createdById` is used as the author on seeded records.
 */
export async function seedDemoData(ctx: MutationCtx, createdById: string) {
  if ((await ctx.db.query("materials").collect()).length > 0) {
    return { seeded: false };
  }

  const matBanner = await ctx.db.insert("materials", {
    name: "Frontlit Banner 440gsm", category: "Banner roll", unit: "m²",
    quantity: 286, reorderAt: 160, rollEquivalent: 160, accent: "cyan", active: true,
  });
  const matAcrylic = await ctx.db.insert("materials", {
    name: "Acrylic Clear 3mm", category: "Sheet", unit: "m²",
    quantity: 54.8, reorderAt: 65, sheetEquivalent: 2.98, accent: "violet", active: true,
  });
  const matVinyl = await ctx.db.insert("materials", {
    name: "Premium Vinyl Gloss", category: "Vinyl roll", unit: "m",
    quantity: 417, reorderAt: 240, rollEquivalent: 50, accent: "gold", active: true,
  });
  const matLed = await ctx.db.insert("materials", {
    name: "LED Module 1.5W", category: "Electrical", unit: "piece",
    quantity: 1260, reorderAt: 800, accent: "blue", active: true,
  });
  const matInk = await ctx.db.insert("materials", {
    name: "UV Ink — Cyan", category: "Ink", unit: "L",
    quantity: 18.2, reorderAt: 12, accent: "green", active: true,
  });
  const matMdf = await ctx.db.insert("materials", {
    name: "MDF Board 18mm", category: "Sheet", unit: "m²",
    quantity: 91.4, reorderAt: 45, sheetEquivalent: 2.98, accent: "gold", active: true,
  });

  const mLaser = await ctx.db.insert("machines", {
    name: "Laser Cutter 1325", code: "LAS-01", type: "Laser cutter",
    operatorRole: "laser_operator", materialUnit: "m²", status: "Running",
    activeJob: "JC-0421", active: true,
  });
  const mCnc = await ctx.db.insert("machines", {
    name: "CNC Router 2030", code: "CNC-02", type: "CNC router",
    operatorRole: "cnc_operator", materialUnit: "m²", status: "Running",
    activeJob: "JC-0424", active: true,
  });
  const mPlotter = await ctx.db.insert("machines", {
    name: "Graphtec FC9000", code: "PLT-01", type: "Plotter & vinyl cutter",
    operatorRole: "plotter_operator", materialUnit: "m", status: "Available", active: true,
  });
  const mPrinter = await ctx.db.insert("machines", {
    name: "Eco-solvent 3.2m", code: "PRT-01", type: "Large format printer",
    operatorRole: "printer_operator", materialUnit: "m²", status: "Running",
    activeJob: "JC-0420", active: true,
  });

  await ctx.db.insert("jobCards", {
    code: "JC-0420", client: "Abyssinia Bank", title: "Branch fascia banners",
    machineId: mPrinter, materialId: matBanner, quantity: 86.4, unit: "m²",
    status: "In production", due: "Today, 16:30", priority: "High",
    createdBy: createdById, createdAt: Date.now(),
  });
  await ctx.db.insert("jobCards", {
    code: "JC-0421", client: "Bole Medical", title: "Acrylic wayfinding signs",
    machineId: mLaser, materialId: matAcrylic, quantity: 14.8, unit: "m²",
    status: "In production", due: "Today, 18:00", priority: "Medium",
    createdBy: createdById, createdAt: Date.now(),
  });
  await ctx.db.insert("jobCards", {
    code: "JC-0424", client: "Ethio Logistics", title: "Reception desk logo",
    machineId: mCnc, materialId: matMdf, quantity: 8.2, unit: "m²",
    status: "In production", due: "Tomorrow, 10:00", priority: "Normal",
    createdBy: createdById, createdAt: Date.now(),
  });
  await ctx.db.insert("jobCards", {
    code: "JC-0426", client: "Hibret Insurance", title: "Fleet sticker set",
    machineId: mPlotter, materialId: matVinyl, quantity: 96, unit: "m",
    status: "Queued", due: "Tomorrow, 15:00", priority: "Medium",
    createdBy: createdById, createdAt: Date.now(),
  });

  await ctx.db.insert("offcuts", {
    materialId: matAcrylic, label: "Acrylic Clear 3mm", width: 1.2, length: 0.8,
    area: 0.96, location: "Rack B · Slot 04", usable: true, status: "available",
    createdBy: createdById, createdAt: "08:25",
  });
  await ctx.db.insert("offcuts", {
    materialId: matMdf, label: "MDF Board 18mm", width: 0.9, length: 0.6,
    area: 0.54, location: "Rack C · Slot 02", usable: true, status: "available",
    createdBy: createdById, createdAt: "Yesterday",
  });

  return { seeded: true };
}

/**
 * Loads the demo operations dataset. Runs only when the database is empty so it
 * is safe to call repeatedly. Intended to be invoked once by an administrator
 * after the first deployment.
 */
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const user = await authComponent.getAuthUser(ctx);
    return seedDemoData(ctx, user._id);
  },
});

const YT_WORKSPACE_KEY = "yt-advertisement";

const YT_MACHINE_MASTER_DATA = [
  { name: "Large Format Banner Printer", code: "BAN-01", type: "Banner Printer", model: "3.2m Eco-Solvent / Solvent Printer", capability: "3.2m Print Width", operatorRole: "printer_operator" as const, materialUnit: "m²" as const, displayUnit: "m²", status: "Available" as const },
  { name: "DTF Printer", code: "DTF-01", type: "DTF", manufacturer: "Crystal", model: "60cm Roll-to-Roll DTF", capability: "0.60m Print Width", operatorRole: "printer_operator" as const, materialUnit: "m" as const, displayUnit: "m", status: "Available" as const },
  { name: "Print & Cut Eco-Solvent Plotter", code: "PAC-01", type: "Print and Cut", manufacturer: "Crystal", model: "1.6m Print & Cut Plotter", capability: "1.6m Width", operatorRole: "plotter_operator" as const, materialUnit: "m²" as const, displayUnit: "m²", status: "Available" as const },
  { name: "CNC Router 2030", code: "CNC-01", type: "CNC Router", model: "2000mm x 3000mm Heavy Duty", capability: "2.0m x 3.0m Bed Size", operatorRole: "cnc_operator" as const, materialUnit: "m²" as const, displayUnit: "m²", status: "Available" as const },
  { name: "Laser Cutter 1325", code: "LAS-01", type: "Laser Cutter 1325", manufacturer: "Crystal", model: "1300mm x 2500mm CO2 Laser", capability: "1.22m x 2.44m Standard Board", operatorRole: "laser_operator" as const, materialUnit: "m²" as const, displayUnit: "m²", status: "Available" as const },
  { name: "Pneumatic / Manual Heat Press", code: "HPR-01", type: "Heat press", model: "Flatbed Heat Press", capability: "40cm x 60cm Platen", operatorRole: "printer_operator" as const, materialUnit: "pcs" as const, displayUnit: "pcs", status: "Available" as const },
  { name: "Paper Guillotine Cutter (Conca)", code: "CON-01", type: "Conca", model: "Heavy Duty Paper Cutter", capability: "A3+ Cutting Width", operatorRole: "printer_operator" as const, materialUnit: "pcs" as const, displayUnit: "pcs", status: "Available" as const, notes: "Paper work" },
  { name: "UV Flatbed Printer", code: "UVF-01", type: "UV Flat bed", manufacturer: "Crystal", model: "Industrial UV Flatbed", capability: "Direct-to-Rigid Board", operatorRole: "printer_operator" as const, materialUnit: "m²" as const, displayUnit: "m²", status: "Available" as const },
] as const;

const YT_MATERIAL_MASTER_DATA = [
  ["Banner", "Banner", "m²", "roll", 160, "ሮል"],
  ["DTF Film", "Film", "m", "roll", 100, "ሮል", "Store", "Based on customer requirement"],
  ["Acrylic", "Rigid sheet", "m²", "sheet", 2.977, "ቁጥር", "", "1.22m × 2.44m sheet"],
  ["DTF Ink", "Ink", "L", "liter", 1, "ሊትር"],
  ["Banner Ink", "Ink", "L", "liter", 1, "ሊትር"],
  ["Print and Cut INK", "Ink", "L", "liter", 1, "ሊትር"],
  ["UV Flat bed Ink", "Ink", "L", "liter", 1, "ሊትር"],
  ["LED", "Electrical", "pcs", "pack", 20, "ቁጥር", "", "Pack of 20"],
  ["Normal Sticker", "Sticker roll", "m²", "roll", 63.5, "ሮል", "", "1.27m × 50m roll"],
  ["Frosted Sticker", "Sticker roll", "m²", "roll", 63.5, "ሮል", "", "1.27m × 50m roll"],
  ["Transparent Sticker", "Sticker roll", "m²", "roll", 63.5, "ሮል", "", "1.27m × 50m roll"],
  ["Reflective Sticker", "Sticker roll", "m²", "roll", 63.5, "ሮል", "", "1.27m × 50m roll"],
  ["Mush Sticker", "Sticker roll", "m²", "roll", 63.5, "ሮል", "", "1.27m × 50m roll; source label retained as Mush Sticker"],
  ["Mica", "Rigid sheet", "pcs", "piece", 1, "ቁጥር"],
  ["PVC Film", "Film", "m²", "roll", undefined, "ሮል", "", "Roll conversion requires physical confirmation"],
  ["Canvas", "Fabric roll", "m²", "roll", 45.6, "ሮል", "", "1.52m × 30m roll"],
  ["Neon Light", "Electrical", "m", "roll", 5, "ሜትር", "", "Roll of 5m"],
  ["Power Supply", "Electrical", "pcs", "piece", 1, "ቁጥር"],
  ["Foam", "Foam board", "m²", "sheet", 2.977, "ቁጥር", "", "1.22m × 2.44m sheet"],
  ["AMIR", "Finished component", "pcs", "piece", 1, "ቁጥር"],
  ["ROLE UP DELUX", "Finished component", "pcs", "piece", 1, "ቁጥር"],
  ["ROLE UP STANDARD", "Finished component", "pcs", "piece", 1, "ቁጥር"],
  ["VINNER", "Finished component", "pcs", "piece", 1, "ቁጥር"],
  ["ZOCOLO", "Finished component", "pcs", "piece", 1, "ቁጥር"],
  ["LED LIGHT BOX A1", "Display hardware", "pcs", "piece", 1, "ቁጥር"],
  ["LED LIGHT BOX A2", "Display hardware", "pcs", "piece", 1, "ቁጥር"],
] as const;

/**
 * Resolves the calling actor for bootstrap (seed/reset) mutations.
 *
 * When a Better Auth identity is present, it must be an admin/owner — this is
 * the normal guard for an in-app or authenticated invocation. When no identity
 * is present (a deployment-credentialed `npx convex run`), the mutation is
 * still trusted because possession of deployment credentials already grants
 * full database access. This lets operators seed or reset a workspace from the
 * CLI without a live session.
 */
async function resolveBootstrapActor(ctx: MutationCtx): Promise<{ role: string; authUserId: string | undefined }> {
  const identity = await authComponent.safeGetAuthUser(ctx);
  if (identity) return requireAdmin(ctx);
  return { role: "owner", authUserId: undefined };
}

/**
 * Removes all previously loaded demo and operational workspace data so the
 * master dataset can be re-seeded cleanly.
 *
 * This intentionally preserves authentication users and the owner profile; it
 * only clears data created by seeding or by production activity against the
 * seeded master records (company settings, staff, machines, materials, jobs,
 * logs, movements, requests, offcuts, scrap).
 */
export async function clearWorkspaceData(ctx: MutationCtx) {
  const requests = await ctx.db.query("materialRequests").collect();
  for (const record of requests) await ctx.db.delete(record._id);
  const productionLogs = await ctx.db.query("productionLogs").collect();
  for (const record of productionLogs) await ctx.db.delete(record._id);
  const offcuts = await ctx.db.query("offcuts").collect();
  for (const record of offcuts) await ctx.db.delete(record._id);
  const scraps = await ctx.db.query("scraps").collect();
  for (const record of scraps) await ctx.db.delete(record._id);
  const jobCards = await ctx.db.query("jobCards").collect();
  for (const record of jobCards) await ctx.db.delete(record._id);
  const stockMovements = await ctx.db.query("stockMovements").collect();
  for (const record of stockMovements) await ctx.db.delete(record._id);
  const materials = await ctx.db.query("materials").collect();
  for (const record of materials) await ctx.db.delete(record._id);
  const machines = await ctx.db.query("machines").collect();
  for (const record of machines) await ctx.db.delete(record._id);
  const staff = await ctx.db.query("staff").collect();
  for (const record of staff) await ctx.db.delete(record._id);
  const settings = await ctx.db
    .query("companySettings")
    .withIndex("by_key", (q) => q.eq("key", YT_WORKSPACE_KEY))
    .unique();
  if (settings) await ctx.db.delete(settings._id);
}

/**
 * Wipes all previously loaded demo and operational workspace data. Use this
 * before re-running `seedYtAdvertisementWorkspace` with `force`, or as a
 * standalone reset. Authentication users and the owner profile are preserved.
 */
export const resetSeedData = mutation({
  args: {},
  handler: async (ctx) => {
    await resolveBootstrapActor(ctx);
    await clearWorkspaceData(ctx);
    return { cleared: true };
  },
});

/**
 * Seeds the captured YT Advertisement master data for a fresh database.
 *
 * This intentionally does not create jobs, production logs, stock movements,
 * requests, scrap, or offcuts because the workspace capture did not provide
 * real historical activity. It refuses to mix with an existing database unless
 * `force` is supplied, which first removes all previously loaded demo and
 * operational data.
 */
export const seedYtAdvertisementWorkspace = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const actor = await resolveBootstrapActor(ctx);
    const existingSettings = await ctx.db
      .query("companySettings")
      .withIndex("by_key", (q) => q.eq("key", YT_WORKSPACE_KEY))
      .unique();
    if (existingSettings && !args.force) {
      return { seeded: false, reason: "YT Advertisement workspace is already seeded." };
    }

    const [materials, machines, jobs, productionLogs, stockMovements, offcuts, scraps] = await Promise.all([
      ctx.db.query("materials").collect(),
      ctx.db.query("machines").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("productionLogs").collect(),
      ctx.db.query("stockMovements").collect(),
      ctx.db.query("offcuts").collect(),
      ctx.db.query("scraps").collect(),
    ]);
    if ((materials.length || machines.length || jobs.length || productionLogs.length || stockMovements.length || offcuts.length || scraps.length) && !args.force) {
      return {
        seeded: false,
        reason: "Existing operational data detected. Back up and review a migration before replacing it.",
      };
    }

    if (args.force) {
      await clearWorkspaceData(ctx);
    }
    await ctx.db.insert("companySettings", {
      key: YT_WORKSPACE_KEY,
      companyName: "YT Advertisement",
      industry: "ማስታወቂያ እና ማተሚያ",
      address: "የድርጅት አድራሻ ጀሞ ካፍደም ህንጻ",
      phone: "0951082102",
      ownerAuthUserId: actor.role === "owner" ? actor.authUserId : undefined,
      timezone: "Africa/Addis_Ababa",
      dailyReportEnabled: true,
      monthlyAuditEnabled: true,
      active: true,
    });

    const machineRecords = YT_MACHINE_MASTER_DATA;
    for (const machine of machineRecords) await ctx.db.insert("machines", { ...machine, active: true });

    const materialRecords = YT_MATERIAL_MASTER_DATA;
    const accents = ["cyan", "violet", "gold", "green", "blue"] as const;
    for (const [index, record] of materialRecords.entries()) {
      const [name, category, unit, purchaseUnit, conversionRatio, displayUnit, storageLocation, averageUse] = record;
      await ctx.db.insert("materials", {
        name,
        category,
        unit,
        baseUnit: unit,
        purchaseUnit,
        conversionRatio,
        rollEquivalent: purchaseUnit === "roll" ? conversionRatio : undefined,
        sheetEquivalent: purchaseUnit === "sheet" ? conversionRatio : undefined,
        displayUnit,
        quantity: 0,
        reorderAt: 0,
        storageLocation: storageLocation || undefined,
        averageUse: averageUse || undefined,
        accent: accents[index % accents.length],
        active: true,
      });
    }

    const staffRecords = [
      ["Zewuditu", "Store", "Storekeeper", "እቃ ተቀባይ እና አከፋፋይ", "እቃ ያስረክባል"],
      ["ዮርዳኖስ", "ማኔጅመንት", "Management", "ስታፍ መቆጣጠር", "የለውም"],
      ["Debas melaku", undefined, "Print and Cut operator, Crystal", undefined, "እቃ ይቀበላል"],
      ["surafel", undefined, "UV FLAT BED OPERATOR", undefined, "እቃ ይቀበላል"],
      ["SAMUEL GETE", undefined, "Banner machine operator", undefined, "እቃ ይቀበላል"],
      ["Addisu", undefined, "CNC and Laser Operator", undefined, "እቃ ይቀበላል"],
      ["Niguse", undefined, "Relief Coordinator", undefined, "እቃ ይቀበላል"],
      ["abriham", undefined, "Relief staff", undefined, "እቃ ይቀበላል"],
      ["haymanot", undefined, "Relief staff", undefined, "እቃ ይቀበላል"],
      ["Yohannes", undefined, "Relief Staff", undefined, "እቃ ይቀበላል"],
      ["Emebet", undefined, "Direct sales / customer services", "main position customer services", undefined],
    ] as const;
    const applicationRoles: Record<string, Role[]> = {
      Zewuditu: ["storekeeper"],
      "ዮርዳኖስ": ["manager"],
      "Debas melaku": ["plotter_operator"],
      surafel: ["printer_operator"],
      "SAMUEL GETE": ["printer_operator"],
      Addisu: ["cnc_operator", "laser_operator"],
    };
    for (const [personName, department, businessRole, responsibility, handlesMaterial] of staffRecords) {
      await ctx.db.insert("staff", { personName, department, businessRole, responsibility, handlesMaterial, applicationRoles: applicationRoles[personName], active: true });
    }
    await ctx.db.insert("staff", {
      personName: "Yitbarek",
      businessRole: "Owner",
      responsibility: "Whole-activity oversight, role assignment, profile access, and company settings",
      applicationRoles: ["owner"],
      authUserId: actor.role === "owner" ? actor.authUserId : undefined,
      active: true,
    });

    return {
      seeded: true,
      company: "YT Advertisement",
      machines: machineRecords.length,
      materials: materialRecords.length,
      staff: staffRecords.length + 1,
      operationalRecordsCreated: 0,
    };
  },
});

/**
 * Creates or promotes the real YT Advertisement owner account.
 *
 * The password is supplied only when this mutation is invoked in the local
 * deployment; it is intentionally not stored in source, returned, or written
 * to the application profile. The owner can change it from account settings.
 */
export const seedYitbarekOwner = mutation({
  args: {
    password: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = (args.email ?? "ytadvert@admin.org").toLowerCase().trim();
    const name = (args.name ?? "Yitbarek").trim();
    if (email !== "ytadvert@admin.org") {
      throw new Error("This bootstrap mutation is restricted to the confirmed owner email.");
    }
    if (args.password.length < 8) throw new Error("Owner password must be at least 8 characters.");
    if (!name) throw new Error("Owner name is required.");

    const existingProfile = (await ctx.db.query("users").collect()).find((user) => user.email.toLowerCase() === email);
    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, { name, role: "owner", active: true });
      const settings = await ctx.db
        .query("companySettings")
        .withIndex("by_key", (q) => q.eq("key", YT_WORKSPACE_KEY))
        .unique();
      if (settings) await ctx.db.patch(settings._id, { ownerAuthUserId: existingProfile.authUserId });
      const staff = (await ctx.db.query("staff").collect()).find((member) => member.personName.toLowerCase() === "yitbarek");
      if (staff) await ctx.db.patch(staff._id, { authUserId: existingProfile.authUserId });
      return { created: false, email, profileId: existingProfile._id };
    }

    const auth = createAuth(ctx);
    const result = await auth.api.signUpEmail({
      body: { name, email, password: args.password },
    });
    const authUser = result.user;
    const profileId = await ctx.db.insert("users", {
      authUserId: authUser.id,
      name: authUser.name ?? name,
      email: authUser.email,
      image: authUser.image ?? undefined,
      role: "owner",
      active: true,
    });
    const settings = await ctx.db
      .query("companySettings")
      .withIndex("by_key", (q) => q.eq("key", YT_WORKSPACE_KEY))
      .unique();
    if (settings) await ctx.db.patch(settings._id, { ownerAuthUserId: authUser.id });
    const staff = (await ctx.db.query("staff").collect()).find((member) => member.personName.toLowerCase() === "yitbarek");
    if (staff) await ctx.db.patch(staff._id, { authUserId: authUser.id });

    return { created: true, email, profileId };
  },
});

/**
 * Applies the revised requirement master data to an existing workspace without
 * clearing operational history or opening balances. Existing machine records
 * are matched by code and materials by name; missing records are inserted with
 * zero quantity and zero reorder threshold.
 */
export const migrateYtAdvertisementMasterData = mutation({
  args: {},
  handler: async (ctx) => {
    const actor = await resolveBootstrapActor(ctx);
    const settings = await ctx.db
      .query("companySettings")
      .withIndex("by_key", (q) => q.eq("key", YT_WORKSPACE_KEY))
      .unique();
    if (!settings) {
      return { migrated: false, reason: "Seed the YT Advertisement workspace before applying master-data migration." };
    }

    let machinesPatched = 0;
    let machinesInserted = 0;
    for (const machine of YT_MACHINE_MASTER_DATA) {
      const existing = await ctx.db
        .query("machines")
        .withIndex("by_code", (q) => q.eq("code", machine.code))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          name: machine.name,
          type: machine.type,
          manufacturer: "manufacturer" in machine ? machine.manufacturer : undefined,
          model: machine.model,
          capability: machine.capability,
          notes: "notes" in machine ? machine.notes : undefined,
          operatorRole: machine.operatorRole,
          materialUnit: machine.materialUnit,
          displayUnit: machine.displayUnit,
        });
        machinesPatched += 1;
      } else {
        await ctx.db.insert("machines", { ...machine, active: true });
        machinesInserted += 1;
      }
    }

    const existingMaterials = await ctx.db.query("materials").collect();
    let materialsPatched = 0;
    let materialsInserted = 0;
    const accents = ["cyan", "violet", "gold", "green", "blue"] as const;
    for (const [index, record] of YT_MATERIAL_MASTER_DATA.entries()) {
      const [name, category, unit, purchaseUnit, conversionRatio, displayUnit, storageLocation, averageUse] = record;
      const existing = existingMaterials.find((material) => material.name.toLowerCase() === name.toLowerCase());
      const masterFields = {
        category,
        unit,
        baseUnit: unit,
        purchaseUnit,
        conversionRatio,
        rollEquivalent: purchaseUnit === "roll" ? conversionRatio : undefined,
        sheetEquivalent: purchaseUnit === "sheet" ? conversionRatio : undefined,
        displayUnit,
        storageLocation: storageLocation || undefined,
        averageUse: averageUse || undefined,
      };
      if (existing) {
        await ctx.db.patch(existing._id, masterFields);
        materialsPatched += 1;
      } else {
        await ctx.db.insert("materials", {
          name,
          ...masterFields,
          quantity: 0,
          reorderAt: 0,
          accent: accents[index % accents.length],
          active: true,
        });
        materialsInserted += 1;
      }
    }

    return {
      migrated: true,
      machinesPatched,
      machinesInserted,
      materialsPatched,
      materialsInserted,
      operationalDataPreserved: true,
      actorRole: actor.role,
    };
  },
});
