import { internalMutation, internalAction, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Canonical `customerOrders.status` values. Any stored value outside this set
 * is a legacy alias from an earlier write path and must be normalized.
 */
const CANONICAL_ORDER_STATUSES: ReadonlySet<string> = new Set([
  "PENDING_REVIEW",
  "PRICED_AND_PENDING_PAYMENT",
  "CONFIRMED_PAID_OR_CREDIT",
  "JOB_CARD_CREATED",
  "IN_PRODUCTION",
  "COMPLETED",
  "Expired",
  "EXPIRED_JUNK",
]);

/** Map of legacy order-status values (casing or pre-lifecycle states) to their canonical value. */
const ORDER_STATUS_ALIASES: Record<string, string> = {
  Received: "PENDING_REVIEW",
  "Recieved": "PENDING_REVIEW",
  Completed: "COMPLETED",
  "In Production": "IN_PRODUCTION",
  "In production": "IN_PRODUCTION",
  in_production: "IN_PRODUCTION",
  completed: "COMPLETED",
  "Ready for Pickup": "COMPLETED",
};

/**
 * One-shot backfill that normalizes legacy `customerOrders.status` casing to the
 * canonical schema values. The `orderStatus` union is temporarily widened (see
 * `convex/schema.ts`) so this can read and rewrite rows that the tightened
 * validator previously rejected.
 *
 * Idempotent: once every affected row is canonical the operation is a no-op, and
 * a `migrations` row prevents it from re-scanning the table unnecessarily.
 */
export const migrateOrderStatusCasing = internalAction({
  args: {},
  handler: async (ctx): Promise<{ patched: number }> => {
    return ctx.runMutation(internal.migrations.normalizeOrderStatusCasing, {});
  },
});

/** Applies the normalization in a single transactional mutation. */
export const normalizeOrderStatusCasing = internalMutation({
  args: {},
  handler: async (ctx) => {
    const alreadyRun = await ctx.db
      .query("migrations")
      .withIndex("by_key", (q: any) => q.eq("key", "orderStatusCasing"))
      .unique();
    if (alreadyRun) {
      return { patched: 0, skipped: true };
    }

    let patched = 0;
    const orders = await ctx.db.query("customerOrders").collect();

    for (const order of orders) {
      const status = order.status as string;
      if (CANONICAL_ORDER_STATUSES.has(status)) continue;
      const canonical = ORDER_STATUS_ALIASES[status];
      if (!canonical) continue;
      await ctx.db.patch(order._id, {
        status: canonical as typeof order.status,
        updatedAt: Date.now(),
      });
      patched++;
    }

    await ctx.db.insert("migrations", { key: "orderStatusCasing", ranAt: Date.now() });
    return { patched };
  },
});

/**
 * Owner-triggerable manual entry point for the same backfill, useful while the
 * one-shot cron has not yet fired or for running it on demand after deploy.
 */
export const runOrderStatusMigration = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("migrations")
      .withIndex("by_key", (q: any) => q.eq("key", "orderStatusCasing"))
      .unique();
    if (existing) {
      return { skipped: true, reason: "already run" };
    }
    await ctx.scheduler.runAfter(0, internal.migrations.migrateOrderStatusCasing, {});
    return { scheduled: true };
  },
});
