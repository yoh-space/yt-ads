import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  pushTokens: defineTable({
    userId: v.string(),
    token: v.string(),
    platform: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_token', ['token']),
  
  scheduledNotifications: defineTable({
    userId: v.string(),
    title: v.string(),
    body: v.string(),
    deepLink: v.optional(v.string()),
    scheduledFor: v.number(), // Unix timestamp
    status: v.string(), // 'pending', 'sent', 'failed', 'cancelled'
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_status', ['status'])
    .index('by_scheduled_time', ['scheduledFor']),
    
  notificationHistory: defineTable({
    userId: v.string(),
    title: v.string(),
    body: v.string(),
    deepLink: v.optional(v.string()),
    sentAt: v.number(),
    success: v.boolean(),
    provider: v.string(), // 'fcm' or 'expo-push'
    error: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_sent_time', ['sentAt']),
});