import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./users";

const exceptionStatus = v.union(
  v.literal("OPEN"),
  v.literal("ACKNOWLEDGED"),
  v.literal("RESOLVED"),
);

const exception = v.object({
  _id: v.id("overuseExceptions"),
  _creationTime: v.number(),
  jobCardId: v.id("jobCards"),
  materialId: v.id("materials"),
  productionLogId: v.optional(v.id("productionLogs")),
  actualUsage: v.number(),
  plannedUsage: v.number(),
  approvedScrapQuantity: v.number(),
  excessQuantity: v.number(),
  unit: v.union(v.literal("m²"), v.literal("m"), v.literal("sheet"), v.literal("piece"), v.literal("pcs"), v.literal("L")),
  status: exceptionStatus,
  createdBy: v.string(),
  createdAt: v.number(),
  note: v.optional(v.string()),
  resolvedBy: v.optional(v.string()),
  resolvedAt: v.optional(v.number()),
});

export const list = query({
  args: { status: v.optional(exceptionStatus) },
  returns: v.array(exception),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audit.view");
    const rows = args.status === undefined
      ? await ctx.db.query("overuseExceptions").withIndex("by_status", (q) => q.eq("status", "OPEN")).collect()
      : await ctx.db.query("overuseExceptions").withIndex("by_status", (q) => q.eq("status", args.status!)).collect();
    return rows.sort((left, right) => right.createdAt - left.createdAt);
  },
});

export const resolve = mutation({
  args: { id: v.id("overuseExceptions"), note: v.optional(v.string()) },
  returns: exception,
  handler: async (ctx, args) => {
    const { identity } = await requirePermission(ctx, "reconciliation.review");
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Overuse exception not found.");
    if (row.status === "RESOLVED") return row;
    await ctx.db.patch(args.id, {
      status: "RESOLVED",
      resolvedBy: identity._id,
      resolvedAt: Date.now(),
      note: args.note?.trim() || row.note,
    });
    return (await ctx.db.get(args.id))!;
  },
});
