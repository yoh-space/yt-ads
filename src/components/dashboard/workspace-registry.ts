import type { Role } from "@/lib/operations-types";
import type { AccessContext, Capability } from "@/lib/access-policy";
import { canAccess } from "@/lib/access-policy";
import type { View } from "./nav-config";

export type WorkspaceId = "owner" | "manager" | "admin" | "storekeeper" | "receptionist" | "operator";
export type WorkspacePlacement = "primary" | "secondary" | "footer";

export type WorkspaceModule = {
  id: string;
  capability: Capability;
  placement: WorkspacePlacement;
};

export type WorkspaceDefinition = {
  id: WorkspaceId;
  route: string;
  roles: Role[];
  primaryCapability: Capability;
  navViews: View[];
  modules: WorkspaceModule[];
};

export const WORKSPACE_REGISTRY: Record<WorkspaceId, WorkspaceDefinition> = {
  owner: {
    id: "owner",
    route: "/dashboard/owner",
    roles: ["owner"],
    primaryCapability: "finance.view",
    navViews: ["overview", "orders", "inventory", "jobs", "machines", "reports", "reconciliation", "financial", "settings"],
    modules: [
      { id: "dashboard.kpis", capability: "dashboard.view", placement: "primary" },
      { id: "orders.queue", capability: "orders.view", placement: "primary" },
      { id: "reports.finance", capability: "finance.view", placement: "secondary" },
    ],
  },
  manager: {
    id: "manager",
    route: "/dashboard/manager",
    roles: ["manager"],
    primaryCapability: "dashboard.view",
    navViews: ["overview", "orders", "inventory", "jobs", "machines", "reports", "reconciliation", "settings"],
    modules: [
      { id: "dashboard.kpis", capability: "dashboard.view", placement: "primary" },
      { id: "orders.queue", capability: "orders.view", placement: "primary" },
      { id: "reconciliation.queue", capability: "reconciliation.review", placement: "secondary" },
    ],
  },
  admin: {
    id: "admin",
    route: "/dashboard/owner",
    roles: ["admin"],
    primaryCapability: "dashboard.view",
    navViews: ["overview", "orders", "inventory", "jobs", "machines", "reports", "reconciliation", "financial", "settings"],
    modules: [
      { id: "dashboard.kpis", capability: "dashboard.view", placement: "primary" },
      { id: "orders.queue", capability: "orders.view", placement: "primary" },
      { id: "reports.finance", capability: "finance.view", placement: "secondary" },
    ],
  },
  storekeeper: {
    id: "storekeeper",
    route: "/dashboard/storekeeper",
    roles: ["storekeeper"],
    primaryCapability: "inventory.parent.view",
    navViews: ["overview", "inventory", "reconciliation", "settings"],
    modules: [
      { id: "inventory.kpis", capability: "inventory.parent.view", placement: "primary" },
      { id: "inventory.parent-stock", capability: "inventory.parent.view", placement: "primary" },
      { id: "inventory.requisitions", capability: "inventory.requisition.approve", placement: "secondary" },
      { id: "inventory.reorder-alerts", capability: "inventory.reorder.create", placement: "footer" },
    ],
  },
  receptionist: {
    id: "receptionist",
    route: "/dashboard/reception",
    roles: ["receptionist"],
    primaryCapability: "orders.view",
    navViews: ["overview", "orders", "settings"],
    modules: [
      { id: "orders.queue", capability: "orders.view", placement: "primary" },
    ],
  },
  operator: {
    id: "operator",
    route: "/dashboard/operator",
    roles: ["laser_operator", "cnc_operator", "plotter_operator", "printer_operator"],
    primaryCapability: "jobs.execute",
    navViews: ["overview", "inventory", "settings"],
    modules: [
      { id: "jobs.queue", capability: "jobs.execute", placement: "primary" },
      { id: "inventory.substock", capability: "inventory.substock.view", placement: "secondary" },
    ],
  },
};

export function workspaceForRole(role: Role): WorkspaceDefinition {
  const workspace = Object.values(WORKSPACE_REGISTRY).find((candidate) => candidate.roles.includes(role));
  if (!workspace) throw new Error(`No workspace registered for role: ${role}`);
  return workspace;
}

export function resolveWorkspace(context: AccessContext): WorkspaceDefinition | null {
  if (!context.profile?.active) return null;
  const workspace = workspaceForRole(context.profile.role);
  return canAccess(context, workspace.primaryCapability) ? workspace : null;
}

export function routeForWorkspace(context: AccessContext): string | null {
  const workspace = resolveWorkspace(context);
  if (!workspace) return null;
  if (workspace.id !== "operator") return workspace.route;
  const machineType = context.attributes?.machineType;
  return machineType ? `${workspace.route}/${machineType}` : workspace.route;
}

export function visibleModules(
  workspace: WorkspaceDefinition,
  context: AccessContext,
): WorkspaceModule[] {
  return workspace.modules.filter((module) => canAccess(context, module.capability));
}
