import type { Profile, Role } from "./operations-types";
import { hasPermission, type Permission } from "./permissions";

/**
 * Capabilities are the stable contract consumed by UI modules. Roles are only
 * one input to the policy; future tenant, department, or assignment attributes
 * can be added here without changing dashboard components.
 */
export type Capability =
  | "dashboard.view"
  | "inventory.parent.view"
  | "inventory.stock-in"
  | "inventory.dispatch"
  | "inventory.requisition.approve"
  | "inventory.reorder.create"
  | "inventory.substock.view"
  | "orders.view"
  | "reports.view"
  | "reconciliation.record"
  | "reconciliation.operator"
  | "reconciliation.review"
  | "machines.manage"
  | "finance.view"
  | "jobs.execute";

export type AccessContext = {
  profile: Pick<Profile, "role" | "active"> | null;
  attributes?: {
    userId?: string;
    warehouseId?: string;
    department?: string;
    machineId?: string;
    machineType?: "laser" | "cnc" | "plotter" | "printer";
  };
};

const CAPABILITY_PERMISSIONS: Record<Capability, Permission | null> = {
  "dashboard.view": "dashboard.view",
  "inventory.parent.view": "material.view",
  "inventory.stock-in": "stock.record",
  "inventory.dispatch": "stock.record",
  "inventory.requisition.approve": "request.issue",
  "inventory.reorder.create": "material.edit",
  "inventory.substock.view": "material.view",
  "orders.view": "order.view",
  "reports.view": "reports.view",
  "reconciliation.record": "reconciliation.record",
  "reconciliation.operator": "reconciliation.operator",
  "reconciliation.review": "reconciliation.review",
  "machines.manage": "machine.update",
  "finance.view": "reports.view",
  "jobs.execute": "job.view",
};

const ROLE_CAPABILITY_OVERRIDES: Partial<Record<Role, Partial<Record<Capability, boolean>>>> = {
  owner: { "finance.view": true },
  manager: {
    "finance.view": false,
    "reports.view": false,
    "reconciliation.review": false,
    "jobs.execute": false,
    "inventory.substock.view": false,
  },
  admin: { "finance.view": true },
  receptionist: {
    "orders.view": true,
    "inventory.parent.view": false,
    "inventory.substock.view": false,
    "jobs.execute": false,
  },
  storekeeper: {
    "orders.view": false,
    "finance.view": false,
    "inventory.parent.view": true,
    "inventory.stock-in": true,
    "inventory.dispatch": true,
    "inventory.requisition.approve": true,
    "inventory.substock.view": false,
    "reconciliation.record": true,
    "jobs.execute": false,
  },
  laser_operator: { "inventory.parent.view": false, "inventory.substock.view": true, "reconciliation.operator": true, "jobs.execute": true },
  cnc_operator: { "inventory.parent.view": false, "inventory.substock.view": true, "reconciliation.operator": true, "jobs.execute": true },
  plotter_operator: { "inventory.parent.view": false, "inventory.substock.view": true, "reconciliation.operator": true, "jobs.execute": true },
  printer_operator: { "inventory.parent.view": false, "inventory.substock.view": true, "reconciliation.operator": true, "jobs.execute": true },
};

export function canAccess(context: AccessContext, capability: Capability): boolean {
  if (!context.profile?.active) return false;

  const override = ROLE_CAPABILITY_OVERRIDES[context.profile.role]?.[capability];
  if (override !== undefined) return override;

  const permission = CAPABILITY_PERMISSIONS[capability];
  return permission === null || hasPermission(context.profile.role, permission);
}

export function capabilitiesFor(context: AccessContext): Capability[] {
  return (Object.keys(CAPABILITY_PERMISSIONS) as Capability[]).filter((capability) =>
    canAccess(context, capability),
  );
}
