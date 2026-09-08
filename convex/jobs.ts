import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { priority, serviceType as serviceTypeValidator, unit } from "./schema";
import { requireActiveProfile, requirePermission } from "./users";
import { canAccessJob } from "./authorization";
import { notifyRoles, notifyUser } from "./notificationHelpers";
import { assertProductionQuantities } from "./validation";
import { classifyMaterialProductionType, computeJobConsumption, getUsageAllowanceStatus, resolveEtbValue } from "./materialUsage";
import { ensureSystemConfig } from "./systemConfigs";
import { calculateOffcutArea } from "./units";
import { deductOperatorStock } from "./inventory";
import { recordInventoryEvent } from "./inventoryLedger";
import { resolveJobBOM } from "./bomResolver";
import { deductJobRequirements } from "./jobConsumption";
import type { Unit } from "./types";

async function notifyOrderCompletion(ctx: any, orderId: any, actorAuthUserId: string) {
  const order = await ctx.db.get(orderId);
  if (!order) return;
  const users = await ctx.db.query("users").collect();
  for (const user of users) {
    if (user.active && ["owner", "manager", "admin"].includes(user.role) && user.authUserId !== actorAuthUserId) {
      await ctx.db.insert("notifications", {
        recipientAuthUserId: user.authUserId,
        title: "Order ready for pickup",
        message: `${order.code} · ${order.clientName} is ready for pickup.`,
        type: "order_status",
        actorAuthUserId,
        relatedTable: "customerOrders",
        relatedId: orderId,
        createdAt: Date.now(),
      });
    }
  }
}

type ProductionInput = {
  jobCardId: string;
  inputQuantity: number;
  outputQuantity: number;
  wasteQuantity: number;
};

async function getProductionTotals(ctx: any, jobCardId: any) {
  const logs = await ctx.db
    .query("productionLogs")
    .withIndex("by_job_card", (q: any) => q.eq("jobCardId", jobCardId))
    .collect();
  return logs.reduce((total: number, log: { inputQuantity: number }) => total + log.inputQuantity, 0);
}

async function recordProductionInternal(ctx: any, args: ProductionInput, operatorId: string) {
  assertProductionQuantities(args.inputQuantity, args.outputQuantity, args.wasteQuantity);

  const job = await ctx.db.get(args.jobCardId);
  if (!job) throw new Error("Job card not found.");
  if (job.status === "Completed") throw new Error("Completed job cards cannot receive more production logs.");

  const material = await ctx.db.get(job.materialId);
  if (!material || !material.active) throw new Error("Active job material not found.");
  const previousInput = await getProductionTotals(ctx, args.jobCardId);
  if (previousInput + args.inputQuantity > job.quantity) {
    throw new Error("Production input exceeds the planned job quantity.");
  }
  await deductJobRequirements(ctx, {
    jobCardId: job._id,
    actorId: operatorId,
    mode: "incremental",
    actualInputQuantity: args.inputQuantity,
    actualOutputQuantity: args.outputQuantity,
    wasteQuantity: args.wasteQuantity,
  });
  const config = await ensureSystemConfig(ctx, operatorId);
  // Per-material allowance wins; a default of 0 (or unset) inherits the global
  // max allowed waste rate so the production-engine threshold stays the baseline.
  const allowancePercent = config.materialScrapAllowances?.find((entry) => entry.materialId === job.materialId)?.allowancePercent
    ?? (config.defaultScrapAllowancePercent ? config.defaultScrapAllowancePercent : config.maxAllowedWastePercent);
  const usageAllowanceStatus = getUsageAllowanceStatus(
    previousInput + args.inputQuantity + args.wasteQuantity,
    job.quantity,
    allowancePercent,
  );
  await ctx.db.insert("productionLogs", {
    jobCardId: job._id,
    machineId: job.machineId,
    inputQuantity: args.inputQuantity,
    outputQuantity: args.outputQuantity,
    wasteQuantity: args.wasteQuantity,
    unit: job.unit,
    operatorId,
    createdAt: Date.now(),
    plannedQuantity: job.quantity,
    approvedScrapQuantity: Number((job.quantity * allowancePercent / 100).toFixed(3)),
    usageAllowanceStatus,
  });
  if (usageAllowanceStatus === "EXCEEDED") {
    const excessQuantity = Number((previousInput + args.inputQuantity + args.wasteQuantity - job.quantity * (1 + allowancePercent / 100)).toFixed(3));
    await ctx.db.insert("overuseExceptions", {
      jobCardId: job._id,
      materialId: job.materialId,
      actualUsage: previousInput + args.inputQuantity + args.wasteQuantity,
      plannedUsage: job.quantity,
      approvedScrapQuantity: Number((job.quantity * allowancePercent / 100).toFixed(3)),
      excessQuantity: Math.max(0, excessQuantity),
      unit: job.unit,
      status: "OPEN",
      createdBy: operatorId,
      createdAt: Date.now(),
      note: "Production usage exceeded the approved scrap allowance.",
    });
    await notifyRoles(ctx, ["owner", "manager", "admin"], {
      title: "Material overuse exception",
      message: `${job.code} exceeded the approved usage allowance by ${Math.max(0, excessQuantity)} ${job.unit}.`,
      type: "material_overuse",
      actorAuthUserId: operatorId,
      relatedTable: "jobCards",
      relatedId: job._id,
    });
  }
  await ctx.db.patch(job._id, { status: "In production" });
  if (job.orderId) {
    await ctx.db.patch(job.orderId, { status: "IN_PRODUCTION", updatedAt: Date.now() });
  }
  const machine = await ctx.db.get(job.machineId);
  if (machine && machine.status !== "Running") {
    await ctx.db.patch(machine._id, { status: "Running", activeJob: job.code });
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireActiveProfile(ctx);
    const jobs = await ctx.db.query("jobCards").collect();
    let visibleJobs = jobs;
    if (!["owner", "manager", "admin", "storekeeper"].includes(profile.role)) {
      const machines = await ctx.db.query("machines").collect();
      const assignedMachineIds = new Set(machines.filter((machine) => machine.operatorRole === profile.role).map((machine) => machine._id));
      visibleJobs = jobs.filter((job) => assignedMachineIds.has(job.machineId));
    }
    const orders = await ctx.db.query("customerOrders").collect();
    const orderById = new Map(orders.map((order) => [order._id, order]));
    return visibleJobs.map((job) => {
      const order = job.orderId ? orderById.get(job.orderId) : undefined;
      return {
        ...job,
        orderStatus: order?.status,
        orderOverdue: Boolean(order && !["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"].includes(order.status) && order.preferredDueDate < Date.now()),
        orderDueTimestamp: order?.preferredDueDate,
      };
    });
  },
});

export const listUsageAlerts = query({
  args: {},
  returns: v.array(v.object({
    id: v.id("productionLogs"),
    jobCardId: v.id("jobCards"),
    status: v.union(v.literal("WATCH"), v.literal("CRITICAL"), v.literal("EXCEEDED")),
    actualUsage: v.number(),
    plannedQuantity: v.number(),
    approvedScrapQuantity: v.number(),
    createdAt: v.number(),
  })),
  handler: async (ctx) => {
    await requirePermission(ctx, "material.view");
    const logs = await ctx.db.query("productionLogs")
      .withIndex("by_allowance_status")
      .order("desc")
      .take(100);
    return logs
      .filter((log): log is typeof log & { usageAllowanceStatus: "WATCH" | "CRITICAL" | "EXCEEDED"; plannedQuantity: number; approvedScrapQuantity: number } =>
        (log.usageAllowanceStatus === "WATCH" || log.usageAllowanceStatus === "CRITICAL" || log.usageAllowanceStatus === "EXCEEDED")
        && log.plannedQuantity !== undefined && log.approvedScrapQuantity !== undefined)
      .map((log) => ({
        id: log._id,
        jobCardId: log.jobCardId,
        status: log.usageAllowanceStatus,
        actualUsage: log.inputQuantity + log.wasteQuantity,
        plannedQuantity: log.plannedQuantity,
        approvedScrapQuantity: log.approvedScrapQuantity,
        createdAt: log.createdAt,
      }));
  },
});

export const getJobRequirements = query({
  args: { jobCardId: v.id("jobCards") },
  handler: async (ctx, args) => {
    const requirements = await ctx.db
      .query("jobMaterialRequirements")
      .withIndex("by_job_card", (q) => q.eq("jobCardId", args.jobCardId))
      .collect();
    const materials = await ctx.db.query("materials").collect();
    const materialById = new Map(materials.map((m) => [m._id, m]));

    return requirements.map((req) => {
      const mat = materialById.get(req.materialId);
      return {
        ...req,
        materialName: mat?.name ?? "Material",
        materialUnit: mat?.baseUnit ?? mat?.unit ?? req.baseUnit,
        materialFamily: mat?.materialFamily,
      };
    });
  },
});

export const create = mutation({
  args: {
    client: v.string(),
    title: v.string(),
    machineId: v.id("machines"),
    materialId: v.id("materials"),
    quantity: v.number(),
    unit,
    due: v.string(),
    priority,
    length: v.optional(v.number()),
    width: v.optional(v.number()),
    deductOnComplete: v.optional(v.boolean()),
    serviceType: v.optional(serviceTypeValidator),
  },
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "job.create");
    if (!args.client.trim() || !args.title.trim()) throw new Error("Client and job description are required.");
    if (!Number.isFinite(args.quantity) || args.quantity <= 0) {
      throw new Error("Planned job quantity must be greater than zero.");
    }
    const machine = await ctx.db.get(args.machineId);
    const material = await ctx.db.get(args.materialId);
    if (!machine || !machine.active) throw new Error("Active machine not found.");
    if (!material || !material.active) throw new Error("Active material not found.");
    if (args.unit !== (material.baseUnit ?? material.unit)) throw new Error("Job unit must match the selected material base unit.");
    if (machine.status === "Maintenance" || machine.status === "Unavailable") {
      return { success: false as const, error: `${machine.name} is currently ${machine.status.toLowerCase()} and cannot accept new jobs.` };
    }
    if (args.quantity > material.quantity) {
      return { success: false as const, error: `Stock shortfall — ${material.name} has ${material.quantity} ${material.baseUnit ?? material.unit} available but ${args.quantity} ${args.unit} is required.` };
    }

    const code = `JC-${String(430 + Math.floor(Math.random() * 500)).padStart(4, "0")}`;
    const id = await ctx.db.insert("jobCards", {
      code,
      client: args.client.trim(),
      title: args.title.trim(),
      machineId: args.machineId,
      materialId: args.materialId,
      quantity: args.quantity,
      unit: args.unit,
      status: "Queued",
      due: args.due,
      priority: args.priority,
      createdBy: identity._id,
      createdAt: Date.now(),
      length: args.length && Number.isFinite(args.length) && args.length > 0 ? Number(args.length.toFixed(3)) : undefined,
      width: args.width && Number.isFinite(args.width) && args.width > 0 ? Number(args.width.toFixed(3)) : undefined,
      deductOnComplete: args.deductOnComplete,
      serviceType: args.serviceType,
    });
    if (args.serviceType) {
      const config = await ensureSystemConfig(ctx, identity._id);
      const bomItems = await resolveJobBOM(
        ctx,
        args.serviceType,
        { length: args.length, width: args.width },
        String(args.quantity),
        {
          standardWasteMargin: config.defaultScrapAllowancePercent ?? config.maxAllowedWastePercent,
          maxAllowedScrapLimit: config.maxAllowedWastePercent,
        },
      );
      for (const item of bomItems) {
        await ctx.db.insert("jobMaterialRequirements", {
          jobCardId: id,
          materialId: item.materialId,
          packageUnit: item.packageUnit,
          suggestedPackages: item.suggestedPackages,
          baseUnit: item.baseUnit,
          plannedBaseQuantity: item.plannedBaseQuantity,
          approvedScrapQuantity: item.approvedScrapQuantity,
          conversionRatioSnapshot: item.conversionRatioSnapshot,
          status: "PLANNED",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
    if (machine.status !== "Running") {
      await ctx.db.patch(args.machineId, { status: "Running", activeJob: code });
    }
    await notifyRoles(ctx, [machine.operatorRole, "owner", "manager", "admin"], {
      title: "Job card assigned",
      message: `${code} · ${args.client.trim()} was assigned to ${machine.name}.`,
      type: "job_update",
      actorAuthUserId: identity._id,
      relatedTable: "jobCards",
      relatedId: id,
    });
    const job = (await ctx.db.get(id))!;
    return { success: true as const, job };
  },
});

export const recordProduction = mutation({
  args: {
    jobCardId: v.id("jobCards"),
    inputQuantity: v.number(),
    outputQuantity: v.number(),
    wasteQuantity: v.number(),
  },
  handler: async (ctx, args) => {
    const { identity, profile } = await requireActiveProfile(ctx);
    const job = await ctx.db.get(args.jobCardId);
    if (!job) throw new Error("Job card not found.");
    const machine = await ctx.db.get(job.machineId);
    if (!machine) throw new Error("Job machine not found.");
    if (!canAccessJob(profile.role, machine)) {
      throw new Error("You are not assigned to this machine.");
    }
    await recordProductionInternal(ctx, args, identity._id);
    await notifyUser(ctx, job.createdBy, {
      title: "Production activity recorded",
      message: `${job.code} received a production update on ${machine.name}.`,
      type: "job_update",
      actorAuthUserId: identity._id,
      relatedTable: "jobCards",
      relatedId: args.jobCardId,
    });
  },
});

async function consumeFromOffcuts(ctx: any, jobId: any, materialId: any, baseQuantity: number, actorId: string) {
  const available = await ctx.db
    .query("offcuts")
    .withIndex("by_material_status", (q: any) => q.eq("materialId", materialId).eq("status", "available"))
    .collect();
  if (available.length === 0 || baseQuantity <= 0) return 0;
  const sorted = available.sort((a: any, b: any) => a.area - b.area);
  let covered = 0;
  for (const offcut of sorted) {
    if (baseQuantity - covered <= 0) break;
    const usedFromOffcut = Math.min(offcut.area, Number((baseQuantity - covered).toFixed(3)));
    covered = Number((covered + usedFromOffcut).toFixed(3));
    await ctx.db.insert("offcutConsumptions", {
      jobCardId: jobId,
      materialId,
      offcutId: offcut._id,
      area: usedFromOffcut,
      unit: "m²",
      consumedBy: actorId,
      createdAt: Date.now(),
    });
    const remainingArea = Number((offcut.area - usedFromOffcut).toFixed(3));
    if (remainingArea <= 0.01) {
      await ctx.db.patch(offcut._id, { status: "consumed", usable: offcut.usable });
    } else {
      await ctx.db.patch(offcut._id, { area: remainingArea, width: Math.max(0.01, Number((offcut.width * (remainingArea / offcut.area)).toFixed(3))), status: "available" });
    }
    await recordInventoryEvent(ctx, {
      materialId,
      eventType: "PRODUCTION_CONSUMPTION",
      custody: "parent",
      balanceEffect: "out",
      quantity: usedFromOffcut,
      unit: "m²",
      baseUnit: "m²",
      baseQuantity: usedFromOffcut,
      jobCardId: jobId,
      offcutId: offcut._id,
      note: `Offcut consumption for ${jobId}`,
      createdBy: actorId,
    });
  }
  return covered;
}

async function recordAutomaticDeduction(ctx: any, job: any, material: any, actorId: string) {
  if (job.deductOnComplete === false) return { deducted: false, reason: "Automatic deduction disabled for this job." };

  const config = await ensureSystemConfig(ctx, actorId);
  const allowancePercent = config.materialScrapAllowances?.find((entry) => entry.materialId === job.materialId)?.allowancePercent
    ?? (config.defaultScrapAllowancePercent ? config.defaultScrapAllowancePercent : config.maxAllowedWastePercent);

  const bom = computeJobConsumption(material, {
    length: job.length,
    width: job.width,
    quantity: job.quantity,
    fallbackArea: job.quantity,
    marginSquareMetres: config.defaultMarginSquareMetres ?? 0,
    allowancePercent,
    inkMlPerSquareMetre: config.inkMlPerSquareMetre,
  });

  const previousInput = await getProductionTotals(ctx, job._id);
  const rawToDeduct = Number((Math.max(0, bom.baseQuantity - previousInput)).toFixed(3));
  if (rawToDeduct <= 0) {
    return {
      deducted: false,
      reason: "The planned material quantity has already been consumed.",
      productionType: bom.productionType,
      baseQuantity: bom.baseQuantity,
      rawToDeduct: 0,
       areaM2: bom.areaM2,
       allocatedAreaM2: bom.allocatedAreaM2,
      inkMl: bom.inkMl,
      unit: bom.unit,
      etbValue: resolveEtbValue(material),
      floorDeducted: 0,
    };
  }

  let materialToDeduct = rawToDeduct;
  if (bom.productionType === "area") {
    const covered = await consumeFromOffcuts(ctx, job._id, job.materialId, rawToDeduct, actorId);
    const coveredForRemaining = Math.min(covered, rawToDeduct);
    materialToDeduct = Number((Math.max(0, rawToDeduct - coveredForRemaining)).toFixed(3));
  }

  const floorDeducted = materialToDeduct > 0
    ? await deductOperatorStock(ctx, job.machineId, job.materialId, materialToDeduct, actorId, job._id)
    : 0;
  const centralRemainder = Number((materialToDeduct - floorDeducted).toFixed(3));
  if (centralRemainder > 0) {
    await recordInventoryEvent(ctx, {
      materialId: job.materialId,
      eventType: "PRODUCTION_CONSUMPTION",
      custody: "parent",
      balanceEffect: "out",
      quantity: centralRemainder,
      unit: bom.unit as Unit,
      baseUnit: bom.unit as Unit,
      baseQuantity: centralRemainder,
      machineId: job.machineId,
      jobCardId: job._id,
      note: `Automatic job completion consumption ${job.code} (${bom.productionType}, ${bom.areaM2} m² printed${bom.productionType === "ink" ? ` · ${bom.inkMl} mL ink` : ""})`,
      createdBy: actorId,
    });
  }

  if (bom.productionType === "area") {
    await ctx.db.insert("productionLogs", {
      jobCardId: job._id,
      machineId: job.machineId,
      inputQuantity: rawToDeduct,
      outputQuantity: rawToDeduct,
      wasteQuantity: 0,
      unit: job.unit,
      operatorId: actorId,
      createdAt: Date.now(),
    });
  }

  // Synchronous Ink Deduction:
  // If the job prints on an ink-consuming machine, deduct substrate m² and ink Liters simultaneously.
  // Solvents are strictly excluded and adjusted periodically.
  let inkDeducted = 0;
  let inkMaterialName: string | undefined = undefined;
  
  if (bom.areaM2 > 0 && material.category !== "Ink") {
    const machine = await ctx.db.get(job.machineId);
    let targetInkMaterial: any = null;
    if (job.inkMaterialId) {
      targetInkMaterial = await ctx.db.get(job.inkMaterialId);
    } else if (machine) {
      const compatibleInkNames: string[] = machine.compatibleInks ?? [];
      const allMaterials = await ctx.db.query("materials").collect();
      if (compatibleInkNames.length > 0) {
        targetInkMaterial = allMaterials.find((m: any) =>
          compatibleInkNames.some((cin) => cin.toLowerCase() === m.name.toLowerCase())
        );
      } else {
        const code = (machine.code ?? "").toLowerCase();
        const mName = (machine.name ?? "").toLowerCase();
        if (code.includes("cj7k") || mName.includes("crystal jet") || mName.includes("banner")) {
          targetInkMaterial = allMaterials.find((m: any) => m.name.toLowerCase().includes("banner ink"));
        } else if (code.includes("cesp") || mName.includes("eco-solvent") || mName.includes("crystc") || mName.includes("pac")) {
          targetInkMaterial = allMaterials.find((m: any) => m.name.toLowerCase().includes("print & cut ink") || m.name.toLowerCase().includes("print and cut"));
        } else if (code.includes("ruv") || mName.includes("ricoh") || mName.includes("uv")) {
          targetInkMaterial = allMaterials.find((m: any) => m.name.toLowerCase().includes("uv ink") || m.name.toLowerCase().includes("uv flat"));
        } else if (code.includes("dtf") || mName.includes("dtf") || mName.includes("i3200")) {
          targetInkMaterial = allMaterials.find((m: any) => m.name.toLowerCase().includes("dtf ink"));
        }
      }
    }

    if (targetInkMaterial && !targetInkMaterial.isSolvent) {
      const sysConfig = await ctx.db.query("systemConfigs").withIndex("by_key", (q: any) => q.eq("key", "default")).first();
      const inkRateMl = sysConfig?.inkMlPerSquareMetre ?? 12;
      const calculatedInkLiters = Number(((bom.areaM2 * inkRateMl) / 1000).toFixed(3));
      if (calculatedInkLiters > 0) {
        const floorInkDeducted = await deductOperatorStock(ctx, job.machineId, targetInkMaterial._id, calculatedInkLiters, actorId, job._id);
        const centralInkRemainder = Number((calculatedInkLiters - floorInkDeducted).toFixed(3));
        if (centralInkRemainder > 0) {
          await recordInventoryEvent(ctx, {
            materialId: targetInkMaterial._id,
            eventType: "PRODUCTION_CONSUMPTION",
            custody: "parent",
            balanceEffect: "out",
            quantity: centralInkRemainder,
            unit: "L",
            baseUnit: "L",
            baseQuantity: centralInkRemainder,
            machineId: job.machineId,
            jobCardId: job._id,
            note: `Synchronous ink deduction for ${job.code} on ${machine?.name ?? "machine"} (${calculatedInkLiters} L)`,
            createdBy: actorId,
          });
        }
        inkDeducted = calculatedInkLiters;
        inkMaterialName = targetInkMaterial.name;
      }
    }
  }

  const etb = resolveEtbValue(material);
  
  return {
    deducted: true,
    productionType: bom.productionType,
    baseQuantity: bom.baseQuantity,
    rawToDeduct: materialToDeduct,
       areaM2: bom.areaM2,
       allocatedAreaM2: bom.allocatedAreaM2,
    inkMl: bom.inkMl,
    inkDeducted,
    inkMaterialName,
    unit: bom.unit,
    etbValue: etb,
    floorDeducted,
  };
}

async function recordAutomaticBomDeductions(ctx: any, job: any, actorId: string) {
  const requirements = await ctx.db
    .query("jobMaterialRequirements")
    .withIndex("by_job_card", (q: any) => q.eq("jobCardId", job._id))
    .collect();
  const openRequirements = requirements.filter((requirement: any) => requirement.status !== "COMPLETED");
  if (openRequirements.length === 0) return null;

  const coveredMaterialIds = new Set<string>();
  const deductions: Array<{ materialId: string; baseQuantity: number; floorDeducted: number; centralRemainder: number }> = [];
  for (const requirement of openRequirements) {
    const material = await ctx.db.get(requirement.materialId);
    if (!material || !material.active) throw new Error("A required job BOM material is unavailable.");
    const baseQuantity = Number((requirement.plannedBaseQuantity + requirement.approvedScrapQuantity).toFixed(3));
    if (baseQuantity <= 0) continue;
    const floorDeducted = await deductOperatorStock(ctx, job.machineId, requirement.materialId, baseQuantity, actorId, job._id);
    const centralRemainder = Number((baseQuantity - floorDeducted).toFixed(3));
    if (centralRemainder > 0) {
      await recordInventoryEvent(ctx, {
        materialId: requirement.materialId,
        eventType: "PRODUCTION_CONSUMPTION",
        custody: "parent",
        balanceEffect: "out",
        quantity: centralRemainder,
        unit: material.baseUnit ?? material.unit,
        baseUnit: material.baseUnit ?? material.unit,
        baseQuantity: centralRemainder,
        machineId: job.machineId,
        jobCardId: job._id,
        note: `Automatic BOM consumption ${job.code}`,
        createdBy: actorId,
      });
    }
    await ctx.db.patch(requirement._id, { status: "COMPLETED", updatedAt: Date.now() });
    coveredMaterialIds.add(String(requirement.materialId));
    deductions.push({ materialId: requirement.materialId, baseQuantity, floorDeducted, centralRemainder });
  }

  // A recipe may describe secondary materials only; retain the primary job
  // material fallback so every completed job still consumes its main input.
  if (!coveredMaterialIds.has(String(job.materialId))) {
    const material = await ctx.db.get(job.materialId);
    if (!material) throw new Error("Job material not found.");
    const fallback = await recordAutomaticDeduction(ctx, job, material, actorId);
    return { bom: deductions, fallback };
  }
  return { bom: deductions };
}

/**
 * Shared job-completion transaction used by the generic `complete` mutation
 * and the machine-scoped operator namespace mutation. Mutations validate input,
 * require an active application profile, enforce the relevant role, and write
 * all deduction, order-status, machine-availability, and notification changes
 * transactionally.
 */
export async function completeJobInternal(
  ctx: any,
  identity: { _id: string },
  profile: { role: string },
  args: { jobId: any },
) {
  const job = await ctx.db.get(args.jobId);
  if (!job) throw new Error("Job card not found.");
  const machine = await ctx.db.get(job.machineId);
  if (!machine) throw new Error("Job machine not found.");
  if (!canAccessJob(profile.role as any, machine)) {
    throw new Error("You are not assigned to this machine.");
  }
  if (job.status === "Completed") return { success: true, deduction: undefined };

  const deduction = await deductJobRequirements(ctx, {
    jobCardId: job._id,
    actorId: identity._id,
    mode: "completion",
  });

  await ctx.db.patch(args.jobId, { status: "Completed" });
  if (job.orderId) {
    await ctx.db.patch(job.orderId, { status: "COMPLETED", updatedAt: Date.now() });
    await notifyOrderCompletion(ctx, job.orderId, identity._id);
  }
  await ctx.db.patch(machine._id, { status: "Available", activeJob: undefined });
  await notifyUser(ctx, job.createdBy, {
    title: "Job completed",
    message: `${job.code} was completed and ${machine.name} is available.`,
    type: "job_update",
    actorAuthUserId: identity._id,
    relatedTable: "jobCards",
    relatedId: args.jobId,
  });
  return { success: true, deduction };
}

export const complete = mutation({
  args: { jobId: v.id("jobCards") },
  handler: async (ctx, args) => {
    const { identity, profile } = await requireActiveProfile(ctx);
    return completeJobInternal(ctx, identity, profile, args);
  },
});
