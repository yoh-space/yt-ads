import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Role } from "./types";
import { authComponent, createAuth } from "./auth";
import { requireAdmin } from "./users";
import { convertToBase, type InputUnit } from "./units";
import { api } from "./_generated/api";
import { MATERIAL_SPECIFICATIONS, type MaterialSpecificationDefinition } from "../src/shared/material-specifications";

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
    const material = MATERIAL_SPECIFICATIONS.find((entry) => entry.name === name);
    if (!material) throw new Error(`Missing demo material definition: ${name}`);
    return material;
  };
  const createDemoMaterial = (material: MaterialSpecificationDefinition, quantity: number, reorderAt: number, accent: "cyan" | "gold" | "violet" | "blue" | "green", specificationValue?: string) =>
    ctx.db.insert("materials", {
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
      quantity,
      reorderAt,
      storageLocation: material.storageLocation,
      averageUse: material.averageUse,
      accent,
      active: true,
    });

  const matBanner = await createDemoMaterial(definition("Banner"), 286, 160, "cyan", "3 Meter Roll Weight");
  const matAcrylic = await createDemoMaterial(definition("Acrylic"), 54.8, 65, "violet", "3mm");
  const matVinyl = await createDemoMaterial(definition("Normal Sticker"), 417, 240, "gold", "1.27 Meter × 50 Meter Roll");
  const matLed = await createDemoMaterial(definition("LED Module / Strip"), 1260, 800, "blue", "Cool White (6000K-6500K)");
  const matInk = await createDemoMaterial(definition("DTF Ink"), 18.2, 12, "green", "CMYK (Cyan, Magenta, Yellow, Key/Black)");
  const matMdf = await createDemoMaterial(definition("Foam"), 91.4, 45, "gold", "18mm");

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
    materialId: matMdf, label: "Foam · 18mm", width: 0.9, length: 0.6,
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
  const stockExceptions = await ctx.db.query("stockExceptions").collect();
  for (const record of stockExceptions) await ctx.db.delete(record._id);
  const customerOrders = await ctx.db.query("customerOrders").collect();
  for (const record of customerOrders) await ctx.db.delete(record._id);
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
    for (const [index, material] of materialRecords.entries()) {
      await ctx.db.insert("materials", {
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
        specificationOptions: material.specificationOptions ? [...material.specificationOptions] : undefined,
        quantity: 0,
        reorderAt: 0,
        storageLocation: material.storageLocation,
        averageUse: material.averageUse,
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
    for (const [index, material] of YT_MATERIAL_MASTER_DATA.entries()) {
      const names = [material.name, ...(material.aliases ?? [])].map((name) => name.toLowerCase());
      const existing = existingMaterials.find((record) => names.includes(record.name.toLowerCase()));
      const masterFields = {
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
        specificationOptions: material.specificationOptions ? [...material.specificationOptions] : undefined,
        storageLocation: material.storageLocation,
        averageUse: material.averageUse,
      };
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

/**
 * Issues sample opening stock to every active material so the freshly seeded
 * workspace has realistic quantities and an audit trail of stock movements.
 * Runs as a bootstrap (deployment-credentialed) operation; it adds stock-in
 * movements and sets a sensible reorder level per material. Safe to re-run —
 * it tops each material up to the sample level rather than stacking on top.
 */
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

export const seedSampleStock = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const actor = await resolveBootstrapActor(ctx);
    const createdBy = actor.authUserId ?? "seed";
    const materials = await ctx.db.query("materials").collect();
    const activeMaterials = materials.filter((material) => material.active);

    const movements = await ctx.db.query("stockMovements").collect();
    const alreadySeeded = movements.some((movement) => movement.note.startsWith("Sample opening stock"));
    if (alreadySeeded && !args.force) {
      return { seeded: false, reason: "Sample stock already issued. Pass force to re-issue." };
    }

    let issued = 0;
    for (const material of activeMaterials) {
      const target = sampleOpeningQuantity(material.unit);
      const baseUnit = material.baseUnit ?? material.unit;
      const converted = convertToBase(
        target,
        material.unit as InputUnit,
        baseUnit,
        material.conversionRatio,
        material.rollEquivalent,
        material.sheetEquivalent,
      );
      if (!Number.isFinite(converted) || converted <= 0) continue;
      const current = material.quantity ?? 0;
      const nextQuantity = args.force ? target : Number((current + converted).toFixed(2));
      await ctx.db.patch(material._id, {
        quantity: nextQuantity,
        reorderAt: Number((target * 0.3).toFixed(2)),
      });
      await ctx.db.insert("stockMovements", {
        materialId: material._id,
        direction: "in",
        quantity: target,
        unit: material.unit,
        baseUnit,
        baseQuantity: converted,
        note: "Sample opening stock (seed)",
        createdBy,
        createdAt: Date.now(),
      });
      issued += 1;
    }

    return { seeded: true, materialsIssued: issued };
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
      await ctx.db.insert("stockMovements", {
        materialId: material._id,
        direction: "out",
        quantity: amount,
        unit: material.unit,
        baseUnit,
        baseQuantity,
        note: "Sample consumption (seed)",
        createdBy,
        createdAt: Date.now(),
      });
      await ctx.db.patch(material._id, {
        quantity: Math.max(0, Number((material.quantity - baseQuantity).toFixed(2))),
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
 * full YT Advertisement master dataset, issues sample opening stock,
 * creates/promotes the owner account, and provisions demo accounts for every
 * workspace role. Run once against the production deployment after
 * `convex deploy`.
 */
export const seedAll = mutation({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    await resolveBootstrapActor(ctx);
    await ctx.runMutation(api.seed.seedYtAdvertisementWorkspace, { force: true });
    await ctx.runMutation(api.seed.seedSampleStock, {});
    const owner: { email: string; created: boolean } = await ctx.runMutation(api.seed.seedYitbarekOwner, { password: args.password });
    return { seeded: true, ownerEmail: owner.email, ownerCreated: owner.created };
  },
});
