import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { convexTokenHelpers } from 'expo-push-easy/adapters';

export const saveToken = mutation({
  args: {
    userId: v.string(),
    token: v.string(),
    platform: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await convexTokenHelpers.saveToken(ctx.db, args.userId, args.token, args.platform);
    return { ok: true };
  },
});

export const getTokensForUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await convexTokenHelpers.getTokensForUser(ctx.db, args.userId);
  },
});

export const removeToken = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await convexTokenHelpers.removeToken(ctx.db, args.token);
    return { ok: true };
  },
});

export const getAllTokens = query({
  handler: async (ctx) => {
    return await ctx.db.query('pushTokens').collect();
  },
});

export const getAllUserIds = query({
  handler: async (ctx) => {
    const tokens = await ctx.db.query('pushTokens').collect();
    const userIds = [...new Set(tokens.map((t) => t.userId))];
    return userIds;
  },
});

export const getTokenCount = query({
  handler: async (ctx) => {
    const tokens = await ctx.db.query('pushTokens').collect();
    return tokens.length;
  },
});
