import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { Role } from "./types";
import {
  canViewNotification,
  resolveNotificationContext,
  type NotificationType,
  type NotificationAudience,
  type NotificationRecord,
  type NotificationContext,
  type UserProfile,
} from "./notificationPolicy";

export type NotifyByPolicyInput = {
  type: NotificationType;
  title: string;
  message: string;
  actorAuthUserId?: string;
  relatedTable?: string;
  relatedId?: string;
  audience?: NotificationAudience;
  targetUserId?: string;
  targetRole?: Role;
  targetRoles?: Role[];
  machineId?: Id<"machines">;
  cooldownHours?: number;
};

/** Dispatches a notification to active recipients allowed by the central policy. */
export async function notifyByPolicy(ctx: MutationCtx, input: NotifyByPolicyInput) {
  // 1. Resolve context
  const resolvedContext = await resolveNotificationContext(ctx, {
    message: input.message,
    relatedTable: input.relatedTable,
    relatedId: input.relatedId,
  });

  const context: NotificationContext = {
    ...resolvedContext,
    machineId: input.machineId ?? resolvedContext.machineId,
  };

  if (context.machineId && !context.machineRole) {
    const machine = await ctx.db.get(context.machineId);
    if (machine) {
      context.machineRole = machine.operatorRole;
    }
  }

  // 2. Resolve candidates
  const allUsers = await ctx.db.query("users").collect();
  const activeUsers = allUsers.filter((u) => u.active);

  let candidateUsers = activeUsers;

  if (input.targetUserId) {
    candidateUsers = activeUsers.filter((u) => u.authUserId === input.targetUserId);
  } else if (input.targetRoles && input.targetRoles.length > 0) {
    candidateUsers = activeUsers.filter((u) => input.targetRoles!.includes(u.role));
  } else if (input.targetRole) {
    candidateUsers = activeUsers.filter((u) => u.role === input.targetRole);
  } else if (input.audience === "MACHINE_ROLE" && context.machineRole) {
    candidateUsers = activeUsers.filter((u) => u.role === context.machineRole);
  } else if (input.audience === "MACHINE_ASSIGNMENT" && context.machineId) {
    candidateUsers = activeUsers.filter(
      (u) => u.assignedMachineIds && u.assignedMachineIds.includes(context.machineId!),
    );
  }

  // 3. Filter candidates using central policy & suppress actor
  const notificationRecord: NotificationRecord = {
    title: input.title,
    message: input.message,
    type: input.type,
    actorAuthUserId: input.actorAuthUserId,
    relatedTable: input.relatedTable,
    relatedId: input.relatedId,
  };

  const eligibleRecipients: string[] = [];

  for (const user of candidateUsers) {
    // Suppress actor
    if (user.authUserId === input.actorAuthUserId) continue;

    const profile: UserProfile = {
      authUserId: user.authUserId,
      role: user.role,
      assignedMachineIds: user.assignedMachineIds,
    };

    const recordForUser: NotificationRecord = {
      ...notificationRecord,
      recipientAuthUserId: user.authUserId,
    };

    if (canViewNotification(profile, recordForUser, context)) {
      eligibleRecipients.push(user.authUserId);
    }
  }

  // 4. Cooldown check and insertion
  const now = Date.now();
  for (const recipientAuthUserId of eligibleRecipients) {
    if (input.cooldownHours && input.cooldownHours > 0 && input.relatedId) {
      const cutoff = now - input.cooldownHours * 60 * 60 * 1000;
      const recent = await ctx.db
        .query("notifications")
        .withIndex("by_recipient_created", (q) => q.eq("recipientAuthUserId", recipientAuthUserId))
        .order("desc")
        .take(50);

      const alreadyNotified = recent.some(
        (n) => n.createdAt >= cutoff && n.type === input.type && n.relatedId === input.relatedId,
      );
      if (alreadyNotified) continue;
    }

    await ctx.db.insert("notifications", {
      recipientAuthUserId,
      title: input.title,
      message: input.message,
      type: input.type,
      actorAuthUserId: input.actorAuthUserId,
      relatedTable: input.relatedTable,
      relatedId: input.relatedId,
      createdAt: now,
    });
  }
}

/** Dispatches a policy-checked notification to one application user. */
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
    machineId?: Id<"machines">;
  },
) {
  return notifyByPolicy(ctx, {
    ...input,
    audience: "USER",
    targetUserId: recipientAuthUserId,
  });
}

/** Dispatches a policy-checked notification to active users in the given roles. */
export async function notifyRoles(
  ctx: MutationCtx,
  roles: Role[],
  input: {
    title: string;
    message: string;
    type: NotificationType;
    actorAuthUserId?: string;
    relatedTable?: string;
    relatedId?: string;
    cooldownHours?: number;
    machineId?: Id<"machines">;
  },
) {
  return notifyByPolicy(ctx, {
    ...input,
    audience: "ROLE",
    targetRoles: roles,
  });
}
