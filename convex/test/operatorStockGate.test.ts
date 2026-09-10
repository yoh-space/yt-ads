import { describe, expect, it } from "vitest";
import { findStockShortages } from "../operator/jobs";

describe("operator production stock gate", () => {
  const required = [{ materialId: "substrate", quantity: 2, materialName: "Banner", unit: "m²" }];

  it("blocks a job when the assigned machine has no loaded stock", () => {
    expect(findStockShortages(required, [], "machine-1", ["operator-1", "printer_operator"])).toHaveLength(1);
  });

  it("unlocks a job when storekeeper-cleared stock is loaded on the machine", () => {
    expect(findStockShortages(required, [{ materialId: "substrate", currentRemaining: 2, machineId: "machine-1", operatorId: "operator-1", status: "ACTIVE" }], "machine-1", ["operator-1", "printer_operator"])).toHaveLength(0);
  });

  it("does not count stock loaded on another machine", () => {
    expect(findStockShortages(required, [{ materialId: "substrate", currentRemaining: 10, machineId: "machine-2", operatorId: "operator-1", status: "ACTIVE" }], "machine-1", ["operator-1", "printer_operator"])).toHaveLength(1);
  });
});
