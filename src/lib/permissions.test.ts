import { describe, expect, it } from "vitest";
import { can, canAccessJob, canAccessMachine, hasPermission } from "./permissions";
import type { Profile } from "./operations-types";

describe("frontend RBAC and ABAC mirror", () => {
  it("keeps management-only order and exception permissions out of operator roles", () => {
    expect(hasPermission("manager", "order.manage")).toBe(true);
    expect(hasPermission("manager", "stock.exception")).toBe(false);
    expect(hasPermission("storekeeper", "order.view")).toBe(false);
    expect(hasPermission("storekeeper", "order.manage")).toBe(false);
    expect(hasPermission("storekeeper", "stock.exception")).toBe(true);
    expect(hasPermission("storekeeper", "request.issue")).toBe(true);
    expect(hasPermission("crystal_jet_operator", "order.view")).toBe(false);
    expect(hasPermission("crystal_jet_operator", "stock.exception")).toBe(false);
    expect(hasPermission("crystal_jet_operator", "machine.create")).toBe(false);
    expect(hasPermission("crystal_jet_operator", "request.create")).toBe(true);
  });

  it("applies machine and job attributes to operator access", () => {
    const printer = { operatorRole: "crystal_jet_operator" as const };
    const laser = { operatorRole: "laser_operator" as const };
    expect(canAccessMachine("crystal_jet_operator", printer)).toBe(true);
    expect(canAccessMachine("crystal_jet_operator", laser)).toBe(false);
    expect(canAccessJob("laser_operator", laser)).toBe(true);
    expect(canAccessJob("laser_operator", undefined)).toBe(false);
  });

  it("returns false for missing profiles instead of fail-open UI access", () => {
    const profile: Profile = {
      id: "user-1",
      authUserId: "auth-1",
      name: "Operator",
      email: "operator@example.com",
      role: "crystal_jet_operator",
      active: true,
    };
    expect(can(null, "material.create")).toBe(false);
    expect(can(profile, "job.record_production")).toBe(true);
    expect(can(profile, "job.create")).toBe(false);
  });
});
