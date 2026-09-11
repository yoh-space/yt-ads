import type { Role } from "./types";

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
  | "reconciliation.review"
  | "reconciliation.operator"
  | "reconciliation.clearance"

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
  "reconciliation.operator",
  "reconciliation.clearance",
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
  "reconciliation.operator",
];

const EXCLUDED_FROM_MANAGER: Set<Permission> = new Set([
  "company_settings.update",
  "reports.view",
  "reconciliation.review",
  "reconciliation.clearance",
  "stock.record",
  "stock.exception",
  "team.view",
  "team.manage",
]);

/** Owners do not request or issue materials — the store handles handover. */
const EXCLUDED_FROM_OWNER: Set<Permission> = new Set([
  "request.create",
  "request.issue",
  "request.acknowledge",
]);

const MANAGEMENT_ROLES: Role[] = ["owner", "manager", "admin", "storekeeper"];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL.filter((permission) => !EXCLUDED_FROM_OWNER.has(permission)),
  manager: ALL.filter((permission) => !EXCLUDED_FROM_MANAGER.has(permission)),
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
    "request.issue",
    "request.acknowledge",
    "team.view",
    "company_settings.update",
    "reports.view",
    "audit.view",
    "order.view",
    "order.create",
    "order.manage",
    "stock.exception",
    "reconciliation.record",
    "reconciliation.review", // Added for administrative review
    "reconciliation.operator",
    "reconciliation.clearance",
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
    "reconciliation.operator",
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
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canViewFinancial(role: Role): boolean {
  return role === "owner";
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/* ----------------------------- Attribute checks (ABAC) ----------------------------- */

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
