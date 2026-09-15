import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { calculateOffcutArea } from "./units";
import { requirePermission } from "./users";
import { canAccessMachine } from "./authorization";
import type { Role } from "./types";
import { recordInventoryEvent } from "./inventoryLedger";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "offcut.view");
    return ctx.db
      .query("offcuts")
      .filter((q) => q.eq(q.field("status"), "available"))
      .collect();
  },
});

/** Human-friendly waste amount, dropping trailing zeros (e.g. "3.5 mL"). */
function formatWasteAmount(value: number, unitLabel: string): string {
  const formatted = Number(value.toFixed(3)).toString();
  return `${formatted} ${unitLabel}`;
}

/** Owner-set bounds shared by the operator and management offcut/scrap paths. */

/**
 * Enforces the owner-set minimum offcut dimensions for square-metre materials.
 * Called from `createOffcutInternal` so every offcut path is bounded the same way.
 */
async function enforceOffcutBounds(ctx: any, material: any, width: number, length: number) {
  const policy = material.wasteLimitPolicy ?? "warn";
  const minWidth = material.minOffcutWidth;
  const minLength = material.minOffcutLength;

  if (material.unit === "m²" && policy === "block" && (minWidth === undefined || minLength === undefined)) {
    throw new ConvexError(
      `The owner must configure the waste limits for ${material.name} before offcuts can be logged on it.`,
    );
  }
  if (minWidth !== undefined && minLength !== undefined) {
    if (width < minWidth || length < minLength) {
      throw new ConvexError(
        `Offcut ${formatWasteAmount(width, "m")} × ${formatWasteAmount(length, "m")} is below the ${formatWasteAmount(minWidth, "m")} × ${formatWasteAmount(minLength, "m")} minimum set for ${material.name}. Log it as scrap instead.`,
      );
    }
  }
}

/**
 * Enforces the owner-set global maximum scrap for a material, summed across all
 * machines and operators. Called from `logScrapInternal` so every scrap path is
 * bounded the same way.
 */
async function enforceScrapBounds(ctx: any, material: any, quantity: number) {
  const policy = material.wasteLimitPolicy ?? "warn";
  const maxScrap = material.maxScrap;
  const unitLabel = material.baseUnit ?? material.unit ?? "";

  if (policy === "block" && maxScrap === undefined) {
    throw new ConvexError(
      `The owner must configure the max scrap limit for ${material.name} before scrap can be logged on it.`,
    );
  }
  if (maxScrap === undefined) return;

  const logged = await ctx.db
    .query("scraps")
    .withIndex("by_material", (q: any) => q.eq("materialId", material._id))
    .collect();
  const total = logged.reduce((sum: number, entry: { quantity: number }) => sum + entry.quantity, 0) + quantity;
  if (total > maxScrap) {
    const remaining = Math.max(0, maxScrap - (total - quantity));
    throw new ConvexError(
      `Scrap would total ${formatWasteAmount(total, unitLabel)}, beyond the ${formatWasteAmount(maxScrap, unitLabel)} limit for ${material.name} (${formatWasteAmount(remaining, unitLabel)} remaining).`,
    );
  }
}

/**
 * Shared offcut-return transaction used by the generic `create` mutation and
 * the machine-scoped operator namespace mutation. Operators may only return
 * offcuts against their own assigned floor stock on an accessible machine;
 * management roles may record offcuts without operator custody.
 */
export async function createOffcutInternal(
  ctx: any,
  identity: { _id: string },
  profile: { role: string },
  args: {
    materialId: any;
    width: number;
    length: number;
    location: string;
    operatorSubStockId?: any;
    machineId?: any;
  },
) {
  if (!Number.isFinite(args.width) || !Number.isFinite(args.length) || args.width <= 0 || args.length <= 0) {
    throw new Error("Offcut dimensions must be greater than zero.");
  }
  if (!args.location.trim()) throw new Error("Offcut location is required.");
  const material = await ctx.db.get(args.materialId);
  if (!material || !material.active) throw new Error("Active material not found.");
  if (material.unit !== "m²") throw new Error("Only square-meter materials can create sheet offcuts.");
  await enforceOffcutBounds(ctx, material, args.width, args.length);
  const isManagement = ["owner", "manager", "admin", "storekeeper"].includes(profile.role);
  let operatorSubStockId = args.operatorSubStockId;
  if (!isManagement) {
    if (!args.machineId || !args.operatorSubStockId) throw new Error("Operators must select their assigned floor stock when returning an offcut.");
    const machine = await ctx.db.get(args.machineId);
    const subStock = await ctx.db.get(args.operatorSubStockId);
    if (!machine || !subStock || !canAccessMachine(profile.role as Role, machine) || subStock.operatorId !== identity._id || subStock.machineId !== machine._id || subStock.materialId !== material._id) {
      throw new Error("You can only return offcuts from your assigned floor stock.");
    }
  }

  const area = calculateOffcutArea(args.width, args.length);
  const label = material.name;
  const id = await ctx.db.insert("offcuts", {
    materialId: args.materialId,
    label,
    width: args.width,
    length: args.length,
    area,
    location: args.location.trim(),
    usable: true,
    status: "available",
    createdBy: identity._id,
    createdAt: new Date().toISOString(),
    operatorSubStockId,
    operatorId: operatorSubStockId ? identity._id : undefined,
    machineId: args.machineId,
  });

  await recordInventoryEvent(ctx, {
    materialId: args.materialId,
    eventType: "OFFCUT_RETURN",
    custody: "parent",
    balanceEffect: "in",
    quantity: area,
    unit: "m²",
    baseUnit: "m²",
    baseQuantity: area,
    operatorSubStockId,
    operatorId: operatorSubStockId ? identity._id : undefined,
    machineId: args.machineId,
    offcutId: id,
    note: `Usable offcut returned at ${args.location.trim()}`,
    createdBy: identity._id,
  });
  return (await ctx.db.get(id))!;
}

export const create = mutation({
  args: {
    materialId: v.id("materials"),
    width: v.number(),
    length: v.number(),
    location: v.string(),
    operatorSubStockId: v.optional(v.id("operatorSubStock")),
    machineId: v.optional(v.id("machines")),
  },
  handler: async (ctx, args) => {
    const { identity, profile } = await requirePermission(ctx, "offcut.create");
    return createOffcutInternal(ctx, identity, profile, args);
  },
});

export const listScraps = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "scrap.view");
    return ctx.db.query("scraps").collect();
  },
});

/**
 * Shared scrap-log transaction used by the generic `logScrap` mutation and the
 * machine-scoped operator namespace mutation. Operators may only log scrap
 * against their own assigned floor stock on an accessible machine; management
 * roles may log it without operator custody.
 */
export async function logScrapInternal(
  ctx: any,
  identity: { _id: string },
  profile: { role: string },
  args: {
    materialId: any;
    quantity: number;
    reason: string;
    operatorSubStockId?: any;
    machineId?: any;
  },
) {
  if (!Number.isFinite(args.quantity) || args.quantity <= 0) {
    throw new Error("Scrap quantity must be greater than zero.");
  }
  if (!args.reason.trim()) throw new Error("A scrap reason is required.");
  const material = await ctx.db.get(args.materialId);
  if (!material || !material.active) throw new Error("Active material not found.");
  await enforceScrapBounds(ctx, material, args.quantity);
  const isManagement = ["owner", "manager", "admin", "storekeeper"].includes(profile.role);
  let operatorSubStockId = args.operatorSubStockId;
  if (!isManagement) {
    if (!args.machineId || !args.operatorSubStockId) throw new Error("Operators must select their assigned floor stock when logging scrap.");
    const machine = await ctx.db.get(args.machineId);
    const subStock = await ctx.db.get(args.operatorSubStockId);
    if (!machine || !subStock || !canAccessMachine(profile.role as Role, machine) || subStock.operatorId !== identity._id || subStock.machineId !== machine._id || subStock.materialId !== material._id) {
      throw new Error("You can only log scrap against your assigned floor stock.");
    }
  }
  if (!operatorSubStockId && args.quantity > material.quantity) {
    throw new Error(`Insufficient ${material.name} stock for this scrap record.`);
  }

  const id = await ctx.db.insert("scraps", {
    materialId: args.materialId,
    label: material.name,
    quantity: args.quantity,
    unit: material.unit,
    reason: args.reason.trim(),
    createdBy: identity._id,
    createdAt: new Date().toISOString(),
    operatorSubStockId,
    operatorId: operatorSubStockId ? identity._id : undefined,
    machineId: args.machineId,
  });
  await recordInventoryEvent(ctx, {
    materialId: args.materialId,
    eventType: "SCRAP_LOG",
    custody: operatorSubStockId ? "operator" : "parent",
    balanceEffect: operatorSubStockId ? "none" : "out",
    quantity: args.quantity,
    unit: material.unit,
    baseUnit: material.baseUnit ?? material.unit,
    baseQuantity: args.quantity,
    operatorSubStockId,
    operatorId: operatorSubStockId ? identity._id : undefined,
    machineId: args.machineId,
    note: `Scrap: ${args.reason.trim()}`,
    createdBy: identity._id,
  });
  return (await ctx.db.get(id))!;
}

export const logScrap = mutation({
  args: {
    materialId: v.id("materials"),
    quantity: v.number(),
    reason: v.string(),
    operatorSubStockId: v.optional(v.id("operatorSubStock")),
    machineId: v.optional(v.id("machines")),
  },
  handler: async (ctx, args) => {
    const { identity, profile } = await requirePermission(ctx, "scrap.create");
    return logScrapInternal(ctx, identity, profile, args);
  },
});