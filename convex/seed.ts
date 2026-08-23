import { mutation } from "./_generated/server";
import { authComponent } from "./auth";
import { requireAdmin } from "./users";

/**
 * Loads the demo operations dataset (materials, machines, job cards, offcuts).
 * Runs only when the database is empty so it is safe to call repeatedly.
 * Intended to be invoked once by an administrator after the first deployment.
 */
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    if ((await ctx.db.query("materials").collect()).length > 0) {
      return { seeded: false };
    }

    const user = await authComponent.getAuthUser(ctx);

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
      createdBy: user._id, createdAt: Date.now(),
    });
    await ctx.db.insert("jobCards", {
      code: "JC-0421", client: "Bole Medical", title: "Acrylic wayfinding signs",
      machineId: mLaser, materialId: matAcrylic, quantity: 14.8, unit: "m²",
      status: "In production", due: "Today, 18:00", priority: "Medium",
      createdBy: user._id, createdAt: Date.now(),
    });
    await ctx.db.insert("jobCards", {
      code: "JC-0424", client: "Ethio Logistics", title: "Reception desk logo",
      machineId: mCnc, materialId: matMdf, quantity: 8.2, unit: "m²",
      status: "In production", due: "Tomorrow, 10:00", priority: "Normal",
      createdBy: user._id, createdAt: Date.now(),
    });
    await ctx.db.insert("jobCards", {
      code: "JC-0426", client: "Hibret Insurance", title: "Fleet sticker set",
      machineId: mPlotter, materialId: matVinyl, quantity: 96, unit: "m",
      status: "Queued", due: "Tomorrow, 15:00", priority: "Medium",
      createdBy: user._id, createdAt: Date.now(),
    });

    await ctx.db.insert("offcuts", {
      materialId: matAcrylic, label: "Acrylic Clear 3mm", width: 1.2, length: 0.8,
      area: 0.96, location: "Rack B · Slot 04", usable: true, status: "available",
      createdBy: user._id, createdAt: "08:25",
    });
    await ctx.db.insert("offcuts", {
      materialId: matMdf, label: "MDF Board 18mm", width: 0.9, length: 0.6,
      area: 0.54, location: "Rack C · Slot 02", usable: true, status: "available",
      createdBy: user._id, createdAt: "Yesterday",
    });

    return { seeded: true };
  },
});
