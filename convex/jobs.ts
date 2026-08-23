import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { jobStatus, priority, unit } from "./schema";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await authComponent.getAuthUser(ctx);
    return ctx.db.query("jobCards").collect();
  },
});

export const create = mutation({
  args: {
    client: v.string(),
    title: v.string(),
    machineId: v.id("machines"),
    materialId: v.id("materials"),
    quantity: v.number(),
    unit,
    due: v.string(),
    priority,
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const code = `JC-${String(430 + Math.floor(Math.random() * 500)).padStart(4, "0")}`;
    const id = await ctx.db.insert("jobCards", {
      code,
      client: args.client || "Walk-in client",
      title: args.title || "Untitled production job",
      machineId: args.machineId,
      materialId: args.materialId,
      quantity: args.quantity,
      unit: args.unit,
      status: "Queued",
      due: args.due,
      priority: args.priority,
      createdBy: user._id,
      createdAt: Date.now(),
    });
    const machine = await ctx.db.get(args.machineId);
    if (machine && machine.status !== "Running") {
      await ctx.db.patch(args.machineId, { status: "Running", activeJob: code });
    }
    return (await ctx.db.get(id))!;
  },
});

export const complete = mutation({
  args: { jobId: v.id("jobCards") },
  handler: async (ctx, args) => {
    await authComponent.getAuthUser(ctx);
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job card not found.");
    await ctx.db.patch(args.jobId, { status: "Completed" });
    const machine = await ctx.db
      .query("machines")
      .filter((q) => q.eq(q.field("activeJob"), job.code))
      .unique();
    if (machine) {
      await ctx.db.patch(machine._id, { status: "Available", activeJob: undefined });
    }
  },
});
