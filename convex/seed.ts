import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
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

/**
 * Seeds the captured YT Advertisement master data for a fresh database.
 *
 * This intentionally does not create jobs, production logs, stock movements,
 * requests, scrap, or offcuts because the workspace capture did not provide
 * real historical activity. It also refuses to mix with an existing database;
 * take a backup and run a reviewed migration before replacing demo data.
 */
export const seedYtAdvertisementWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const actor = await requireAdmin(ctx);
    const existingSettings = await ctx.db
      .query("companySettings")
      .withIndex("by_key", (q) => q.eq("key", YT_WORKSPACE_KEY))
      .unique();
    if (existingSettings) return { seeded: false, reason: "YT Advertisement workspace is already seeded." };

    const [materials, machines, jobs, productionLogs, stockMovements, offcuts, scraps] = await Promise.all([
      ctx.db.query("materials").collect(),
      ctx.db.query("machines").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("productionLogs").collect(),
      ctx.db.query("stockMovements").collect(),
      ctx.db.query("offcuts").collect(),
      ctx.db.query("scraps").collect(),
    ]);
    if (materials.length || machines.length || jobs.length || productionLogs.length || stockMovements.length || offcuts.length || scraps.length) {
      return {
        seeded: false,
        reason: "Existing operational data detected. Back up and review a migration before replacing it.",
      };
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

    const machineRecords = [
      { name: "Banner Printer", code: "BAN-01", type: "Banner Printer", operatorRole: "printer_operator" as const, materialUnit: "m²" as const, displayUnit: "m²", status: "Available" as const },
      { name: "DTF", code: "DTF-01", type: "DTF", manufacturer: "Crystal", capability: "0.6m", operatorRole: "printer_operator" as const, materialUnit: "m²" as const, displayUnit: "ሮል", status: "Available" as const },
      { name: "Print and Cut", code: "PAC-01", type: "Print and Cut", manufacturer: "Crystal", operatorRole: "plotter_operator" as const, materialUnit: "m²" as const, displayUnit: "ሮል", status: "Available" as const },
      { name: "CNC Router", code: "CNC-01", type: "CNC Router", operatorRole: "cnc_operator" as const, materialUnit: "m²" as const, displayUnit: "m²", status: "Available" as const },
      { name: "Laser Cutter 1325", code: "LAS-01", type: "Laser Cutter 1325", manufacturer: "Crystal", capability: "1.20 × 2.44m", operatorRole: "laser_operator" as const, materialUnit: "m²" as const, displayUnit: "m²", status: "Available" as const },
      { name: "Heat press", code: "HPR-01", type: "Heat press", operatorRole: "printer_operator" as const, materialUnit: "piece" as const, displayUnit: "ቁጥር", status: "Available" as const, notes: "ማተም ለልብስ እና ለመሳሰሉት" },
      { name: "Conca", code: "CON-01", type: "Conca", operatorRole: "printer_operator" as const, materialUnit: "piece" as const, displayUnit: "ቁጥር", status: "Available" as const, notes: "Paper work" },
      { name: "UV Flat bed", code: "UVF-01", type: "UV Flat bed", manufacturer: "Crystal", operatorRole: "printer_operator" as const, materialUnit: "m²" as const, displayUnit: "m²", status: "Available" as const },
    ];
    for (const machine of machineRecords) await ctx.db.insert("machines", { ...machine, active: true });

    const materialRecords = [
      ["Banner", "Banner", "m²", "ሮል"],
      ["DTF Film", "Film", "m²", "ሮል", "Store", "Based on customer requirement"],
      ["Acrylic", "Sheet", "piece", "ቁጥር"],
      ["DTF Ink", "Ink", "L", "ሊትር"],
      ["Banner Ink", "Ink", "L", "ሊትር"],
      ["Print and Cut INK", "Ink", "L", "ሊትር"],
      ["UV Flat bed Ink", "Ink", "L", "ሊትር"],
      ["LED", "Electrical", "piece", "ቁጥር"],
      ["Normal Sticker", "Sticker", "m²", "ሮል"],
      ["Frosted Sticker", "Sticker", "m²", "ሮል"],
      ["Transparent Sticker", "Sticker", "m²", "ሮል"],
      ["Reflective Sticker", "Sticker", "m²", "ሮል"],
      ["Mush Sticker", "Sticker", "m²", "ሮል"],
      ["Mica", "Sheet", "piece", "ቁጥር"],
      ["PVC Film", "Film", "m²", "ሮል"],
      ["Canvas", "Fabric", "m²", "ሮል"],
      ["Neon Light", "Electrical", "m", "ሜትር"],
      ["Power Supply", "Electrical", "piece", "ቁጥር"],
      ["Foam", "Board", "piece", "ቁጥር"],
      ["AMIR", "Finished component", "piece", "ቁጥር"],
      ["ROLE UP DELUX", "Finished component", "piece", "ቁጥር"],
      ["ROLE UP STANDARD", "Finished component", "piece", "ቁጥር"],
      ["VINNER", "Finished component", "piece", "ቁጥር"],
      ["ZOCOLO", "Finished component", "piece", "ቁጥር"],
      ["LED LIGHT BOX A1", "Finished component", "piece", "ቁጥር"],
      ["LED LIGHT BOX A2", "Finished component", "piece", "ቁጥር"],
    ] as const;
    const accents = ["cyan", "violet", "gold", "green", "blue"] as const;
    for (const [index, record] of materialRecords.entries()) {
      const [name, category, unit, displayUnit, storageLocation, averageUse] = record;
      await ctx.db.insert("materials", {
        name,
        category,
        unit,
        displayUnit,
        quantity: 0,
        reorderAt: 0,
        storageLocation,
        averageUse,
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
    for (const [personName, department, businessRole, responsibility, handlesMaterial] of staffRecords) {
      await ctx.db.insert("staff", { personName, department, businessRole, responsibility, handlesMaterial, active: true });
    }
    await ctx.db.insert("staff", {
      personName: "Yitbarek",
      businessRole: "Owner",
      responsibility: "Whole-activity oversight, role assignment, profile access, and company settings",
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
