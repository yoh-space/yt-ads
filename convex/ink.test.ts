import { describe, expect, it } from "vitest";
import { resolveInkRequirements } from "./bomResolver";
import type { QueryCtx } from "./_generated/server";

describe("Phase 5: Ink & Solvent Resolution & Validation", () => {
  function createMockQueryCtx(materials: Array<any> = []) {
    return {
      db: {
        query: (table: string) => ({
          collect: async () => {
            if (table === "materials") return materials;
            return [];
          },
        }),
      },
    } as unknown as QueryCtx;
  }

  it("resolves structured machine ink requirements with per-color rates", async () => {
    const materials = [
      { _id: "m_cyan", name: "Cyan Ink", inkColor: "Cyan", materialFamily: "INK", quantity: 5, active: true },
      { _id: "m_magenta", name: "Magenta Ink", inkColor: "Magenta", materialFamily: "INK", quantity: 5, active: true },
      { _id: "m_yellow", name: "Yellow Ink", inkColor: "Yellow", materialFamily: "INK", quantity: 5, active: true },
      { _id: "m_black", name: "Black Ink", inkColor: "Black", materialFamily: "INK", quantity: 5, active: true },
    ];
    const ctx = createMockQueryCtx(materials);
    const machine = {
      _id: "mach_1" as any,
      name: "Polaris High Speed",
      inkRequirements: [
        { materialName: "Cyan Ink", inkColor: "Cyan", rateMlPerSqM: 3.5 },
        { materialName: "Magenta Ink", inkColor: "Magenta", rateMlPerSqM: 3.5 },
        { materialName: "Yellow Ink", inkColor: "Yellow", rateMlPerSqM: 3.0 },
        { materialName: "Black Ink", inkColor: "Black", rateMlPerSqM: 4.0 },
      ],
    } as any;

    const reqs = await resolveInkRequirements(ctx, machine, 10, { inkMlPerSquareMetre: 14 });
    expect(reqs).toHaveLength(4);

    const cyan = reqs.find((r) => r.inkColor === "Cyan");
    expect(cyan).toBeDefined();
    // 10 m² * 3.5 ml/m² = 35 ml = 0.035 L
    expect(cyan?.requiredMl).toBe(35);
    expect(cyan?.requiredLitres).toBe(0.035);

    const black = reqs.find((r) => r.inkColor === "Black");
    expect(black?.requiredMl).toBe(40);
    expect(black?.requiredLitres).toBe(0.04);
  });

  it("excludes solvents from ink resolution", async () => {
    const materials = [
      { _id: "m_eco_ink", name: "Eco-Solvent Ink", inkColor: "Cyan", materialFamily: "INK", quantity: 2, active: true },
      { _id: "m_cleaner", name: "Cleaning Solvent", materialFamily: "SOLVENT", quantity: 10, active: true },
    ];
    const ctx = createMockQueryCtx(materials);
    const machine = {
      _id: "mach_2" as any,
      name: "Eco-Solvent Printer",
      compatibleInks: ["Eco-Solvent Ink", "Cleaning Solvent Flush"],
    } as any;

    const reqs = await resolveInkRequirements(ctx, machine, 10, { inkMlPerSquareMetre: 12 });
    // "Cleaning Solvent Flush" contains "solvent" and must be excluded
    expect(reqs).toHaveLength(1);
    expect(reqs[0].materialName).toBe("Eco-Solvent Ink");
    expect(reqs[0].requiredMl).toBe(120);
  });

  it("returns empty requirements for non-printing machines", async () => {
    const ctx = createMockQueryCtx([]);
    const machine = {
      _id: "mach_laser" as any,
      name: "Laser Cutter 1390",
      compatibleInks: [],
    } as any;

    const reqs = await resolveInkRequirements(ctx, machine, 10, { inkMlPerSquareMetre: 12 });
    expect(reqs).toHaveLength(0);
  });
});
