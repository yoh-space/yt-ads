import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// 8 KB cap on the serialized grammY session (language, active step, order draft).
const MAX_DATA_LENGTH = 8192;

function normalizeKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) throw new Error("Session key is required.");
  if (trimmed.length > 128) throw new Error("Session key is too long.");
  return trimmed;
}

/**
 * Reads the serialized session for a Telegram chat. Returns `null` when the
 * chat has no stored session yet (the bot then starts with default values).
 */
export const getTelegramSession = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("telegramSessions")
      .withIndex("by_key", (q) => q.eq("key", normalizeKey(args.key)))
      .unique();
    return { data: row?.data ?? null };
  },
});

/** Upserts the serialized session for a Telegram chat. */
export const setTelegramSession = mutation({
  args: { key: v.string(), data: v.string() },
  handler: async (ctx, args) => {
    const key = normalizeKey(args.key);
    if (!args.data || args.data.length > MAX_DATA_LENGTH) {
      throw new Error("Invalid session payload.");
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("telegramSessions")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { data: args.data, updatedAt: now });
    } else {
      await ctx.db.insert("telegramSessions", { key, data: args.data, updatedAt: now });
    }
  },
});

/** Deletes the session for a Telegram chat when the conversation resets. */
export const deleteTelegramSession = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("telegramSessions")
      .withIndex("by_key", (q) => q.eq("key", normalizeKey(args.key)))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});