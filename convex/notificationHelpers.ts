import type { MutationCtx } from "./_generated/server";
import type { Role } from "./types";

type NotificationType =
  | "material_request"
  | "material_issue"
  | "material_received"
  | "short_stock"
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
  for (const recipient of recipients.keys()) await notifyUser(ctx, recipient, input);
}
