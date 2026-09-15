import { mutation, query } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { requireRoles } from "../users";
import { notifyRoles } from "../notificationHelpers";

const DESIGNER_ROLES = ["designer", "owner", "admin"] as const;

export const listAssignedTasks = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile, identity } = await requireRoles(ctx, DESIGNER_ROLES);
    let tasksQuery = ctx.db.query("designTasks");

    let tasks: Doc<"designTasks">[];
    if (profile.role === "designer") {
      tasks = await tasksQuery
        .withIndex("by_assignedDesignerId", (q) => q.eq("assignedDesignerId", identity._id))
        .collect();
    } else {
      tasks = await tasksQuery.collect();
    }

    if (args.status) {
      tasks = tasks.filter((t) => t.status === args.status);
    }

    // Enrich with order and submission details
    return Promise.all(
      tasks.map(async (task) => {
        const order = await ctx.db.get(task.orderId);
        let latestSubmission: any = null;
        if (task.latestSubmissionId) {
          const sub = await ctx.db.get(task.latestSubmissionId);
          if (sub) {
            latestSubmission = {
              ...sub,
              fileUrl: sub.fileStorageId ? await ctx.storage.getUrl(sub.fileStorageId) : null,
            };
          }
        }

        const customerFileUrl = order?.fileStorageId ? await ctx.storage.getUrl(order.fileStorageId) : null;

        return {
          ...task,
          orderCode: order?.code ?? "UNKNOWN",
          clientName: order?.clientName ?? "Unknown Client",
          phone: order?.phone,
          serviceType: order?.serviceType ?? "General",
          orderDimensions: order?.dimensions,
          orderPriority: order?.priority ?? "Medium",
          orderDueDate: order?.preferredDueDate,
          customerFileUrl,
          customerFileName: order?.fileName,
          latestSubmission,
        };
      }),
    );
  },
});

export const getTaskDetails = query({
  args: { taskId: v.id("designTasks") },
  handler: async (ctx, args) => {
    const { profile, identity } = await requireRoles(ctx, DESIGNER_ROLES);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Design task not found.");

    if (profile.role === "designer" && task.assignedDesignerId && task.assignedDesignerId !== identity._id) {
      throw new ConvexError("Unauthorized to view this design task.");
    }

    const order = await ctx.db.get(task.orderId);
    const submissions = await ctx.db
      .query("designSubmissions")
      .withIndex("by_designTaskId", (q) => q.eq("designTaskId", args.taskId))
      .collect();

    const enrichedSubmissions = await Promise.all(
      submissions.map(async (sub) => ({
        ...sub,
        fileUrl: sub.fileStorageId ? await ctx.storage.getUrl(sub.fileStorageId) : null,
      })),
    );

    const customerFileUrl = order?.fileStorageId ? await ctx.storage.getUrl(order.fileStorageId) : null;
    const attachmentUrls = order?.attachmentStorageIds
      ? await Promise.all(order.attachmentStorageIds.map((id) => ctx.storage.getUrl(id)))
      : [];

    return {
      ...task,
      order: order
        ? {
            ...order,
            customerFileUrl,
            attachmentUrls,
          }
        : null,
      submissions: enrichedSubmissions.sort((a, b) => b.versionNumber - a.versionNumber),
    };
  },
});

export const acceptTask = mutation({
  args: { taskId: v.id("designTasks") },
  handler: async (ctx, args) => {
    const { profile, identity } = await requireRoles(ctx, DESIGNER_ROLES);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Design task not found.");

    if (profile.role === "designer" && task.assignedDesignerId && task.assignedDesignerId !== identity._id) {
      throw new ConvexError("Unauthorized: task is assigned to another designer.");
    }

    if (task.status === "APPROVED" || task.status === "CANCELLED") {
      throw new ConvexError(`Cannot accept task in status ${task.status}.`);
    }

    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      status: "IN_PROGRESS",
      updatedAt: now,
    });

    await ctx.db.patch(task.orderId, {
      designStatus: "IN_PROGRESS",
      updatedAt: now,
    });

    return { success: true };
  },
});

export const blockTask = mutation({
  args: {
    taskId: v.id("designTasks"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { profile, identity } = await requireRoles(ctx, DESIGNER_ROLES);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Design task not found.");

    if (profile.role === "designer" && task.assignedDesignerId && task.assignedDesignerId !== identity._id) {
      throw new ConvexError("Unauthorized to update this task.");
    }

    const cleanReason = args.reason.trim();
    if (!cleanReason) throw new ConvexError("Reason for blocking task is required.");

    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      status: "BLOCKED",
      blockedReason: cleanReason,
      updatedAt: now,
    });

    await ctx.db.patch(task.orderId, {
      designStatus: "BLOCKED",
      updatedAt: now,
    });

    const order = await ctx.db.get(task.orderId);

    await notifyRoles(ctx, ["receptionist", "owner", "admin"], {
      title: "Design task blocked",
      message: `${order?.code ?? "Order"} · Designer reported blocking issue: ${cleanReason}`,
      type: "design_task",
      actorAuthUserId: identity._id,
      relatedTable: "designTasks",
      relatedId: args.taskId,
    });

    return { success: true };
  },
});

export const submitDesign = mutation({
  args: {
    taskId: v.id("designTasks"),
    fileStorageId: v.id("_storage"),
    fileName: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile, identity } = await requireRoles(ctx, DESIGNER_ROLES);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Design task not found.");

    if (profile.role === "designer" && task.assignedDesignerId && task.assignedDesignerId !== identity._id) {
      throw new ConvexError("Unauthorized to submit for this task.");
    }

    if (task.status === "APPROVED" || task.status === "CANCELLED") {
      throw new ConvexError(`Cannot submit design for a task that is ${task.status}.`);
    }

    const order = await ctx.db.get(task.orderId);
    if (!order) throw new ConvexError("Associated order not found.");

    const nextVersion = (task.currentVersionNumber ?? 0) + 1;
    const now = Date.now();

    const submissionId = await ctx.db.insert("designSubmissions", {
      designTaskId: args.taskId,
      orderId: task.orderId,
      versionNumber: nextVersion,
      fileStorageId: args.fileStorageId,
      fileName: args.fileName.trim(),
      designerId: identity._id,
      designerName: identity.name ?? "Designer",
      notes: args.notes?.trim() || undefined,
      status: "SUBMITTED",
      createdAt: now,
    });

    await ctx.db.patch(args.taskId, {
      status: "SUBMITTED",
      currentVersionNumber: nextVersion,
      latestSubmissionId: submissionId,
      updatedAt: now,
    });

    await ctx.db.patch(task.orderId, {
      designStatus: "SUBMITTED",
      updatedAt: now,
    });

    await ctx.db.insert("orderEvents", {
      orderId: task.orderId,
      actorId: identity._id,
      actorLabel: `Designer · ${identity.name ?? "Staff"}`,
      action: "DESIGN_SUBMITTED",
      detail: `Artwork version ${nextVersion} submitted: ${args.fileName}`,
      createdAt: now,
    });

    await notifyRoles(ctx, ["receptionist", "owner", "admin"], {
      title: "Design submitted for review",
      message: `${order.code} · ${identity.name ?? "Designer"} submitted artwork v${nextVersion} (${args.fileName}).`,
      type: "design_submission",
      actorAuthUserId: identity._id,
      relatedTable: "designTasks",
      relatedId: args.taskId,
    });

    return { success: true, submissionId, versionNumber: nextVersion };
  },
});
