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
 * Irreversibly wipes ALL operational data, machine configs, material catalog,
 * operational configuration, and operator staff profiles. Preserves only:
 *   - owner, manager, admin, storekeeper, receptionist staff profiles
 *   - system config (with reset flag set)
 *   - company settings
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

    // ── 1. Operational history & transactional records ──
    const operationalTables = [
      "notifications",
      "materialRequests",
      "materialRequestLines",
      "customerOrders",
      "orderEvents",
      "stockExceptions",
      "stock_movements",
      "jobCards",
      "productionLogs",
      "overuseExceptions",
      "offcuts",
      "offcutConsumptions",
      "scraps",
      "reconciliations",
      "weeklyReconciliations",
      "configurationChanges",
      "parentInventory",
      "operatorSubStock",
      "jobMaterialRequirements",
      "reservations",
      "telegramUsers",
      "telegramSessions",
      "migrations",
    ] as const;

    for (const table of operationalTables) {
      const records = await ctx.db.query(table).collect();
      for (const record of records) await ctx.db.delete(record._id);
    }

    // ── 2. Machine configs & operational configuration ──
    const configTables = [
      "machines",
      "capabilities",
      "machineCapabilities",
      "machineMaterialLinks",
      "operatorRoles",
      "operatorMachineAssignments",
      "machineInkConsumptionRules",
      "serviceDefinitions",
      "machineServiceRoutes",
      "serviceMaterialRecipes",
      "serviceBOM",
      "materialTypeCatalog",
    ] as const;

    for (const table of configTables) {
      const records = await ctx.db.query(table).collect();
      for (const record of records) await ctx.db.delete(record._id);
    }

    // ── 3. Delete operator staff profiles (preserve owner/manager/admin/storekeeper/receptionist) ──
    const operatorRoles = new Set([
      "laser_operator",
      "cnc_operator",
      "crystek_operator",
      "crystal_jet_operator",
    ]);
    const allStaff = await ctx.db.query("staff").collect();
    for (const member of allStaff) {
      const roles = member.applicationRoles ?? [];
      const isOperator = roles.some((r) => operatorRoles.has(r));
      if (isOperator) {
        await ctx.db.delete(member._id);
      }
    }

    // Also delete associated user auth records for operators
    const allUsers = await ctx.db.query("users").collect();
    for (const user of allUsers) {
      if (operatorRoles.has(user.role)) {
        await ctx.db.delete(user._id);
      }
    }

    // ── 4. Wipe material catalog entirely ──
    const materials = await ctx.db.query("materials").collect();
    for (const material of materials) {
      await ctx.db.delete(material._id);
    }

    // ── 5. Mark reset as executed ──
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
