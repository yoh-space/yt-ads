import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { assertOperatorCanComplete, findStockShortages, operatorStockShortageError } from "../operator/jobs";

describe("operator production stock gate", () => {
  const required = [{ materialId: "substrate", quantity: 2, materialName: "Banner", unit: "m²" }];

  it("blocks a job when the assigned machine has no loaded stock", () => {
    expect(findStockShortages(required, [], "machine-1", ["operator-1", "crystal_jet_operator"])).toHaveLength(1);
  });

  it("unlocks a job when storekeeper-cleared stock is loaded on the machine", () => {
    expect(findStockShortages(required, [{ materialId: "substrate", currentRemaining: 2, machineId: "machine-1", operatorId: "operator-1", status: "ACTIVE" }], "machine-1", ["operator-1", "crystal_jet_operator"])).toHaveLength(0);
  });

  it("does not count stock loaded on another machine", () => {
    expect(findStockShortages(required, [{ materialId: "substrate", currentRemaining: 10, machineId: "machine-2", operatorId: "operator-1", status: "ACTIVE" }], "machine-1", ["operator-1", "crystal_jet_operator"])).toHaveLength(1);
  });

  it("blocks completion when floor stock is only partially available", () => {
    expect(findStockShortages(required, [{ materialId: "substrate", currentRemaining: 1.999, machineId: "machine-1", operatorId: "operator-1", status: "ACTIVE" }], "machine-1", ["operator-1", "crystal_jet_operator"])).toHaveLength(1);
  });

  it("does not treat pending-clearance stock as usable floor stock", () => {
    expect(findStockShortages(required, [{ materialId: "substrate", currentRemaining: 2, machineId: "machine-1", operatorId: "operator-1", status: "PENDING_CLEARANCE" }], "machine-1", ["operator-1", "crystal_jet_operator"])).toHaveLength(1);
  });

  it("uses ConvexError for diagnosable completion shortage failures", () => {
    const error = operatorStockShortageError("Insufficient operator stock for Banner");
    expect(error).toBeInstanceOf(ConvexError);
    expect(error.message).toBe("Insufficient operator stock for Banner");
  });

  it("deliberately blocks paused jobs until they are resumed", () => {
    expect(() => assertOperatorCanComplete("Paused")).toThrow("This job is paused. Resume it before completing.");
    expect(() => assertOperatorCanComplete("Paused")).toThrowError(ConvexError);
  });
});
