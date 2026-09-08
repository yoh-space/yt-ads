import { describe, expect, it } from "vitest";
import {
  ALL_ROLES,
  ALL_WORKSPACES,
  OPERATOR_MACHINES,
  OPERATOR_MACHINE_MAP,
  ROLE_HOME_ROUTE,
  ROLE_TO_MACHINE_MAP,
  ROUTE_CONTRACTS,
  canAccessWorkspace,
  getLegacyRouteRedirect,
  getRoleHomeRoute,
  getWorkspaceForRole,
  isOperatorMachineAllowed,
  isPublicRoute,
  isRedirectLoop,
  isRouteAllowedForRole,
  isValidOperatorMachine,
  isValidRole,
  isValidWorkspaceId,
  normalizePathname,
} from "./role-routing";
import type { Role } from "./operations-types";

describe("role-routing", () => {
  it("recognizes all system roles", () => {
    expect(ALL_ROLES).toContain("owner");
    expect(ALL_ROLES).toContain("manager");
    expect(ALL_ROLES).toContain("admin");
    expect(ALL_ROLES).toContain("storekeeper");
    expect(ALL_ROLES).toContain("receptionist");
    expect(ALL_ROLES).toContain("laser_operator");
    expect(ALL_ROLES).toContain("cnc_operator");
    expect(ALL_ROLES).toContain("plotter_operator");
    expect(ALL_ROLES).toContain("printer_operator");

    expect(isValidRole("owner")).toBe(true);
    expect(isValidRole("storekeeper")).toBe(true);
    expect(isValidRole("hacker")).toBe(false);
  });

  it("maps roles to their respective landing pages", () => {
    expect(getRoleHomeRoute("owner")).toBe("/dashboard/owner");
    expect(getRoleHomeRoute("admin")).toBe("/dashboard/admin");
    expect(getRoleHomeRoute("manager")).toBe("/dashboard/manager");
    expect(getRoleHomeRoute("storekeeper")).toBe("/dashboard/storekeeper");
    expect(getRoleHomeRoute("receptionist")).toBe("/dashboard/receptionist");
    expect(getRoleHomeRoute("laser_operator")).toBe("/dashboard/operator/laser");
    expect(getRoleHomeRoute("cnc_operator")).toBe("/dashboard/operator/cnc");
    expect(getRoleHomeRoute("plotter_operator")).toBe("/dashboard/operator/plotter");
    expect(getRoleHomeRoute("printer_operator")).toBe("/dashboard/operator/printer");
  });

  it("validates workspaces and provides workspace-for-role mapping", () => {
    expect(ALL_WORKSPACES).toEqual([
      "owner",
      "manager",
      "admin",
      "storekeeper",
      "receptionist",
      "operator",
    ]);

    expect(isValidWorkspaceId("owner")).toBe(true);
    expect(isValidWorkspaceId("operator")).toBe(true);
    expect(isValidWorkspaceId("superadmin")).toBe(false);
    expect(isValidWorkspaceId("")).toBe(false);

    expect(getWorkspaceForRole("owner")).toBe("owner");
    expect(getWorkspaceForRole("admin")).toBe("admin");
    expect(getWorkspaceForRole("manager")).toBe("manager");
    expect(getWorkspaceForRole("storekeeper")).toBe("storekeeper");
    expect(getWorkspaceForRole("receptionist")).toBe("receptionist");
    expect(getWorkspaceForRole("laser_operator")).toBe("operator");
    expect(getWorkspaceForRole("cnc_operator")).toBe("operator");
    expect(getWorkspaceForRole("plotter_operator")).toBe("operator");
    expect(getWorkspaceForRole("printer_operator")).toBe("operator");
  });

  it("identifies public routes correctly", () => {
    expect(isPublicRoute("/")).toBe(true);
    expect(isPublicRoute("/sign-in")).toBe(true);
    expect(isPublicRoute("/sign-up")).toBe(true);
    expect(isPublicRoute("/track")).toBe(true);
    expect(isPublicRoute("/track/YT-1234")).toBe(true);
    expect(isPublicRoute("/api/auth/session")).toBe(true);
    expect(isPublicRoute("/favicon.ico")).toBe(true);
    expect(isPublicRoute("/_next/static/chunk.js")).toBe(true);
    expect(isPublicRoute("/dashboard")).toBe(false);
    expect(isPublicRoute("/orders")).toBe(false);
    expect(isPublicRoute("/reports")).toBe(false);
  });

  it("enforces role-based route access strictly", () => {
    // Owner & Admin
    expect(isRouteAllowedForRole("owner", "/dashboard/owner")).toBe(true);
    expect(isRouteAllowedForRole("owner", "/reports")).toBe(true);
    expect(isRouteAllowedForRole("owner", "/reconciliation")).toBe(true);

    expect(isRouteAllowedForRole("admin", "/dashboard/owner")).toBe(true);
    expect(isRouteAllowedForRole("admin", "/reports")).toBe(true);
    expect(isRouteAllowedForRole("admin", "/reconciliation")).toBe(true);

    // Manager
    expect(isRouteAllowedForRole("manager", "/dashboard/manager")).toBe(true);
    expect(isRouteAllowedForRole("manager", "/reports")).toBe(false);
    expect(isRouteAllowedForRole("manager", "/reconciliation")).toBe(false);
    expect(isRouteAllowedForRole("manager", "/dashboard/owner")).toBe(false);

    // Storekeeper
    expect(isRouteAllowedForRole("storekeeper", "/dashboard/storekeeper")).toBe(true);
    expect(isRouteAllowedForRole("storekeeper", "/dashboard/storekeeper/reconciliation")).toBe(true);
    expect(isRouteAllowedForRole("storekeeper", "/inventory/parent")).toBe(true);
    expect(isRouteAllowedForRole("storekeeper", "/reports")).toBe(false);
    expect(isRouteAllowedForRole("storekeeper", "/orders")).toBe(false);
    expect(isRouteAllowedForRole("storekeeper", "/dashboard/owner")).toBe(false);

    // Receptionist
    expect(isRouteAllowedForRole("receptionist", "/dashboard/reception")).toBe(true);
    expect(isRouteAllowedForRole("receptionist", "/dashboard/receptionist")).toBe(true);
    expect(isRouteAllowedForRole("receptionist", "/orders")).toBe(true);
    expect(isRouteAllowedForRole("receptionist", "/inventory/parent")).toBe(false);
    expect(isRouteAllowedForRole("receptionist", "/reports")).toBe(false);
    expect(isRouteAllowedForRole("receptionist", "/reconciliation")).toBe(false);

    // Laser Operator
    expect(isRouteAllowedForRole("laser_operator", "/dashboard/operator/laser")).toBe(true);
    expect(isRouteAllowedForRole("laser_operator", "/dashboard/operator/inventory/substock")).toBe(true);
    expect(isRouteAllowedForRole("laser_operator", "/inventory/substock")).toBe(true);
    expect(isRouteAllowedForRole("laser_operator", "/dashboard/operator/cnc")).toBe(false);
    expect(isRouteAllowedForRole("laser_operator", "/reports")).toBe(false);
    expect(isRouteAllowedForRole("laser_operator", "/orders")).toBe(false);
  });

  it("maps machines and operator roles symmetrically and validates machines", () => {
    expect(OPERATOR_MACHINES).toEqual(["laser", "cnc", "plotter", "printer"]);
    expect(isValidOperatorMachine("laser")).toBe(true);
    expect(isValidOperatorMachine("lathe")).toBe(false);

    expect(OPERATOR_MACHINE_MAP["laser"]).toBe("laser_operator");
    expect(OPERATOR_MACHINE_MAP["cnc"]).toBe("cnc_operator");
    expect(OPERATOR_MACHINE_MAP["plotter"]).toBe("plotter_operator");
    expect(OPERATOR_MACHINE_MAP["printer"]).toBe("printer_operator");

    expect(ROLE_TO_MACHINE_MAP["laser_operator"]).toBe("laser");
    expect(ROLE_TO_MACHINE_MAP["cnc_operator"]).toBe("cnc");
    expect(ROLE_TO_MACHINE_MAP["plotter_operator"]).toBe("plotter");
    expect(ROLE_TO_MACHINE_MAP["printer_operator"]).toBe("printer");
  });

  it("evaluates operator machine access and catches operator machine mismatch", () => {
    // Admins and owners can access any machine
    expect(isOperatorMachineAllowed("owner", "laser")).toBe(true);
    expect(isOperatorMachineAllowed("admin", "cnc")).toBe(true);
    expect(isOperatorMachineAllowed("manager", "plotter")).toBe(true);

    // Specific operators can only access their assigned machine
    expect(isOperatorMachineAllowed("laser_operator", "laser")).toBe(true);
    expect(isOperatorMachineAllowed("laser_operator", "cnc")).toBe(false);
    expect(isOperatorMachineAllowed("laser_operator", "printer")).toBe(false);

    expect(isOperatorMachineAllowed("cnc_operator", "cnc")).toBe(true);
    expect(isOperatorMachineAllowed("cnc_operator", "laser")).toBe(false);

    expect(isOperatorMachineAllowed("plotter_operator", "plotter")).toBe(true);
    expect(isOperatorMachineAllowed("plotter_operator", "printer")).toBe(false);

    expect(isOperatorMachineAllowed("printer_operator", "printer")).toBe(true);
    expect(isOperatorMachineAllowed("printer_operator", "laser")).toBe(false);
  });

  it("enforces workspace access permissions via canAccessWorkspace", () => {
    expect(canAccessWorkspace("owner", "owner")).toBe(true);
    expect(canAccessWorkspace("owner", "storekeeper")).toBe(true);
    expect(canAccessWorkspace("admin", "owner")).toBe(true);

    expect(canAccessWorkspace("manager", "manager")).toBe(true);
    expect(canAccessWorkspace("manager", "operator")).toBe(true);
    expect(canAccessWorkspace("manager", "owner")).toBe(false);
    expect(canAccessWorkspace("manager", "storekeeper")).toBe(false);

    expect(canAccessWorkspace("storekeeper", "storekeeper")).toBe(true);
    expect(canAccessWorkspace("storekeeper", "owner")).toBe(false);
    expect(canAccessWorkspace("storekeeper", "manager")).toBe(false);

    expect(canAccessWorkspace("receptionist", "receptionist")).toBe(true);
    expect(canAccessWorkspace("receptionist", "owner")).toBe(false);

    expect(canAccessWorkspace("laser_operator", "operator")).toBe(true);
    expect(canAccessWorkspace("laser_operator", "storekeeper")).toBe(false);
  });

  it("resolves legacy route redirects correctly", () => {
    // /dashboard root dispatch
    expect(getLegacyRouteRedirect("/dashboard", "owner")).toBe("/dashboard/owner");
    expect(getLegacyRouteRedirect("/dashboard", "admin")).toBe("/dashboard/admin");
    expect(getLegacyRouteRedirect("/dashboard", "manager")).toBe("/dashboard/manager");
    expect(getLegacyRouteRedirect("/dashboard", "storekeeper")).toBe("/dashboard/storekeeper");
    expect(getLegacyRouteRedirect("/dashboard", "receptionist")).toBe("/dashboard/receptionist");
    expect(getLegacyRouteRedirect("/dashboard", "laser_operator")).toBe("/dashboard/operator/laser");

    // /inventory root dispatch
    expect(getLegacyRouteRedirect("/inventory", "storekeeper")).toBe("/inventory/parent");
    expect(getLegacyRouteRedirect("/inventory", "laser_operator")).toBe("/inventory/substock");
    expect(getLegacyRouteRedirect("/inventory", "cnc_operator")).toBe("/inventory/substock");
    expect(getLegacyRouteRedirect("/inventory", "owner")).toBe("/inventory/parent");

    // Legacy flat routes redirect to canonical workspace routes
    expect(getLegacyRouteRedirect("/orders", "owner")).toBe("/dashboard/owner/orders");
    expect(getLegacyRouteRedirect("/orders", "receptionist")).toBe("/dashboard/receptionist/orders");
    expect(getLegacyRouteRedirect("/orders", "manager")).toBe("/dashboard/manager/orders");
    expect(getLegacyRouteRedirect("/reports", "owner")).toBe("/dashboard/owner/reports");
    expect(getLegacyRouteRedirect("/settings", "owner")).toBe("/dashboard/owner/settings");
    // Operators use flat legacy routes directly — /dashboard/operator/[machine] conflicts with workspace routes
    expect(getLegacyRouteRedirect("/settings", "laser_operator")).toBe(null);
    expect(getLegacyRouteRedirect("/reconciliation", "owner")).toBe("/dashboard/owner/reconciliation");
    expect(getLegacyRouteRedirect("/reconciliation", "storekeeper")).toBe("/dashboard/storekeeper/reconciliation");
    expect(getLegacyRouteRedirect("/inventory/parent", "storekeeper")).toBe("/dashboard/storekeeper/inventory");
    // Operators use flat legacy routes directly — /dashboard/operator/[machine] conflicts with workspace routes
    expect(getLegacyRouteRedirect("/inventory/substock", "laser_operator")).toBe(null);

    // Unauthorized legacy routes redirected to role home
    expect(getLegacyRouteRedirect("/reports", "storekeeper")).toBe("/dashboard/storekeeper");
    expect(getLegacyRouteRedirect("/orders", "storekeeper")).toBe("/dashboard/storekeeper");
    expect(getLegacyRouteRedirect("/dashboard/owner", "manager")).toBe("/dashboard/manager");
    expect(getLegacyRouteRedirect("/dashboard/operator/cnc", "laser_operator")).toBe("/dashboard/operator/laser");

    // Canonical workspace routes are authorized and need no redirect (returns null)
    expect(getLegacyRouteRedirect("/dashboard/owner", "owner")).toBe(null);
    expect(getLegacyRouteRedirect("/dashboard/owner/orders", "owner")).toBe(null);
    expect(getLegacyRouteRedirect("/dashboard/owner/reports", "owner")).toBe(null);
    expect(getLegacyRouteRedirect("/dashboard/receptionist/orders", "receptionist")).toBe(null);
    expect(getLegacyRouteRedirect("/dashboard/operator/laser", "laser_operator")).toBe(null);
  });

  it("prevents redirect loops", () => {
    expect(isRedirectLoop("/dashboard/owner", "/dashboard/owner")).toBe(true);
    expect(isRedirectLoop("/dashboard/owner/", "/dashboard/owner")).toBe(true);
    expect(isRedirectLoop("/dashboard/owner?unauthorized=1", "/dashboard/owner")).toBe(true);
    expect(isRedirectLoop("/dashboard", "/dashboard/owner")).toBe(false);

    // Verify getLegacyRouteRedirect does not produce a redirect when already at target
    expect(getLegacyRouteRedirect("/dashboard/owner", "owner")).toBe(null);
    expect(getLegacyRouteRedirect("/dashboard/storekeeper", "storekeeper")).toBe(null);
    expect(getLegacyRouteRedirect("/dashboard/reception", "receptionist")).toBe("/dashboard/receptionist");
    expect(getLegacyRouteRedirect("/dashboard/operator/laser", "laser_operator")).toBe(null);
    expect(getLegacyRouteRedirect("/dashboard/owner/orders", "owner")).toBe(null);
  });

  it("exposes route contracts with valid home routes for each workspace", () => {
    for (const ws of ALL_WORKSPACES) {
      const contract = ROUTE_CONTRACTS[ws];
      expect(contract).toBeDefined();
      expect(contract.workspace).toBe(ws);
      expect(contract.homeRoute.startsWith("/dashboard")).toBe(true);
      expect(contract.roles.length).toBeGreaterThan(0);
      expect(contract.allowedPrefixes.length).toBeGreaterThan(0);
    }
  });
});
