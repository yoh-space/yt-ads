/**
 * Canonical role-permission definitions shared by both frontend and backend.
 *
 * This is the single source of truth for RBAC. Both `src/lib/permissions.ts`
 * (frontend) and `convex/authorization.ts` (backend) import from this file
 * so the two maps can never silently drift apart.
 */

import type { Role } from "../lib/operations-types";

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
  | "reconciliation.clearance";

export const ALL_PERMISSIONS: Permission[] = [
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
  "reconciliation.record",
  "reconciliation.review",
  "reconciliation.operator",
  "reconciliation.clearance",
];

export const OPERATOR_PERMISSIONS: Permission[] = [
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

/** Owners do not request or issue materials — the store handles handover. */
const EXCLUDED_FROM_OWNER: Set<Permission> = new Set([
  "request.create",
  "request.issue",
  "request.acknowledge",
]);

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

/**
 * Authoritative role → permission mapping.
 * Both frontend and backend MUST import this single definition.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL_PERMISSIONS.filter((p) => !EXCLUDED_FROM_OWNER.has(p)),
  manager: ALL_PERMISSIONS.filter((p) => !EXCLUDED_FROM_MANAGER.has(p)),
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
  laser_operator: [...OPERATOR_PERMISSIONS],
  cnc_operator: [...OPERATOR_PERMISSIONS],
  crystek_operator: [...OPERATOR_PERMISSIONS],
  crystal_jet_operator: [...OPERATOR_PERMISSIONS],
  ricoh_uv_operator: [...OPERATOR_PERMISSIONS],
  dtf_operator: [...OPERATOR_PERMISSIONS],
  receptionist: [
    "dashboard.view",
    "order.view",
    "order.create",
    "order.manage",
  ],
};

export const MANAGEMENT_ROLES: Role[] = ["owner", "manager", "admin", "storekeeper"];
