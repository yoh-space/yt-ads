import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireRoles } from "./users";

export const get = query({
  args: { orderId: v.id("customerOrders") },
  handler: async (ctx, args) => {
    await requireRoles(ctx, ["owner", "manager"]);
    const order = await ctx.db.get(args.orderId);
    if (!order) return null;

    const [creator, machine, jobCard] = await Promise.all([
      order.createdBy ? ctx.db.query("users").withIndex("by_auth_user", (q) => q.eq("authUserId", order.createdBy!)).unique() : null,
      order.machineId ? ctx.db.get(order.machineId) : null,
      order.jobCardId ? ctx.db.get(order.jobCardId) : null,
    ]);
    const [fileUrl, attachmentUrls] = await Promise.all([
      order.fileStorageId ? ctx.storage.getUrl(order.fileStorageId) : null,
      Promise.all((order.attachmentStorageIds ?? []).map((storageId) => ctx.storage.getUrl(storageId))),
    ]);

    const [requirements, reservations, movements] = await Promise.all([
      jobCard
        ? ctx.db.query("jobMaterialRequirements").withIndex("by_job_card", (q) => q.eq("jobCardId", jobCard._id)).collect()
        : [],
      ctx.db.query("reservations").withIndex("by_order", (q) => q.eq("orderId", order._id)).collect(),
      jobCard
        ? ctx.db.query("stock_movements").withIndex("by_job_card", (q) => q.eq("jobCardId", jobCard._id)).collect()
        : [],
    ]);

    const materialIds = [...new Set([
      ...requirements.map((item) => item.materialId),
      ...reservations.map((item) => item.materialId),
      ...movements.map((item) => item.materialId),
    ])];
    const materials = await Promise.all(materialIds.map((id) => ctx.db.get(id)));
    const materialById = new Map(materialIds.map((id, index) => [id, materials[index]]));

    const timeline = [
      {
        type: "created",
        label: "Order created",
        detail: creator?.name ?? "Order intake",
        at: order.createdAt,
      },
      ...(jobCard ? [{
        type: "job",
        label: "Production job linked",
        detail: `${jobCard.code} · ${jobCard.status}`,
        at: jobCard.createdAt,
      }] : []),
      ...movements.map((movement) => ({
        type: "stock",
        label: movement.eventType.replaceAll("_", " ").toLowerCase(),
        detail: `${materialById.get(movement.materialId)?.name ?? "Material"} · ${movement.baseQuantity} ${movement.baseUnit}`,
        at: movement.createdAt,
      })),
      ...(order.updatedAt !== order.createdAt ? [{
        type: "updated",
        label: "Order updated",
        detail: order.status.replaceAll("_", " ").toLowerCase(),
        at: order.updatedAt,
      }] : []),
    ].sort((left, right) => right.at - left.at);

    return {
      id: order._id,
      code: order.code,
      clientName: order.clientName,
      phone: order.phone,
      clientType: order.companyLegalName ? "Company" : "Individual",
      serviceType: order.serviceType,
      serviceId: order.serviceId ?? order.serviceType,
      specifications: order.specifications,
      dimensions: order.dimensions,
      length: order.length,
      width: order.width,
      quantity: order.quantity,
      notes: order.notes,
      amount: order.amount ?? 0,
      paymentStatus: order.paymentStatus ?? "UNPAID",
      paymentMethod: order.paymentMethod,
      paymentConfirmedAt: order.paymentConfirmedAt,
      status: order.status,
      priority: order.priority,
      source: order.source,
      preferredDueDate: order.preferredDueDate,
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      createdBy: creator?.name ?? "Order intake",
      fileName: order.fileName,
      fileUrl,
      attachments: (order.attachmentFileNames ?? []).map((name, index) => ({
        name,
        url: attachmentUrls[index] ?? null,
      })),
      machineName: machine?.name,
      machineCode: machine?.code,
      operatorRole: machine?.operatorRole,
      job: jobCard ? {
        code: jobCard.code,
        title: jobCard.title,
        status: jobCard.status,
        due: jobCard.due,
        quantity: jobCard.quantity,
        unit: jobCard.unit,
      } : null,
      items: requirements.map((item) => ({
        name: materialById.get(item.materialId)?.name ?? "Material",
        category: materialById.get(item.materialId)?.category ?? "",
        unit: item.baseUnit,
        planned: item.plannedBaseQuantity,
        requested: item.requestedPackages,
        issued: item.issuedPackages,
        consumed: item.consumedBaseQuantity,
        status: item.status,
      })),
      reservations: reservations.map((item) => ({
        name: materialById.get(item.materialId)?.name ?? "Material",
        quantity: item.reservedQuantity,
        unit: item.unit,
        status: item.status,
      })),
      timeline,
    };
  },
});
