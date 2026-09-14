import { describe, expect, it } from "vitest";

describe("Operator Cockpit: Substrate Matching & Queue Batching", () => {
  type SubstrateMatchInfo =
    | {
        status: "MATCHED";
        materialId: string;
        materialName: string;
        remaining: number;
        unit: string;
      }
    | {
        status: "ROLL_CHANGE_REQUIRED";
        materialId: string;
        requiredMaterialName: string;
        loadedMaterialName: string;
        loadedRemaining: number;
        unit: string;
      }
    | {
        status: "NO_STOCK";
        materialId: string;
        requiredMaterialName: string;
      };

  function computeSubstrateMatch(
    materialId: string,
    activeSubstrateBatches: Array<{
      materialId: string;
      materialName: string;
      currentRemaining: number;
      baseUnit: string;
    }>,
    materialNames: Record<string, string>
  ): SubstrateMatchInfo {
    const directBatch = activeSubstrateBatches.find((b) => b.materialId === materialId);
    const reqName = materialNames[materialId] ?? "Unknown material";
    const primaryMountedBatch = activeSubstrateBatches[0];

    if (directBatch) {
      return {
        status: "MATCHED",
        materialId,
        materialName: directBatch.materialName,
        remaining: directBatch.currentRemaining,
        unit: directBatch.baseUnit,
      };
    }
    if (primaryMountedBatch) {
      return {
        status: "ROLL_CHANGE_REQUIRED",
        materialId,
        requiredMaterialName: reqName,
        loadedMaterialName: primaryMountedBatch.materialName,
        loadedRemaining: primaryMountedBatch.currentRemaining,
        unit: primaryMountedBatch.baseUnit,
      };
    }
    return {
      status: "NO_STOCK",
      materialId,
      requiredMaterialName: reqName,
    };
  }

  it("identifies matching substrate when the required roll is loaded on the machine", () => {
    const floorStock = [
      {
        materialId: "mat_banner_510",
        materialName: "Frontlit Banner 510g (3.2m)",
        currentRemaining: 45.5,
        baseUnit: "m²",
      },
    ];
    const materials = {
      mat_banner_510: "Frontlit Banner 510g (3.2m)",
      mat_vinyl_clear: "Clear Vinyl 1.52m",
    };

    const match = computeSubstrateMatch("mat_banner_510", floorStock, materials);
    expect(match.status).toBe("MATCHED");
    if (match.status === "MATCHED") {
      expect(match.materialName).toBe("Frontlit Banner 510g (3.2m)");
      expect(match.remaining).toBe(45.5);
      expect(match.unit).toBe("m²");
    }
  });

  it("alerts roll change required when another substrate is mounted", () => {
    const floorStock = [
      {
        materialId: "mat_banner_510",
        materialName: "Frontlit Banner 510g (3.2m)",
        currentRemaining: 45.5,
        baseUnit: "m²",
      },
    ];
    const materials = {
      mat_banner_510: "Frontlit Banner 510g (3.2m)",
      mat_vinyl_clear: "Clear Vinyl 1.52m",
    };

    const match = computeSubstrateMatch("mat_vinyl_clear", floorStock, materials);
    expect(match.status).toBe("ROLL_CHANGE_REQUIRED");
    if (match.status === "ROLL_CHANGE_REQUIRED") {
      expect(match.requiredMaterialName).toBe("Clear Vinyl 1.52m");
      expect(match.loadedMaterialName).toBe("Frontlit Banner 510g (3.2m)");
      expect(match.loadedRemaining).toBe(45.5);
    }
  });

  it("flags no stock when machine has zero mounted media", () => {
    const floorStock: Array<{
      materialId: string;
      materialName: string;
      currentRemaining: number;
      baseUnit: string;
    }> = [];
    const materials = {
      mat_acrylic_3mm: "Cast Acrylic 3mm Clear",
    };

    const match = computeSubstrateMatch("mat_acrylic_3mm", floorStock, materials);
    expect(match.status).toBe("NO_STOCK");
    if (match.status === "NO_STOCK") {
      expect(match.requiredMaterialName).toBe("Cast Acrylic 3mm Clear");
    }
  });

  it("enables operators to batch jobs by loaded roll", () => {
    const floorStock = [
      {
        materialId: "mat_banner_510",
        materialName: "Frontlit Banner 510g",
        currentRemaining: 60,
        baseUnit: "m²",
      },
    ];
    const materials = {
      mat_banner_510: "Frontlit Banner 510g",
      mat_mesh_banner: "Mesh Banner 3.2m",
    };

    const upcomingJobs = [
      { id: "job1", code: "JOB-001", materialId: "mat_banner_510" },
      { id: "job2", code: "JOB-002", materialId: "mat_mesh_banner" },
      { id: "job3", code: "JOB-003", materialId: "mat_banner_510" },
    ];

    const enriched = upcomingJobs.map((j) => ({
      ...j,
      match: computeSubstrateMatch(j.materialId, floorStock, materials),
    }));

    const batchForLoadedRoll = enriched.filter((j) => j.match.status === "MATCHED");
    expect(batchForLoadedRoll.map((j) => j.code)).toEqual(["JOB-001", "JOB-003"]);

    const requiresRollSwap = enriched.filter((j) => j.match.status === "ROLL_CHANGE_REQUIRED");
    expect(requiresRollSwap.map((j) => j.code)).toEqual(["JOB-002"]);
  });
});
