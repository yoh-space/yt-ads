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

export const OPERATOR_MACHINE_MAP: Record<string, Role> = {
  laser: "laser_operator",
  cnc: "cnc_operator",
  plotter: "plotter_operator",
  printer: "printer_operator",
};

export const ROLE_TO_MACHINE_MAP: Partial<Record<Role, string>> = {
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
  receptionist: "/dashboard/reception",
  laser_operator: "/dashboard/operator/laser",
  cnc_operator: "/dashboard/operator/cnc",
  plotter_operator: "/dashboard/operator/plotter",
  printer_operator: "/dashboard/operator/printer",
};

export function getRoleHomeRoute(role: Role): string {
  return ROLE_HOME_ROUTE[role] ?? "/dashboard/owner";
}

/**
 * Public routes that bypass authentication and proxy interception.
 */
export function isPublicRoute(pathname: string): boolean {
  if (
    pathname === "/" ||
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname.startsWith("/track") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|map)$/i.test(pathname)
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
  // Normalize pathname: remove trailing slash except root
  const cleanPath = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

  // Root /dashboard and /inventory are redirected to role-specific sub-routes
  if (cleanPath === "/dashboard" || cleanPath === "/inventory") {
    return true;
  }

  // Owner and Admin have full access across all operational workspaces
  if (role === "owner" || role === "admin") {
    return true;
  }

  // Manager has broad access: overview, orders, inventory, reports, reconciliation, settings
  if (role === "manager") {
    if (cleanPath.startsWith("/dashboard/owner")) return false; // strictly owner
    return (
      cleanPath.startsWith("/dashboard/manager") ||
      cleanPath.startsWith("/dashboard/operator") ||
      cleanPath.startsWith("/inventory") ||
      cleanPath.startsWith("/orders") ||
      cleanPath.startsWith("/reports") ||
      cleanPath.startsWith("/reconciliation") ||
      cleanPath.startsWith("/settings")
    );
  }

  // Storekeeper: Central packaging inventory (/dashboard/storekeeper, /inventory/parent), stock movements, settings
  if (role === "storekeeper") {
    return (
      cleanPath.startsWith("/dashboard/storekeeper") ||
      cleanPath === "/inventory" ||
      cleanPath.startsWith("/inventory/parent") ||
      cleanPath.startsWith("/settings")
    );
  }

  // Receptionist: Reception desk (/dashboard/reception), orders queue (/orders), settings
  if (role === "receptionist") {
    return (
      cleanPath.startsWith("/dashboard/reception") ||
      cleanPath.startsWith("/orders") ||
      cleanPath.startsWith("/settings")
    );
  }

  // Operators: Operator workspace for their machine (/dashboard/operator/[machine]), floor sub-stock (/inventory/substock), settings
  if (
    role === "laser_operator" ||
    role === "cnc_operator" ||
    role === "plotter_operator" ||
    role === "printer_operator"
  ) {
    const assignedMachine = ROLE_TO_MACHINE_MAP[role];
    const isAssignedMachineRoute = assignedMachine
      ? cleanPath.startsWith(`/dashboard/operator/${assignedMachine}`)
      : cleanPath.startsWith("/dashboard/operator");

    return (
      isAssignedMachineRoute ||
      cleanPath === "/inventory" ||
      cleanPath.startsWith("/inventory/substock") ||
      cleanPath.startsWith("/settings")
    );
  }

  return false;
}
