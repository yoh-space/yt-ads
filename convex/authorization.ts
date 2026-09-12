import type { Role } from "./types";
import {
  ROLE_PERMISSIONS,
  MANAGEMENT_ROLES,
  type Permission,
} from "../src/shared/role-permissions";

export type { Permission } from "../src/shared/role-permissions";

export { ROLE_PERMISSIONS } from "../src/shared/role-permissions";

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

export function canAccessMachine(role: Role, machine: { operatorRole: Role }): boolean {
  if (MANAGEMENT_ROLES.includes(role)) return true;
  return machine.operatorRole === role;
}

export function canAccessJob(role: Role, machine: { operatorRole: Role } | undefined): boolean {
  if (MANAGEMENT_ROLES.includes(role)) return true;
  if (!machine) return false;
  return machine.operatorRole === role;
}

export function canAccessMaterialRequest(
  role: Role,
  identityId: string,
  request: { requestedBy: string },
  machine?: { operatorRole: Role },
): boolean {
  if (MANAGEMENT_ROLES.includes(role)) return true;
  if (request.requestedBy === identityId) return true;
  if (machine && machine.operatorRole === role) return true;
  return false;
}
