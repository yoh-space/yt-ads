import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireActiveProfile } from "./users";
import { notificationType } from "./schema";
import {
  canViewNotification,
  resolveNotificationContext,
  getNotificationDomain,
  getAllowedDomainsForRole,
  type NotificationRecord,
  type NotificationContext,
  type UserProfile,
  type NotificationDomain,
} from "./notificationPolicy";

type DbCtx = QueryCtx | MutationCtx;

export const notificationCategory = v.union(
  v.literal("all"),
  v.literal("orders"),
  v.literal("inventory"),
  v.literal("operations"),
  v.literal("account"),
);

async function resolveVisibleNotifications(
  ctx: DbCtx,
  profile: UserProfile,
  notifications: NotificationRecord[],
) {
  const resolved = await Promise.all(
    notifications.map(async (notification) => {
      const context = await resolveNotificationContext(ctx, notification);
      return canViewNotification(profile, notification, context) ? { notification, context } : null;
    }),
  );
  return resolved.filter(
    (entry): entry is { notification: NotificationRecord; context: NotificationContext } => entry !== null,
  );
}

export const list = query({
  args: {
    category: v.optional(notificationCategory),
  },
  returns: v.array(
    v.object({
      _id: v.id("notifications"),
      title: v.string(),
      message: v.string(),
      type: notificationType,
      domain: v.string(),
      actorName: v.optional(v.string()),
      relatedLabel: v.optional(v.string()),
      createdAt: v.number(),
      readAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const { identity, profile } = await requireActiveProfile(ctx);
    const userProfile: UserProfile = {
      authUserId: identity._id,
      role: profile.role,
      assignedMachineIds: profile.assignedMachineIds,
    };

    const allowedDomains = getAllowedDomainsForRole(profile.role);
    if (args.category && args.category !== "all") {
      if (!allowedDomains.includes(args.category as NotificationDomain)) {
        return [];
      }
    }

    const [notifications, users] = await Promise.all([
      ctx.db
        .query("notifications")
        .withIndex("by_recipient_created", (q) => q.eq("recipientAuthUserId", identity._id))
        .order("desc")
        .take(100),
      ctx.db.query("users").collect(),
    ]);

    const names = new Map(users.map((user) => [user.authUserId, user.name]));
    const visible = await resolveVisibleNotifications(ctx, userProfile, notifications);

    const filtered = args.category && args.category !== "all"
      ? visible.filter(({ notification }) => getNotificationDomain(notification.type) === args.category)
      : visible;

    return filtered.slice(0, 40).map(({ notification, context }) => ({
      _id: notification._id!,
      title: notification.title,
      message: context.message ?? notification.message,
      type: notification.type,
      domain: getNotificationDomain(notification.type),
      actorName: notification.actorAuthUserId ? names.get(notification.actorAuthUserId) : undefined,
      relatedLabel: context.relatedLabel,
      createdAt: notification.createdAt ?? 0,
      readAt: notification.readAt,
    }));
  },
});

export const unreadCount = query({
  args: {
    category: v.optional(notificationCategory),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { identity, profile } = await requireActiveProfile(ctx);
    const userProfile: UserProfile = {
      authUserId: identity._id,
      role: profile.role,
      assignedMachineIds: profile.assignedMachineIds,
    };

    const allowedDomains = getAllowedDomainsForRole(profile.role);
    if (args.category && args.category !== "all") {
      if (!allowedDomains.includes(args.category as NotificationDomain)) {
        return 0;
      }
    }

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_created", (q) => q.eq("recipientAuthUserId", identity._id))
      .collect();

    const visible = await resolveVisibleNotifications(ctx, userProfile, notifications);

    const filtered = args.category && args.category !== "all"
      ? visible.filter(({ notification }) => getNotificationDomain(notification.type) === args.category)
      : visible;

    return filtered.reduce((count, { notification }) => count + (notification.readAt ? 0 : 1), 0);
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

    const userProfile: UserProfile = {
      authUserId: identity._id,
      role: profile.role,
      assignedMachineIds: profile.assignedMachineIds,
    };

    const context = await resolveNotificationContext(ctx, notification);
    if (!canViewNotification(userProfile, notification, context)) {
      throw new Error("Notification not found.");
    }

    if (!notification.readAt) {
      await ctx.db.patch(args.notificationId, { readAt: Date.now() });
    }
  },
});

export const markAllRead = mutation({
  args: {
    category: v.optional(notificationCategory),
  },
  returns: v.object({ updated: v.number() }),
  handler: async (ctx, args) => {
    const { identity, profile } = await requireActiveProfile(ctx);
    const userProfile: UserProfile = {
      authUserId: identity._id,
      role: profile.role,
      assignedMachineIds: profile.assignedMachineIds,
    };

    const allowedDomains = getAllowedDomainsForRole(profile.role);
    if (args.category && args.category !== "all") {
      if (!allowedDomains.includes(args.category as NotificationDomain)) {
        return { updated: 0 };
      }
    }

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_created", (q) => q.eq("recipientAuthUserId", identity._id))
      .collect();

    const visible = await resolveVisibleNotifications(ctx, userProfile, notifications);

    const filtered = args.category && args.category !== "all"
      ? visible.filter(({ notification }) => getNotificationDomain(notification.type) === args.category)
      : visible;

    const readAt = Date.now();
    let updated = 0;
    for (const { notification } of filtered) {
      if (!notification.readAt && notification._id) {
        await ctx.db.patch(notification._id, { readAt });
        updated++;
      }
    }
    return { updated };
  },
});
