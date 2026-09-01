import type { Role } from "./types";

/**
 * Granular action permissions. These are the atoms the RBAC layer maps roles
 * to, and the ABAC helpers below combine with entity attributes (machine
 * operator role, requester identity, etc.) to make runtime access decisions.
 */
export type Permission =
  | "dashboard.view"
  | "material.view"
  | "material.create"
  | "material.edit"
  | "material.delete"
  | "stock.record"
  | "machine.view"
  | "machine.create"
  | "machine.update"
  | "machine.delete"
  | "job.view"
  | "job.create"
  | "job.complete"
  | "job.record_production"
  | "offcut.view"
  | "offcut.create"
  | "scrap.view"
  | "scrap.create"
  | "request.view"
  | "request.create"
  | "request.issue"
  | "request.acknowledge"
  | "team.view"
  | "team.manage"
  | "company_settings.update"
  | "reports.view"
  | "audit.view"
  | "order.view"
  | "order.create"
  | "order.manage"
  | "stock.exception"
  | "reconciliation.record"
  | "reconciliation.review";

const ALL: Permission[] = [
  "dashboard.view",
  "material.view",
  "material.create",
  "material.edit",
  "material.delete",
  "stock.record",
  "machine.view",
  "machine.create",
  "machine.update",
  "machine.delete",
  "job.view",
  "job.create",
  "job.complete",
  "job.record_production",
  "offcut.view",
  "offcut.create",
  "scrap.view",
  "scrap.create",
  "request.view",
  "request.create",
  "request.issue",
  "request.acknowledge",
  "team.view",
  "team.manage",
  "company_settings.update",
  "reports.view",
  "audit.view",
  "order.view",
  "order.create",
  "order.manage",
  "stock.exception",
  "reconciliation.record",
  "reconciliation.review",
];

const OPERATIONS: Permission[] = [
  "machine.view",
  "job.view",
  "job.record_production",
  "job.complete",
  "offcut.view",
  "offcut.create",
  "scrap.view",
  "scrap.create",
  "request.view",
  "request.create",
  "request.acknowledge",
];

const MANAGEMENT_ROLES: Role[] = ["owner", "manager", "admin", "storekeeper"];

/**
 * Single source of truth for role → permission assignment (RBAC). Operators
 * share one operational profile; managers receive everything except owner-only
 * company settings; admins run operations but cannot manage the team or company
 * settings; storekeepers handle the store but not machine/team administration.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [...ALL],
  manager: ALL.filter((permission) => permission !== "company_settings.update" || "team.view" || "team.manage" || "dashboard.view"),
  admin: [
    "dashboard.view",
    "material.view",
    "material.create",
    "material.edit",
    "material.delete",
    "stock.record",
    "machine.view",
    "machine.create",
    "machine.update",
    "machine.delete",
    "job.view",
    "job.create",
    "job.complete",
    "job.record_production",
    "offcut.view",
    "offcut.create",
    "scrap.view",
    "scrap.create",
    "request.view",
    "request.create",
    "request.issue",
    "request.acknowledge",
    "team.view",
    "reports.view",
    "audit.view",
    "order.view",
    "order.create",
    "order.manage",
    "stock.exception",
    "reconciliation.record",
  ],
  storekeeper: [
    "material.view",
    "material.create",
    "material.edit",
    "stock.record",
    "offcut.view",
    "offcut.create",
    "scrap.view",
    "scrap.create",
    "request.view",
    "request.issue",
    "request.acknowledge",
    "audit.view",
    "stock.exception",
    "reconciliation.record",
  ],
  laser_operator: [...OPERATIONS],
  cnc_operator: [...OPERATIONS],
  plotter_operator: [...OPERATIONS],
  printer_operator: [...OPERATIONS],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Whether a role may view monetary (ETB) values in read responses. Only the
 * owner sees financial figures; every other role receives masked payloads at
 * the backend query layer so sensitive values never reach the client.
 */
export function canViewFinancial(role: Role): boolean {
  return role === "owner";
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/* ----------------------------- Attribute checks (ABAC) ----------------------------- */

/** True for any management/storekeeping role; operators are limited to their own machine. */
function isManagementOrStore(role: Role): boolean {
  return MANAGEMENT_ROLES.includes(role);
}

/**
 * ABAC: a profile may access a machine when it is management/storekeeping, or
 * when the machine's operator role matches the profile's role.
 */
export function canAccessMachine(role: Role, machine: { operatorRole: Role }): boolean {
  if (isManagementOrStore(role)) return true;
  return machine.operatorRole === role;
}

/**
 * ABAC: a profile may access a job when it is management/storekeeping, or when
 * the job's machine operator role matches the profile's role.
 */
export function canAccessJob(role: Role, machine: { operatorRole: Role } | undefined): boolean {
  if (isManagementOrStore(role)) return true;
  if (!machine) return false;
  return machine.operatorRole === role;
}

/**
 * ABAC: a profile may access a material request when it is management/store, or
 * when the request was raised by the caller, or when the request's job runs on
 * a machine the operator is assigned to.
 */
export function canAccessMaterialRequest(
  role: Role,
  identityId: string,
  request: { requestedBy: string },
  machine?: { operatorRole: Role },
): boolean {
  if (isManagementOrStore(role)) return true;
  if (request.requestedBy === identityId) return true;
  if (machine && machine.operatorRole === role) return true;
  return false;
}
