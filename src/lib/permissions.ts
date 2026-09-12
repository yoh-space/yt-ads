import type { Role, Machine, JobCard, MaterialRequest, Profile } from "./operations-types";
import {
  ROLE_PERMISSIONS,
  MANAGEMENT_ROLES,
  type Permission,
} from "../shared/role-permissions";

export type { Permission } from "../shared/role-permissions";

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** UI convenience: check a permission against a possibly-null profile. */
export function can(profile: Profile | null, permission: Permission): boolean {
  if (!profile) return false;
  return hasPermission(profile.role, permission);
}

export function canAccessMachine(role: Role, machine: { operatorRole: Role }): boolean {
  if (MANAGEMENT_ROLES.includes(role)) return true;
  return machine.operatorRole === role;
}

export function canAccessJob(role: Role, machine: { operatorRole: Role } | undefined): boolean {
  if (MANAGEMENT_ROLES.includes(role)) return true;
  if (!machine) return false;
  return machine.operatorRole === role;
}
