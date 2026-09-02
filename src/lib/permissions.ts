import type { Role, Machine, JobCard, MaterialRequest, Profile } from "./operations-types";

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
  "dashboard.view",
  "material.view",
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

/** Frontend mirror of the backend RBAC map (keep in sync with convex/authorization.ts). */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [...ALL],
  manager: ALL.filter((permission) => permission !== "company_settings.update" && permission !== "reconciliation.review"),
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
    "dashboard.view",
    "material.view",
    "material.create",
    "material.edit",
    "stock.record",
    "machine.view",
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
    "audit.view",
    "order.view",
    "order.create",
    "order.manage",
    "stock.exception",
    "reconciliation.record",
  ],
  laser_operator: [...OPERATIONS],
  cnc_operator: [...OPERATIONS],
  plotter_operator: [...OPERATIONS],
  printer_operator: [...OPERATIONS],
  receptionist: [
    "dashboard.view",
    "order.view",
    "order.create",
    "order.manage",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/** UI convenience: check a permission against a possibly-null profile. */
export function can(profile: Profile | null, permission: Permission): boolean {
  if (!profile) return false;
  return hasPermission(profile.role, permission);
}

function isManagementOrStore(role: Role): boolean {
  return MANAGEMENT_ROLES.includes(role);
}

export function canAccessMachine(role: Role, machine: { operatorRole: Role }): boolean {
  if (isManagementOrStore(role)) return true;
  return machine.operatorRole === role;
}

export function canAccessJob(role: Role, machine: { operatorRole: Role } | undefined): boolean {
  if (isManagementOrStore(role)) return true;
  if (!machine) return false;
  return machine.operatorRole === role;
}

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

export type { Machine, JobCard, MaterialRequest };
