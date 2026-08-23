import { describe, expect, it } from "vitest";
import { calculateOffcutArea, convertToBase, formatQuantity } from "@/lib/units";
import { assignJobToMachine, completeProductionJob, applyStockMovement, recordScrap, returnOffcutToInventory } from "@/lib/workflows";
import { initialJobs, initialMachines, initialMaterials, initialOffcuts } from "@/lib/operations-types";

describe("inventory unit conversion", () => {
  it("converts a banner roll into the configured square-meter base quantity", () => {
    expect(convertToBase(2, "roll", "m²", 160)).toBe(320);
  });

  it("converts sheets into square meters using the configured sheet rule", () => {
    expect(convertToBase(2, "sheet", "m²", undefined, 2.98)).toBe(5.96);
  });

  it("preserves base-unit entries without conversion", () => {
    expect(convertToBase(96, "m", "m", 50)).toBe(96);
  });

  it("calculates reusable sheet offcuts in square meters", () => {
    expect(calculateOffcutArea(1.2, 0.8)).toBe(0.96);
  });

  it("formats tracked quantities consistently", () => {
    expect(formatQuantity(18.25, "L")).toBe("18.3 L");
  });

  it("applies a sheet stock-in movement to the material inventory", () => {
    const next = applyStockMovement(initialMaterials, "mat-acrylic", "in", 2, "sheet");
    expect(next.find((material) => material.id === "mat-acrylic")?.quantity).toBe(60.76);
  });

  it("applies a base-unit stock-out movement without allowing negative inventory", () => {
    const next = applyStockMovement(initialMaterials, "mat-vinyl", "out", 500, "m");
    expect(next.find((material) => material.id === "mat-vinyl")?.quantity).toBe(0);
  });

  it("assigns a job to its machine and releases the machine once completed", () => {
    const queuedJob = { ...initialJobs[3], status: "Queued" as const };
    const assignedMachines = assignJobToMachine(initialMachines, queuedJob);
    expect(assignedMachines.find((machine) => machine.id === queuedJob.machineId)?.activeJob).toBe(queuedJob.code);
    const finished = completeProductionJob([queuedJob], assignedMachines, queuedJob.id);
    expect(finished.jobs[0].status).toBe("Completed");
    expect(finished.machines.find((machine) => machine.id === queuedJob.machineId)?.status).toBe("Available");
  });

  it("returns a usable offcut to its material inventory", () => {
    const next = returnOffcutToInventory(initialMaterials, initialOffcuts[0]);
    expect(next.find((material) => material.id === "mat-acrylic")?.quantity).toBe(55.76);
  });

  it("adds unusable scrap to a separate recovery and wastage register", () => {
    const next = recordScrap([], { id: "scrap-01", materialId: "mat-banner", label: "Frontlit Banner 440gsm", quantity: 1.4, unit: "m²", reason: "Trim loss", createdAt: "Just now" });
    expect(next).toHaveLength(1);
    expect(next[0].reason).toBe("Trim loss");
  });
});
