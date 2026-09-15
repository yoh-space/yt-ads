import type { Role } from "@shared-lib/operations-types";
import type { WorkspaceId } from "@shared-lib/role-routing";
import { getWorkspaceForRole, ROLE_TO_MACHINE_MAP } from "@shared-lib/role-routing";

/**
 * Mobile-only routing constants for the Expo client.
 *
 * Everything here is derived from the shared root definitions
 * (@shared-lib/*); roles and workspaces are never redefined on mobile.
 */

export type TabKey =
  | "overview"
  | "orders"
  | "inventory"
  | "jobs"
  | "queue"
  | "stock"
  | "requests"
  | "reconcile"
  | "payments"
  | "tasks"
  | "dashboard"
  | "settings";

export type TabConfig = {
  key: TabKey;
  title: string;
  /** Expo Router route relative to the (app) group, e.g. "receptionist/queue". */
  route: string;
  /** Icon key resolved by the mobile icon map (not a component ref). */
  icon: string;
  /** Show a notification badge on this tab. */
  badges?: boolean;
};

export type RoleTabs = {
  workspace: WorkspaceId;
  tabs: TabConfig[];
  /** The tab that is the role's landing screen. */
  primary: TabKey;
};

function workspaceRoute(ws: WorkspaceId, tab: TabKey, title: string, icon: string): TabConfig {
  return { key: tab, title, route: `${ws}/${tab}`, icon };
}

function overviewTabs(ws: WorkspaceId): TabConfig[] {
  return [
    workspaceRoute(ws, "overview", "Overview", "home"),
    workspaceRoute(ws, "orders", "Orders", "receipt"),
    workspaceRoute(ws, "inventory", "Inventory", "box"),
    workspaceRoute(ws, "jobs", "Jobs", "wrench"),
    workspaceRoute(ws, "settings", "Settings", "settings"),
  ];
}

const QUEUE: TabConfig = { key: "queue", title: "Queue", route: "receptionist/queue", icon: "inbox", badges: true };
const STOCK: TabConfig = { key: "stock", title: "Stock", route: "storekeeper/stock", icon: "box" };
const REQUESTS: TabConfig = { key: "requests", title: "Requests", route: "storekeeper/requests", icon: "clipboard", badges: true };
const RECONCILE: TabConfig = { key: "reconcile", title: "Reconcile", route: "storekeeper/reconcile", icon: "balance" };
const PAYMENTS: TabConfig = { key: "payments", title: "Payments", route: "cashier/payments", icon: "card", badges: true };
const TASKS: TabConfig = { key: "tasks", title: "Tasks", route: "designer/tasks", icon: "pen", badges: true };

function operatorTabs(): TabConfig[] {
  return [
    { key: "dashboard", title: "Machine", route: "operator/[machine]/dashboard", icon: "gauge", badges: true },
    { key: "jobs", title: "Jobs", route: "operator/[machine]/jobs", icon: "wrench" },
    { key: "inventory", title: "Inventory", route: "operator/[machine]/inventory", icon: "box" },
    { key: "settings", title: "Settings", route: "operator/[machine]/settings", icon: "settings" },
  ];
}

export const ROLE_TABS: Record<Role, RoleTabs> = {
  owner: { workspace: "owner", tabs: overviewTabs("owner"), primary: "overview" },
  admin: { workspace: "admin", tabs: overviewTabs("admin"), primary: "overview" },
  manager: { workspace: "manager", tabs: overviewTabs("manager"), primary: "overview" },
  receptionist: {
    workspace: "receptionist",
    tabs: [QUEUE, workspaceRoute("receptionist", "orders", "Orders", "receipt"), workspaceRoute("receptionist", "settings", "Settings", "settings")],
    primary: "queue",
  },
  storekeeper: {
    workspace: "storekeeper",
    tabs: [STOCK, REQUESTS, RECONCILE, workspaceRoute("storekeeper", "settings", "Settings", "settings")],
    primary: "stock",
  },
  cashier: {
    workspace: "cashier",
    tabs: [PAYMENTS, workspaceRoute("cashier", "orders", "Orders", "receipt"), workspaceRoute("cashier", "settings", "Settings", "settings")],
    primary: "payments",
  },
  designer: {
    workspace: "designer",
    tabs: [TASKS, workspaceRoute("designer", "settings", "Settings", "settings")],
    primary: "tasks",
  },
  laser_operator: { workspace: "operator", tabs: operatorTabs(), primary: "dashboard" },
  cnc_operator: { workspace: "operator", tabs: operatorTabs(), primary: "dashboard" },
  crystek_operator: { workspace: "operator", tabs: operatorTabs(), primary: "dashboard" },
  crystal_jet_operator: { workspace: "operator", tabs: operatorTabs(), primary: "dashboard" },
  ricoh_uv_operator: { workspace: "operator", tabs: operatorTabs(), primary: "dashboard" },
  dtf_operator: { workspace: "operator", tabs: operatorTabs(), primary: "dashboard" },
};

/**
 * Resolves a TabConfig route for a concrete role.
 * Operator routes interpolate the assigned machine segment
 * (ROLE_TO_MACHINE_MAP, root role-routing) matching the web app's
 * /dashboard/operator/[machine] semantics.
 */
export function resolveTabRoute(role: Role, tab: TabConfig): string {
  const machine = ROLE_TO_MACHINE_MAP[role];
  return machine ? tab.route.replace("[machine]", machine) : tab.route.replace("[machine]", "unknown");
}

/** The landing route for a role — used for initial redirect + deep links. */
export function homeTabForRole(role: Role): string {
  const { tabs, primary } = ROLE_TABS[role];
  const tab = tabs.find((candidate) => candidate.key === primary) ?? tabs[0];
  return resolveTabRoute(role, tab);
}

/**
 * Validates a resolved mobile route against the role's allowed tab set.
 * Deep links (notification taps) must land on an authorized route.
 */
export function isRouteAllowedForTabConfig(role: Role, route: string): boolean {
  return ROLE_TABS[role].tabs.some((tab) => resolveTabRoute(role, tab) === route);
}

export { getWorkspaceForRole };