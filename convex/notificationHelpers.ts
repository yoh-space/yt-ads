import type { MutationCtx } from "./_generated/server";
import type { Role } from "./types";

type NotificationType =
  | "material_request"
  | "material_issue"
  | "material_received"
  | "short_stock"
  | "material_overuse"
  | "discrepancy"
  | "job_update"
  | "machine_update"
  | "account_update"
  | "order_received"
  | "order_status"
  | "overdue_order"
  | "exception_stock_out"
  | "clearance_granted"
  | "clearance_rejected";

export async function notifyUser(
  ctx: MutationCtx,
  recipientAuthUserId: string,
  input: {
    title: string;
    message: string;
    type: NotificationType;
    actorAuthUserId?: string;
    relatedTable?: string;
    relatedId?: string;
    cooldownHours?: number;
  },
) {
  if (recipientAuthUserId === input.actorAuthUserId) return;
  await ctx.db.insert("notifications", {
    recipientAuthUserId,
    title: input.title,
    message: input.message,
    type: input.type,
    actorAuthUserId: input.actorAuthUserId,
    relatedTable: input.relatedTable,
    relatedId: input.relatedId,
    createdAt: Date.now(),
  });
}

export async function notifyRoles(
  ctx: MutationCtx,
  roles: Role[],
  input: Parameters<typeof notifyUser>[2],
) {
  const recipients = new Map<string, true>();
  for (const role of roles) {
    const users = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", role)).collect();
    for (const user of users) if (user.active) recipients.set(user.authUserId, true);
  }
  for (const recipient of recipients.keys()) {
    if (input.cooldownHours && input.cooldownHours > 0 && input.relatedId) {
      const cutoff = Date.now() - input.cooldownHours * 60 * 60 * 1000;
      const recent = await ctx.db
        .query("notifications")
        .withIndex("by_recipient_created", (q) => q.eq("recipientAuthUserId", recipient))
        .order("desc")
        .take(50);
      const alreadyNotified = recent.some(
        (notification) =>
          notification.createdAt >= cutoff &&
          notification.type === input.type &&
          notification.relatedId === input.relatedId,
      );
      if (alreadyNotified) continue;
    }
    await notifyUser(ctx, recipient, input);
  }
}
