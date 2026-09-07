import type { Role } from "./operations-types";

export const ALL_ROLES: readonly Role[] = [
  "owner",
  "manager",
  "admin",
  "storekeeper",
  "receptionist",
  "laser_operator",
  "cnc_operator",
  "plotter_operator",
  "printer_operator",
] as const;

export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && ALL_ROLES.includes(value as Role);
}

export const ALL_WORKSPACES = [
  "owner",
  "manager",
  "admin",
  "storekeeper",
  "receptionist",
  "operator",
] as const;

export type WorkspaceId = (typeof ALL_WORKSPACES)[number];

export function isValidWorkspaceId(value: unknown): value is WorkspaceId {
  return typeof value === "string" && (ALL_WORKSPACES as readonly string[]).includes(value);
}

export const OPERATOR_MACHINES = ["laser", "cnc", "plotter", "printer"] as const;
export type OperatorMachine = (typeof OPERATOR_MACHINES)[number];

export function isValidOperatorMachine(value: unknown): value is OperatorMachine {
  return typeof value === "string" && (OPERATOR_MACHINES as readonly string[]).includes(value);
}

export const OPERATOR_MACHINE_MAP: Record<OperatorMachine, Role> = {
  laser: "laser_operator",
  cnc: "cnc_operator",
  plotter: "plotter_operator",
  printer: "printer_operator",
};

export const ROLE_TO_MACHINE_MAP: Partial<Record<Role, OperatorMachine>> = {
  laser_operator: "laser",
  cnc_operator: "cnc",
  plotter_operator: "plotter",
  printer_operator: "printer",
};

export const ROLE_HOME_ROUTE: Record<Role, string> = {
  owner: "/dashboard/owner",
  manager: "/dashboard/manager",
  admin: "/dashboard/owner",
  storekeeper: "/dashboard/storekeeper",
  receptionist: "/dashboard/receptionist",
  laser_operator: "/dashboard/operator/laser",
  cnc_operator: "/dashboard/operator/cnc",
  plotter_operator: "/dashboard/operator/plotter",
  printer_operator: "/dashboard/operator/printer",
};

export function getRoleHomeRoute(role: Role): string {
  return ROLE_HOME_ROUTE[role] ?? "/dashboard/owner";
}

export function getWorkspaceForRole(role: Role): WorkspaceId {
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  if (role === "manager") return "manager";
  if (role === "storekeeper") return "storekeeper";
  if (role === "receptionist") return "receptionist";
  return "operator";
}

export function canAccessWorkspace(role: Role, workspace: WorkspaceId): boolean {
  if (role === "owner" || role === "admin") return true;
  if (role === "manager") {
    return workspace === "manager" || workspace === "operator";
  }
  if (role === "storekeeper") {
    return workspace === "storekeeper";
  }
  if (role === "receptionist") {
    return workspace === "receptionist";
  }
  return workspace === "operator";
}

export function isOperatorMachineAllowed(role: Role, machine: string): boolean {
  if (role === "owner" || role === "admin" || role === "manager") return true;
  const assigned = ROLE_TO_MACHINE_MAP[role];
  return assigned === machine;
}

/**
 * Route type classification for each path.
 * - "canonical": The primary business implementation lives here.
 * - "redirect": Minimal redirect-only compatibility route.
 * - "operator-stable": Operator machine route that owns the stable URL contract.
 */
export type RouteType = "canonical" | "redirect" | "operator-stable";

/**
 * Canonical route descriptor — single source of truth for navigation hrefs.
 * Each view maps to a function that produces the correct href for the given role.
 * Operators use flat legacy routes for workspace-level features (inventory, settings)
 * because /dashboard/operator/[machine] conflicts with /dashboard/[workspace]/[feature].
 */
export type RouteDescriptor = {
  view: string;
  href: (role: Role) => string;
  type: RouteType;
};

function isOperatorRole(role: Role): boolean {
  return (
    role === "laser_operator" ||
    role === "cnc_operator" ||
    role === "plotter_operator" ||
    role === "printer_operator"
  );
}

function operatorMachineForRole(role: Role): OperatorMachine | null {
  return ROLE_TO_MACHINE_MAP[role] ?? null;
}

/**
 * Canonical route descriptors for each navigation view.
 * Operators use /inventory/substock and /settings (flat legacy routes) because
 * /dashboard/operator/[machine]/inventory would conflict with the workspace route tree.
 */
export const ROUTE_DESCRIPTORS: Record<string, RouteDescriptor> = {
  overview: {
    view: "overview",
    href: (role) => {
      if (role === "owner" || role === "admin") return "/dashboard/owner";
      if (role === "manager") return "/dashboard/manager";
      if (role === "storekeeper") return "/dashboard/storekeeper";
      if (role === "receptionist") return "/dashboard/receptionist";
      const machine = operatorMachineForRole(role);
      if (machine) return `/dashboard/operator/${machine}`;
      return "/dashboard/owner";
    },
    type: "canonical",
  },
  orders: {
    view: "orders",
    href: (role) => {
      if (isOperatorRole(role)) return "/dashboard"; // operators don't access orders
      return "/orders";
    },
    type: "canonical",
  },
  inventory: {
    view: "inventory",
    href: (role) => {
      if (role === "storekeeper") return "/inventory/parent";
      if (isOperatorRole(role)) return "/inventory/substock";
      return "/inventory/parent";
    },
    type: "canonical",
  },
  jobs: {
    view: "jobs",
    href: (role) => {
      const machine = operatorMachineForRole(role);
      if (machine) return `/dashboard/operator/${machine}`;
      if (role === "owner" || role === "admin") return "/dashboard/owner/jobs";
      return "/dashboard/manager";
    },
    type: "canonical",
  },
  machines: {
    view: "machines",
    href: (role) => {
      if (role === "owner" || role === "admin") return "/dashboard/owner/machines";
      return "/dashboard/manager";
    },
    type: "canonical",
  },
  offcuts: {
    view: "offcuts",
    href: () => "/inventory/substock",
    type: "canonical",
  },
  reports: {
    view: "reports",
    href: () => "/reports",
    type: "canonical",
  },
  reconciliation: {
    view: "reconciliation",
    href: (role) => {
      if (role === "storekeeper") return "/dashboard/storekeeper/reconciliation";
      const machine = operatorMachineForRole(role);
      if (machine) return `/dashboard/operator/${machine}/reconciliation`;
      return "/reconciliation";
    },
    type: "canonical",
  },
  financial: {
    view: "financial",
    href: () => "/reports",
    type: "canonical",
  },
  audit: {
    view: "audit",
    href: () => "/settings",
    type: "canonical",
  },
  settings: {
    view: "settings",
    href: () => "/settings",
    type: "canonical",
  },
  config: {
    view: "config",
    href: (role) => {
      if (role === "owner" || role === "admin") return "/dashboard/owner/config";
      return "/settings";
    },
    type: "canonical",
  },
};

export type RouteContract = {
  workspace: WorkspaceId;
  roles: readonly Role[];
  homeRoute: string;
  allowedPrefixes: readonly string[];
};

export const ROUTE_CONTRACTS: Record<WorkspaceId, RouteContract> = {
  owner: {
    workspace: "owner",
    roles: ["owner"],
    homeRoute: "/dashboard/owner",
    allowedPrefixes: [
      "/dashboard",
      "/orders",
      "/inventory",
      "/reports",
      "/reconciliation",
      "/settings",
    ],
  },
  admin: {
    workspace: "admin",
    roles: ["admin"],
    homeRoute: "/dashboard/owner",
    allowedPrefixes: [
      "/dashboard",
      "/orders",
      "/inventory",
      "/reports",
      "/reconciliation",
      "/settings",
    ],
  },
  manager: {
    workspace: "manager",
    roles: ["manager"],
    homeRoute: "/dashboard/manager",
    allowedPrefixes: [
      "/dashboard/manager",
      "/dashboard/operator",
      "/orders",
      "/inventory",
      "/settings",
    ],
  },
  storekeeper: {
    workspace: "storekeeper",
    roles: ["storekeeper"],
    homeRoute: "/dashboard/storekeeper",
    allowedPrefixes: [
      "/dashboard/storekeeper",
      "/inventory",
      "/inventory/parent",
      "/settings",
    ],
  },
  receptionist: {
    workspace: "receptionist",
    roles: ["receptionist"],
    homeRoute: "/dashboard/receptionist",
    allowedPrefixes: [
      "/dashboard/reception",
      "/dashboard/receptionist",
      "/orders",
      "/settings",
    ],
  },
  operator: {
    workspace: "operator",
    roles: [
      "laser_operator",
      "cnc_operator",
      "plotter_operator",
      "printer_operator",
    ],
    homeRoute: "/dashboard/operator",
    allowedPrefixes: [
      "/dashboard/operator",
      "/inventory/substock",
      "/settings",
    ],
  },
};

/**
 * Normalizes a pathname by stripping query strings and trailing slashes.
 */
export function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split("?")[0] ?? pathname;
  return withoutQuery.length > 1 && withoutQuery.endsWith("/")
    ? withoutQuery.slice(0, -1)
    : withoutQuery;
}

/**
 * Checks if target redirect would cause a redirect loop.
 */
export function isRedirectLoop(currentPath: string, targetPath: string): boolean {
  return normalizePathname(currentPath) === normalizePathname(targetPath);
}

/**
 * Legacy flat-route and role dispatch resolver.
 * Returns a redirect destination path, or null if no redirect is needed.
 */
export function getLegacyRouteRedirect(pathname: string, role: Role): string | null {
  const cleanPath = normalizePathname(pathname);
  const workspace = getWorkspaceForRole(role);

  // Root /dashboard -> role home route
  if (cleanPath === "/dashboard") {
    const home = getRoleHomeRoute(role);
    return isRedirectLoop(cleanPath, home) ? null : home;
  }

  // Keep the old receptionist landing path compatible with the canonical workspace route.
  if (cleanPath === "/dashboard/reception" && role === "receptionist") {
    return "/dashboard/receptionist";
  }

  // Root /inventory -> parent or substock based on role
  if (cleanPath === "/inventory") {
    const isFloorOperator = [
      "laser_operator",
      "cnc_operator",
      "plotter_operator",
      "printer_operator",
    ].includes(role);
    const target = isFloorOperator ? "/inventory/substock" : "/inventory/parent";
    return isRedirectLoop(cleanPath, target) ? null : target;
  }

  // Legacy flat paths redirect to canonical workspace routes if authorized
  if (cleanPath === "/orders") {
    if (["owner", "admin", "manager", "receptionist"].includes(role)) {
      const target = `/dashboard/${workspace}/orders`;
      return isRedirectLoop(cleanPath, target) ? null : target;
    }
  }
  if (cleanPath === "/reports") {
    if (["owner", "admin"].includes(role)) {
      const target = `/dashboard/${workspace}/reports`;
      return isRedirectLoop(cleanPath, target) ? null : target;
    }
  }
  if (cleanPath === "/settings") {
    // Operators use the flat legacy route directly — /dashboard/operator/[machine]
    // conflicts with /dashboard/[workspace]/[feature], so operators keep /settings.
    if (isOperatorRole(role)) {
      return null;
    }
    const target = `/dashboard/${workspace}/settings`;
    return isRedirectLoop(cleanPath, target) ? null : target;
  }
  if (cleanPath === "/reconciliation") {
    if (role === "storekeeper") {
      return "/dashboard/storekeeper/reconciliation";
    }
    if (["owner", "admin"].includes(role)) {
      const target = `/dashboard/${workspace}/reconciliation`;
      return isRedirectLoop(cleanPath, target) ? null : target;
    }
  }
  if (cleanPath === "/inventory/parent") {
    const target = `/dashboard/${workspace}/inventory/parent`;
    return isRedirectLoop(cleanPath, target) ? null : target;
  }
  if (cleanPath === "/inventory/substock") {
    // Operators use the flat legacy route directly — /dashboard/operator/[machine]
    // conflicts with /dashboard/[workspace]/[feature], so operators keep /inventory/substock.
    if (isOperatorRole(role)) {
      return null;
    }
    const target = `/dashboard/${workspace}/inventory/substock`;
    return isRedirectLoop(cleanPath, target) ? null : target;
  }

  // Disallow admin-only / unauthorized access to other role dashboards
  if (!isRouteAllowedForRole(role, cleanPath)) {
    const home = getRoleHomeRoute(role);
    return isRedirectLoop(cleanPath, home) ? null : home;
  }

  return null;
}

/**
 * Public routes that bypass authentication and proxy interception.
 */
export function isPublicRoute(pathname: string): boolean {
  const clean = normalizePathname(pathname);
  if (
    clean === "" ||
    clean === "/" ||
    clean === "/sign-in" ||
    clean === "/sign-up" ||
    clean.startsWith("/track") ||
    clean.startsWith("/api/") ||
    clean.startsWith("/_next") ||
    clean.startsWith("/favicon") ||
    /\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|map)$/i.test(clean)
  ) {
    return true;
  }
  return false;
}

/**
 * Evaluates whether a role is authorized to visit a specific pathname.
 * Unauthorized routes will be redirected by proxy.ts to the user's role home route.
 */
export function isRouteAllowedForRole(role: Role, pathname: string): boolean {
  const cleanPath = normalizePathname(pathname);

  // Root /dashboard and /inventory are redirected to role-specific sub-routes
  if (cleanPath === "/dashboard" || cleanPath === "/inventory") {
    return true;
  }

  // Canonical workspace routing: /dashboard/[workspace]/...
  if (cleanPath.startsWith("/dashboard/")) {
    const segments = cleanPath.split("/").filter(Boolean);
    const ws = segments[1];
    // Only handle canonical workspace routes here; legacy dashboard routes fall through
    if (isValidWorkspaceId(ws)) {
      return canAccessCanonicalRoute(role, cleanPath);
    }
    // Legacy dashboard routes (e.g., /dashboard/reception) — handle via legacy check
    return canAccessLegacyRoute(role, cleanPath);
  }

  // Legacy flat routes — these are compatibility paths that redirect to canonical routes
  return canAccessLegacyRoute(role, cleanPath);
}

/**
 * Checks access to canonical workspace routes under /dashboard/[workspace]/...
 * This is the single source of truth for workspace-based authorization.
 */
function canAccessCanonicalRoute(role: Role, pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean); // ["dashboard", workspace, ...]
  const ws = segments[1];

  if (!isValidWorkspaceId(ws)) return false;
  if (!canAccessWorkspace(role, ws)) return false;

  const feature = segments[2];

  // Operators use /dashboard/operator/[machine] for machine-specific routes.
  // Inventory and settings are accessed via flat legacy routes (/inventory/substock, /settings)
  // because /dashboard/operator/[machine]/inventory conflicts with the workspace route tree.
  if (ws === "operator") {
    if (feature) {
      return isOperatorMachineAllowed(role, feature);
    }
    return true;
  }

  // Feature-based access for non-operator workspaces
  if (feature === "orders") {
    return ["owner", "admin", "manager", "receptionist"].includes(role);
  }
  if (feature === "reports") {
    return ["owner", "admin"].includes(role);
  }
  if (feature === "reconciliation") {
    return ["owner", "admin", "storekeeper"].includes(role);
  }
  if (feature === "jobs" || feature === "machines" || feature === "config") {
    return ["owner", "admin", "manager"].includes(role);
  }
  if (feature === "settings") {
    return true;
  }
  if (feature === "inventory") {
    const sub = segments[3];
    if (sub === "substock") {
      return ["owner", "admin", "manager", "laser_operator", "cnc_operator", "plotter_operator", "printer_operator"].includes(role);
    }
    return ["owner", "admin", "manager", "storekeeper"].includes(role);
  }
  return true;
}

/**
 * Checks access to legacy flat routes (e.g., /orders, /inventory, /settings).
 * These routes exist for backward compatibility and redirect to canonical workspace routes.
 */
function canAccessLegacyRoute(role: Role, pathname: string): boolean {
  // Owner and Admin have full access across all operational workspaces
  if (role === "owner" || role === "admin") {
    return true;
  }

  // Manager has operational access only; reports and reconciliation are owner/admin domains.
  if (role === "manager") {
    if (pathname.startsWith("/dashboard/owner")) return false;
    return (
      pathname.startsWith("/dashboard/manager") ||
      pathname.startsWith("/dashboard/operator") ||
      pathname.startsWith("/inventory") ||
      pathname.startsWith("/orders") ||
      pathname.startsWith("/settings")
    );
  }

  // Storekeeper: Central packaging inventory (/dashboard/storekeeper, /inventory/parent), stock movements, settings
  if (role === "storekeeper") {
    return (
      pathname.startsWith("/dashboard/storekeeper") ||
      pathname === "/inventory" ||
      pathname.startsWith("/inventory/parent") ||
      pathname.startsWith("/settings")
    );
  }

  // Receptionist: Reception desk (/dashboard/reception), orders queue (/orders), settings
  if (role === "receptionist") {
    return (
      pathname.startsWith("/dashboard/reception") ||
      pathname.startsWith("/orders") ||
      pathname.startsWith("/settings")
    );
  }

  // Operators: Operator workspace for their machine (/dashboard/operator/[machine]), floor sub-stock (/inventory/substock), settings
  if (isOperatorRole(role)) {
    const assignedMachine = ROLE_TO_MACHINE_MAP[role];
    const isAssignedMachineRoute = assignedMachine
      ? pathname.startsWith(`/dashboard/operator/${assignedMachine}`)
      : pathname.startsWith("/dashboard/operator");

    return (
      isAssignedMachineRoute ||
      pathname === "/inventory" ||
      pathname.startsWith("/inventory/substock") ||
      pathname.startsWith("/settings")
    );
  }

  return false;
}
