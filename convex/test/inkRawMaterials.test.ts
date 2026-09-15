import { describe, expect, it, vi, beforeEach } from "vitest";
import { createRawMaterial, updateRawMaterial, listRawMaterials } from "../owner/materials";
import * as users from "../users";
import type { MutationCtx, QueryCtx } from "../_generated/server";

beforeEach(() => {
  vi.spyOn(users, "requireOwner").mockResolvedValue({
    identity: { _id: "user_owner", email: "owner@test.com" } as any,
    profile: { _id: "prof_owner", authUserId: "user_owner", role: "owner", active: true } as any,
  } as any);
});

function createMockDb() {
  const tables = new Map<string, Map<string, any>>();

  function getTable(name: string) {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  }

  let idCounter = 1;

  const db = {
    get: async (id: string) => {
      for (const t of tables.values()) {
        if (t.has(id)) return t.get(id);
      }
      return null;
    },
    insert: async (table: string, doc: any) => {
      const _id = `${table}_${idCounter++}`;
      const record = { ...doc, _id };
      getTable(table).set(_id, record);
      return _id;
    },
    patch: async (id: string, updates: any) => {
      for (const t of tables.values()) {
        if (t.has(id)) {
          const updated = { ...t.get(id), ...updates };
          t.set(id, updated);
          return;
        }
      }
      throw new Error(`Document not found: ${id}`);
    },
    delete: async (id: string) => {
      for (const t of tables.values()) {
        t.delete(id);
      }
    },
    query: (table: string) => {
      const t = getTable(table);
      let filterFn: ((row: any) => boolean) | null = null;

      const builder = {
        withIndex: (_name: string, indexFn?: (q: any) => any) => {
          if (indexFn) {
            const conditions: Array<{ field: string; value: any }> = [];
            const indexQ = {
              eq: (field: string, value: any) => {
                conditions.push({ field, value });
                return indexQ;
              },
            };
            indexFn(indexQ);
            filterFn = (row) => conditions.every((c) => row[c.field] === c.value);
          }
          return builder;
        },
        filter: (_filterCallback: (q: any) => any) => {
          return builder;
        },
        first: async () => {
          const all = Array.from(t.values());
          return filterFn ? all.find(filterFn) ?? null : all[0] ?? null;
        },
        collect: async () => {
          const all = Array.from(t.values());
          return filterFn ? all.filter(filterFn) : all;
        },
      };
      return builder;
    },
  };

  return { db, tables };
}

describe("Owner Ink Raw Materials with Independent Color Property", () => {
  it("creates independent raw material records for each ink color with normalized inkColor and materialFamily", async () => {
    const { db, tables } = createMockDb();
    const ctx = { db } as unknown as MutationCtx;

    // 1. Create Cyan Ink
    const cyanRes = await (createRawMaterial as any)._handler(ctx, {
      name: "Banner Ink 5L Canister - Cyan",
      category: "Ink",
      catalogFamily: "INK_SOLVENT",
      unit: "L",
      baseUnit: "L",
      purchaseUnit: "canister",
      conversionRatio: 5,
      inkColor: "Cyan",
      reorderAt: 10,
    });

    expect(cyanRes.materialId).toBeDefined();
    expect(cyanRes.catalogId).toBeDefined();

    // 2. Create Magenta Ink
    const magentaRes = await (createRawMaterial as any)._handler(ctx, {
      name: "Banner Ink 5L Canister - Magenta",
      category: "Ink",
      catalogFamily: "INK_SOLVENT",
      unit: "L",
      baseUnit: "L",
      purchaseUnit: "canister",
      conversionRatio: 5,
      inkColor: "Magenta",
      reorderAt: 8,
    });

    expect(magentaRes.materialId).toBeDefined();
    expect(magentaRes.materialId).not.toBe(cyanRes.materialId);

    // Verify materials table records
    const cyanMat = await db.get(cyanRes.materialId);
    expect(cyanMat.name).toBe("Banner Ink 5L Canister - Cyan");
    expect(cyanMat.inkColor).toBe("CYAN");
    expect(cyanMat.materialFamily).toBe("INK");
    expect(cyanMat.catalogFamily).toBe("INK_SOLVENT");

    const magMat = await db.get(magentaRes.materialId);
    expect(magMat.name).toBe("Banner Ink 5L Canister - Magenta");
    expect(magMat.inkColor).toBe("MAGENTA");
    expect(magMat.materialFamily).toBe("INK");

    // Verify materialCatalog table records
    const cyanCat = await db.get(cyanRes.catalogId);
    expect(cyanCat.inkColor).toBe("CYAN");
    expect(cyanCat.catalogFamily).toBe("INK_SOLVENT");

    const magCat = await db.get(magentaRes.catalogId);
    expect(magCat.inkColor).toBe("MAGENTA");

    // Verify independent parentInventory records
    const parentInv = Array.from(tables.get("parentInventory")?.values() ?? []);
    expect(parentInv).toHaveLength(2);
    expect(parentInv.map((p) => p.materialId)).toContain(cyanRes.materialId);
    expect(parentInv.map((p) => p.materialId)).toContain(magentaRes.materialId);
  });

  it("updates inkColor and materialFamily when editing raw material", async () => {
    const { db } = createMockDb();
    const ctx = { db } as unknown as MutationCtx;

    const created = await (createRawMaterial as any)._handler(ctx, {
      name: "UV Ink 1L Canister - Black",
      category: "Ink",
      catalogFamily: "INK_SOLVENT",
      unit: "L",
      purchaseUnit: "canister",
      conversionRatio: 1,
      inkColor: "Black",
      reorderAt: 5,
    });

    // Update to White
    await (updateRawMaterial as any)._handler(ctx, {
      materialId: created.materialId,
      name: "UV Ink 1L Canister - White",
      category: "Ink",
      catalogFamily: "INK_SOLVENT",
      unit: "L",
      purchaseUnit: "canister",
      conversionRatio: 1,
      inkColor: "White",
      reorderAt: 12,
      active: true,
    });

    const updatedMat = await db.get(created.materialId);
    expect(updatedMat.name).toBe("UV Ink 1L Canister - White");
    expect(updatedMat.inkColor).toBe("WHITE");
    expect(updatedMat.reorderAt).toBe(12);

    const updatedCat = await db.get(created.catalogId);
    expect(updatedCat.inkColor).toBe("WHITE");
  });

  it("returns inkColor and materialFamily in listRawMaterials query", async () => {
    const { db } = createMockDb();
    const mutationCtx = { db } as unknown as MutationCtx;
    const queryCtx = { db } as unknown as QueryCtx;

    await (createRawMaterial as any)._handler(mutationCtx, {
      name: "DTF Ink 1L Canister - Yellow",
      category: "Ink",
      catalogFamily: "INK_SOLVENT",
      unit: "L",
      purchaseUnit: "canister",
      conversionRatio: 1,
      inkColor: "Yellow",
      reorderAt: 5,
    });

    const list = await (listRawMaterials as any)._handler(queryCtx, {});
    expect(list).toHaveLength(1);
    expect(list[0].inkColor).toBe("YELLOW");
    expect(list[0].materialFamily).toBe("INK");
  });
});
