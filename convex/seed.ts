import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { TableNames } from "./_generated/dataModel";
import type { Role } from "./types";
import { authComponent, createAuth } from "./auth";
import { requireAdmin } from "./users";
import { convertToBase, type InputUnit } from "./units";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";
import { MATERIAL_SPECIFICATIONS, findMaterialSpecification, resolveMaterialFamily, type MaterialCatalogFamily, type MaterialSpecificationDefinition } from "../src/shared/material-specifications";
import { recordInventoryEvent } from "./inventoryLedger";
import { classifyMaterialProductionType, effectiveConsumptionRate, resolveEtbValue } from "./materialUsage";
import { assertServiceIdsMatchSchema } from "./services";
import { MATERIAL_TYPE_CATALOG } from "./orderAutomation";

/**
 * Full field set for a seeded material, matching what the production
 * `materials:create` path stores: canonical identity, purchase-to-base
 * conversion, physical dimensions, and the automatic-deduction profile
 * (`productionType` / `consumptionRate`) plus the default ETB valuation.
 */
function materialMasterFields(material: MaterialSpecificationDefinition) {
  const classifierInput = { name: material.name, category: material.category, baseUnit: material.baseUnit };
  const catalogFamily: MaterialCatalogFamily = material.catalogFamily ?? (
    material.category === "Ink" || material.name.toLowerCase().includes("solvent")
      ? "INK_SOLVENT"
      : material.purchaseUnit === "roll"
        ? "ROLL"
        : material.category === "Rigid sheet" || material.category === "Foam board"
          ? "RIGID_SHEET"
          : "HARDWARE"
  );
  return {
    name: material.name,
    category: material.category,
    catalogFamily,
    catalogVariant: material.catalogVariant,
    catalogDimensions: material.catalogDimensions,
    compatibleMachineTypes: material.compatibleMachineTypes ? [...material.compatibleMachineTypes] : undefined,
    unit: material.baseUnit,
    baseUnit: material.baseUnit,
    purchaseUnit: material.purchaseUnit,
    packageSize: material.packageSize,
    packageLabel: material.packageLabel,
    isSolvent: material.isSolvent,
    materialFamily: material.materialFamily ?? resolveMaterialFamily({
      catalogFamily,
      isSolvent: material.isSolvent,
      category: material.category,
      name: material.name,
    }),
    inkColor: material.inkColor,
    conversionRatio: material.conversionRatio,
    rollEquivalent: material.purchaseUnit === "roll" ? material.conversionRatio : undefined,
    sheetEquivalent: material.purchaseUnit === "sheet" ? material.conversionRatio : undefined,
    displayUnit: material.displayUnit,
    specification: material.specification,
    specificationOptions: material.specificationOptions ? [...material.specificationOptions] : undefined,
    storageLocation: material.storageLocation,
    averageUse: material.averageUse,
    rollWidth: material.rollWidth,
    sheetWidth: material.sheetWidth,
    sheetLength: material.sheetLength,
    productionType: classifyMaterialProductionType(classifierInput),
    consumptionRate: effectiveConsumptionRate(classifierInput),
    etbValue: resolveEtbValue(classifierInput),
  };
}

/**
 * Populates the demo operations dataset (materials, machines, job cards,
 * offcuts). No-op when materials already exist so it is safe to call
 * repeatedly. `createdById` is used as the author on seeded records.
 */
export async function seedDemoData(ctx: MutationCtx, createdById: string) {
  if ((await ctx.db.query("materials").collect()).length > 0) {
    return { seeded: false };
  }

  const definition = (name: string): MaterialSpecificationDefinition => {
    const material = findMaterialSpecification(name);
    if (!material) throw new Error(`Missing demo material definition: ${name}`);
    return material;
  };
  const createDemoMaterial = async (material: MaterialSpecificationDefinition, quantity: number, reorderAt: number, accent: "cyan" | "gold" | "violet" | "blue" | "green", specificationValue?: string) => {
    const id = await ctx.db.insert("materials", {
      name: material.name,
      category: material.category,
      unit: material.baseUnit,
      baseUnit: material.baseUnit,
      purchaseUnit: material.purchaseUnit,
      conversionRatio: material.conversionRatio,
      rollEquivalent: material.purchaseUnit === "roll" ? material.conversionRatio : undefined,
      sheetEquivalent: material.purchaseUnit === "sheet" ? material.conversionRatio : undefined,
      displayUnit: material.displayUnit,
      specification: material.specification,
      specificationValue,
      specificationOptions: material.specificationOptions ? [...material.specificationOptions] : undefined,
      quantity: 0,
      reorderAt,
      storageLocation: material.storageLocation,
      averageUse: material.averageUse,
      accent,
      active: true,
    });
    await recordInventoryEvent(ctx, {
      materialId: id,
      eventType: "STOCK_IN",
      custody: "parent",
      balanceEffect: "in",
      quantity,
      unit: material.baseUnit,
      baseUnit: material.baseUnit,
      baseQuantity: quantity,
      note: "Demo opening stock",
      createdBy: createdById,
    });
    await ctx.db.patch(id, { reorderAt });
    return id;
  };

  const matBanner = await createDemoMaterial(definition("Banner Flex"), 286, 160, "cyan", "3.2m × 50m (160 m²)");
  const matAcrylic = await createDemoMaterial(definition("Mica"), 54.8, 65, "violet", "3mm");
  const matVinyl = await createDemoMaterial(definition("Frosted Sticker"), 417, 240, "gold", "1.2m × 50m (60 m²)");
  const matLed = await createDemoMaterial(definition("LED Modules"), 1260, 800, "blue", "Cool White (6000K-6500K)");
  const matInk = await createDemoMaterial(definition("DTF Ink 1L Canister"), 18.2, 12, "green", "White");
  const matMdf = await createDemoMaterial(definition("Foam Board"), 91.4, 45, "gold", "18mm");

  const mLaser = await ctx.db.insert("machines", {
    name: "Laser Cutter", code: "LAS-01", type: "CO2 Laser Cutter 1325",
    operatorRole: "laser_operator", materialUnit: "m²", status: "Running",
    activeJob: "JC-0421", active: true,
    primaryMaterials: ["Mica", "Foam Board"],
  });
  const mCnc = await ctx.db.insert("machines", {
    name: "CNC Router", code: "CNC-01", type: "Heavy Duty CNC Router 2030",
    operatorRole: "cnc_operator", materialUnit: "m²", status: "Running",
    activeJob: "JC-0424", active: true,
    primaryMaterials: ["Foam Board", "Cladding"],
  });
  const mPlotter = await ctx.db.insert("machines", {
    name: "Crystc Eco-Solvent Printer", code: "CESP-01", type: "Eco-Solvent Printer & Cutter",
    operatorRole: "plotter_operator", materialUnit: "m²", status: "Available", active: true,
    primaryMaterials: ["Frosted Sticker", "Transparent Sticker", "Reflective Sticker", "Mesh Sticker"],
    compatibleInks: ["Print & Cut Ink 1L Canister"],
  });
  const mPrinter = await ctx.db.insert("machines", {
    name: "Crystal Jet 7K Series", code: "CJ7K-01", type: "Large Format Solvent Printer",
    operatorRole: "printer_operator", materialUnit: "m²", status: "Running",
    activeJob: "JC-0420", active: true,
    primaryMaterials: ["Banner Flex", "Mesh Sticker"],
    compatibleInks: ["Banner Ink 5L Canister"],
    solventNames: ["Banner Solvent"],
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
    status: "In production", due: "Tomorrow, 10:00", priority: "Low",
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
    materialId: matMdf, label: "Foam · 18mm", width: 0.9, length: 0.6,
    area: 0.54, location: "Rack C · Slot 02", usable: true, status: "available",
    createdBy: createdById, createdAt: "Yesterday",
  });

  await ensureMaterialTypeCatalog(ctx);

  return { seeded: true };
}

/**
 * Idempotently seeds the material-type routing catalog from the canonical
 * source in `convex/orderAutomation.ts`. Missing services are inserted; rows
 * for services already present are left untouched so owner edits survive.
 */
async function ensureMaterialTypeCatalog(ctx: MutationCtx): Promise<number> {
  const existingServices = new Set((await ctx.db.query("materialTypeCatalog").collect()).map((row) => row.serviceType));
  let inserted = 0;
  for (const route of MATERIAL_TYPE_CATALOG) {
    if (existingServices.has(route.serviceType)) continue;
    await ctx.db.insert("materialTypeCatalog", {
      serviceType: route.serviceType,
      materialType: route.materialType,
      preferredMaterialName: route.preferredMaterialName,
      machineCapabilities: [...route.machineCapabilities],
      operatorRole: route.operatorRole,
      active: true,
    });
    inserted += 1;
  }
  return inserted;
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
  { name: "Crystal Jet 7K Series", code: "BAN-01", type: "Banner Printer", manufacturer: "Crystal", model: "Crystal Jet 7K Series", capability: "Banner and heavy sticker production", primaryMaterialFamilies: ["ROLL"], associatedInkFamilies: ["Banner Ink 5L", "Banner Solvent"], operatorRole: "printer_operator" as const, materialUnit: "m²" as const, displayUnit: "m²", status: "Available" as const },
  { name: "Crystc Eco-Solvent Printer", code: "PAC-01", type: "Print and Cut", manufacturer: "Crystal", model: "Eco-Solvent Print & Cut", capability: "Stickers and grayback media", primaryMaterialFamilies: ["ROLL"], associatedInkFamilies: ["Print & Cut Ink 1L", "Print & Cut Solvent"], operatorRole: "plotter_operator" as const, materialUnit: "m²" as const, displayUnit: "m²", status: "Available" as const },
  { name: "Ricoh Flatbed UV Machine", code: "UVF-01", type: "UV Flatbed", manufacturer: "Ricoh", model: "Flatbed UV", capability: "Rigid sheets and specialty media", primaryMaterialFamilies: ["RIGID_SHEET", "HARDWARE"], associatedInkFamilies: ["UV Ink 1L"], operatorRole: "printer_operator" as const, materialUnit: "m²" as const, displayUnit: "m²", status: "Available" as const },
  { name: "DTF i3200", code: "DTF-01", type: "DTF", manufacturer: "i3200", model: "DTF i3200", capability: "T-shirts and textile films", primaryMaterialFamilies: ["ROLL", "HARDWARE"], associatedInkFamilies: ["DTF Ink 1L", "DTF Solvent"], operatorRole: "printer_operator" as const, materialUnit: "m" as const, displayUnit: "m", status: "Available" as const },
  { name: "Laser Cutter", code: "LAS-01", type: "Laser Cutter", manufacturer: "Crystal", model: "CO2 Laser Cutter", capability: "Mica and foam board cutting", primaryMaterialFamilies: ["RIGID_SHEET"], operatorRole: "laser_operator" as const, materialUnit: "m²" as const, displayUnit: "m²", status: "Available" as const },
  { name: "CNC Router", code: "CNC-01", type: "CNC Router", model: "Heavy Duty CNC Router", capability: "Foam board, cladding, and MDF sheets", primaryMaterialFamilies: ["RIGID_SHEET"], operatorRole: "cnc_operator" as const, materialUnit: "m²" as const, displayUnit: "m²", status: "Available" as const },
] as const;

const YT_MATERIAL_MASTER_DATA = MATERIAL_SPECIFICATIONS;

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
 * Enforces that the schema's `serviceType` validator still matches the
 * canonical id list in `src/shared/services.ts`. Called once at the top of
 * every seed entry point so any drift fails the seed loudly instead of
 * silently producing wrong labels at lookup time.
 */
function guardServiceSchema(): string[] {
  return assertServiceIdsMatchSchema();
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
  const offcutConsumptions = await ctx.db.query("offcutConsumptions").collect();
  for (const record of offcutConsumptions) await ctx.db.delete(record._id);
  const scraps = await ctx.db.query("scraps").collect();
  for (const record of scraps) await ctx.db.delete(record._id);
  const stockExceptions = await ctx.db.query("stockExceptions").collect();
  for (const record of stockExceptions) await ctx.db.delete(record._id);
  const customerOrders = await ctx.db.query("customerOrders").collect();
  for (const record of customerOrders) await ctx.db.delete(record._id);
  const jobCards = await ctx.db.query("jobCards").collect();
  for (const record of jobCards) await ctx.db.delete(record._id);
  const stockMovements = await ctx.db.query("stock_movements").collect();
  for (const record of stockMovements) await ctx.db.delete(record._id);
  const operatorSubStock = await ctx.db.query("operatorSubStock").collect();
  for (const record of operatorSubStock) await ctx.db.delete(record._id);
  const weeklyReconciliations = await ctx.db.query("weeklyReconciliations").collect();
  for (const record of weeklyReconciliations) await ctx.db.delete(record._id);
  const reconciliations = await ctx.db.query("reconciliations").collect();
  for (const record of reconciliations) await ctx.db.delete(record._id);
  const parentInventory = await ctx.db.query("parentInventory").collect();
  for (const record of parentInventory) await ctx.db.delete(record._id);
  const materials = await ctx.db.query("materials").collect();
  for (const record of materials) await ctx.db.delete(record._id);
  const machines = await ctx.db.query("machines").collect();
  for (const record of machines) await ctx.db.delete(record._id);
  const staff = await ctx.db.query("staff").collect();
  for (const record of staff) await ctx.db.delete(record._id);
  const materialTypeCatalog = await ctx.db.query("materialTypeCatalog").collect();
  for (const record of materialTypeCatalog) await ctx.db.delete(record._id);
  const notifications = await ctx.db.query("notifications").collect();
  for (const record of notifications) await ctx.db.delete(record._id);
  const systemConfigs = await ctx.db.query("systemConfigs").collect();
  for (const record of systemConfigs) await ctx.db.delete(record._id);
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
 * Nuclear reset: clears the workspace (see `clearWorkspaceData`) plus every
 * application profile, Telegram customer record, bot session, migration
 * marker, and Better Auth account (user + sessions + credential links).
 * Leaves the deployment completely empty so `seedAll` can rebuild it from
 * scratch. Bootstrap/CLI helper — no auth required.
 */
export const resetAllData = mutation({
  args: {},
  handler: async (ctx) => {
    await resolveBootstrapActor(ctx);
    await clearWorkspaceData(ctx);
    for (const row of await ctx.db.query("users").collect()) await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("telegramUsers").collect()) await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("telegramSessions").collect()) await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("migrations").collect()) await ctx.db.delete(row._id);

    const auth = createAuth(ctx);
    const context = await auth.$context;
    let authUsersDeleted = 0;
    for (;;) {
      const batch = await context.internalAdapter.listUsers(100, 0);
      if (!batch.length) break;
      for (const user of batch) {
        await context.internalAdapter.deleteUserSessions(user.id);
        await context.internalAdapter.deleteAccounts(user.id);
        await context.internalAdapter.deleteUser(user.id);
        authUsersDeleted += 1;
      }
    }
    return { cleared: true, authUsersDeleted };
  },
});

/**
 * Deletes a user profile by email. Bootstrap/CLI helper — no auth required.
 */
export const deleteUserByEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await resolveBootstrapActor(ctx);
    const users = await ctx.db.query("users").collect();
    const target = users.find((u) => u.email.toLowerCase() === args.email.toLowerCase());
    if (!target) return { deleted: false, reason: "User not found." };
    await ctx.db.delete(target._id);
    return { deleted: true, email: target.email };
  },
});

/**
 * Removes a Better Auth user (credential account + profile + app user) by
 * email so the seed flow can re-create the same account cleanly. Bootstrap/CLI
 * helper — no auth required.
 */
export const deleteAuthUserByEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await resolveBootstrapActor(ctx);
    const targetEmail = args.email.toLowerCase();
    const auth = createAuth(ctx);
    const context = await auth.$context;
    const authResult = await context.internalAdapter.findUserByEmail(targetEmail);
    const authUser = authResult?.user;
    let authDeleted = false;
    if (authUser) {
      await context.internalAdapter.deleteUser(authUser.id);
      authDeleted = true;
    }
    const profile = (await ctx.db.query("users").collect()).find((u) => u.email.toLowerCase() === targetEmail);
    if (profile) await ctx.db.delete(profile._id);
    const staff = (await ctx.db.query("staff").collect()).filter((member) => (member as { authUserId?: string }).authUserId === authUser?.id);
    for (const member of staff) {
      await ctx.db.patch(member._id, { authUserId: undefined });
    }
    const settings = await ctx.db
      .query("companySettings")
      .withIndex("by_key", (q) => q.eq("key", YT_WORKSPACE_KEY))
      .unique();
    if (settings && settings.ownerAuthUserId && authUser && settings.ownerAuthUserId === authUser.id) {
      await ctx.db.patch(settings._id, { ownerAuthUserId: undefined });
    }
    return { deleted: authDeleted, email: targetEmail, profileDeleted: Boolean(profile) };
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
    guardServiceSchema();
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
      ctx.db.query("stock_movements").collect(),
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
    for (const machine of machineRecords) await ctx.db.insert("machines", {
      ...machine,
       primaryMaterialFamilies: "primaryMaterialFamilies" in machine ? [...machine.primaryMaterialFamilies] : undefined,
       associatedInkFamilies: "associatedInkFamilies" in machine ? [...machine.associatedInkFamilies] : undefined,
      active: true,
    });

    const materialRecords = YT_MATERIAL_MASTER_DATA;
    const accents = ["cyan", "violet", "gold", "green", "blue"] as const;
    for (const [index, material] of materialRecords.entries()) {
      await ctx.db.insert("materials", {
        ...materialMasterFields(material),
        quantity: 0,
        reorderAt: 0,
        accent: accents[index % accents.length],
        active: true,
      });
    }
    const catalogSeedCount = await ensureMaterialTypeCatalog(ctx);

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
      materialTypeRoutes: catalogSeedCount,
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

      const auth = createAuth(ctx);
      const context = await auth.$context;
      const passwordHash = await context.password.hash(args.password);
      const accounts = await context.internalAdapter.findAccounts(existingProfile.authUserId);
      const credentialAccount = accounts.find((account: any) => account.providerId === "credential");
      if (credentialAccount) {
        await context.internalAdapter.updatePassword(existingProfile.authUserId, passwordHash);
      } else {
        await context.internalAdapter.linkAccount({
          userId: existingProfile.authUserId,
          providerId: "credential",
          accountId: existingProfile.authUserId,
          password: passwordHash,
        });
      }
      await context.internalAdapter.updateUser(existingProfile.authUserId, { emailVerified: true });

      return { created: false, email, profileId: existingProfile._id };
    }

    const auth = createAuth(ctx);
    const result = await auth.api.signUpEmail({
      body: { name, email, password: args.password },
    });
    const authUser = result.user;
    const context = await auth.$context;
    await context.internalAdapter.updateUser(authUser.id, { emailVerified: true });
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
          notes: "notes" in machine ? String(machine.notes) : undefined,
          primaryMaterialFamilies: "primaryMaterialFamilies" in machine ? [...machine.primaryMaterialFamilies] : undefined,
          associatedInkFamilies: "associatedInkFamilies" in machine ? [...machine.associatedInkFamilies] : undefined,
          operatorRole: machine.operatorRole,
          materialUnit: machine.materialUnit,
          displayUnit: machine.displayUnit,
          primaryMaterials: "primaryMaterials" in machine && Array.isArray(machine.primaryMaterials) ? [...machine.primaryMaterials] : undefined,
          compatibleInks: "compatibleInks" in machine && Array.isArray(machine.compatibleInks) ? [...machine.compatibleInks] : undefined,
          solventNames: "solventNames" in machine && Array.isArray(machine.solventNames) ? [...machine.solventNames] : undefined,
          defaultWasteMarginPercent: "defaultWasteMarginPercent" in machine && typeof machine.defaultWasteMarginPercent === "number" ? machine.defaultWasteMarginPercent : undefined,
          maxAllowedScrapLimitPercent: "maxAllowedScrapLimitPercent" in machine && typeof machine.maxAllowedScrapLimitPercent === "number" ? machine.maxAllowedScrapLimitPercent : undefined,
        });
        machinesPatched += 1;
      } else {
        await ctx.db.insert("machines", {
          ...machine,
          primaryMaterialFamilies: "primaryMaterialFamilies" in machine ? [...machine.primaryMaterialFamilies] : undefined,
          associatedInkFamilies: "associatedInkFamilies" in machine ? [...machine.associatedInkFamilies] : undefined,
          active: true,
        });
        machinesInserted += 1;
      }
    }

    const existingMaterials = await ctx.db.query("materials").collect();
    let materialsPatched = 0;
    let materialsInserted = 0;
    const accents = ["cyan", "violet", "gold", "green", "blue"] as const;
    for (const [index, material] of YT_MATERIAL_MASTER_DATA.entries()) {
      const names = [material.name, ...(material.aliases ?? [])].map((name) => name.toLowerCase());
      const existing = existingMaterials.find((record) => names.includes(record.name.toLowerCase()));
      const masterFields = materialMasterFields(material);
      if (existing) {
        await ctx.db.patch(existing._id, masterFields);
        materialsPatched += 1;
      } else {
        await ctx.db.insert("materials", {
          ...masterFields,
          quantity: 0,
          reorderAt: 0,
          accent: accents[index % accents.length],
          active: true,
        });
        materialsInserted += 1;
      }
    }

    const catalogInserted = await ensureMaterialTypeCatalog(ctx);

    return {
      migrated: true,
      machinesPatched,
      machinesInserted,
      materialsPatched,
      materialsInserted,
      materialTypeRoutesInserted: catalogInserted,
      operationalDataPreserved: true,
      actorRole: actor.role,
    };
  },
});

/**
 * Issues sample opening stock so the freshly seeded workspace matches the
 * current two-tier inventory design: roll / sheet / liter materials receive a
 * `parentInventory` central-store row (whole packaging units + conversion
 * factor) and an auditable `STOCK_IN` ledger event carrying the packaging
 * quantity, while piece / pack hardware materials are stocked directly in
 * base units. Runs as a bootstrap (deployment-credentialed) operation.
 *
 * Safe to re-run with `force`: both the materialized material balance and the
 * central packaging stock are first drained through reconciliation events,
 * then re-issued at the sample level.
 */

/** Sample opening stock in whole central-store packaging units per material. */
const SAMPLE_PACKAGING_STOCK: Record<string, number> = {
  Banner: 2,
  "DTF Film": 2,
  "Normal Sticker": 3,
  "Frosted Sticker": 3,
  "Transparent Sticker": 3,
  "Reflective Sticker": 3,
  "Mush Sticker": 3,
  "Canvas (Canva)": 2,
  "Neon Light": 4,
  Acrylic: 20,
  Foam: 20,
  "DTF Ink": 24,
  "Banner Ink": 24,
  "Print and Cut INK": 24,
  "UV Flat bed Ink": 24,
};

/** Sample opening stock in base units for piece / pack hardware materials. */
const SAMPLE_UNIT_STOCK: Record<string, number> = {
  "LED Module / Strip": 240,
  "Mica Sheet": 250,
  "Power Supply": 40,
  AMIR: 15,
  "ROLE UP DELUX": 10,
  "ROLE UP STANDARD": 10,
  VINNER: 15,
  "Zocolo (Base / Skirting)": 20,
  "LED LIGHT BOX A1": 8,
  "LED LIGHT BOX A2": 8,
};

function sampleOpeningQuantity(unit: string): number {
  switch (unit) {
    case "m²":
      return 180;
    case "m":
      return 120;
    case "piece":
    case "pcs":
      return 250;
    case "L":
      return 24;
    case "sheet":
      return 60;
    default:
      return 100;
  }
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

type ParentInventoryDoc = { _id: Id<"parentInventory">; unitType: "ROLL" | "SHEET" | "LITER"; totalStockQuantity: number };

/** Maps a purchase unit onto the central-store packaging tier, if tracked. */
function parentUnitTypeFor(purchaseUnit: string | undefined): "ROLL" | "SHEET" | "LITER" | null {
  if (purchaseUnit === "roll") return "ROLL";
  if (purchaseUnit === "sheet") return "SHEET";
  if (purchaseUnit === "liter") return "LITER";
  return null;
}

export const seedSampleStock = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const actor = await resolveBootstrapActor(ctx);
    const createdBy = actor.authUserId ?? "seed";
    const materials = await ctx.db.query("materials").collect();
    const activeMaterials = materials.filter((material) => material.active);

    const movements = await ctx.db.query("stock_movements").collect();
    const alreadySeeded = movements.some((movement) => movement.note.startsWith("Sample opening stock"));
    if (alreadySeeded && !args.force) {
      return { seeded: false, reason: "Sample stock already issued. Pass force to re-issue." };
    }

    let parentItemsCreated = 0;
    let packagingIssued = 0;
    let unitIssued = 0;
    const skipped: string[] = [];

    for (const material of activeMaterials) {
      const baseUnit = material.baseUnit ?? material.unit;
      const unitType = parentUnitTypeFor(material.purchaseUnit);
      const ratio = material.conversionRatio;

      // Tier-1 trackable material: stock whole packaging units centrally.
      if (unitType && ratio !== undefined && Number.isFinite(ratio) && ratio > 0) {
        const existing = await ctx.db
          .query("parentInventory")
          .withIndex("by_material", (q) => q.eq("materialId", material._id))
          .unique();
        const packages = SAMPLE_PACKAGING_STOCK[material.name] ?? 2;

        let parent: ParentInventoryDoc;
        if (existing) {
          if (args.force && (existing.totalStockQuantity > 0 || (material.quantity ?? 0) > 0)) {
            if ((material.quantity ?? 0) > 0) {
              await recordInventoryEvent(ctx, {
                materialId: material._id,
                eventType: "RECONCILIATION_ADJUSTMENT",
                custody: "parent",
                balanceEffect: "out",
                quantity: material.quantity ?? 0,
                unit: baseUnit,
                baseUnit,
                baseQuantity: material.quantity ?? 0,
                packageQuantity: existing.totalStockQuantity > 0 ? existing.totalStockQuantity : undefined,
                packageUnit: existing.unitType,
                parentInventoryId: existing._id,
                note: "Reset sample opening projection",
                createdBy,
              });
            } else if (existing.totalStockQuantity > 0) {
              await ctx.db.patch(existing._id, { totalStockQuantity: 0, updatedAt: Date.now() });
            }
          }
          await ctx.db.patch(existing._id, {
            unitType,
            lengthPerRoll: unitType === "ROLL" ? ratio : undefined,
            areaPerSheet: unitType === "SHEET" ? ratio : undefined,
            volumePerContainer: unitType === "LITER" ? ratio : undefined,
            updatedAt: Date.now(),
          });
          parent = existing;
        } else {
          const id = await ctx.db.insert("parentInventory", {
            materialId: material._id,
            unitType,
            totalStockQuantity: 0,
            lengthPerRoll: unitType === "ROLL" ? ratio : undefined,
            areaPerSheet: unitType === "SHEET" ? ratio : undefined,
            volumePerContainer: unitType === "LITER" ? ratio : undefined,
            updatedAt: Date.now(),
          });
          parentItemsCreated += 1;
          parent = { _id: id, unitType, totalStockQuantity: 0 };
        }

        if (!args.force && (material.quantity ?? 0) >= round3(packages * ratio)) {
          await ctx.db.patch(material._id, { reorderAt: round3(packages * ratio * 0.3) });
          packagingIssued += 1;
          continue;
        }

        await recordInventoryEvent(ctx, {
          materialId: material._id,
          eventType: "STOCK_IN",
          custody: "parent",
          balanceEffect: "in",
          quantity: packages,
          unit: material.purchaseUnit as "roll" | "sheet" | "liter",
          baseUnit,
          baseQuantity: round3(packages * ratio),
          packageQuantity: packages,
          packageUnit: unitType,
          conversionRatio: ratio,
          parentInventoryId: parent._id,
          note: "Sample opening stock (seed)",
          createdBy,
        });
        await ctx.db.patch(material._id, { reorderAt: round3(packages * ratio * 0.3) });
        packagingIssued += 1;
        continue;
      }

      // Piece / pack hardware (or materials without a confirmed conversion
      // ratio, e.g. PVC Film): stock in base units only.
      if (unitType && (ratio === undefined || !Number.isFinite(ratio) || ratio <= 0)) {
        skipped.push(material.name);
        continue;
      }
      const target = SAMPLE_UNIT_STOCK[material.name] ?? sampleOpeningQuantity(baseUnit);
      if (!Number.isFinite(target) || target <= 0) {
        skipped.push(material.name);
        continue;
      }
      if (args.force && (material.quantity ?? 0) > 0) {
        await recordInventoryEvent(ctx, {
          materialId: material._id,
          eventType: "RECONCILIATION_ADJUSTMENT",
          custody: "parent",
          balanceEffect: "out",
          quantity: material.quantity ?? 0,
          unit: baseUnit,
          baseUnit,
          baseQuantity: material.quantity ?? 0,
          note: "Reset sample opening projection",
          createdBy,
        });
      }
      if (!args.force && (material.quantity ?? 0) >= target) {
        await ctx.db.patch(material._id, { reorderAt: round3(target * 0.3) });
        unitIssued += 1;
        continue;
      }
      await recordInventoryEvent(ctx, {
        materialId: material._id,
        eventType: "STOCK_IN",
        custody: "parent",
        balanceEffect: "in",
        quantity: target,
        unit: baseUnit,
        baseUnit,
        baseQuantity: target,
        note: "Sample opening stock (seed)",
        createdBy,
      });
      await ctx.db.patch(material._id, { reorderAt: round3(target * 0.3) });
      unitIssued += 1;
    }

    return { seeded: true, parentItemsCreated, packagingIssued, unitIssued, skipped };
  },
});

const SAMPLE_CONSUMPTION_RATIO = 0.18;

/**
 * Issues a small set of synthetic stock-out movements against the first few
 * active materials so the Material Pulse utilization metric renders realistic
 * percentages on a freshly seeded workspace. Bootstrap/CLI helper — no auth
 * required.
 */
export const seedSampleConsumption = mutation({
  args: {},
  handler: async (ctx) => {
    await resolveBootstrapActor(ctx);
    const createdBy = "seed";
    const materials = (await ctx.db.query("materials").collect())
      .filter((material) => material.active)
      .slice(0, 4);
    let issued = 0;
    for (const material of materials) {
      const baseUnit = material.baseUnit ?? material.unit;
      const amount = Number((sampleOpeningQuantity(material.unit) * SAMPLE_CONSUMPTION_RATIO).toFixed(2));
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const baseQuantity = convertToBase(
        amount,
        material.unit as InputUnit,
        baseUnit,
        material.conversionRatio,
        material.rollEquivalent,
        material.sheetEquivalent,
      );
      if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) continue;
      await recordInventoryEvent(ctx, {
        materialId: material._id,
        eventType: "PRODUCTION_CONSUMPTION",
        custody: "parent",
        balanceEffect: "out",
        quantity: amount,
        unit: material.unit,
        baseUnit,
        baseQuantity,
        note: "Sample consumption (seed)",
        createdBy,
      });
      issued += 1;
    }
    return { seeded: true, materialsIssued: issued };
  },
});

export const seedSingleRoleAccount = mutation({
  args: { roleName: v.string() },
  handler: async (ctx, args) => {
    await resolveBootstrapActor(ctx);

    const ROLE_SEED_DATA: Record<string, { role: Role; name: string; email: string; password: string; staffName?: string }> = {
      owner: { role: "owner", name: "Yitbarek", email: "ytadvert+owner@gmail.com", password: "password123", staffName: "Yitbarek" },
      manager: { role: "manager", name: "Yordanos", email: "ytadvert+manager@gmail.com", password: "password123", staffName: "ዮርዳኖስ" },
      admin: { role: "admin", name: "Admin User", email: "ytadvert+admin@gmail.com", password: "password123" },
      storekeeper: { role: "storekeeper", name: "Zewuditu", email: "ytadvert+storekeeper@gmail.com", password: "password123", staffName: "Zewuditu" },
      receptionist: { role: "receptionist", name: "Selamawit", email: "ytadvert+receptionist@gmail.com", password: "password123", staffName: "Selamawit" },
      laser_operator: { role: "laser_operator", name: "Addisu", email: "ytadvert+laser@gmail.com", password: "password123", staffName: "Addisu" },
      cnc_operator: { role: "cnc_operator", name: "Addisu", email: "ytadvert+cnc@gmail.com", password: "password123", staffName: "Addisu" },
      plotter_operator: { role: "plotter_operator", name: "Debas Melaku", email: "ytadvert+plotter@gmail.com", password: "password123", staffName: "Debas melaku" },
      printer_operator: { role: "printer_operator", name: "Surafel", email: "ytadvert+printer@gmail.com", password: "password123", staffName: "surafel" },
    };

    const entry = ROLE_SEED_DATA[args.roleName];
    if (!entry) throw new Error(`Unknown role: ${args.roleName}. Valid: ${Object.keys(ROLE_SEED_DATA).join(", ")}`);

    const existingProfile = (await ctx.db.query("users").collect()).find(
      (user) => user.email.toLowerCase() === entry.email,
    );
    if (existingProfile) return { created: false, reason: "Profile already exists", email: entry.email };

    const auth = createAuth(ctx);
    const result = await auth.api.signUpEmail({
      body: { name: entry.name, email: entry.email, password: entry.password },
    });
    const authUser = result.user;

    const profileId = await ctx.db.insert("users", {
      authUserId: authUser.id,
      name: entry.name,
      email: entry.email,
      role: entry.role,
      active: true,
    });

    let linkedStaff = false;
    if (entry.staffName) {
      const staff = (await ctx.db.query("staff").collect()).find(
        (member) => member.personName.toLowerCase() === entry.staffName!.toLowerCase(),
      );
      if (staff) {
        await ctx.db.patch(staff._id, { authUserId: authUser.id });
        linkedStaff = true;
      }
    }

    if (entry.role === "owner") {
      const settings = await ctx.db
        .query("companySettings")
        .withIndex("by_key", (q) => q.eq("key", YT_WORKSPACE_KEY))
        .unique();
      if (settings) await ctx.db.patch(settings._id, { ownerAuthUserId: authUser.id });
    }

    return { created: true, role: entry.role, email: entry.email, profileId, linkedStaff };
  },
});

/**
 * One-shot production bootstrap: clears any prior workspace data, seeds the
 * full YT Advertisement master dataset, issues sample opening stock through
 * the two-tier inventory design, creates/promotes the owner account, and —
 * with `demoAccounts` — provisions the password123 demo account for every
 * non-owner workspace role (mirroring the sign-in page's test accounts).
 * Run once against the deployment after `convex deploy`.
 */
const DEMO_ACCOUNT_ROLES = [
  "manager",
  "admin",
  "storekeeper",
  "receptionist",
  "laser_operator",
  "cnc_operator",
  "plotter_operator",
  "printer_operator",
] as const;

export const seedAll = mutation({
  args: { password: v.string(), demoAccounts: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await resolveBootstrapActor(ctx);
    guardServiceSchema();
    await ctx.runMutation(api.seed.seedYtAdvertisementWorkspace, { force: true });
    const stock: {
      seeded: boolean;
      reason?: string;
      parentItemsCreated?: number;
      packagingIssued?: number;
      unitIssued?: number;
      skipped?: string[];
    } = await ctx.runMutation(api.seed.seedSampleStock, { force: true });
    const owner: { email: string; created: boolean } = await ctx.runMutation(api.seed.seedYitbarekOwner, { password: args.password });
    const demoAccounts: Array<Record<string, unknown>> = [];
    if (args.demoAccounts) {
      for (const roleName of DEMO_ACCOUNT_ROLES) {
        demoAccounts.push(await ctx.runMutation(api.seed.seedSingleRoleAccount, { roleName }));
      }
    }

    await ctx.runMutation(internal.migrations.normalizeOrderStatusCasing, {});
    return {
      seeded: true,
      ownerEmail: owner.email,
      ownerCreated: owner.created,
      sampleStock: stock,
      demoAccounts: demoAccounts.map((result) => ({ role: result.role, email: result.email, created: result.created })),
    };
  },
});

/* ============================================================
 * Strict Clearance-Gated Lifecycle Seed (`seedDemoLifecycle`)
 * ============================================================
 *
 * One-shot, fully-typed seed that builds the canonical demo state for YT
 * Advertisement. Runs the operational sequence in order so every later step
 * sees the data it depends on:
 *
 *   1. Auth & users   — Better Auth identities + application profiles + staff
 *   2. System setup   — companySettings, systemConfigs, machines, materials
 *   3. Procurement    — parentInventory rows + STOCK_IN ledger events
 *   4. Floor issuance — STORE_TO_OPERATOR_TRANSFER events seeding
 *                       operatorSubStock (one operator per machine, plus an
 *                       ACTIVE Banner Ink batch on the banner printer)
 *   5. Orders
 *   6. Production     — jobCards + productionLogs + PRODUCTION_CONSUMPTION
 *                       (both substrate and ink legs for print jobs)
 *   7. Clearance      — reconciliations + weeklyReconciliations; flips some
 *                       operator batches to PENDING_CLEARANCE / CLEARED
 *   8. Re-stocking    — materialRequests ONLY for operators whose prior
 *                       cycle is CLEARED (runtime gate honoured)
 *   9. Migration      — `migrations` row recording the seed completion
 *
 * Schema discipline:
 *   • Only `operatorSubStock` (authoritative floor ledger).
 *   • Only `stock_movements`  (authoritative inventory ledger).
 *   • `systemConfigs.key = "default"`, `companySettings.key = "yt-advertisement"`.
 *
 * Run:  `npx convex run seed:seedDemoLifecycle`
 * Idempotent: refuses to re-run unless `force: true` is supplied.
 */

/** Demo workspace credentials. */
type RoleKey =
  | "owner"
  | "manager"
  | "admin"
  | "storekeeper"
  | "receptionist"
  | "laser_operator"
  | "cnc_operator"
  | "printer_operator";

interface DemoAccount {
  role: RoleKey;
  name: string;
  email: string;
  password: string;
  staffName?: string;
}

const DEMO_PASSWORD = "Password123!";

const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { role: "owner",          name: "Yitbarek Tesfaye", email: "owner@yotech.com",          password: DEMO_PASSWORD, staffName: "Yitbarek" },
  { role: "manager",        name: "Yordanos Lemma",   email: "manager@yotech.com",        password: DEMO_PASSWORD, staffName: "ዮርዳኖስ" },
  { role: "admin",          name: "Sami Tesfaye",     email: "admin@yotech.com",          password: DEMO_PASSWORD },
  { role: "storekeeper",    name: "Zewuditu Bekele",  email: "storekeeper@yotech.com",    password: DEMO_PASSWORD, staffName: "Zewuditu" },
  { role: "receptionist",   name: "Selamawit Alemu",  email: "receptionist@yotech.com",   password: DEMO_PASSWORD },
  { role: "laser_operator", name: "Addisu Mekonnen",  email: "laser@yotech.com",          password: DEMO_PASSWORD },
  { role: "cnc_operator",   name: "Addisu Mekonnen",  email: "cnc@yotech.com",            password: DEMO_PASSWORD },
  { role: "printer_operator", name: "Surafel Girma",  email: "printer@yotech.com",        password: DEMO_PASSWORD },
];

const SEED_MIGRATION_KEY = "seed:demo:v1";
const WORKSPACE_KEY = "yt-advertisement";
const SYSTEM_CONFIG_KEY = "default";

/**
 * Round a quantity to 3 decimal places (matches ledger precision).
 */
function qty(value: number): number {
  return Number(value.toFixed(3));
}

/**
 * Resolves the bootstrap actor. When a Better Auth identity is present it
 * must be admin/owner; when no identity is present (deployment-credentialed
 * `npx convex run`) we trust the caller because deployment credentials already
 * grant full database access.
 */
async function resolveLifecycleActor(
  ctx: MutationCtx,
): Promise<{ authUserId: string | undefined; role: Role }> {
  const identity = await authComponent.safeGetAuthUser(ctx);
  if (identity) {
    const profile = await requireAdmin(ctx);
    return { authUserId: profile.authUserId, role: profile.role };
  }
  return { authUserId: undefined, role: "owner" };
}

/**
 * Ensures a Better Auth user + credential account exists for the given email,
 * returning the auth user id. When `forcePassword` is supplied the credential
 * password is rewritten regardless of any prior account. Idempotent.
 */
async function ensureBetterAuthUser(
  ctx: MutationCtx,
  account: DemoAccount,
): Promise<{ authUserId: string; created: boolean }> {
  const auth = createAuth(ctx);
  const targetEmail = account.email.toLowerCase().trim();
  let authUserId: string | undefined;
  let created = false;

  try {
    const result = await auth.api.signUpEmail({
      body: { name: account.name, email: targetEmail, password: account.password },
    });
    authUserId = result.user.id;
    created = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already|exists|registered|conflict/i.test(message)) throw error;
    const context = await auth.$context;
    const lookup = await context.internalAdapter.findUserByEmail(targetEmail);
    if (!lookup?.user) throw error;
    authUserId = lookup.user.id;
    // Always (re)write the password so a fresh demo is always sign-in-able.
    const passwordHash = await context.password.hash(account.password);
    const accounts = await context.internalAdapter.findAccounts(authUserId);
    const credential = accounts.find((entry: { providerId: string }) => entry.providerId === "credential");
    if (credential) {
      await context.internalAdapter.updatePassword(authUserId, passwordHash);
    } else {
      await context.internalAdapter.linkAccount({
        userId: authUserId,
        providerId: "credential",
        accountId: authUserId,
        password: passwordHash,
      });
    }
  }

  if (!authUserId) throw new Error(`Failed to provision Better Auth identity for ${targetEmail}`);
  return { authUserId, created };
}

/**
 * Ensures the `users` application profile exists, linking it back to the
 * staff directory entry when one matches the seeded name.
 */
async function ensureAppProfile(
  ctx: MutationCtx,
  account: DemoAccount,
  authUserId: string,
): Promise<Id<"users">> {
  const email = account.email.toLowerCase();
  const existing = (await ctx.db.query("users").collect()).find(
    (u) => u.email.toLowerCase() === email,
  );
  if (existing) {
    await ctx.db.patch(existing._id, {
      authUserId,
      name: account.name,
      role: account.role,
      active: true,
    });
    return existing._id;
  }
  return ctx.db.insert("users", {
    authUserId,
    name: account.name,
    email: account.email,
    role: account.role,
    active: true,
  });
}

/**
 * Ensures a `staff` directory row exists for non-account staff (and links it
 * to the auth identity for the operator/manager/storekeeper/owner accounts).
 */
async function ensureStaffDirectory(
  ctx: MutationCtx,
  account: DemoAccount,
  authUserId: string,
): Promise<void> {
  if (!account.staffName) return;
  const existing = (await ctx.db.query("staff").collect()).find(
    (s) => s.personName.toLowerCase() === account.staffName!.toLowerCase(),
  );
  if (existing) {
    await ctx.db.patch(existing._id, {
      authUserId,
      applicationRoles: [account.role],
      active: true,
    });
    return;
  }
  await ctx.db.insert("staff", {
    personName: account.staffName,
    businessRole: account.role,
    responsibility: "Demo workspace seed",
    applicationRoles: [account.role],
    authUserId,
    active: true,
  });
}

/**
 * Wipes every table touched by `seedDemoLifecycle` so a `force` re-run starts
 * from a known-empty state. Preserves Better Auth identities (those are
 * managed by `resetAuthData` if the caller wants a full clean slate).
 */
async function clearLifecycleData(ctx: MutationCtx): Promise<void> {
  const tables: readonly TableNames[] = [
    "materialRequests",
    "productionLogs",
    "offcuts",
    "offcutConsumptions",
    "scraps",
    "stockExceptions",
    "customerOrders",
    "jobCards",
    "stock_movements",
    "operatorSubStock",
    "weeklyReconciliations",
    "reconciliations",
    "parentInventory",
    "materials",
    "machines",
    "staff",
    "notifications",
    "systemConfigs",
    "users",
    "companySettings",
  ];
  for (const table of tables) {
    const rows = await ctx.db.query(table).collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }
  for (const row of await ctx.db.query("migrations").collect()) {
    if (row.key === SEED_MIGRATION_KEY) await ctx.db.delete(row._id);
  }
}

interface MachineInsertInput {
  name: string;
  code: string;
  type: string;
  manufacturer?: string;
  model?: string;
  capability?: string;
  notes?: string;
  primaryMaterialFamilies?: string[];
  associatedInkFamilies?: string[];
  operatorRole: Role;
  materialUnit: "m²" | "m" | "sheet" | "piece" | "pcs" | "L";
  displayUnit?: string;
  status: "Available" | "Running" | "Maintenance" | "Unavailable";
}

const DEMO_MACHINES: readonly MachineInsertInput[] = [
  {
    name: "Laser Cutter 1325",
    code: "LAS-01",
    type: "Laser Cutter 1325",
    manufacturer: "Crystal",
    model: "1300mm x 2500mm CO2 Laser",
    capability: "1.22m x 2.44m Standard Board",
    operatorRole: "laser_operator",
    materialUnit: "m²",
    displayUnit: "m²",
    status: "Running",
  },
  {
    name: "CNC Router 2030",
    code: "CNC-01",
    type: "CNC Router",
    manufacturer: "Generic",
    model: "2000mm x 3000mm Heavy Duty",
    capability: "2.0m x 3.0m Bed Size",
    operatorRole: "cnc_operator",
    materialUnit: "m²",
    displayUnit: "m²",
    status: "Running",
  },
  {
    name: "Large Format Banner Printer",
    code: "BAN-01",
    type: "Banner Printer",
    manufacturer: "Generic",
    model: "3.2m Eco-Solvent / Solvent Printer",
    capability: "3.2m Print Width",
    operatorRole: "printer_operator",
    materialUnit: "m²",
    displayUnit: "m²",
    status: "Running",
  },
];

interface MaterialInsertInput {
  name: string;
  category: string;
  baseUnit: "m²" | "m" | "sheet" | "piece" | "pcs" | "L";
  purchaseUnit?: "roll" | "sheet" | "pack" | "liter" | "piece";
  conversionRatio?: number;
  displayUnit?: string;
  reorderAt: number;
  accent: "cyan" | "gold" | "violet" | "blue" | "green";
  storageLocation?: string;
  averageUse?: string;
  rollWidth?: number;
  sheetWidth?: number;
  sheetLength?: number;
  specification?: string;
  specificationValue?: string;
  specificationOptions?: string[];
}

const DEMO_MATERIALS: readonly MaterialInsertInput[] = [
  {
    name: "Banner",
    category: "Banner",
    baseUnit: "m²",
    purchaseUnit: "roll",
    conversionRatio: 160,
    displayUnit: "ሮል",
    reorderAt: 240,
    accent: "cyan",
    rollWidth: 3.2,
    specification: "Roll Weight & Size",
    specificationValue: "3 Meter Roll Weight",
    specificationOptions: ["2 Meter Roll Weight", "3 Meter Roll Weight"],
  },
  {
    name: "Acrylic",
    category: "Rigid sheet",
    baseUnit: "m²",
    purchaseUnit: "sheet",
    conversionRatio: 2.977,
    displayUnit: "ቁጥር",
    reorderAt: 60,
    accent: "violet",
    sheetWidth: 1.22,
    sheetLength: 2.44,
    specification: "Thickness (in millimeters)",
    specificationValue: "3mm",
    specificationOptions: ["18mm", "10mm", "8mm", "5mm", "3mm"],
  },
  {
    name: "Foam",
    category: "Foam board",
    baseUnit: "m²",
    purchaseUnit: "sheet",
    conversionRatio: 2.977,
    displayUnit: "ቁጥር",
    reorderAt: 45,
    accent: "gold",
    sheetWidth: 1.22,
    sheetLength: 2.44,
    specification: "Thickness / Size (in millimeters)",
    specificationValue: "18mm",
    specificationOptions: ["18mm", "10mm", "8mm", "5mm", "3mm"],
  },
  {
    name: "Banner Ink",
    category: "Ink",
    baseUnit: "L",
    purchaseUnit: "liter",
    conversionRatio: 1,
    displayUnit: "ሊትር",
    reorderAt: 12,
    accent: "green",
    specification: "Ink Type & Color Config",
    specificationValue: "Eco-Solvent (CMYK)",
    specificationOptions: ["Eco-Solvent (CMYK)", "Solvent (CMYK)", "Dye (CMYK)"],
  },
];

interface SeedLog {
  step: string;
  detail: string;
}

export const seedDemoLifecycle = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const actor = await resolveLifecycleActor(ctx);
    const createdBy = actor.authUserId ?? "seed-lifecycle";
    const log: SeedLog[] = [];

    const completed = await ctx.db
      .query("migrations")
      .withIndex("by_key", (q) => q.eq("key", SEED_MIGRATION_KEY))
      .unique();
    if (completed && !args.force) {
      return {
        seeded: false,
        reason: `${SEED_MIGRATION_KEY} already ran. Pass { force: true } to wipe and re-seed.`,
        log,
      };
    }

    if (args.force) {
      await clearLifecycleData(ctx);
      log.push({ step: "reset", detail: "Lifecycle workspace cleared." });
    }

    /* ---------- 1. Auth & users ---------- */
    const accountByRole = new Map<RoleKey, DemoAccount>(DEMO_ACCOUNTS.map((a) => [a.role, a]));
    const owner = accountByRole.get("owner")!;
    const ownerAuth = await ensureBetterAuthUser(ctx, owner);
    log.push({
      step: "auth:owner",
      detail: `${owner.email} (${ownerAuth.created ? "created" : "relinked"})`,
    });
    for (const account of DEMO_ACCOUNTS) {
      const auth = await ensureBetterAuthUser(ctx, account);
      const profileId = await ensureAppProfile(ctx, account, auth.authUserId);
      await ensureStaffDirectory(ctx, account, auth.authUserId);
      log.push({
        step: "auth:user",
        detail: `${account.role} → ${account.email} (${auth.created ? "created" : "relinked"}, profile ${profileId})`,
      });
    }
    // Owner bootstrap fix-up (settings + company ownership).
    const ownerAppProfile = (await ctx.db.query("users").collect()).find(
      (u) => u.role === "owner",
    );
    if (!ownerAppProfile) throw new Error("Owner application profile missing after seed step 1.");

    /* ---------- 2. System setup ---------- */
    await ctx.db.insert("companySettings", {
      key: WORKSPACE_KEY,
      companyName: "YT Advertisement",
      industry: "ማስታወቂያ እና ማተሚያ",
      address: "ጀሞ · ካፍደም ህንጻ",
      phone: "0951082102",
      ownerAuthUserId: ownerAppProfile.authUserId,
      timezone: "Africa/Addis_Ababa",
      dailyReportEnabled: true,
      monthlyAuditEnabled: true,
      active: true,
    });
    log.push({ step: "system:settings", detail: `companySettings(${WORKSPACE_KEY}) inserted.` });

    await ctx.db.insert("systemConfigs", {
      key: SYSTEM_CONFIG_KEY,
      etbPerSquareMetre: 220,
      etbPerLitre: 950,
      etbPerPiece: 35,
      etbPerMetre: 180,
      etbPerSheet: 360,
      unitConversionDefaults: [],
      materialOverrides: [],
      inkMlPerSquareMetre: 12,
      maxAllowedWastePercent: 12,
      minOffcutAreaSquareMetre: 0.25,
      requireAdminPinForExceptions: false,
      maxDirectStockOutEtb: 5000,
      orderExpirationHours: 72,
      updatedAt: Date.now(),
      updatedBy: ownerAppProfile.authUserId,
    });
    log.push({ step: "system:configs", detail: `systemConfigs(${SYSTEM_CONFIG_KEY}) inserted.` });

    const machineIds: Record<string, Id<"machines">> = {};
    for (const machine of DEMO_MACHINES) {
      machineIds[machine.code] = await ctx.db.insert("machines", { ...machine, active: true });
      log.push({ step: "machine", detail: `${machine.code} · ${machine.name} (${machine.operatorRole})` });
    }

    const materialIds: Record<string, Id<"materials">> = {};
    for (const material of DEMO_MATERIALS) {
      materialIds[material.name] = await ctx.db.insert("materials", {
        name: material.name,
        category: material.category,
        unit: material.baseUnit,
        baseUnit: material.baseUnit,
        purchaseUnit: material.purchaseUnit,
        conversionRatio: material.conversionRatio,
        rollEquivalent:
          material.purchaseUnit === "roll" ? material.conversionRatio : undefined,
        sheetEquivalent:
          material.purchaseUnit === "sheet" ? material.conversionRatio : undefined,
        displayUnit: material.displayUnit,
        specification: material.specification,
        specificationValue: material.specificationValue,
        specificationOptions: material.specificationOptions
          ? [...material.specificationOptions]
          : undefined,
        storageLocation: material.storageLocation,
        averageUse: material.averageUse,
        rollWidth: material.rollWidth,
        sheetWidth: material.sheetWidth,
        sheetLength: material.sheetLength,
        quantity: 0,
        reorderAt: material.reorderAt,
        accent: material.accent,
        active: true,
      });
      log.push({ step: "material", detail: `${material.name} (${material.baseUnit})` });
    }

    /* ---------- 3. Procurement (parentInventory + STOCK_IN) ---------- */
    interface ProcurementPlan {
      materialName: string;
      packages: number;
    }
    const procurement: readonly ProcurementPlan[] = [
      { materialName: "Banner", packages: 3 },   // 3 rolls = 480 m²
      { materialName: "Acrylic", packages: 12 }, // 12 sheets = ~35.7 m²
      { materialName: "Foam", packages: 10 },    // 10 sheets = ~29.8 m²
      { materialName: "Banner Ink", packages: 12 }, // 12 litres = 12 L
    ];

    const parentIds: Record<string, Id<"parentInventory">> = {};
    for (const plan of procurement) {
      const material = DEMO_MATERIALS.find((m) => m.name === plan.materialName);
      const materialId = materialIds[plan.materialName];
      if (!material || !material.purchaseUnit || !material.conversionRatio) continue;
      const unitType =
        material.purchaseUnit === "roll"
          ? "ROLL"
          : material.purchaseUnit === "sheet"
            ? "SHEET"
            : material.purchaseUnit === "liter"
              ? "LITER"
              : null;
      if (!unitType) continue;

      const parentId = await ctx.db.insert("parentInventory", {
        materialId,
        unitType,
        totalStockQuantity: 0,
        lengthPerRoll: unitType === "ROLL" ? material.conversionRatio : undefined,
        areaPerSheet: unitType === "SHEET" ? material.conversionRatio : undefined,
        volumePerContainer: unitType === "LITER" ? material.conversionRatio : undefined,
        updatedAt: Date.now(),
      });
      parentIds[plan.materialName] = parentId;

      const baseQuantity = qty(plan.packages * material.conversionRatio);
      await recordInventoryEvent(ctx, {
        materialId,
        eventType: "STOCK_IN",
        custody: "parent",
        balanceEffect: "in",
        quantity: plan.packages,
        unit: material.purchaseUnit,
        baseUnit: material.baseUnit,
        baseQuantity,
        packageQuantity: plan.packages,
        packageUnit: unitType,
        conversionRatio: material.conversionRatio,
        parentInventoryId: parentId,
        note: `Procurement opening stock (${plan.materialName})`,
        createdBy,
      });
      log.push({
        step: "procurement",
        detail: `${plan.materialName}: ${plan.packages} ${material.purchaseUnit}(s) = ${baseQuantity} ${material.baseUnit}`,
      });
    }

    /* ---------- 4. Floor issuance (operatorSubStock + STORE_TO_OPERATOR_TRANSFER) ---------- */
    interface OperatorAssignment {
      machineCode: string;
      operatorRole: RoleKey;
      materialName: string;
      packages: number;
      clearanceStage: "ACTIVE" | "PENDING_CLEARANCE" | "CLEARED";
      consumeQuantity: number;
      offcutQuantity: number;
      scrapQuantity: number;
    }

    const operatorIds: Record<RoleKey, string> = {
      owner: ownerAppProfile.authUserId,
      manager: "",
      admin: "",
      storekeeper: "",
      receptionist: "",
      laser_operator: "",
      cnc_operator: "",
      printer_operator: "",
    };
    for (const role of Object.keys(operatorIds) as RoleKey[]) {
      if (operatorIds[role]) continue;
      const profile = (await ctx.db.query("users").collect()).find((u) => u.role === role);
      if (!profile) throw new Error(`Missing operator profile for role ${role} after step 1.`);
      operatorIds[role] = profile.authUserId;
    }

    const assignments: readonly OperatorAssignment[] = [
      {
        machineCode: "LAS-01",
        operatorRole: "laser_operator",
        materialName: "Acrylic",
        packages: 4,            // 4 sheets = ~11.9 m² issued to laser
        clearanceStage: "ACTIVE",
        consumeQuantity: 4.5,    // partial consumption to leave remainder
        offcutQuantity: 0.4,
        scrapQuantity: 0.2,
      },
      {
        machineCode: "CNC-01",
        operatorRole: "cnc_operator",
        materialName: "Foam",
        packages: 3,            // 3 sheets = ~8.93 m² issued to cnc
        clearanceStage: "PENDING_CLEARANCE",
        consumeQuantity: 6.2,
        offcutQuantity: 0.3,
        scrapQuantity: 0.5,
      },
      {
        machineCode: "BAN-01",
        operatorRole: "printer_operator",
        materialName: "Banner",
        packages: 1,            // 1 roll = 160 m² issued to printer
        clearanceStage: "CLEARED",
        consumeQuantity: 86.4,   // banner job consumption
        offcutQuantity: 1.6,
        scrapQuantity: 0.8,
      },
    ];

    const operatorBatchIds: Record<string, Id<"operatorSubStock">> = {};
    // Key under which the banner printer's ACTIVE ink sub-stock is tracked.
    const INK_STOCK_KEY = "printer_operator_ink";
    const assignmentByRole = new Map<RoleKey, OperatorAssignment>(
      assignments.map((a) => [a.operatorRole, a]),
    );
    for (const assignment of assignments) {
      const material = DEMO_MATERIALS.find((m) => m.name === assignment.materialName)!;
      const materialId = materialIds[assignment.materialName];
      const parentId = parentIds[assignment.materialName];
      const operatorAuthId = operatorIds[assignment.operatorRole];
      const issuedBase = qty(assignment.packages * (material.conversionRatio ?? 1));
      const subStockId = await ctx.db.insert("operatorSubStock", {
        parentInventoryId: parentId,
        materialId,
        operatorId: operatorAuthId,
        machineId: machineIds[assignment.machineCode],
        issuedUnits: assignment.packages,
        issuedQuantity: issuedBase,
        currentRemaining: issuedBase,
        status: "ACTIVE",
        issuedBy: operatorIds.storekeeper,
        issuedAt: Date.now(),
        updatedAt: Date.now(),
      });
      operatorBatchIds[assignment.operatorRole] = subStockId;
      await recordInventoryEvent(ctx, {
        materialId,
        eventType: "STORE_TO_OPERATOR_TRANSFER",
        custody: "parent",
        balanceEffect: "transfer",
        quantity: assignment.packages,
        unit: material.purchaseUnit ?? material.baseUnit,
        baseUnit: material.baseUnit,
        baseQuantity: issuedBase,
        packageQuantity: assignment.packages,
        packageUnit:
          material.purchaseUnit === "roll"
            ? "ROLL"
            : material.purchaseUnit === "sheet"
              ? "SHEET"
              : material.purchaseUnit === "liter"
                ? "LITER"
                : undefined,
        conversionRatio: material.conversionRatio,
        parentInventoryId: parentId,
        operatorSubStockId: subStockId,
        operatorId: operatorAuthId,
        machineId: machineIds[assignment.machineCode],
        note: `Store-to-operator transfer (${assignment.materialName} → ${assignment.operatorRole})`,
        createdBy,
      });
      log.push({
        step: "issuance",
        detail: `${assignment.machineCode} ${assignment.operatorRole}: ${assignment.packages} ${material.purchaseUnit} = ${issuedBase} ${material.baseUnit}`,
      });
    }

    // Ink floor issuance — the banner printer also holds an ACTIVE ink batch so
    // the demo exhibits the ink leg of `logProductionAndDeductStock`
    // (printedArea × systemConfigs.inkMlPerSquareMetre). Distinct `operatorRole`
    // keys would collide, so the ink batch is tracked under its own key and kept
    // ACTIVE (ink remains in use while the banner substrate cycle was cleared).
    {
      const inkMaterialName = "Banner Ink";
      const inkMaterial = DEMO_MATERIALS.find((m) => m.name === inkMaterialName)!;
      const inkMaterialId = materialIds[inkMaterialName];
      const inkParentId = parentIds[inkMaterialName];
      const inkOperatorAuthId = operatorIds.printer_operator;
      const printerMachineId = machineIds["BAN-01"];
      const inkLitres = 5;

      const inkStockId = await ctx.db.insert("operatorSubStock", {
        parentInventoryId: inkParentId,
        materialId: inkMaterialId,
        operatorId: inkOperatorAuthId,
        machineId: printerMachineId,
        issuedUnits: inkLitres,
        issuedQuantity: inkLitres,
        currentRemaining: inkLitres,
        status: "ACTIVE",
        issuedBy: operatorIds.storekeeper,
        issuedAt: Date.now(),
        updatedAt: Date.now(),
      });
      operatorBatchIds[INK_STOCK_KEY] = inkStockId;

      await recordInventoryEvent(ctx, {
        materialId: inkMaterialId,
        eventType: "STORE_TO_OPERATOR_TRANSFER",
        custody: "parent",
        balanceEffect: "transfer",
        quantity: inkLitres,
        unit: "liter",
        baseUnit: "L",
        baseQuantity: inkLitres,
        packageQuantity: inkLitres,
        packageUnit: "LITER",
        conversionRatio: 1,
        parentInventoryId: inkParentId,
        operatorSubStockId: inkStockId,
        operatorId: inkOperatorAuthId,
        machineId: printerMachineId,
        note: `Store-to-operator transfer (${inkMaterialName} → printer_operator)`,
        createdBy,
      });
      log.push({
        step: "issuance:ink",
        detail: `BAN-01 printer_operator: 5 L Banner Ink issued to floor (ACTIVE)`,
      });
    }

    /* ---------- 5. Orders ---------- */
    interface CustomerOrderSpec {
      code: string;
      clientName: string;
      phone: string;
      serviceType:
        | "banner_print"
        | "sticker_white"
        | "uv_print_foam"
        | "uv_print_mica"
        | "light_box_a1";
      dimensions: string;
      quantity: string;
      amount: number;
      paymentStatus: "UNPAID" | "PAID" | "APPROVED_CREDIT";
      tinNumber?: string;
      companyLegalName?: string;
      priority: "High" | "Medium" | "Low";
      dueOffsetDays: number;
      operatorRole: RoleKey;
      machineCode: string;
      materialName: string;
    }

    const orders: readonly CustomerOrderSpec[] = [
      {
        code: "CO-1001",
        clientName: "Abyssinia Bank",
        phone: "+251911223344",
        serviceType: "banner_print",
        dimensions: "320cm × 270cm",
        quantity: "1",
        amount: 12500,
        paymentStatus: "PAID",
        tinNumber: "0012345678",
        companyLegalName: "Abyssinia Bank S.C.",
        priority: "High",
        dueOffsetDays: 0,
        operatorRole: "printer_operator",
        machineCode: "BAN-01",
        materialName: "Banner",
      },
      {
        code: "CO-1002",
        clientName: "Bole Medical Center",
        phone: "+251922334455",
        serviceType: "uv_print_mica",
        dimensions: "122cm × 244cm",
        quantity: "2",
        amount: 7800,
        paymentStatus: "PAID",
        priority: "Medium",
        dueOffsetDays: 1,
        operatorRole: "cnc_operator",
        machineCode: "CNC-01",
        materialName: "Foam",
      },
      {
        code: "CO-1003",
        clientName: "Hibret Insurance",
        phone: "+251933445566",
        serviceType: "light_box_a1",
        dimensions: "60cm × 85cm",
        quantity: "4",
        amount: 9600,
        paymentStatus: "UNPAID",
        priority: "Low",
        dueOffsetDays: 2,
        operatorRole: "laser_operator",
        machineCode: "LAS-01",
        materialName: "Acrylic",
      },
    ];

    const orderIds: Record<string, Id<"customerOrders">> = {};
    for (const order of orders) {
      const orderId = await ctx.db.insert("customerOrders", {
        code: order.code,
        clientName: order.clientName,
        phone: order.phone,
        serviceType: order.serviceType,
        dimensions: order.dimensions,
        quantity: order.quantity,
        amount: order.amount,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentStatus === "PAID" ? "Bank transfer" : undefined,
        paymentConfirmedAt: order.paymentStatus === "PAID" ? Date.now() : undefined,
        paymentConfirmedBy: order.paymentStatus === "PAID" ? ownerAppProfile.authUserId : undefined,
        preferredDueDate: Date.now() + order.dueOffsetDays * 24 * 60 * 60 * 1000,
        status:
          order.paymentStatus === "PAID"
            ? "CONFIRMED_PAID_OR_CREDIT"
            : "PENDING_REVIEW",
        priority: order.priority,
        source: "walk_in",
        notes: undefined,
        tinNumber: order.tinNumber,
        companyLegalName: order.companyLegalName,
        machineId: machineIds[order.machineCode],
        createdBy: operatorIds.receptionist,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      orderIds[order.code] = orderId;

      log.push({
        step: "order",
        detail: `${order.code} ${order.clientName} (${order.amount} ETB, ${order.priority})`,
      });
    }

    /* ---------- 6. Production & floor consumption ---------- */
    interface JobSpec {
      code: string;
      client: string;
      title: string;
      machineCode: string;
      materialName: string;
      quantity: number;
      status: "Queued" | "In production" | "Completed" | "Paused";
      priority: "High" | "Medium" | "Low";
      dueOffsetHours: number;
      operatorRole: RoleKey;
      consumeQuantity: number;
      offcutQuantity: number;
      scrapQuantity: number;
      orderCode: string;
    }

    const jobs: readonly JobSpec[] = [
      {
        code: "JC-0420",
        client: "Abyssinia Bank",
        title: "Branch fascia banners",
        machineCode: "BAN-01",
        materialName: "Banner",
        quantity: 86.4,
        status: "In production",
        priority: "High",
        dueOffsetHours: 8,
        operatorRole: "printer_operator",
        consumeQuantity: 86.4,
        offcutQuantity: 1.6,
        scrapQuantity: 0.8,
        orderCode: "CO-1001",
      },
      {
        code: "JC-0421",
        client: "Bole Medical Center",
        title: "Reception desk logo",
        machineCode: "CNC-01",
        materialName: "Foam",
        quantity: 6.2,
        status: "In production",
        priority: "Medium",
        dueOffsetHours: 26,
        operatorRole: "cnc_operator",
        consumeQuantity: 6.2,
        offcutQuantity: 0.3,
        scrapQuantity: 0.5,
        orderCode: "CO-1002",
      },
      {
        code: "JC-0422",
        client: "Hibret Insurance",
        title: "Lightbox face panels",
        machineCode: "LAS-01",
        materialName: "Acrylic",
        quantity: 4.5,
        status: "In production",
        priority: "Low",
        dueOffsetHours: 50,
        operatorRole: "laser_operator",
        consumeQuantity: 4.5,
        offcutQuantity: 0.4,
        scrapQuantity: 0.2,
        orderCode: "CO-1003",
      },
    ];

    const jobIds: Record<string, Id<"jobCards">> = {};
    for (const job of jobs) {
      const material = DEMO_MATERIALS.find((m) => m.name === job.materialName)!;
      const assignment = assignmentByRole.get(job.operatorRole);
      if (!assignment) throw new Error(`No operator assignment for job ${job.code}`);
      const jobId = await ctx.db.insert("jobCards", {
        code: job.code,
        client: job.client,
        title: job.title,
        machineId: machineIds[job.machineCode],
        materialId: materialIds[job.materialName],
        quantity: job.quantity,
        unit: material.baseUnit,
        status: job.status,
        due: new Date(Date.now() + job.dueOffsetHours * 60 * 60 * 1000).toISOString(),
        priority: job.priority,
        createdBy: operatorIds[job.operatorRole],
        createdAt: Date.now(),
        orderId: orderIds[job.orderCode],
        length: undefined,
        width: undefined,
        deductOnComplete: true,
      });
      jobIds[job.code] = jobId;
      // Patch the order to reference the job card.
      await ctx.db.patch(orderIds[job.orderCode], { jobCardId: jobId });
      // Update machine.activeJob so the dashboard reflects activity.
      await ctx.db.patch(machineIds[job.machineCode], { activeJob: job.code });

      // Production log + PRODUCTION_CONSUMPTION ledger event.
      const subStockId = operatorBatchIds[job.operatorRole];
      await ctx.db.insert("productionLogs", {
        jobCardId: jobId,
        machineId: machineIds[job.machineCode],
        inputQuantity: qty(job.consumeQuantity + job.offcutQuantity + job.scrapQuantity),
        outputQuantity: qty(job.consumeQuantity),
        wasteQuantity: qty(job.offcutQuantity + job.scrapQuantity),
        unit: material.baseUnit,
        operatorId: operatorIds[job.operatorRole],
        createdAt: Date.now(),
      });
      await recordInventoryEvent(ctx, {
        materialId: materialIds[job.materialName],
        eventType: "PRODUCTION_CONSUMPTION",
        custody: "operator",
        balanceEffect: "out",
        quantity: job.consumeQuantity,
        unit: material.baseUnit,
        baseUnit: material.baseUnit,
        baseQuantity: job.consumeQuantity,
        operatorSubStockId: subStockId,
        operatorId: operatorIds[job.operatorRole],
        machineId: machineIds[job.machineCode],
        jobCardId: jobId,
        note: `Production consumption (${job.code})`,
        createdBy: operatorIds[job.operatorRole],
      });

      // Ink consumption for print jobs: printedArea × systemConfigs.inkMlPerSquareMetre.
      // The substrate above is Banner; the printer's ACTIVE ink batch is the one
      // created under INK_STOCK_KEY and the 12 mL/m² rate mirrors the seeded
      // `systemConfigs` so the demo matches `logProductionAndDeductStock`.
      if (job.operatorRole === "printer_operator") {
        const inkStockId = operatorBatchIds[INK_STOCK_KEY];
        const inkMaterialId = materialIds["Banner Ink"];
        const inkMlPerSquareMetre = 12;
        const inkMl = qty(job.consumeQuantity * inkMlPerSquareMetre);
        const inkLitre = qty(inkMl / 1000);
        if (inkStockId && inkLitre > 0) {
          await recordInventoryEvent(ctx, {
            materialId: inkMaterialId,
            eventType: "PRODUCTION_CONSUMPTION",
            custody: "operator",
            balanceEffect: "out",
            quantity: inkLitre,
            unit: "L",
            baseUnit: "L",
            baseQuantity: inkLitre,
            operatorSubStockId: inkStockId,
            operatorId: operatorIds[job.operatorRole],
            machineId: machineIds[job.machineCode],
            jobCardId: jobId,
            note: `Ink consumption (${job.code})`,
            createdBy: operatorIds[job.operatorRole],
          });
          log.push({
            step: "production:ink",
            detail: `${job.code}: -${inkLitre} L Banner Ink (${inkMl} mL @ ${inkMlPerSquareMetre} mL/m²)`,
          });
        }
      }

      if (job.offcutQuantity > 0) {
        const offcutId = await ctx.db.insert("offcuts", {
          materialId: materialIds[job.materialName],
          label: `${job.materialName} offcut ${job.code}`,
          width: 1,
          length: qty(job.offcutQuantity),
          area: qty(job.offcutQuantity),
          location: `Rack ${machineIds[job.machineCode] ? "A" : "B"} · ${job.code}`,
          usable: true,
          status: "available",
          createdBy: operatorIds[job.operatorRole],
          createdAt: new Date().toISOString(),
          jobCardId: jobId,
          operatorSubStockId: subStockId,
          operatorId: operatorIds[job.operatorRole],
          machineId: machineIds[job.machineCode],
          source: "job_auto",
        });
        await recordInventoryEvent(ctx, {
          materialId: materialIds[job.materialName],
          eventType: "OFFCUT_RETURN",
          custody: "operator",
          balanceEffect: "none",
          quantity: job.offcutQuantity,
          unit: material.baseUnit,
          baseUnit: material.baseUnit,
          baseQuantity: job.offcutQuantity,
          operatorSubStockId: subStockId,
          operatorId: operatorIds[job.operatorRole],
          machineId: machineIds[job.machineCode],
          jobCardId: jobId,
          offcutId,
          note: `Offcut registered (${job.code})`,
          createdBy: operatorIds[job.operatorRole],
        });
      }
      if (job.scrapQuantity > 0) {
        const scrapId = await ctx.db.insert("scraps", {
          materialId: materialIds[job.materialName],
          label: `${job.materialName} scrap ${job.code}`,
          quantity: job.scrapQuantity,
          unit: material.baseUnit,
          reason: "Trim & print loss",
          createdBy: operatorIds[job.operatorRole],
          createdAt: new Date().toISOString(),
          operatorSubStockId: subStockId,
          operatorId: operatorIds[job.operatorRole],
          machineId: machineIds[job.machineCode],
        });
        await recordInventoryEvent(ctx, {
          materialId: materialIds[job.materialName],
          eventType: "SCRAP_LOG",
          custody: "operator",
          balanceEffect: "out",
          quantity: job.scrapQuantity,
          unit: material.baseUnit,
          baseUnit: material.baseUnit,
          baseQuantity: job.scrapQuantity,
          operatorSubStockId: subStockId,
          operatorId: operatorIds[job.operatorRole],
          machineId: machineIds[job.machineCode],
          jobCardId: jobId,
          note: `Scrap logged (${job.code})`,
          createdBy: operatorIds[job.operatorRole],
        });
      }
      log.push({
        step: "production",
        detail: `${job.code} ${job.client}: -${job.consumeQuantity} ${material.baseUnit} on ${assignment.machineCode}`,
      });
    }

    /* ---------- 7. Clearance workflow ---------- */
    // The reconciliation summary + audit reads expect operator batches to land
    // in the right state. Drive that deterministically here.
    for (const assignment of assignments) {
      const subStockId = operatorBatchIds[assignment.operatorRole];
      const subStock = await ctx.db.get(subStockId);
      if (!subStock) continue;
      const material = DEMO_MATERIALS.find((m) => m.name === assignment.materialName)!;
      const issuedQuantity = subStock.issuedQuantity;
      const remaining = subStock.currentRemaining;
      const consumed = qty(Math.max(0, issuedQuantity - remaining));
      const physicalActual = remaining;
      const discrepancy = qty(physicalActual - (issuedQuantity - consumed));

      // Material-level reconciliation (centred on the parent store) — `Open`
      // for ACTIVE & PENDING_CLEARANCE, `Resolved` for CLEARED so the owner
      // history section is populated.
      const materialReconStatus =
        assignment.clearanceStage === "CLEARED" ? "Resolved" : "Open";
      await ctx.db.insert("reconciliations", {
        materialId: materialIds[assignment.materialName],
        status: materialReconStatus,
        systemQuantity: qty(consumed),
        countedQuantity: qty(consumed),
        variance: 0,
        countedBy: operatorIds[assignment.operatorRole],
        reviewedBy:
          materialReconStatus === "Resolved" ? ownerAppProfile.authUserId : undefined,
        note: `Auto reconciliation for ${assignment.operatorRole} cycle`,
        createdAt: Date.now() - 24 * 60 * 60 * 1000,
        reviewedAt:
          materialReconStatus === "Resolved" ? Date.now() : undefined,
      });

      // Per-operator weekly reconciliation (audit row).
      const weeklyId = await ctx.db.insert("weeklyReconciliations", {
        machineId: machineIds[assignment.machineCode],
        operatorId: operatorIds[assignment.operatorRole],
        operatorSubStockId: subStockId,
        systemCalculatedRemaining: qty(issuedQuantity - consumed),
        physicalActualRemaining: physicalActual,
        discrepancy,
        unit: material.baseUnit,
        reconciledBy: operatorIds[assignment.operatorRole],
        reconciledAt: Date.now() - 24 * 60 * 60 * 1000,
        notes: `Weekly reconciliation for ${assignment.operatorRole}`,
      });

      // Transition the operator sub-stock through its clearance state.
      if (assignment.clearanceStage === "CLEARED") {
        await ctx.db.patch(subStockId, {
          status: "CLEARED",
          clearedBy: ownerAppProfile.authUserId,
          clearedAt: Date.now(),
          clearanceNote: `Demo clearance approved for ${assignment.operatorRole}`,
          updatedAt: Date.now(),
        });
        log.push({
          step: "clearance",
          detail: `${assignment.operatorRole}: CLEARED (owner approved)`,
        });
      } else if (assignment.clearanceStage === "PENDING_CLEARANCE") {
        await ctx.db.patch(subStockId, {
          status: "PENDING_CLEARANCE",
          clearanceNote: `Pending owner review for ${assignment.operatorRole}`,
          updatedAt: Date.now(),
        });
        log.push({
          step: "clearance",
          detail: `${assignment.operatorRole}: PENDING_CLEARANCE (awaiting owner)`,
        });
      } else {
        await ctx.db.patch(subStockId, { status: "ACTIVE", updatedAt: Date.now() });
        log.push({ step: "clearance", detail: `${assignment.operatorRole}: ACTIVE` });
      }
      // `weeklyId` is referenced by the audit log; suppress unused warnings.
      void weeklyId;
    }

    /* ---------- 8. Clearance-gated material requests ---------- */
    // Only operators whose prior cycle is CLEARED may issue a new
    // materialRequest — this mirrors the runtime check in
    // `convex/materialRequests.ts → create` so the seed matches the gate.
    for (const assignment of assignments) {
      if (assignment.clearanceStage !== "CLEARED") continue;
      const material = DEMO_MATERIALS.find((m) => m.name === assignment.materialName)!;
      const assignmentJobs = jobs.filter((j) => j.operatorRole === assignment.operatorRole);
      const job = assignmentJobs[0];
      if (!job) continue;
      const jobId = jobIds[job.code];
      const requested = qty(material.conversionRatio ? material.conversionRatio : 20);
      const reqId = await ctx.db.insert("materialRequests", {
        jobCardId: jobId,
        materialId: materialIds[assignment.materialName],
        requestedQuantity: requested,
        issuedQuantity: 0,
        unit: material.baseUnit,
        status: "Requested",
        requestedBy: operatorIds[assignment.operatorRole],
        requestedAt: Date.now(),
        note: `Re-stocking after clearance (${assignment.operatorRole})`,
      });
      log.push({
        step: "restock",
        detail: `${assignment.operatorRole}: ${requested} ${material.baseUnit} for ${job.code}`,
      });
      void reqId;
    }

    /* ---------- 9. Migration marker ---------- */
    await ctx.db.insert("migrations", { key: SEED_MIGRATION_KEY, ranAt: Date.now() });

    /* Normalize any legacy order-status casing so the demo data is canonical. */
    await ctx.runMutation(internal.migrations.normalizeOrderStatusCasing, {});

    return {
      seeded: true,
      migration: SEED_MIGRATION_KEY,
      operatorAccounts: assignments.map((a) => ({
        role: a.operatorRole,
        machineCode: a.machineCode,
        clearanceStage: a.clearanceStage,
      })),
      counts: {
        machines: DEMO_MACHINES.length,
        materials: DEMO_MATERIALS.length,
        operators: assignments.length,
        inkBatches: operatorBatchIds[INK_STOCK_KEY] ? 1 : 0,
        orders: orders.length,
        jobs: jobs.length,
      },
      log,
    };
  },
});
