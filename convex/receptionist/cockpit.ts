import { mutation, query } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { orderPriority } from "../schema";
import { requireRoles } from "../users";
import { notifyRoles, notifyUser } from "../notificationHelpers";
import { lockOrderForReviewInternal } from "../orders";

const RECEPTION_ROLES = ["receptionist", "owner", "admin"] as const;

export const listDesigners = query({
  args: {},
  handler: async (ctx) => {
    await requireRoles(ctx, RECEPTION_ROLES);
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => u.active && (u.role === "designer" || u.role === "owner" || u.role === "admin"))
      .map((u) => ({
        id: u._id,
        authUserId: u.authUserId,
        name: u.name,
        email: u.email,
        role: u.role,
      }));
  },
});

export const listPriorityWork = query({
  args: {},
  handler: async (ctx) => {
    await requireRoles(ctx, RECEPTION_ROLES);

    const [orders, designTasks, users] = await Promise.all([
      ctx.db.query("customerOrders").collect(),
      ctx.db.query("designTasks").collect(),
      ctx.db.query("users").collect(),
    ]);

    const userNames = new Map(users.map((u) => [u.authUserId, u.name]));
    const now = Date.now();

    // Map design tasks by orderId
    const taskMap = new Map<string, Doc<"designTasks">>();
    for (const t of designTasks) {
      taskMap.set(t.orderId, t);
    }

    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const fileUrl = order.fileStorageId ? await ctx.storage.getUrl(order.fileStorageId) : null;
        const task = taskMap.get(order._id);
        let latestSubmission: any = null;
        if (task?.latestSubmissionId) {
          const sub = await ctx.db.get(task.latestSubmissionId);
          if (sub) {
            latestSubmission = {
              ...sub,
              fileUrl: await ctx.storage.getUrl(sub.fileStorageId),
            };
          }
        }

        const isOverdue =
          !["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"].includes(order.status) &&
          order.preferredDueDate < now;
        const isDueSoon =
          !["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"].includes(order.status) &&
          !isOverdue &&
          order.preferredDueDate < now + 86_400_000 * 2;

        return {
          ...order,
          fileUrl,
          designTask: task ? { ...task, latestSubmission } : null,
          isOverdue,
          isDueSoon,
          lockedByName: order.customerEditLockedBy ? userNames.get(order.customerEditLockedBy) : undefined,
          ageMs: now - order.createdAt,
        };
      }),
    );

    // 1. New Intake requiring acceptance (PENDING_REVIEW and not locked)
    const newIntake = enrichedOrders
      .filter((o) => o.status === "PENDING_REVIEW" && !o.customerEditLockedAt)
      .sort((a, b) => a.preferredDueDate - b.preferredDueDate);

    // 2. Customer Follow-up required
    const customerFollowUp = enrichedOrders
      .filter((o) => Boolean(o.returnedToCustomerReason) || o.status === "EXPIRED")
      .sort((a, b) => b.updatedAt - a.updatedAt);

    // 3. Design Assignment required (marked designRequired, but unassigned)
    const designAssignmentRequired = enrichedOrders
      .filter((o) => o.status === "RECEPTION_REVIEW" && o.designRequired && (!o.designStatus || o.designStatus === "UNASSIGNED"))
      .sort((a, b) => a.preferredDueDate - b.preferredDueDate);

    // 4. Design Review required (design submissions waiting for receptionist review)
    const designReviewRequired = enrichedOrders
      .filter((o) => o.designStatus === "SUBMITTED" && o.designTask?.latestSubmission)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    // 5. Pricing Queue (in review, design not required or approved, but not yet priced)
    const pricingQueue = enrichedOrders
      .filter((o) => o.status === "RECEPTION_REVIEW" && (!o.designRequired || o.designStatus === "APPROVED"))
      .sort((a, b) => a.preferredDueDate - b.preferredDueDate);

    // 6. Payment Waiting (handed off to cashier, awaiting payment verification)
    const paymentWaiting = enrichedOrders
      .filter((o) => o.status === "PRICED_AND_PENDING_PAYMENT" && !o.jobCardId)
      .sort((a, b) => (b.pricedAt ?? b.updatedAt) - (a.pricedAt ?? a.updatedAt));

    // 7. Returned from Cashier (cashier flagged payment/pricing issues)
    const returnedFromCashier = enrichedOrders
      .filter((o) => Boolean(o.returnedToReceptionReason) && o.status === "RECEPTION_REVIEW")
      .sort((a, b) => (b.returnedToReceptionAt ?? b.updatedAt) - (a.returnedToReceptionAt ?? a.updatedAt));

    // 8. Production Progress (active in factory)
    const productionProgress = enrichedOrders
      .filter((o) => ["JOB_CARD_CREATED", "WAITING_FOR_MATERIAL", "IN_PRODUCTION"].includes(o.status))
      .sort((a, b) => a.preferredDueDate - b.preferredDueDate);

    // 9. Overdue or At Risk
    const overdueOrAtRisk = enrichedOrders
      .filter((o) => o.isOverdue || o.isDueSoon)
      .sort((a, b) => a.preferredDueDate - b.preferredDueDate);

    return {
      newIntake,
      customerFollowUp,
      designAssignmentRequired,
      designReviewRequired,
      pricingQueue,
      paymentWaiting,
      returnedFromCashier,
      productionProgress,
      overdueOrAtRisk,
      counts: {
        newIntake: newIntake.length,
        customerFollowUp: customerFollowUp.length,
        designAssignmentRequired: designAssignmentRequired.length,
        designReviewRequired: designReviewRequired.length,
        pricingQueue: pricingQueue.length,
        paymentWaiting: paymentWaiting.length,
        returnedFromCashier: returnedFromCashier.length,
        productionProgress: productionProgress.length,
        overdueOrAtRisk: overdueOrAtRisk.length,
      },
    };
  },
});

export const acceptOrderForReview = mutation({
  args: {
    orderId: v.id("customerOrders"),
    reviewLockReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireRoles(ctx, RECEPTION_ROLES);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Order not found.");

    // Lock customer editing and set status to RECEPTION_REVIEW
    await lockOrderForReviewInternal(ctx, identity, {
      orderId: args.orderId,
      reviewLockReason: args.reviewLockReason ?? "Reception review accepted",
    });

    await ctx.db.insert("orderEvents", {
      orderId: args.orderId,
      actorId: identity._id,
      actorLabel: `Reception · ${identity.name ?? "Staff"}`,
      action: "ACCEPTED_FOR_REVIEW",
      detail: args.reviewLockReason ?? "Order accepted into reception review queue",
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

export const returnOrderForCustomerClarification = mutation({
  args: {
    orderId: v.id("customerOrders"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireRoles(ctx, RECEPTION_ROLES);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Order not found.");

    const cleanReason = args.reason.trim();
    if (!cleanReason) throw new ConvexError("Clarification reason is required.");

    const now = Date.now();
    await ctx.db.patch(args.orderId, {
      returnedToCustomerReason: cleanReason,
      returnedToCustomerAt: now,
      returnedToCustomerBy: identity._id,
      updatedAt: now,
    });

    await ctx.db.insert("orderEvents", {
      orderId: args.orderId,
      actorId: identity._id,
      actorLabel: `Reception · ${identity.name ?? "Staff"}`,
      action: "RETURNED_TO_CUSTOMER",
      detail: `Returned to customer for clarification: ${cleanReason}`,
      createdAt: now,
    });

    return { success: true };
  },
});

export const setDesignRequired = mutation({
  args: {
    orderId: v.id("customerOrders"),
    required: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireRoles(ctx, RECEPTION_ROLES);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Order not found.");

    const now = Date.now();
    await ctx.db.patch(args.orderId, {
      designRequired: args.required,
      designStatus: args.required ? (order.designStatus ?? "UNASSIGNED") : "NOT_REQUIRED",
      updatedAt: now,
    });

    return { success: true };
  },
});

export const assignDesignTask = mutation({
  args: {
    orderId: v.id("customerOrders"),
    designerId: v.string(), // authUserId
    customerBrief: v.optional(v.string()),
    productionBrief: v.optional(v.string()),
    requiredOutputType: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    dueTimestamp: v.optional(v.number()),
    priority: v.optional(orderPriority),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireRoles(ctx, RECEPTION_ROLES);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Order not found.");

    const designerUser = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", args.designerId))
      .unique();

    const designerName = designerUser?.name ?? "Designer";
    const now = Date.now();

    let taskId = order.activeDesignTaskId;
    if (taskId) {
      await ctx.db.patch(taskId, {
        assignedDesignerId: args.designerId,
        assignedDesignerName: designerName,
        assignedAt: now,
        status: "ASSIGNED",
        customerBrief: args.customerBrief ?? order.notes,
        productionBrief: args.productionBrief,
        requiredOutputType: args.requiredOutputType,
        dimensions: args.dimensions ?? order.dimensions,
        dueTimestamp: args.dueTimestamp ?? order.preferredDueDate,
        priority: args.priority ?? order.priority,
        updatedAt: now,
      });
    } else {
      taskId = await ctx.db.insert("designTasks", {
        orderId: args.orderId,
        assignedDesignerId: args.designerId,
        assignedDesignerName: designerName,
        assignedAt: now,
        createdBy: identity._id,
        createdByName: identity.name ?? "Receptionist",
        status: "ASSIGNED",
        customerBrief: args.customerBrief ?? order.notes,
        productionBrief: args.productionBrief,
        requiredOutputType: args.requiredOutputType,
        dimensions: args.dimensions ?? order.dimensions,
        dueTimestamp: args.dueTimestamp ?? order.preferredDueDate,
        priority: args.priority ?? order.priority,
        currentVersionNumber: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.orderId, {
      designRequired: true,
      designStatus: "ASSIGNED",
      activeDesignTaskId: taskId,
      updatedAt: now,
    });

    await ctx.db.insert("orderEvents", {
      orderId: args.orderId,
      actorId: identity._id,
      actorLabel: `Reception · ${identity.name ?? "Staff"}`,
      action: "DESIGN_ASSIGNED",
      detail: `Assigned design work to ${designerName}`,
      createdAt: now,
    });

    await notifyUser(ctx, args.designerId, {
      title: "New design task assigned",
      message: `${order.code} (${order.clientName}) · Artwork requested for ${order.serviceType}.`,
      type: "design_task",
      actorAuthUserId: identity._id,
      relatedTable: "designTasks",
      relatedId: taskId,
    });

    return { success: true, taskId };
  },
});

export const reviewDesignSubmission = mutation({
  args: {
    taskId: v.id("designTasks"),
    decision: v.union(v.literal("APPROVED"), v.literal("REVISION_REQUIRED")),
    feedback: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireRoles(ctx, RECEPTION_ROLES);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Design task not found.");

    const order = await ctx.db.get(task.orderId);
    if (!order) throw new ConvexError("Associated order not found.");

    const now = Date.now();
    const isApproved = args.decision === "APPROVED";

    if (task.latestSubmissionId) {
      await ctx.db.patch(task.latestSubmissionId, {
        status: args.decision,
        receptionFeedback: args.feedback?.trim() || undefined,
        reviewedBy: identity._id,
        reviewedByName: identity.name ?? "Receptionist",
        reviewedAt: now,
      });
    }

    await ctx.db.patch(args.taskId, {
      status: args.decision,
      receptionReviewNotes: args.feedback?.trim() || undefined,
      updatedAt: now,
    });

    await ctx.db.patch(task.orderId, {
      designStatus: args.decision,
      updatedAt: now,
    });

    await ctx.db.insert("orderEvents", {
      orderId: task.orderId,
      actorId: identity._id,
      actorLabel: `Reception · ${identity.name ?? "Staff"}`,
      action: isApproved ? "DESIGN_APPROVED" : "DESIGN_REVISION_REQUESTED",
      detail: isApproved
        ? "Design artwork approved for production and pricing"
        : `Revision requested: ${args.feedback ?? "Corrections required"}`,
      createdAt: now,
    });

    if (task.assignedDesignerId) {
      await notifyUser(ctx, task.assignedDesignerId, {
        title: isApproved ? "Design artwork approved" : "Design revision requested",
        message: `${order.code} · ${isApproved ? "Artwork approved by reception." : `Revision requested: ${args.feedback ?? ""}`}`,
        type: "design_submission",
        actorAuthUserId: identity._id,
        relatedTable: "designTasks",
        relatedId: args.taskId,
      });
    }

    return { success: true, decision: args.decision };
  },
});
