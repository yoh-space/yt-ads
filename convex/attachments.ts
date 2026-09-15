import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { buildCustomerDocumentFileName } from "./utils/orderFileName";

/**
 * Records a Convex-storage attachment (e.g. customer proof, mockup image) for an order.
 * The upload itself is two-step (generateUploadUrl via api.orders.generateUploadUrl, then
 * a direct POST); this mutation only stores the resulting storageId and order metadata.
 */
export const recordOrderAttachment = mutation({
  args: {
    orderId: v.id("customerOrders"),
    storageId: v.id("_storage"),
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
      storageId: args.storageId,
      fileName: canonicalFileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      uploadedAt: Date.now(),
      uploadedBy: identity?._id,
    });

    return attachmentId;
  },
});

/** Lists all attachments for an order, resolving a fresh signed URL per read (Convex storage URLs are not permanent). */
export const listOrderAttachments = query({
  args: { orderId: v.id("customerOrders") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("orderAttachments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    return await Promise.all(
      rows.map(async (row) => ({
        ...row,
        fileUrl: await ctx.storage.getUrl(row.storageId),
      })),
    );
  },
});

/** Mirrors orders.ts's delete-on-order-removal cleanup for attachment storage objects. */
export const deleteOrderAttachment = mutation({
  args: { attachmentId: v.id("orderAttachments") },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) return;
    await ctx.storage.delete(attachment.storageId);
    await ctx.db.delete(args.attachmentId);
  },
});