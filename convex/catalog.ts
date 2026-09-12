import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  capabilityCategory,
  machineMaterialRelationship,
  productionType,
} from "./schema";
import { OPERATOR_ROLES, requireOwner, requirePermission } from "./users";
import {
  CANONICAL_MACHINES,
  CANONICAL_OPERATOR_ROLES,
  CAPABILITY_REGISTRY,
} from "../src/shared/production-manifest";

const capabilityArgs = {
  code: v.string(),
  name: v.string(),
  description: v.string(),
  category: capabilityCategory,
};

async function audit(
  ctx: any,
  actorAuthUserId: string,
  configKey: string,
  changedFields: string[],
  reason?: string,
) {
  await ctx.db.insert("configurationChanges", {
    configKey,
    changedFields,
    reason,
    actorAuthUserId,
    createdAt: Date.now(),
  });
}

export const listCapabilities = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "machine.view");
    const rows = await ctx.db.query("capabilities").collect();
    return args.includeInactive ? rows : rows.filter((row) => row.active);
  },
});

export const createCapability = mutation({
  args: capabilityArgs,
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "machine.create");
    const code = args.code.trim().toUpperCase();
    if (!code || !args.name.trim()) throw new Error("Capability code and name are required.");
    const duplicate = (await ctx.db.query("capabilities").collect()).find((row) => row.code === code);
    if (duplicate) throw new Error("Capability code already exists.");
    const now = Date.now();
    const id = await ctx.db.insert("capabilities", {
      code,
      name: args.name.trim(),
      description: args.description.trim(),
      category: args.category,
      active: true,
      createdAt: now,
      updatedAt: now,
      createdBy: identity._id,
      updatedBy: identity._id,
    });
    await audit(ctx, identity._id, `capability:${code}`, ["created"]);
    return id;
  },
});

export const updateCapability = mutation({
  args: {
    capabilityId: v.id("capabilities"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(capabilityCategory),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "machine.update");
    const current = await ctx.db.get(args.capabilityId);
    if (!current) throw new Error("Capability not found.");
    const patch: Record<string, unknown> = { updatedAt: Date.now(), updatedBy: identity._id };
    const changed: string[] = [];
    if (args.name !== undefined) { patch.name = args.name.trim(); changed.push("name"); }
    if (args.description !== undefined) { patch.description = args.description.trim(); changed.push("description"); }
    if (args.category !== undefined) { patch.category = args.category; changed.push("category"); }
    if (args.active !== undefined) { patch.active = args.active; changed.push("active"); }
    await ctx.db.patch(args.capabilityId, patch);
    await audit(ctx, identity._id, `capability:${current.code}`, changed);
    return (await ctx.db.get(args.capabilityId))!;
  },
});

export const listMachineMaterialLinks = query({
  args: {
    machineId: v.optional(v.id("machines")),
    materialId: v.optional(v.id("materials")),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "machine.view");
    let rows = await ctx.db.query("machineMaterialLinks").collect();
    if (args.machineId) rows = rows.filter((row) => row.machineId === args.machineId);
    if (args.materialId) rows = rows.filter((row) => row.materialId === args.materialId);
    if (!args.includeInactive) rows = rows.filter((row) => row.active);
    return rows;
  },
});

export const createMachineMaterialLink = mutation({
  args: {
    machineId: v.id("machines"),
    materialId: v.id("materials"),
    relationshipType: machineMaterialRelationship,
    productionType: v.optional(productionType),
    conversionRatioOverride: v.optional(v.number()),
    wasteMarginPercent: v.optional(v.number()),
    required: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "machine.update");
    const [machine, material] = await Promise.all([ctx.db.get(args.machineId), ctx.db.get(args.materialId)]);
    if (!machine || !material) throw new Error("Machine and material must both exist.");
    if (!machine.active) throw new Error("Cannot link material to an archived machine.");
    if (!material.active) throw new Error("Cannot link an archived material.");
    const duplicate = (await ctx.db.query("machineMaterialLinks").withIndex("by_machine_material", (q) => q.eq("machineId", args.machineId).eq("materialId", args.materialId)).collect())
      .find((row) => row.active && row.relationshipType === args.relationshipType);
    if (duplicate) throw new Error("This active machine-material relationship already exists.");
    const now = Date.now();
    const id = await ctx.db.insert("machineMaterialLinks", {
      ...args,
      notes: args.notes?.trim() || undefined,
      active: true,
      createdAt: now,
      updatedAt: now,
      createdBy: identity._id,
      updatedBy: identity._id,
    });
    await audit(ctx, identity._id, `machine-material:${args.machineId}:${args.materialId}`, ["created", args.relationshipType]);
    return id;
  },
});

export const archiveMachineMaterialLink = mutation({
  args: { linkId: v.id("machineMaterialLinks"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "machine.update");
    const link = await ctx.db.get(args.linkId);
    if (!link) throw new Error("Machine-material relationship not found.");
    await ctx.db.patch(args.linkId, { active: false, effectiveTo: Date.now(), updatedAt: Date.now(), updatedBy: identity._id });
    await audit(ctx, identity._id, `machine-material:${link.machineId}:${link.materialId}`, ["active"], args.reason);
  },
});

export const listOperatorRoles = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "team.view");
    const rows = await ctx.db.query("operatorRoles").collect();
    return args.includeInactive ? rows : rows.filter((row) => row.active);
  },
});

export const createOperatorRole = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    allowedCapabilityIds: v.array(v.id("capabilities")),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "team.manage");
    const code = args.code.trim().toLowerCase();
    if (!code || !args.name.trim()) throw new Error("Operator role code and name are required.");
    const duplicate = (await ctx.db.query("operatorRoles").collect()).find((row) => row.code === code);
    if (duplicate) throw new Error("Operator role code already exists.");
    const capabilities = await Promise.all(args.allowedCapabilityIds.map((id) => ctx.db.get(id)));
    if (capabilities.some((capability) => !capability || !capability.active)) throw new Error("Every allowed capability must be active.");
    const now = Date.now();
    const id = await ctx.db.insert("operatorRoles", {
      code,
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      allowedCapabilityIds: args.allowedCapabilityIds,
      active: true,
      createdAt: now,
      updatedAt: now,
      createdBy: identity._id,
      updatedBy: identity._id,
    });
    await audit(ctx, identity._id, `operator-role:${code}`, ["created"]);
    return id;
  },
});

export const listOperatorAssignments = query({
  args: { userId: v.optional(v.id("users")), machineId: v.optional(v.id("machines")) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "team.view");
    let rows = await ctx.db.query("operatorMachineAssignments").collect();
    if (args.userId) rows = rows.filter((row) => row.userId === args.userId);
    if (args.machineId) rows = rows.filter((row) => row.machineId === args.machineId);
    return rows.filter((row) => row.active);
  },
});

export const assignOperatorToMachine = mutation({
  args: {
    userId: v.id("users"),
    machineId: v.id("machines"),
    operatorRoleId: v.id("operatorRoles"),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "team.manage");
    const [user, machine, operatorRole] = await Promise.all([
      ctx.db.get(args.userId),
      ctx.db.get(args.machineId),
      ctx.db.get(args.operatorRoleId),
    ]);
    if (!user || !machine || !operatorRole) throw new Error("User, machine, and operator role must exist.");
    if (!user.active || !machine.active || !operatorRole.active) throw new Error("User, machine, and operator role must be active.");
    if (!OPERATOR_ROLES.includes(user.role)) throw new Error("Only machine-operator application profiles can receive an operator assignment.");
    const machineCapabilities = await ctx.db.query("machineCapabilities").withIndex("by_machine", (q) => q.eq("machineId", machine._id)).collect();
    const allowed = new Set(operatorRole.allowedCapabilityIds.map(String));
    if (!machineCapabilities.some((link) => link.active && allowed.has(String(link.capabilityId)))) {
      throw new Error("The operator role has no capability compatible with this machine.");
    }
    const existing = (await ctx.db.query("operatorMachineAssignments").withIndex("by_user", (q) => q.eq("userId", user._id)).collect())
      .find((row) => row.machineId === machine._id && row.active);
    if (existing) throw new Error("This operator is already assigned to this machine.");
    const now = Date.now();
    const id = await ctx.db.insert("operatorMachineAssignments", {
      userId: user._id,
      machineId: machine._id,
      operatorRoleId: operatorRole._id,
      active: true,
      effectiveFrom: now,
      createdAt: now,
      updatedAt: now,
      createdBy: identity._id,
      updatedBy: identity._id,
    });
    await audit(ctx, identity._id, `operator-assignment:${user._id}:${machine._id}`, ["created"]);
    return id;
  },
});

export const archiveOperatorAssignment = mutation({
  args: { assignmentId: v.id("operatorMachineAssignments"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "team.manage");
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("Operator assignment not found.");
    await ctx.db.patch(args.assignmentId, { active: false, effectiveTo: Date.now(), updatedAt: Date.now(), updatedBy: identity._id });
    await audit(ctx, identity._id, `operator-assignment:${assignment.userId}:${assignment.machineId}`, ["active"], args.reason);
  },
});

export function isKnownOperatorRole(role: string): boolean {
  return OPERATOR_ROLES.includes(role as typeof OPERATOR_ROLES[number]);
}

export type CatalogMachineId = Id<"machines">;

export const reconcileCanonicalCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    const { identity } = await requireOwner(ctx);
    const now = Date.now();
    let capabilitiesCreated = 0;
    let rolesCreated = 0;
    let machinesPatched = 0;
    let linksCreated = 0;
    const unresolvedMachines: string[] = [];
    const unresolvedMaterials: string[] = [];

    const capabilityIds = new Map<string, Id<"capabilities">>();
    for (const definition of Object.values(CAPABILITY_REGISTRY)) {
      const existing = (await ctx.db.query("capabilities").withIndex("by_code", (q) => q.eq("code", definition.id)).unique());
      const id = existing?._id ?? await ctx.db.insert("capabilities", {
        code: definition.id,
        name: definition.name,
        description: definition.description,
        category: definition.category,
        active: true,
        createdAt: now,
        updatedAt: now,
        createdBy: identity._id,
        updatedBy: identity._id,
      });
      capabilityIds.set(definition.id, id);
      if (!existing) capabilitiesCreated++;
    }

    const roleIds = new Map<string, Id<"operatorRoles">>();
    for (const code of CANONICAL_OPERATOR_ROLES) {
      const existing = (await ctx.db.query("operatorRoles").withIndex("by_code", (q) => q.eq("code", code)).unique());
      const allowedCapabilityIds = Object.values(CAPABILITY_REGISTRY)
        .filter((capability) => capability.category === "PRINTING" || capability.category === "CUTTING_ROUTING" || capability.category === "FINISHING_AUXILIARY")
        .map((capability) => capabilityIds.get(capability.id))
        .filter((id): id is Id<"capabilities"> => Boolean(id));
      const id = existing?._id ?? await ctx.db.insert("operatorRoles", {
        code,
        name: code.replace(/_operator$/, " operator").replace(/_/g, " "),
        description: `Canonical production role: ${code}`,
        allowedCapabilityIds,
        active: true,
        createdAt: now,
        updatedAt: now,
        createdBy: identity._id,
        updatedBy: identity._id,
      });
      roleIds.set(code, id);
      if (!existing) rolesCreated++;
    }

    const machines = await ctx.db.query("machines").collect();
    for (const definition of CANONICAL_MACHINES) {
      const machine = machines.find((row) => row.catalogKey === definition.id || row.code === definition.code || row.name === definition.name);
      if (!machine) {
        unresolvedMachines.push(`${definition.id} (${definition.code})`);
        continue;
      }
      if (machine.catalogKey !== definition.id) {
        await ctx.db.patch(machine._id, { catalogKey: definition.id });
        machinesPatched++;
      }
      for (const capabilityCode of definition.capabilities) {
        const capabilityId = capabilityIds.get(capabilityCode);
        if (!capabilityId) continue;
        const existingLink = (await ctx.db.query("machineCapabilities").withIndex("by_machine", (q) => q.eq("machineId", machine._id)).collect())
          .find((link) => link.capabilityId === capabilityId);
        if (!existingLink) {
          await ctx.db.insert("machineCapabilities", {
            machineId: machine._id,
            capabilityId,
            active: true,
            createdAt: now,
            updatedAt: now,
            createdBy: identity._id,
            updatedBy: identity._id,
          });
          linksCreated++;
        }
      }
      const operatorRoleId = roleIds.get(definition.operatorRole);
      if (operatorRoleId) {
        const role = await ctx.db.get(operatorRoleId);
        for (const materialName of definition.primaryMaterialNames) {
          const material = (await ctx.db.query("materials").collect()).find((row) => row.name === materialName || row.name.toLowerCase().includes(materialName.toLowerCase()));
          if (!material) {
            unresolvedMaterials.push(`${definition.code} → ${materialName}`);
            continue;
          }
          const existingLink = (await ctx.db.query("machineMaterialLinks").withIndex("by_machine_material", (q) => q.eq("machineId", machine._id).eq("materialId", material._id)).collect())
            .find((link) => link.relationshipType === "primary" && link.active);
          if (!existingLink) {
            await ctx.db.insert("machineMaterialLinks", {
              machineId: machine._id,
              materialId: material._id,
              relationshipType: "primary",
              productionType: material.productionType,
              wasteMarginPercent: definition.defaultWasteMarginPercent,
              required: true,
              active: true,
              createdAt: now,
              updatedAt: now,
              createdBy: identity._id,
              updatedBy: identity._id,
            });
            linksCreated++;
          }
        }
        if (!role) throw new Error("Canonical operator role could not be loaded.");
      }
    }

    await audit(ctx, identity._id, "canonical-catalog-reconciliation", [
      "capabilities",
      "operatorRoles",
      "machineCapabilities",
      "machineMaterialLinks",
    ], "Owner-triggered idempotent catalog reconciliation");

    return {
      capabilitiesCreated,
      rolesCreated,
      machinesPatched,
      linksCreated,
      unresolvedMachines,
      unresolvedMaterials,
    };
  },
});
