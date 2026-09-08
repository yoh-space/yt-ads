import { describe, expect, it } from "vitest";
import { canAccess, capabilitiesFor } from "./access-policy";
import { routeForWorkspace, visibleModules, workspaceForRole } from "@/components/dashboard/workspace-registry";

describe("workspace access policy", () => {
  it("keeps storekeepers in the physical inventory workflow", () => {
    const context = { profile: { role: "storekeeper" as const, active: true } };

    expect(canAccess(context, "inventory.parent.view")).toBe(true);
    expect(canAccess(context, "inventory.dispatch")).toBe(true);
    expect(canAccess(context, "reconciliation.record")).toBe(true);
    expect(canAccess(context, "orders.view")).toBe(false);
    expect(canAccess(context, "finance.view")).toBe(false);
    expect(visibleModules(workspaceForRole("storekeeper"), context).some((module) => module.id === "inventory.reconciliation")).toBe(true);
  });

  it("denies all capabilities to inactive profiles", () => {
    const context = { profile: { role: "owner" as const, active: false } };
    expect(capabilitiesFor(context)).toEqual([]);
  });

  it("keeps managers out of financial, reports, and clearance capabilities", () => {
    const context = { profile: { role: "manager" as const, active: true } };

    expect(canAccess(context, "finance.view")).toBe(false);
    expect(canAccess(context, "reports.view")).toBe(false);
    expect(canAccess(context, "reconciliation.review")).toBe(false);
    expect(visibleModules(workspaceForRole("manager"), context).some((module) => module.id === "reconciliation.queue")).toBe(false);
  });

  it("resolves every supported role to a workspace and scoped modules", () => {
    const roles = [
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

    for (const role of roles) {
      const context = { profile: { role, active: true } };
      const workspace = workspaceForRole(role);
      expect(workspace.modules.length).toBeGreaterThan(0);
      expect(visibleModules(workspace, context).length).toBeGreaterThan(0);
    }

    expect(routeForWorkspace({
      profile: { role: "laser_operator", active: true },
      attributes: { machineType: "laser" },
    })).toBe("/dashboard/operator/laser");
  });

  it("gives machine operators a reconciliation workspace", () => {
    const context = { profile: { role: "laser_operator" as const, active: true } };
    expect(canAccess(context, "reconciliation.operator")).toBe(true);
    expect(visibleModules(workspaceForRole("laser_operator"), context).some((module) => module.id === "reconciliation.operator")).toBe(true);
    expect(routeForWorkspace({ ...context, attributes: { machineType: "laser" } })).toBe("/dashboard/operator/laser");
  });
});
