import { v } from 'convex/values';
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { send } from 'expo-push-easy';

export const schedule = internalMutation({
  args: {
    userId: v.string(),
    title: v.string(),
    body: v.string(),
    deepLink: v.optional(v.string()),
    scheduledFor: v.number(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('scheduledNotifications', {
      userId: args.userId,
      title: args.title,
      body: args.body,
      deepLink: args.deepLink,
      scheduledFor: args.scheduledFor,
      status: args.status ?? 'pending',
      createdAt: Date.now(),
    });
    return { id };
  },
});

export const scheduleAction = action({
  args: {
    userId: v.string(),
    title: v.string(),
    body: v.string(),
    deepLink: v.optional(v.string()),
    delayMinutes: v.number(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; scheduledFor: number; scheduledId: string }> => {
    const scheduledFor = Date.now() + args.delayMinutes * 60 * 1000;
    const result = (await ctx.runMutation(internal.scheduled.schedule, {
      userId: args.userId,
      title: args.title,
      body: args.body,
      deepLink: args.deepLink,
      scheduledFor,
    })) as { id: string };
    await ctx.scheduler.runAt(scheduledFor, internal.scheduled.process);
    return { ok: true, scheduledFor, scheduledId: result.id };
  },
});

export const scheduleBulkAction = action({
  args: {
    userIds: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    deepLink: v.optional(v.string()),
    delayMinutes: v.number(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; scheduledFor: number; count: number }> => {
    const scheduledFor = Date.now() + args.delayMinutes * 60 * 1000;
    const ids: string[] = [];
    for (const userId of args.userIds) {
      const result = (await ctx.runMutation(internal.scheduled.schedule, {
        userId,
        title: args.title,
        body: args.body,
        deepLink: args.deepLink,
        scheduledFor,
      })) as { id: string };
      ids.push(result.id);
    }
    await ctx.scheduler.runAt(scheduledFor, internal.scheduled.process);
    return { ok: true, scheduledFor, count: ids.length };
  },
});

export const getPendingForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('scheduledNotifications')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), args.userId),
          q.neq(q.field('status'), 'sent'),
        ),
      )
      .order('desc')
      .collect();
  },
});

export const getAllPending = query({
  handler: async (ctx) => {
    return await ctx.db
      .query('scheduledNotifications')
      .filter((q) => q.neq(q.field('status'), 'sent'))
      .order('desc')
      .collect();
  },
});

export const getPending = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('scheduledNotifications')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), args.userId),
          q.eq(q.field('status'), 'pending'),
        ),
      )
      .collect();
  },
});

export const process = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query('scheduledNotifications')
      .filter((q) =>
        q.and(
          q.eq(q.field('status'), 'pending'),
          q.lte(q.field('scheduledFor'), now),
        ),
      )
      .collect();

    for (const notification of due) {
      try {
        const tokens = await ctx.db
          .query('pushTokens')
          .filter((q) => q.eq(q.field('userId'), notification.userId))
          .collect();

        if (tokens.length === 0) {
          await ctx.db.patch(notification._id, { status: 'failed', error: 'No tokens' });
          continue;
        }

        const raw = (globalThis as { process?: { env?: { FCM_SERVICE_ACCOUNT?: string } } })
          .process?.env?.FCM_SERVICE_ACCOUNT;

        for (const t of tokens) {
          await send(
            t.token,
            {
              title: notification.title,
              body: notification.body,
              deepLink: notification.deepLink ?? 'expo-push-easy://convex-example',
              android: { channelId: 'default', priority: 'HIGH' },
            },
            raw ? { serviceAccount: raw } : {},
          );
        }

        await ctx.db.patch(notification._id, { status: 'sent', sentAt: Date.now() });
      } catch (error) {
        await ctx.db.patch(notification._id, { status: 'failed', error: String(error) });
      }
    }
  },
});

export const cancel = mutation({
  args: { notificationId: v.id('scheduledNotifications') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, { status: 'cancelled' });
    return { ok: true };
  },
});

export const cancelForUser = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query('scheduledNotifications')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), args.userId),
          q.eq(q.field('status'), 'pending'),
        ),
      )
      .collect();
    await Promise.all(pending.map((p) => ctx.db.patch(p._id, { status: 'cancelled' })));
    return { ok: true, count: pending.length };
  },
});
