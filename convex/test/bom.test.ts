import { describe, expect, it } from "vitest";
import {
  computeStandardAllocation,
  resolveRouteForService,
  compatibleMachines,
  selectMachineByLoad,
} from "../orderAutomation";
import { parseDimensions } from "../../src/telegram/geometry";

describe("BOM Allocation & Routing Math", () => {
  it("resolves service route from canonical catalog", () => {
    const bannerRoute = resolveRouteForService("banner_print");
    expect(bannerRoute).toBeDefined();
    expect(bannerRoute?.preferredMaterialName).toBe("Banner");
    expect(bannerRoute?.operatorRole).toBe("crystal_jet_operator");

    const laserRoute = resolveRouteForService("light_box_a1");
    expect(laserRoute).toBeDefined();
    expect(laserRoute?.operatorRole).toBe("laser_operator");
  });

  it("calculates order area correctly for standard dimensions", () => {
    const parsed = parseDimensions("2.0 x 3.0");
    expect(parsed).not.toBeNull();
    expect(parsed?.area).toBeCloseTo(6, 2);
    // 2 items of 6m² = 12m²
    const totalArea = (parsed?.area ?? 0) * 2;
    expect(totalArea).toBeCloseTo(12, 2);
  });

  it("calculates standard allocation with waste margin and approved scrap ceiling", () => {
    const order = { length: 2, width: 3, quantity: "1" };
    const material = {
      name: "Banner",
      baseUnit: "m²",
      unit: "m²",
      productionType: "area" as const,
      consumptionRate: 1,
    };
    const config = {
      standardWasteMargin: 5,
      maxAllowedScrapLimit: 10,
    };

    const allocation = computeStandardAllocation(order, material, config);
    // Net = 2 * 3 * 1 = 6 m²
    expect(allocation.netBaseQuantity).toBeCloseTo(6, 2);
    // Planned with 5% waste = 6 * 1.05 = 6.3 m²
    expect(allocation.plannedBaseQuantity).toBeCloseTo(6.3, 2);
    // Approved scrap with 10% ceiling = 6 * 0.10 = 0.6 m²
    expect(allocation.approvedScrapQuantity).toBeCloseTo(0.6, 2);
    expect(allocation.unit).toBe("m²");
  });

  it("selects compatible machines and load balances", () => {
    const route = {
      serviceType: "banner_print",
      materialType: "Banner Flex",
      preferredMaterialName: "Banner",
      machineCapabilities: ["3.2m Print Width"],
      operatorRole: "crystal_jet_operator",
    };

    const machines = [
      { _id: "m1", name: "Printer A", code: "P-01", operatorRole: "crystal_jet_operator", status: "Running", active: true, _creationTime: 100 },
      { _id: "m2", name: "Printer B", code: "P-02", operatorRole: "crystal_jet_operator", status: "Available", active: true, _creationTime: 200 },
      { _id: "m3", name: "Laser A", code: "L-01", operatorRole: "laser_operator", status: "Available", active: true, _creationTime: 300 },
    ];

    const compatible = compatibleMachines(route, machines);
    expect(compatible.map((m) => m._id)).toEqual(["m1", "m2"]);

    const loadMap = new Map([
      ["m1", 3],
      ["m2", 1],
    ]);

    const chosen = selectMachineByLoad(compatible, loadMap);
    expect(chosen?._id).toBe("m2"); // Least loaded
  });
});
