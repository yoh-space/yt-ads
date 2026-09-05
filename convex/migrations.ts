import { internalMutation, internalAction, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requirePermission } from "./users";

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
  "READY_FOR_PICKUP",
  "EXPIRED",
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
  Expired: "EXPIRED",
  expired: "EXPIRED",
  EXPIRED: "EXPIRED",
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

/**
 * Canonical `customerOrders.serviceType` identifiers (see `convex/schema.ts`).
 * Any stored value outside this set is a legacy display label from an earlier
 * write path and must be normalized.
 */
const CANONICAL_SERVICE_TYPES: ReadonlySet<string> = new Set([
  "banner_print",
  "sticker_white",
  "sticker_transparent",
  "sticker_reflective",
  "sticker_mesh",
  "sticker_frosted",
  "hq_print_and_cut",
  "light_box_a1",
  "light_box_a2",
  "neon_light",
  "roll_up_standard",
  "roll_up_deluxe",
  "uv_print_mica",
  "uv_print_foam",
  "uv_print_cladding",
  "uv_print_canvas",
  "foam_cutout",
  "foam_engrave",
  "mica_cutout",
  "mica_engrave",
  "dtf",
  "sublimation",
]);

/**
 * Map of legacy `customerOrders.serviceType` display labels (written by the
 * pre-category Telegram bot and walk-in forms) to their canonical service ids.
 */
const SERVICE_TYPE_ALIASES: Record<string, string> = {
  "Banner (Flex)": "banner_print",
  Banner: "banner_print",
  Sticker: "sticker_white",
  Acrylic: "mica_engrave",
};

/**
 * One-shot backfill that normalizes legacy `customerOrders.serviceType` display
 * labels (e.g. "Banner (Flex)", written by the pre-category Telegram bot and
 * walk-in forms) to the canonical schema ids. The original label is preserved
 * in `notes` so no customer-entered detail is lost. Only canonical values are
 * written, so the migration stays safe under the tightened validator; it is
 * kept as ops tooling in case legacy rows are ever reintroduced (for example
 * by restoring an old snapshot export).
 *
 * Idempotent: rows already holding a canonical id are skipped, and a
 * `migrations` row prevents re-scanning once the dataset is clean. Values with
 * no known alias are reported (and block completion) so they can be mapped
 * deliberately instead of being silently rewritten.
 */
export const migrateServiceTypeLegacy = internalAction({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<{ patched: number; unmapped: string[] }> => {
    return ctx.runMutation(internal.migrations.normalizeServiceTypeLegacy, {
      force: args.force ?? false,
    });
  },
});

/** Applies the normalization in a single transactional mutation. */
export const normalizeServiceTypeLegacy = internalMutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (!args.force) {
      const alreadyRun = await ctx.db
        .query("migrations")
        .withIndex("by_key", (q: any) => q.eq("key", "serviceTypeLegacy"))
        .unique();
      if (alreadyRun) {
        return { patched: 0, skipped: true as const, unmapped: [] as string[] };
      }
    }

    let patched = 0;
    const unmapped: string[] = [];
    const orders = await ctx.db.query("customerOrders").collect();

    for (const order of orders) {
      const raw = order.serviceType as string;
      if (CANONICAL_SERVICE_TYPES.has(raw)) continue;
      const canonical = SERVICE_TYPE_ALIASES[raw];
      if (!canonical) {
        unmapped.push(`${order.code}=${raw}`);
        continue;
      }
      const legacyNote = `Legacy service: ${raw}`;
      const notes =
        order.notes === undefined || order.notes === ""
          ? legacyNote
          : order.notes.includes(legacyNote)
            ? order.notes
            : `${order.notes} · ${legacyNote}`;
      await ctx.db.patch(order._id, {
        serviceType: canonical as typeof order.serviceType,
        notes,
        updatedAt: Date.now(),
      });
      patched++;
    }

    if (unmapped.length === 0) {
      await ctx.db.insert("migrations", { key: "serviceTypeLegacy", ranAt: Date.now() });
    }
    return { patched, unmapped };
  },
});

/**
 * Owner-triggerable manual entry point for the service-type backfill. Pass
 * `{ "force": true }` to re-scan after the first run (e.g. to mop up rows
 * written by a still-deployed legacy client during the bridge window).
 */
export const runServiceTypeMigration = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    if (!args.force) {
      const existing = await ctx.db
        .query("migrations")
        .withIndex("by_key", (q: any) => q.eq("key", "serviceTypeLegacy"))
        .unique();
      if (existing) {
        return { skipped: true as const, reason: "already run" };
      }
    }
    await ctx.scheduler.runAfter(0, internal.migrations.migrateServiceTypeLegacy, {
      force: args.force ?? false,
    });

    return { scheduled: true as const };
  },
});

const packageMigrationResult = v.object({
  patched: v.number(),
  skipped: v.optional(v.boolean()),
});

export const migratePackageMetadata = internalAction({
  args: {},
  returns: packageMigrationResult,
  handler: async (ctx): Promise<{ patched: number; skipped?: boolean }> =>
    ctx.runMutation(internal.migrations.normalizePackageMetadata, {}),
});

export const normalizePackageMetadata = internalMutation({
  args: {},
  returns: packageMigrationResult,
  handler: async (ctx) => {
    const existing = await ctx.db.query("migrations")
      .withIndex("by_key", (q) => q.eq("key", "packageMetadata"))
      .unique();
    if (existing) return { patched: 0, skipped: true };

    let patched = 0;
    const materials = await ctx.db.query("materials").collect();
    for (const material of materials) {
      if (material.packageUnit !== undefined) continue;
      const packageUnit = material.purchaseUnit === "roll"
        ? "ROLL"
        : material.purchaseUnit === "sheet"
          ? "SHEET"
          : material.purchaseUnit === "canister" || material.purchaseUnit === "liter"
            ? "CANISTER"
            : material.purchaseUnit === "piece"
              ? "PIECE"
              : material.purchaseUnit === "pack"
                ? "PACKAGE"
                : undefined;
      if (!packageUnit) continue;
      await ctx.db.patch(material._id, {
        packageUnit,
        packageSize: material.conversionRatio && material.conversionRatio > 0 ? material.conversionRatio : undefined,
        packageLabel: packageUnit === "ROLL" ? "Roll" : packageUnit === "SHEET" ? "Sheet" : packageUnit === "CANISTER" ? "1L canister" : packageUnit === "PIECE" ? "Piece" : "Package",
      });
      patched++;
    }
    await ctx.db.insert("migrations", { key: "packageMetadata", ranAt: Date.now() });
    return { patched };
  },
});

export const runPackageMetadataMigration = mutation({
  args: {},
  returns: v.object({ scheduled: v.optional(v.boolean()), skipped: v.optional(v.boolean()), reason: v.optional(v.string()) }),
  handler: async (ctx) => {
    await requirePermission(ctx, "company_settings.update");
    const existing = await ctx.db.query("migrations")
      .withIndex("by_key", (q) => q.eq("key", "packageMetadata"))
      .unique();
    if (existing) return { skipped: true, reason: "already run" };
    await ctx.scheduler.runAfter(0, internal.migrations.migratePackageMetadata, {});
    return { scheduled: true };
  },
});
