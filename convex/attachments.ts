import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { buildCustomerDocumentFileName } from "./utils/orderFileName";

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

    const existingAttachments = await ctx.db
      .query("orderAttachments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    const attachmentIndex = (order.fileStorageId ? 1 : 0) + existingAttachments.length + 1;

    const canonicalFileName = buildCustomerDocumentFileName({
      customerName: order.clientName,
      serviceType: order.serviceType,
      width: order.width,
      length: order.length,
      orderCode: order.code,
      originalFileName: args.fileName,
      mimeType: args.mimeType,
      attachmentIndex,
    });

    const attachmentId = await ctx.db.insert("orderAttachments", {
      orderId: args.orderId,
      fileUrl: args.fileUrl,
      fileKey: args.fileKey,
      fileName: canonicalFileName,
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
