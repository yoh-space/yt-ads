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
  "stock.exception",
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

const MANAGEMENT_ROLES: Role[] = ["owner", "manager", "admin", "storekeeper"];

/** Frontend mirror of the backend RBAC map (keep in sync with convex/authorization.ts). */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL.filter((permission) => permission !== "request.create" && permission !== "request.issue" && permission !== "request.acknowledge"),
  manager: ALL.filter(
    (permission) =>
      permission !== "company_settings.update" &&
      permission !== "reports.view" &&
      permission !== "reconciliation.review" &&
      permission !== "stock.record" &&
      permission !== "stock.exception" &&
        permission !== "reconciliation.clearance" &&
        permission !== "team.view" &&
        permission !== "team.manage",
  ),
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
    "reconciliation.review",
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
  crystek_operator: [...OPERATIONS],
  crystal_jet_operator: [...OPERATIONS],
  ricoh_uv_operator: [...OPERATIONS],
  dtf_operator: [...OPERATIONS],
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
