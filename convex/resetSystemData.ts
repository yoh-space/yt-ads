import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireOwner } from "./users";
import { ensureSystemConfig } from "./systemConfigs";

const CONFIRMATION_KEY = "RESET-SYSTEM-DATA";

/**
 * Returns whether the irreversible fresh-state reset has already been run.
 * The Owner Settings UI uses this query to permanently hide the action.
 */
export const getResetStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const config = await ctx.db
      .query("systemConfigs")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();
    return { dataResetExecuted: config?.dataResetExecuted === true };
  },
});

/**
 * Irreversibly clears operational/demo data and leaves the workspace's staff,
 * machine, material, service, and system configuration records intact.
 *
 * This is deliberately guarded twice: requireOwner rejects every non-owner
 * role, and the exact confirmation key prevents accidental invocation.
 */
export const resetSystemData = mutation({
  args: { confirmationKey: v.string() },
  handler: async (ctx, args) => {
    const { identity } = await requireOwner(ctx);
    if (args.confirmationKey !== CONFIRMATION_KEY) {
      throw new Error("Invalid confirmation key.");
    }

    let config = await ctx.db
      .query("systemConfigs")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();
    if (config?.dataResetExecuted === true) {
      throw new Error("System data reset has already been executed.");
    }
    if (!config) {
      await ensureSystemConfig(ctx, identity._id);
      config = await ctx.db
        .query("systemConfigs")
        .withIndex("by_key", (q) => q.eq("key", "default"))
        .unique();
    }
    if (!config) throw new Error("System configuration could not be initialized.");

    // These tables are operational history, transactional records, derived
    // stock projections, customer records, and one-time migration/audit data.
    const purgeTables = [
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
    ] as const;

    for (const table of purgeTables) {
      const records = await ctx.db.query(table).collect();
      for (const record of records) await ctx.db.delete(record._id);
    }

    // Preserve the material catalog/configuration but clear its legacy cached
    // balances so the dashboard starts at a zero inventory baseline.
    const materials = await ctx.db.query("materials").collect();
    for (const material of materials) {
      await ctx.db.patch(material._id, {
        quantity: 0,
        rollEquivalent: 0,
        sheetEquivalent: 0,
      });
    }

    const now = Date.now();
    await ctx.db.patch(config._id, {
      dataResetExecuted: true,
      dataResetExecutedAt: now,
      dataResetExecutedBy: identity._id,
      updatedAt: now,
      updatedBy: identity._id,
    });

    return { success: true as const, dataResetExecuted: true as const };
  },
});
