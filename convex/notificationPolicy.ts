import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { Role } from "./types";

export type DbCtx = QueryCtx | MutationCtx;

export type NotificationType =
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
  | "clearance_rejected"
  | "design_task"
  | "design_submission"
  | "payment_verified"
  | "payment_returned";

export type NotificationDomain = "orders" | "inventory" | "operations" | "account";

export type NotificationCategory = "all" | NotificationDomain;

export type NotificationAudience =
  | "ROLE"
  | "USER"
  | "MACHINE_ROLE"
  | "MACHINE_ASSIGNMENT";

export type NotificationRecord = {
  _id?: Id<"notifications">;
  title: string;
  message: string;
  type: NotificationType;
  recipientAuthUserId?: string;
  actorAuthUserId?: string;
  relatedTable?: string;
  relatedId?: string;
  createdAt?: number;
  readAt?: number;
};

export type NotificationContext = {
  message?: string;
  relatedLabel?: string;
  machineId?: Id<"machines">;
  machineRole?: Role;
  targetUserId?: string;
};

export type UserProfile = {
  authUserId?: string;
  role: Role;
  assignedMachineIds?: Id<"machines">[];
};

export const MANAGEMENT_ROLES: Role[] = ["owner", "manager", "admin"];

export const OPERATOR_ROLES: Role[] = [
  "crystal_jet_operator",
  "crystek_operator",
  "ricoh_uv_operator",
  "dtf_operator",
  "laser_operator",
  "cnc_operator",
];

export const NOTIFICATION_TYPE_DOMAIN_MAP: Record<NotificationType, NotificationDomain> = {
  order_received: "orders",
  order_status: "orders",
  overdue_order: "orders",
  design_task: "orders",
  design_submission: "orders",
  payment_verified: "orders",
  payment_returned: "orders",
  material_request: "inventory",
  material_issue: "inventory",
  material_received: "inventory",
  short_stock: "inventory",
  material_overuse: "inventory",
  discrepancy: "inventory",
  exception_stock_out: "inventory",
  job_update: "operations",
  machine_update: "operations",
  clearance_granted: "operations",
  clearance_rejected: "operations",
  account_update: "account",
};

/** Returns the operational domain associated with a notification type. */
export function getNotificationDomain(type: NotificationType): NotificationDomain {
  return NOTIFICATION_TYPE_DOMAIN_MAP[type] ?? "operations";
}

/** Returns the notification domains visible to a role. */
export function getAllowedDomainsForRole(role: Role): NotificationDomain[] {
  if (MANAGEMENT_ROLES.includes(role)) {
    return ["orders", "inventory", "operations", "account"];
  }
  if (role === "receptionist" || role === "cashier") {
    return ["orders"];
  }
  if (role === "designer") {
    return ["orders", "operations"];
  }
  if (role === "storekeeper") {
    return ["inventory"];
  }
  if (OPERATOR_ROLES.includes(role)) {
    return ["inventory", "operations"];
  }
  return [];
}

/** Returns the category filters available to a role, including the aggregate view. */
export function getNotificationCategoriesForRole(role: Role): NotificationCategory[] {
  const domains = getAllowedDomainsForRole(role);
  return ["all", ...domains];
}

/** Replaces stored relation IDs with labels and redacts unresolved legacy IDs. */
export function replaceIds(message: string, replacements: Array<[string | undefined, string | undefined]>) {
  const resolved = replacements.reduce((current, [id, label]) => {
    if (!id || !label || id === label) return current;
    return current.split(id).join(label);
  }, message);
  // Legacy notifications may contain an ID without usable relation metadata.
  return resolved.replace(/\b[a-z][a-z0-9]{19,}\b/gi, "related item");
}

/** Resolves display labels and machine scope from a notification's related record. */
export async function resolveNotificationContext(
  ctx: DbCtx,
  notification: { relatedTable?: string; relatedId?: string; message: string },
): Promise<NotificationContext> {
  const relatedId = notification.relatedId;
  if (!notification.relatedTable || !relatedId) return { message: notification.message };

  switch (notification.relatedTable) {
    case "machines": {
      const machine = await ctx.db.get(relatedId as Id<"machines">);
      return {
        message: replaceIds(notification.message, [[relatedId, machine?.name]]),
        relatedLabel: machine?.name,
        machineId: machine?._id,
        machineRole: machine?.operatorRole,
      };
    }
    case "jobCards": {
      const job = await ctx.db.get(relatedId as Id<"jobCards">);
      const machine = job ? await ctx.db.get(job.machineId) : null;
      return {
        message: replaceIds(notification.message, [[relatedId, job?.code]]),
        relatedLabel: job?.code,
        machineId: machine?._id,
        machineRole: machine?.operatorRole,
      };
    }
    case "customerOrders": {
      const order = await ctx.db.get(relatedId as Id<"customerOrders">);
      const machine = order?.machineId ? await ctx.db.get(order.machineId) : null;
      return {
        message: replaceIds(notification.message, [[relatedId, order?.code]]),
        relatedLabel: order?.code,
        machineId: machine?._id,
        machineRole: machine?.operatorRole,
      };
    }
    case "materialRequests": {
      const request = await ctx.db.get(relatedId as Id<"materialRequests">);
      const [job, material] = request
        ? await Promise.all([ctx.db.get(request.jobCardId), ctx.db.get(request.materialId)])
        : [null, null];
      const machine = job ? await ctx.db.get(job.machineId) : null;
      return {
        message: replaceIds(notification.message, [
          [relatedId, `${material?.name ?? "Material"} request for ${job?.code ?? "production job"}`],
          [request?.jobCardId, job?.code],
          [request?.materialId, material?.name],
        ]),
        relatedLabel: material?.name ?? job?.code,
        machineId: machine?._id,
        machineRole: machine?.operatorRole,
      };
    }
    case "operatorSubStock": {
      const batch = await ctx.db.get(relatedId as Id<"operatorSubStock">);
      const [material, machine] = batch
        ? await Promise.all([ctx.db.get(batch.materialId), ctx.db.get(batch.machineId)])
        : [null, null];
      const label = material && machine ? `${material.name} on ${machine.name}` : machine?.name ?? material?.name;
      return {
        message: replaceIds(notification.message, [[relatedId, label]]),
        relatedLabel: label,
        machineId: machine?._id,
        machineRole: machine?.operatorRole,
      };
    }
    case "weeklyReconciliations": {
      const reconciliation = await ctx.db.get(relatedId as Id<"weeklyReconciliations">);
      const machine = reconciliation ? await ctx.db.get(reconciliation.machineId) : null;
      return {
        message: replaceIds(notification.message, [[relatedId, machine ? `${machine.name} reconciliation` : undefined]]),
        relatedLabel: machine?.name,
        machineId: machine?._id,
        machineRole: machine?.operatorRole,
      };
    }
    case "materials": {
      const material = await ctx.db.get(relatedId as Id<"materials">);
      return {
        message: replaceIds(notification.message, [[relatedId, material?.name]]),
        relatedLabel: material?.name,
      };
    }
    case "stockExceptions": {
      const exception = await ctx.db.get(relatedId as Id<"stockExceptions">);
      const material = exception ? await ctx.db.get(exception.materialId) : null;
      return {
        message: replaceIds(notification.message, [[relatedId, material ? `${material.name} stock exception` : undefined]]),
        relatedLabel: material?.name,
      };
    }
    case "users": {
      const user = await ctx.db.get(relatedId as Id<"users">);
      return {
        message: replaceIds(notification.message, [[relatedId, user?.name]]),
        relatedLabel: user?.name,
      };
    }
    default:
      return { message: notification.message };
  }
}

/** Determines whether a notification is visible to a user in its resolved context. */
export function canViewNotification(
  profile: UserProfile,
  notification: NotificationRecord,
  context: NotificationContext = {},
): boolean {
  const domain = getNotificationDomain(notification.type);

  // 1. Management roles: broad operational visibility
  if (MANAGEMENT_ROLES.includes(profile.role)) {
    // For account_update, target user always sees it; owner & admin can audit
    if (notification.type === "account_update") {
      if (profile.role === "manager" && notification.recipientAuthUserId && profile.authUserId) {
        return notification.recipientAuthUserId === profile.authUserId;
      }
      return true;
    }
    return true;
  }

  // 2. Receptionist: only "orders" domain
  if (profile.role === "receptionist") {
    return domain === "orders";
  }

  // 3. Cashier: only "orders" domain
  if (profile.role === "cashier") {
    return domain === "orders";
  }

  // 4. Designer: design tasks & operations
  if (profile.role === "designer") {
    if (notification.type === "account_update") {
      return Boolean(profile.authUserId && notification.recipientAuthUserId === profile.authUserId);
    }
    return domain === "orders" || domain === "operations";
  }

  // 5. Storekeeper: only "inventory" domain
  if (profile.role === "storekeeper") {
    return domain === "inventory";
  }

  // 4. Operator roles:
  if (OPERATOR_ROLES.includes(profile.role)) {
    // Account updates are private to target user
    if (notification.type === "account_update") {
      return Boolean(profile.authUserId && notification.recipientAuthUserId === profile.authUserId);
    }

    // Special production-handoff: order_status for their machine
    if (notification.type === "order_status") {
      if (!context.machineRole || context.machineRole !== profile.role) return false;
      if (context.machineId && profile.assignedMachineIds && profile.assignedMachineIds.length > 0) {
        return profile.assignedMachineIds.includes(context.machineId);
      }
      return true;
    }

    // Other order types are excluded for operators
    if (domain === "orders") {
      return false;
    }

    // Direct recipient check: if directly sent to this operator for inventory/operations
    if (profile.authUserId && notification.recipientAuthUserId === profile.authUserId) {
      return true;
    }

    // Machine-scoped check for inventory and operations
    if (context.machineRole) {
      if (context.machineRole !== profile.role) return false;
      if (context.machineId && profile.assignedMachineIds && profile.assignedMachineIds.length > 0) {
        return profile.assignedMachineIds.includes(context.machineId);
      }
      return true;
    }

    // If machineId is set without machineRole, check assignment
    if (context.machineId && profile.assignedMachineIds && profile.assignedMachineIds.length > 0) {
      return profile.assignedMachineIds.includes(context.machineId);
    }

    // Non-machine, non-assigned inventory events (like central stock-in/out or general storekeeper alerts) are excluded
    return false;
  }

  return false;
}
