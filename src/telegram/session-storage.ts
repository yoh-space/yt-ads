import type { StorageAdapter } from "grammy";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { TelegramSessionData } from "./types";

/**
 * grammY `StorageAdapter` backed by the Convex `telegramSessions` table. This
 * keeps language preference and in-progress order drafts durable across bot
 * restarts and serverless webhook invocations. Each read/write is a small,
 * transactional Convex operation.
 */
export function createConvexStorage(): StorageAdapter<TelegramSessionData> {
  return {
    read: async (key) => {
      const result = await fetchQuery(api.telegramSessions.getTelegramSession, { key });
      if (!result.data) return undefined;
      try {
        return JSON.parse(result.data) as TelegramSessionData;
      } catch {
        return undefined;
      }
    },
    write: async (key, value) => {
      await fetchMutation(api.telegramSessions.setTelegramSession, { key, data: JSON.stringify(value) });
    },
    delete: async (key) => {
      await fetchMutation(api.telegramSessions.deleteTelegramSession, { key });
    },
  };
}