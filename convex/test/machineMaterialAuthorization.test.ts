import { describe, expect, it } from "vitest";
import {
  resolveMachineMaterialAuthorization,
  assertMachineMaterialAuthorized,
} from "../machineMaterialAuthorization";

describe("Machine Material Link Authorization", () => {
  it("resolves active links for a machine", async () => {
    const mockMachineId = "machine_1" as any;
    const mockMaterialId = "material_1" as any;
    const otherMaterialId = "material_2" as any;

    const mockCtx = {
      db: {
        get: async (id: any) => {
          if (id === mockMachineId) return { _id: mockMachineId, active: true, name: "Konica 512i" };
          if (id === mockMaterialId) return { _id: mockMaterialId, active: true, name: "Star Flex Banner" };
          if (id === otherMaterialId) return { _id: otherMaterialId, active: true, name: "Vinyl Sticker" };
          return null;
        },
        query: (table: string) => {
          if (table === "machineMaterialLinks") {
            return {
              withIndex: (_name: string, _fn: any) => ({
                collect: async () => [
                  {
                    _id: "link_1",
                    machineId: mockMachineId,
                    materialId: mockMaterialId,
                    relationshipType: "primary",
                    active: true,
                    required: true,
                    conversionRatioOverride: 50,
                    wasteMarginPercent: 5,
                  },
                  {
                    _id: "link_2",
                    machineId: mockMachineId,
                    materialId: otherMaterialId,
                    relationshipType: "supported",
                    active: false, // Inactive link
                    required: false,
                  },
                ],
              }),
            };
          }
          return { collect: async () => [] };
        },
      },
    } as any;

    const authMap = await resolveMachineMaterialAuthorization(mockCtx, mockMachineId, [
      mockMaterialId,
      otherMaterialId,
    ]);

    expect(authMap.has(mockMaterialId)).toBe(true);
    expect(authMap.get(mockMaterialId)?.conversionRatioOverride).toBe(50);
    expect(authMap.get(mockMaterialId)?.wasteMarginPercent).toBe(5);
    expect(authMap.has(otherMaterialId)).toBe(false); // Because active === false
  });

  it("assertMachineMaterialAuthorized throws a clear error for unlinked material", async () => {
    const mockMachineId = "machine_1" as any;
    const mockMaterialId = "material_unlinked" as any;

    const mockCtx = {
      db: {
        get: async (id: any) => {
          if (id === mockMachineId) return { _id: mockMachineId, active: true, name: "Flora UV" };
          if (id === mockMaterialId) return { _id: mockMaterialId, active: true, name: "Clear Acrylic 3mm" };
          return null;
        },
        query: () => ({
          withIndex: () => ({
            collect: async () => [], // No links
          }),
        }),
      },
    } as any;

    await expect(
      assertMachineMaterialAuthorized(mockCtx, mockMachineId, mockMaterialId)
    ).rejects.toThrow(/is not authorized\/linked to machine/);
  });

  it("assertMachineMaterialAuthorized returns link info when authorized", async () => {
    const mockMachineId = "machine_1" as any;
    const mockMaterialId = "material_linked" as any;

    const mockCtx = {
      db: {
        get: async (id: any) => {
          if (id === mockMachineId) return { _id: mockMachineId, active: true, name: "Flora UV" };
          if (id === mockMaterialId) return { _id: mockMaterialId, active: true, name: "Flora Cyan Ink" };
          return null;
        },
        query: () => ({
          withIndex: () => ({
            collect: async () => [
              {
                _id: "link_uv_cyan",
                machineId: mockMachineId,
                materialId: mockMaterialId,
                relationshipType: "ink",
                active: true,
                required: true,
              },
            ],
          }),
        }),
      },
    } as any;

    const auth = await assertMachineMaterialAuthorized(mockCtx, mockMachineId, mockMaterialId);
    expect(auth.linkId).toBe("link_uv_cyan");
    expect(auth.relationshipType).toBe("ink");
  });
});
