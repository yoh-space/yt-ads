import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

/**
 * Records a verified uploaded attachment (e.g. customer proof, mockup image) for an order.
 */
export const recordOrderAttachment = mutation({
  args: {
    orderId: v.id("customerOrders"),
    fileUrl: v.string(),
    fileKey: v.string(),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Target customer order not found.");
    }

    const identity = await authComponent.safeGetAuthUser(ctx);

    const attachmentId = await ctx.db.insert("orderAttachments", {
      orderId: args.orderId,
      fileUrl: args.fileUrl,
      fileKey: args.fileKey,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      uploadedAt: Date.now(),
      uploadedBy: identity?._id,
    });

    return attachmentId;
  },
});

/**
 * Lists all attachments associated with a customer order.
 */
export const listOrderAttachments = query({
  args: { orderId: v.id("customerOrders") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orderAttachments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
  },
});
