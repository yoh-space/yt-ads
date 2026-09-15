import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const save = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    body: v.string(),
    deepLink: v.optional(v.string()),
    success: v.boolean(),
    provider: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('notificationHistory', {
      userId: args.userId,
      title: args.title,
      body: args.body,
      deepLink: args.deepLink,
      sentAt: Date.now(),
      success: args.success,
      provider: args.provider,
      error: args.error,
    });
  },
});

export const getHistory = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query('notificationHistory')
      .filter((q) => q.eq(q.field('userId'), args.userId))
      .order('desc')
      .take(args.limit ?? 50);
    return items;
  },
});

export const getAllHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('notificationHistory')
      .order('desc')
      .take(args.limit ?? 50);
  },
});

export const clearHistory = mutation({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.userId) {
      const items = await ctx.db
        .query('notificationHistory')
        .filter((q) => q.eq(q.field('userId'), args.userId))
        .collect();
      await Promise.all(items.map((item) => ctx.db.delete(item._id)));
    } else {
      const items = await ctx.db.query('notificationHistory').collect();
      await Promise.all(items.map((item) => ctx.db.delete(item._id)));
    }
  },
});
