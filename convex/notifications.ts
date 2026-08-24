import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireActiveProfile } from "./users";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { identity } = await requireActiveProfile(ctx);
    const [notifications, users] = await Promise.all([
      ctx.db.query("notifications").withIndex("by_recipient_created", (q) => q.eq("recipientAuthUserId", identity._id)).collect(),
      ctx.db.query("users").collect(),
    ]);
    const names = new Map(users.map((user) => [user.authUserId, user.name]));
    return notifications
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 40)
      .map((notification) => ({
        ...notification,
        actorName: notification.actorAuthUserId ? names.get(notification.actorAuthUserId) : undefined,
      }));
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const { identity } = await requireActiveProfile(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_created", (q) => q.eq("recipientAuthUserId", identity._id))
      .collect();
    return notifications.reduce((count, notification) => count + (notification.readAt ? 0 : 1), 0);
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const { identity } = await requireActiveProfile(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.recipientAuthUserId !== identity._id) {
      throw new Error("Notification not found.");
    }
    if (!notification.readAt) await ctx.db.patch(args.notificationId, { readAt: Date.now() });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const { identity } = await requireActiveProfile(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_created", (q) => q.eq("recipientAuthUserId", identity._id))
      .collect();
    const readAt = Date.now();
    for (const notification of notifications) {
      if (!notification.readAt) await ctx.db.patch(notification._id, { readAt });
    }
    return { updated: notifications.filter((notification) => !notification.readAt).length };
  },
});
