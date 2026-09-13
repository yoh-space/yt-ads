import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireActiveProfile } from "../users";
import { logConfigChange } from "./configAudit";

const MANAGEMENT_ROLES = ["owner", "manager", "admin"];

/**
 * Lists all active machine options configured for a service, sorted by priority.
 */
export const listServiceMachineOptions = query({
  args: { serviceId: v.string() },
  handler: async (ctx, args) => {
    await requireActiveProfile(ctx);
    const options = await ctx.db
      .query("serviceMachineOptions")
      .withIndex("by_service", (q) => q.eq("serviceId", args.serviceId).eq("active", true))
      .collect();
    return options.sort((a, b) => a.priority - b.priority);
  },
});

/**
 * Replaces the multi-machine options for a service in one atomic mutation.
 * Validates that all machineCodes exist and are active. Keeps serviceRoutes.preferredMachineCode
 * synchronized with the top priority (priority 0) machine.
 */
export const upsertServiceMachineOptions = mutation({
  args: {
    serviceId: v.string(),
    machineCodes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile, identity } = await requireActiveProfile(ctx);
    if (!MANAGEMENT_ROLES.includes(profile.role)) {
      throw new Error("Unauthorized: Owner or Manager role required to configure service machines.");
    }

    if (!args.serviceId.trim()) {
      throw new Error("Service ID is required.");
    }

    // Validate that all specified machine codes correspond to existing active machines
    const allMachines = await ctx.db.query("machines").collect();
    const machineMap = new Map(allMachines.map((m) => [m.code, m]));

    for (const code of args.machineCodes) {
      const machine = machineMap.get(code);
      if (!machine) {
        throw new Error(`Machine "${code}" is not registered in the machines table.`);
      }
      if (!machine.active) {
        throw new Error(`Machine "${code}" is inactive and cannot be assigned to service routes.`);
      }
    }

    const existing = await ctx.db
      .query("serviceMachineOptions")
      .withIndex("by_service", (q) => q.eq("serviceId", args.serviceId))
      .collect();

    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    const now = Date.now();
    for (let i = 0; i < args.machineCodes.length; i++) {
      await ctx.db.insert("serviceMachineOptions", {
        serviceId: args.serviceId,
        machineCode: args.machineCodes[i],
        priority: i,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Keep serviceRoutes.preferredMachineCode aligned with priority 0 machine
    if (args.machineCodes.length > 0) {
      const existingRoute = await ctx.db
        .query("serviceRoutes")
        .withIndex("by_service_active", (q) => q.eq("serviceId", args.serviceId).eq("active", true))
        .first();

      if (existingRoute) {
        await ctx.db.patch(existingRoute._id, {
          preferredMachineCode: args.machineCodes[0],
          updatedAt: now,
        });
      }
    }

    await logConfigChange(ctx, {
      entityType: "service_machine_options",
      entityId: args.serviceId,
      action: "update",
      fieldChanges: {
        machineCodes: {
          from: existing.map((e) => e.machineCode),
          to: args.machineCodes,
        },
      },
      changedBy: profile.name || identity._id,
    });

    return { success: true, count: args.machineCodes.length };
  },
});
