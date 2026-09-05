import { describe, expect, it } from "vitest";
import {
  ALL_ROLES,
  OPERATOR_MACHINE_MAP,
  ROLE_HOME_ROUTE,
  ROLE_TO_MACHINE_MAP,
  getRoleHomeRoute,
  isPublicRoute,
  isRouteAllowedForRole,
  isValidRole,
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
    expect(getRoleHomeRoute("admin")).toBe("/dashboard/owner");
    expect(getRoleHomeRoute("manager")).toBe("/dashboard/manager");
    expect(getRoleHomeRoute("storekeeper")).toBe("/dashboard/storekeeper");
    expect(getRoleHomeRoute("receptionist")).toBe("/dashboard/reception");
    expect(getRoleHomeRoute("laser_operator")).toBe("/dashboard/operator/laser");
    expect(getRoleHomeRoute("cnc_operator")).toBe("/dashboard/operator/cnc");
    expect(getRoleHomeRoute("plotter_operator")).toBe("/dashboard/operator/plotter");
    expect(getRoleHomeRoute("printer_operator")).toBe("/dashboard/operator/printer");
  });

  it("identifies public routes correctly", () => {
    expect(isPublicRoute("/")).toBe(true);
    expect(isPublicRoute("/sign-in")).toBe(true);
    expect(isPublicRoute("/sign-up")).toBe(true);
    expect(isPublicRoute("/track")).toBe(true);
    expect(isPublicRoute("/track/YT-1234")).toBe(true);
    expect(isPublicRoute("/api/auth/session")).toBe(true);
    expect(isPublicRoute("/favicon.ico")).toBe(true);
    expect(isPublicRoute("/dashboard")).toBe(false);
    expect(isPublicRoute("/orders")).toBe(false);
    expect(isPublicRoute("/reports")).toBe(false);
  });

  it("enforces role-based route access strictly", () => {
    // Owner & Admin
    expect(isRouteAllowedForRole("owner", "/dashboard/owner")).toBe(true);
    expect(isRouteAllowedForRole("owner", "/reports")).toBe(true);
    expect(isRouteAllowedForRole("owner", "/reconciliation")).toBe(true);

    // Manager
    expect(isRouteAllowedForRole("manager", "/dashboard/manager")).toBe(true);
    expect(isRouteAllowedForRole("manager", "/reports")).toBe(false);
    expect(isRouteAllowedForRole("manager", "/reconciliation")).toBe(false);
    expect(isRouteAllowedForRole("manager", "/dashboard/owner")).toBe(false);

    // Storekeeper
    expect(isRouteAllowedForRole("storekeeper", "/dashboard/storekeeper")).toBe(true);
    expect(isRouteAllowedForRole("storekeeper", "/inventory/parent")).toBe(true);
    expect(isRouteAllowedForRole("storekeeper", "/reports")).toBe(false);
    expect(isRouteAllowedForRole("storekeeper", "/orders")).toBe(false);
    expect(isRouteAllowedForRole("storekeeper", "/dashboard/owner")).toBe(false);

    // Receptionist
    expect(isRouteAllowedForRole("receptionist", "/dashboard/reception")).toBe(true);
    expect(isRouteAllowedForRole("receptionist", "/orders")).toBe(true);
    expect(isRouteAllowedForRole("receptionist", "/inventory/parent")).toBe(false);
    expect(isRouteAllowedForRole("receptionist", "/reports")).toBe(false);
    expect(isRouteAllowedForRole("receptionist", "/reconciliation")).toBe(false);

    // Laser Operator
    expect(isRouteAllowedForRole("laser_operator", "/dashboard/operator/laser")).toBe(true);
    expect(isRouteAllowedForRole("laser_operator", "/inventory/substock")).toBe(true);
    expect(isRouteAllowedForRole("laser_operator", "/dashboard/operator/cnc")).toBe(false);
    expect(isRouteAllowedForRole("laser_operator", "/reports")).toBe(false);
    expect(isRouteAllowedForRole("laser_operator", "/orders")).toBe(false);
  });

  it("maps machines and operator roles symmetrically", () => {
    expect(OPERATOR_MACHINE_MAP["laser"]).toBe("laser_operator");
    expect(OPERATOR_MACHINE_MAP["cnc"]).toBe("cnc_operator");
    expect(OPERATOR_MACHINE_MAP["plotter"]).toBe("plotter_operator");
    expect(OPERATOR_MACHINE_MAP["printer"]).toBe("printer_operator");

    expect(ROLE_TO_MACHINE_MAP["laser_operator"]).toBe("laser");
    expect(ROLE_TO_MACHINE_MAP["cnc_operator"]).toBe("cnc");
    expect(ROLE_TO_MACHINE_MAP["plotter_operator"]).toBe("plotter");
    expect(ROLE_TO_MACHINE_MAP["printer_operator"]).toBe("printer");
  });
});
