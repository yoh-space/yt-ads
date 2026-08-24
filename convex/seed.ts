import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { requireAdmin } from "./users";

const DEFAULT_EMAIL = "admin@demo.com";
const DEFAULT_PASSWORD = "Password123!";
const DEFAULT_NAME = "Demo Admin";

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

/**
 * Bootstraps a sample admin account with a known email and password so the site
 * can be accessed immediately after deployment. Creates the Better Auth user
 * (with a properly hashed password), an admin application profile, and the demo
 * dataset. Idempotent: if an account with the same email already exists it is
 * left untouched and the credentials are returned.
 */
export const seedSampleAccount = mutation({
  args: {
    email: v.optional(v.string()),
    password: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = (args.email ?? DEFAULT_EMAIL).toLowerCase().trim();
    const password = args.password ?? DEFAULT_PASSWORD;
    const name = args.name ?? DEFAULT_NAME;

    const existing = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), email))
      .first();
    if (existing) {
      await seedDemoData(ctx, existing.authUserId);
      return {
        created: false,
        email,
        password,
        message: "An account with this email already exists. Use the existing credentials to sign in.",
      };
    }

    const auth = createAuth(ctx);
    const result = await auth.api.signUpEmail({
      body: { name, email, password },
    });
    const authUser = result.user;

    await ctx.db.insert("users", {
      authUserId: authUser.id,
      name: authUser.name ?? name,
      email: authUser.email,
      role: "admin",
      active: true,
    });

    await seedDemoData(ctx, authUser.id);

    return {
      created: true,
      email,
      password,
      message: "Sample admin account created. Sign in with these credentials.",
    };
  },
});
