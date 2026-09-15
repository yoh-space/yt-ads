import { v } from 'convex/values';

import { action } from './_generated/server';
import { api } from './_generated/api';
import { send } from 'expo-push-easy';

type PushTokenRecord = {
  _id: string;
  userId: string;
  token: string;
  platform?: string;
  updatedAt: number;
};

type SendNotificationResult = {
  ok: boolean;
  sent: number;
  results?: unknown[];
  error?: string;
};

export const sendNotificationToUser: any = action({
  args: {
    userId: v.string(),
    title: v.string(),
    body: v.string(),
    deepLink: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SendNotificationResult> => {
    const serviceAccount = (globalThis as {
      process?: { env?: { FCM_SERVICE_ACCOUNT?: string } };
    }).process?.env?.FCM_SERVICE_ACCOUNT;

    if (!serviceAccount) {
      return { ok: false, sent: 0, error: 'FCM_SERVICE_ACCOUNT environment variable is not set' };
    }

    const tokens = (await ctx.runQuery(api.pushTokens.getTokensForUser, {
      userId: args.userId,
    })) as PushTokenRecord[];

    if (tokens.length === 0) {
      return { ok: false, sent: 0, error: 'No tokens saved for this user yet.' };
    }

    const results = await Promise.all(
      tokens.map(async (record) => {
        const result = await send(
          record.token,
          {
            title: args.title,
            body: args.body,
            deepLink: args.deepLink ?? 'expo-push-easy://convex-example',
            data: { userId: args.userId, source: 'convex-example' },
            android: { channelId: 'default', priority: 'HIGH' },
          },
          { serviceAccount },
        );
        await ctx.runMutation(api.history.save, {
          userId: args.userId,
          title: args.title,
          body: args.body,
          deepLink: args.deepLink,
          success: result.success,
          provider: result.provider || 'fcm',
          error: result.success ? undefined : result.error,
        });
        return result;
      }),
    );

    const successCount = results.filter((r: any) => r.success).length;
    return {
      ok: successCount > 0,
      sent: successCount,
      results,
      error: successCount === results.length ? undefined : `${results.length - successCount} failed`,
    };
  },
});

export const sendBatch: any = action({
  args: {
    userIds: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    deepLink: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SendNotificationResult> => {
    const serviceAccount = (globalThis as {
      process?: { env?: { FCM_SERVICE_ACCOUNT?: string } };
    }).process?.env?.FCM_SERVICE_ACCOUNT;

    if (!serviceAccount) {
      return { ok: false, sent: 0, error: 'FCM_SERVICE_ACCOUNT environment variable is not set' };
    }

    let totalSent = 0;
    const allResults: unknown[] = [];

    for (const userId of args.userIds) {
      const tokens = (await ctx.runQuery(api.pushTokens.getTokensForUser, {
        userId,
      })) as PushTokenRecord[];

      for (const record of tokens) {
        const result = await send(
          record.token,
          {
            title: args.title,
            body: args.body,
            deepLink: args.deepLink ?? 'expo-push-easy://convex-example',
            data: { userId, source: 'convex-example' },
            android: { channelId: 'default', priority: 'HIGH' },
          },
          { serviceAccount },
        );
        await ctx.runMutation(api.history.save, {
          userId,
          title: args.title,
          body: args.body,
          deepLink: args.deepLink,
          success: result.success,
          provider: result.provider || 'fcm',
          error: result.success ? undefined : result.error,
        });
        allResults.push(result);
        if (result.success) totalSent++;
      }
    }

    return {
      ok: totalSent > 0,
      sent: totalSent,
      results: allResults,
      error: totalSent === allResults.length ? undefined : `${allResults.length - totalSent} failed`,
    };
  },
});

export const sendToAll: any = action({
  args: {
    title: v.string(),
    body: v.string(),
    deepLink: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SendNotificationResult> => {
    const serviceAccount = (globalThis as {
      process?: { env?: { FCM_SERVICE_ACCOUNT?: string } };
    }).process?.env?.FCM_SERVICE_ACCOUNT;

    if (!serviceAccount) {
      return { ok: false, sent: 0, error: 'FCM_SERVICE_ACCOUNT environment variable is not set' };
    }

    const allTokens = (await ctx.runQuery(api.pushTokens.getAllTokens)) as PushTokenRecord[];

    if (allTokens.length === 0) {
      return { ok: false, sent: 0, error: 'No tokens in database.' };
    }

    let totalSent = 0;
    const allResults: unknown[] = [];

    for (const record of allTokens) {
      const result = await send(
        record.token,
        {
          title: args.title,
          body: args.body,
          deepLink: args.deepLink ?? 'expo-push-easy://convex-example',
          data: { userId: record.userId, source: 'convex-example' },
          android: { channelId: 'default', priority: 'HIGH' },
        },
        { serviceAccount },
      );
      await ctx.runMutation(api.history.save, {
        userId: record.userId,
        title: args.title,
        body: args.body,
        deepLink: args.deepLink,
        success: result.success,
        provider: result.provider || 'fcm',
        error: result.success ? undefined : result.error,
      });
      allResults.push(result);
      if (result.success) totalSent++;
    }

    return {
      ok: totalSent > 0,
      sent: totalSent,
      results: allResults,
      error: totalSent === allResults.length ? undefined : `${allResults.length - totalSent} failed`,
    };
  },
});
