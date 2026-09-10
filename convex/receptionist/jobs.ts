import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireReceptionist } from "../users";

const JOB_STATUSES = new Set(["Queued", "In production", "Completed", "Paused"]);

function isOverdue(job: { status: string }, order?: { preferredDueDate?: number; status?: string }) {
  return Boolean(order?.preferredDueDate && order.preferredDueDate < Date.now() && !["READY_FOR_PICKUP", "COMPLETED", "EXPIRED", "EXPIRED_JUNK"].includes(order.status ?? "") && job.status !== "Completed");
}

/** Receptionist read model for real-time job-card tracking and inspection. */
export const list = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    machineId: v.optional(v.id("machines")),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    selectedJobId: v.optional(v.id("jobCards")),
  },
  handler: async (ctx, args) => {
    await requireReceptionist(ctx);
    const [jobs, orders, machines] = await Promise.all([
      ctx.db.query("jobCards").collect(),
      ctx.db.query("customerOrders").collect(),
      ctx.db.query("machines").collect(),
    ]);
    const orderById = new Map(orders.map((order) => [order._id, order]));
    const machineById = new Map(machines.map((machine) => [machine._id, machine]));
    const needle = args.search?.trim().toLowerCase();
    const filtered = jobs.filter((job) => {
      const order = job.orderId ? orderById.get(job.orderId) : undefined;
      const machine = machineById.get(job.machineId);
      if (args.status && args.status !== "ALL" && job.status !== args.status) return false;
      if (args.machineId && job.machineId !== args.machineId) return false;
      if (args.from !== undefined && job.createdAt < args.from) return false;
      if (args.to !== undefined && job.createdAt > args.to) return false;
      if (needle) {
        const haystack = [job.code, order?.code, job.client, order?.clientName, machine?.name, job.title].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    }).sort((left, right) => right.createdAt - left.createdAt);
    const rows = filtered.map((job) => {
      const order = job.orderId ? orderById.get(job.orderId) : undefined;
      const machine = machineById.get(job.machineId);
      return {
        id: job._id,
        code: job.code,
        orderId: order?._id,
        orderCode: order?.code ?? "—",
        clientName: order?.clientName ?? job.client,
        serviceType: order?.serviceType ?? job.title,
        dimensions: order?.dimensions ?? `${job.length ?? "—"} × ${job.width ?? "—"}`,
        machineId: job.machineId,
        machineName: machine?.name ?? "Unassigned",
        status: job.status,
        due: job.due,
        dueTimestamp: order?.preferredDueDate,
        createdAt: job.createdAt,
        priority: job.priority,
        overdue: isOverdue(job, order),
      };
    });
    const allJobRows = jobs.map((job) => ({ job, order: job.orderId ? orderById.get(job.orderId) : undefined }));
    const selected = args.selectedJobId ? jobs.find((job) => job._id === args.selectedJobId) : undefined;
    let detail = null;
    if (selected) {
      const order = selected.orderId ? orderById.get(selected.orderId) : undefined;
      const machine = machineById.get(selected.machineId);
      const [logs, operator, fileUrl, attachmentUrls] = await Promise.all([
        ctx.db.query("productionLogs").withIndex("by_job_card", (q) => q.eq("jobCardId", selected._id)).collect(),
        ctx.db.query("users").withIndex("by_auth_user", (q) => q.eq("authUserId", selected.createdBy)).unique(),
        order?.fileStorageId ? ctx.storage.getUrl(order.fileStorageId) : null,
        Promise.all((order?.attachmentStorageIds ?? []).map((id) => ctx.storage.getUrl(id))),
      ]);
      const timeline = [
        { label: "Job card issued", detail: `${selected.code} created`, at: selected.createdAt },
        ...(selected.startedAt ? [{ label: "Production started", detail: machine?.name ?? "Assigned machine", at: selected.startedAt }] : []),
        ...(selected.pausedAt ? [{ label: "Production paused", detail: selected.pauseReason ?? "Paused by operator", at: selected.pausedAt }] : []),
        ...logs.map((log) => ({ label: "Production recorded", detail: `${log.outputQuantity} ${log.unit} output · ${log.wasteQuantity} waste`, at: log.createdAt })),
        ...(order && order.updatedAt !== order.createdAt ? [{ label: "Order updated", detail: order.status.replaceAll("_", " ").toLowerCase(), at: order.updatedAt }] : []),
      ].sort((a, b) => b.at - a.at);
      detail = {
        id: selected._id,
        code: selected.code,
        orderCode: order?.code ?? "—",
        clientName: order?.clientName ?? selected.client,
        phone: order?.phone,
        serviceType: order?.serviceType ?? selected.title,
        dimensions: order?.dimensions,
        length: selected.length ?? order?.length,
        width: selected.width ?? order?.width,
        quantity: order?.quantity,
        machineName: machine?.name ?? "Unassigned",
        machineCode: machine?.code,
        operatorName: operator?.name ?? "Production team",
        status: selected.status,
        due: selected.due,
        dueTimestamp: order?.preferredDueDate,
        priority: selected.priority,
        createdAt: selected.createdAt,
        fileName: order?.fileName,
        fileUrl,
        attachments: (order?.attachmentFileNames ?? []).map((name, index) => ({ name, url: attachmentUrls[index] ?? null })),
        paymentStatus: order?.paymentStatus ?? "UNPAID",
        amount: order?.amount,
        advancePaidAmount: order?.advancePaidAmount,
        remainingDueAmount: order?.remainingDueAmount,
        paymentInstructionsSnapshot: order?.paymentInstructionsSnapshot,
        timeline,
      };
    }
    return {
      rows,
      machines: machines.filter((machine) => machine.active).map((machine) => ({ id: machine._id, name: machine.name, code: machine.code })),
      kpis: {
        totalIssued: jobs.length,
        inProduction: jobs.filter((job) => job.status === "In production").length,
        readyForPickup: allJobRows.filter(({ job, order }) => job.status === "Completed" && order?.status === "READY_FOR_PICKUP").length,
        overdue: allJobRows.filter(({ job, order }) => isOverdue(job, order)).length,
      },
      detail,
      allowedStatuses: [...JOB_STATUSES],
    };
  },
});
