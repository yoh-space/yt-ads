import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireActiveProfile } from "./users";
import { notificationType } from "./schema";
import type { Role } from "./types";

type DbCtx = QueryCtx | MutationCtx;

type NotificationType =
  | "material_request"
  | "material_issue"
  | "material_received"
  | "short_stock"
  | "material_overuse"
  | "discrepancy"
  | "job_update"
  | "machine_update"
  | "account_update"
  | "order_received"
  | "order_status"
  | "overdue_order"
  | "exception_stock_out"
  | "clearance_granted"
  | "clearance_rejected";

type NotificationRecord = {
  _id: Id<"notifications">;
  title: string;
  message: string;
  type: NotificationType;
  actorAuthUserId?: string;
  relatedTable?: string;
  relatedId?: string;
  createdAt: number;
  readAt?: number;
};

type NotificationContext = {
  message: string;
  relatedLabel?: string;
  machineId?: Id<"machines">;
  machineRole?: Role;
};

const MANAGEMENT_ROLES: Role[] = ["owner", "manager", "admin"];
const OPERATOR_ROLES: Role[] = ["laser_operator", "cnc_operator", "plotter_operator", "printer_operator"];
const INVENTORY_TYPES: NotificationType[] = [
  "material_request",
  "material_issue",
  "material_received",
  "short_stock",
  "material_overuse",
  "discrepancy",
  "exception_stock_out",
];
const ORDER_TYPES: NotificationType[] = ["order_received", "order_status", "overdue_order"];

function replaceIds(message: string, replacements: Array<[string | undefined, string | undefined]>) {
  const resolved = replacements.reduce((current, [id, label]) => {
    if (!id || !label || id === label) return current;
    return current.split(id).join(label);
  }, message);
  // Legacy notifications may contain an ID without usable relation metadata.
  return resolved.replace(/\b[a-z][a-z0-9]{19,}\b/gi, "related item");
}

async function resolveNotificationContext(ctx: DbCtx, notification: NotificationRecord): Promise<NotificationContext> {
  const relatedId = notification.relatedId;
  if (!notification.relatedTable || !relatedId) return { message: notification.message };

  switch (notification.relatedTable) {
    case "machines": {
      const machine = await ctx.db.get(relatedId as Id<"machines">);
      return {
        message: replaceIds(notification.message, [[relatedId, machine?.name]]),
        relatedLabel: machine?.name,
        machineId: machine?._id,
        machineRole: machine?.operatorRole,
      };
    }
    case "jobCards": {
      const job = await ctx.db.get(relatedId as Id<"jobCards">);
      const machine = job ? await ctx.db.get(job.machineId) : null;
      return {
        message: replaceIds(notification.message, [[relatedId, job?.code]]),
        relatedLabel: job?.code,
        machineId: machine?._id,
        machineRole: machine?.operatorRole,
      };
    }
    case "customerOrders": {
      const order = await ctx.db.get(relatedId as Id<"customerOrders">);
      const machine = order?.machineId ? await ctx.db.get(order.machineId) : null;
      return {
        message: replaceIds(notification.message, [[relatedId, order?.code]]),
        relatedLabel: order?.code,
        machineId: machine?._id,
        machineRole: machine?.operatorRole,
      };
    }
    case "materialRequests": {
      const request = await ctx.db.get(relatedId as Id<"materialRequests">);
      const [job, material] = request
        ? await Promise.all([ctx.db.get(request.jobCardId), ctx.db.get(request.materialId)])
        : [null, null];
      const machine = job ? await ctx.db.get(job.machineId) : null;
      return {
        message: replaceIds(notification.message, [
          [relatedId, `${material?.name ?? "Material"} request for ${job?.code ?? "production job"}`],
          [request?.jobCardId, job?.code],
          [request?.materialId, material?.name],
        ]),
        relatedLabel: material?.name ?? job?.code,
        machineId: machine?._id,
        machineRole: machine?.operatorRole,
      };
    }
    case "operatorSubStock": {
      const batch = await ctx.db.get(relatedId as Id<"operatorSubStock">);
      const [material, machine] = batch
        ? await Promise.all([ctx.db.get(batch.materialId), ctx.db.get(batch.machineId)])
        : [null, null];
      const label = material && machine ? `${material.name} on ${machine.name}` : machine?.name ?? material?.name;
      return {
        message: replaceIds(notification.message, [[relatedId, label]]),
        relatedLabel: label,
        machineId: machine?._id,
        machineRole: machine?.operatorRole,
      };
    }
    case "weeklyReconciliations": {
      const reconciliation = await ctx.db.get(relatedId as Id<"weeklyReconciliations">);
      const machine = reconciliation ? await ctx.db.get(reconciliation.machineId) : null;
      return {
        message: replaceIds(notification.message, [[relatedId, machine ? `${machine.name} reconciliation` : undefined]]),
        relatedLabel: machine?.name,
        machineId: machine?._id,
        machineRole: machine?.operatorRole,
      };
    }
    case "materials": {
      const material = await ctx.db.get(relatedId as Id<"materials">);
      return {
        message: replaceIds(notification.message, [[relatedId, material?.name]]),
        relatedLabel: material?.name,
      };
    }
    case "stockExceptions": {
      const exception = await ctx.db.get(relatedId as Id<"stockExceptions">);
      const material = exception ? await ctx.db.get(exception.materialId) : null;
      return {
        message: replaceIds(notification.message, [[relatedId, material ? `${material.name} stock exception` : undefined]]),
        relatedLabel: material?.name,
      };
    }
    case "users": {
      const user = await ctx.db.get(relatedId as Id<"users">);
      return {
        message: replaceIds(notification.message, [[relatedId, user?.name]]),
        relatedLabel: user?.name,
      };
    }
    default:
      return { message: notification.message };
  }
}

function canViewNotification(
  profile: { role: Role; assignedMachineIds?: Id<"machines">[] },
  notification: NotificationRecord,
  context: NotificationContext,
) {
  if (MANAGEMENT_ROLES.includes(profile.role) || notification.type === "account_update") return true;
  if (profile.role === "storekeeper") return INVENTORY_TYPES.includes(notification.type);
  if (profile.role === "receptionist") return ORDER_TYPES.includes(notification.type);
  if (!OPERATOR_ROLES.includes(profile.role)) return false;
  if (!context.machineId || context.machineRole !== profile.role) return false;
  if (profile.assignedMachineIds?.length) return profile.assignedMachineIds.includes(context.machineId);
  return true;
}

async function resolveVisibleNotifications(
  ctx: DbCtx,
  profile: { role: Role; assignedMachineIds?: Id<"machines">[] },
  notifications: NotificationRecord[],
) {
  const resolved = await Promise.all(notifications.map(async (notification) => {
    const context = await resolveNotificationContext(ctx, notification);
    return canViewNotification(profile, notification, context) ? { notification, context } : null;
  }));
  return resolved.filter((entry): entry is { notification: NotificationRecord; context: NotificationContext } => entry !== null);
}

export const list = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("notifications"),
    title: v.string(),
    message: v.string(),
    type: notificationType,
    actorName: v.optional(v.string()),
    relatedLabel: v.optional(v.string()),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })),
  handler: async (ctx) => {
    const { identity, profile } = await requireActiveProfile(ctx);
    const [notifications, users] = await Promise.all([
      ctx.db
        .query("notifications")
        .withIndex("by_recipient_created", (q) => q.eq("recipientAuthUserId", identity._id))
        .order("desc")
        .take(100),
      ctx.db.query("users").collect(),
    ]);
    const names = new Map(users.map((user) => [user.authUserId, user.name]));
    const visible = await resolveVisibleNotifications(ctx, profile, notifications);
    return visible.slice(0, 40).map(({ notification, context }) => ({
      _id: notification._id,
      title: notification.title,
      message: context.message,
      type: notification.type,
      actorName: notification.actorAuthUserId ? names.get(notification.actorAuthUserId) : undefined,
      relatedLabel: context.relatedLabel,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    }));
  },
});

export const unreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const { identity, profile } = await requireActiveProfile(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_created", (q) => q.eq("recipientAuthUserId", identity._id))
      .collect();
    const visible = await resolveVisibleNotifications(ctx, profile, notifications);
    return visible.reduce((count, { notification }) => count + (notification.readAt ? 0 : 1), 0);
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const { identity, profile } = await requireActiveProfile(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.recipientAuthUserId !== identity._id) {
      throw new Error("Notification not found.");
    }
    const context = await resolveNotificationContext(ctx, notification);
    if (!canViewNotification(profile, notification, context)) throw new Error("Notification not found.");
    if (!notification.readAt) await ctx.db.patch(args.notificationId, { readAt: Date.now() });
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.object({ updated: v.number() }),
  handler: async (ctx) => {
    const { identity, profile } = await requireActiveProfile(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_created", (q) => q.eq("recipientAuthUserId", identity._id))
      .collect();
    const visible = await resolveVisibleNotifications(ctx, profile, notifications);
    const readAt = Date.now();
    for (const { notification } of visible) {
      if (!notification.readAt) await ctx.db.patch(notification._id, { readAt });
    }
    return { updated: visible.filter(({ notification }) => !notification.readAt).length };
  },
});
