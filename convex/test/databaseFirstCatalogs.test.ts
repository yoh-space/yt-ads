import { describe, expect, it, vi, beforeEach } from "vitest";
import { runDatabaseFirstSeed, assertServiceCatalogSync, assertRoleCatalogSync } from "../owner/seedDatabaseFirst";
import { createRawMaterial, updateRawMaterial } from "../owner/materials";
import * as users from "../users";

beforeEach(() => {
  vi.spyOn(users, "requireOwner").mockResolvedValue({
    identity: { _id: "user_owner", email: "owner@test.com" } as any,
    profile: { role: "owner", active: true } as any,
  } as any);
  vi.spyOn(users, "requirePermission").mockResolvedValue({
    identity: { _id: "user_owner", email: "owner@test.com" } as any,
    profile: { role: "owner", active: true } as any,
  } as any);
});

function createMockDb() {
  const tables = new Map<string, Map<string, any>>();

  function getTable(name: string) {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  }

  const db = {
    query: (table: string) => {
      const t = getTable(table);
      let filterFn: ((row: any) => boolean) | null = null;
      let sortFn: ((a: any, b: any) => number) | null = null;

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
        filter: (filterCallback: (q: any) => any) => {
          const prev = filterFn;
          const filterQ = {
            eq: (left: any, right: any) => {
              const leftVal = typeof left === "function" ? left() : left;
              const rightVal = typeof right === "function" ? right() : right;
              return leftVal === rightVal;
            },
            field: (f: string) => (row: any) => row[f],
          };
          filterFn = (row) => {
            if (prev && !prev(row)) return false;
            return true;
          };
          return builder;
        },
        collect: async () => {
          let rows = Array.from(t.values());
          if (filterFn) rows = rows.filter(filterFn);
          return rows;
        },
        first: async () => {
          const rows = await builder.collect();
          return rows[0] ?? null;
        },
      };
      return builder;
    },
    insert: async (table: string, doc: any) => {
      const t = getTable(table);
      const id = `${table}_${t.size + 1}`;
      const record = { _id: id, ...doc };
      t.set(id, record);
      return id;
    },
    patch: async (id: string, patch: any) => {
      for (const t of tables.values()) {
        if (t.has(id)) {
          const current = t.get(id);
          t.set(id, { ...current, ...patch });
          return;
        }
      }
    },
    get: async (id: string) => {
      for (const t of tables.values()) {
        if (t.has(id)) return t.get(id);
      }
      return null;
    },
  };

  const mockCtx = { db } as any;
  return { mockCtx, tables };
}

describe("Database-First Catalog Seeding & Sync", () => {
  it("idempotently seeds all 9 database-first catalogs", async () => {
    const { mockCtx, tables } = createMockDb();

    const result = await runDatabaseFirstSeed(mockCtx);

    expect(result.status).toBe("SUCCESS");
    expect(result.servicesCount).toBe(22);
    expect(result.materialsCount).toBe(42);
    expect(result.routesCount).toBe(22);
    expect(result.capLinksCount).toBe(6);
    expect(result.roleConfigsCount).toBe(11);
    expect(result.permissionsCount).toBeGreaterThan(0);
    expect(result.categoryGroupsCount).toBe(6);

    // Verify services table
    const services = tables.get("serviceCatalog")!;
    expect(services.size).toBe(22);
    const bannerPrint = Array.from(services.values()).find((s) => s.id === "banner_print");
    expect(bannerPrint).toBeDefined();
    expect(bannerPrint.labelEn).toBe("Banner Print");
    expect(bannerPrint.active).toBe(true);
    expect(bannerPrint.publishable).toBe(true);

    // Verify drift check passes
    const activeServices = await assertServiceCatalogSync(mockCtx);
    expect(activeServices).toContain("banner_print");
    expect(activeServices).toContain("dtf");

    const activeRoles = await assertRoleCatalogSync(mockCtx);
    expect(activeRoles).toContain("crystal_jet_operator");
    expect(activeRoles).toContain("owner");
  });

  it("re-running seed updates existing records idempotently without duplicates", async () => {
    const { mockCtx, tables } = createMockDb();

    await runDatabaseFirstSeed(mockCtx);
    const servicesAfterFirst = tables.get("serviceCatalog")!.size;

    // Run again
    await runDatabaseFirstSeed(mockCtx);
    const servicesAfterSecond = tables.get("serviceCatalog")!.size;

    expect(servicesAfterSecond).toBe(servicesAfterFirst);
  });

  it("createRawMaterial is the single write path: normalizes names and validates operational fields", async () => {
    const { mockCtx, tables } = createMockDb();
    const create = (createRawMaterial as any)._handler;

    const res = await create(mockCtx, {
      name: "  Banner Flex  ",
      category: "Banner",
      catalogFamily: "ROLL",
      unit: "m²",
      baseUnit: "m²",
      purchaseUnit: "roll",
      conversionRatio: 160,
      rollWidth: 3.2,
      reorderAt: 5,
    });

    const catRow = Array.from(tables.get("materialCatalog")!.values())[0] as any;
    expect(catRow.id).toBe("banner_flex");
    expect(catRow.name).toBe("Banner Flex");

    const matRow = await mockCtx.db.get(res.materialId);
    expect(matRow.catalogMaterialId).toBe(res.catalogId);
    expect(matRow.reorderAt).toBe(5);
    expect(tables.get("parentInventory")!.size).toBe(1);

    await expect(create(mockCtx, {
      name: "Solvent Ink",
      category: "Ink",
      catalogFamily: "INK_SOLVENT",
      unit: "L",
      baseUnit: "L",
      purchaseUnit: "canister",
      conversionRatio: 5,
      minOffcutWidth: 0.1,
      reorderAt: 3,
    })).rejects.toThrow("square-metre");

    await expect(create(mockCtx, {
      name: "Banner Flex",
      category: "Banner",
      catalogFamily: "ROLL",
      unit: "m²",
      baseUnit: "m²",
      purchaseUnit: "roll",
      conversionRatio: 160,
      rollWidth: 3.2,
      reorderAt: 5,
    })).rejects.toThrow("already exists");
  });

  it("updateRawMaterial keeps linked catalog and inventory rows in sync", async () => {
    const { mockCtx, tables } = createMockDb();
    const create = (createRawMaterial as any)._handler;
    const update = (updateRawMaterial as any)._handler;

    const created = await create(mockCtx, {
      name: "Banner Flex",
      category: "Banner",
      catalogFamily: "ROLL",
      unit: "m²",
      baseUnit: "m²",
      purchaseUnit: "roll",
      conversionRatio: 160,
      rollWidth: 3.2,
      reorderAt: 5,
    });

    await update(mockCtx, {
      materialId: created.materialId,
      name: "Banner Flex 2.1m",
      category: "Banner",
      catalogFamily: "ROLL",
      unit: "m²",
      baseUnit: "m²",
      purchaseUnit: "roll",
      conversionRatio: 210,
      rollWidth: 2.1,
      reorderAt: 8,
      active: true,
    });

    const matRow = await mockCtx.db.get(created.materialId);
    expect(matRow.name).toBe("Banner Flex 2.1m");
    expect(matRow.reorderAt).toBe(8);
    expect(matRow.conversionRatio).toBe(210);

    const catRow = await mockCtx.db.get(created.catalogId);
    expect(catRow.name).toBe("Banner Flex 2.1m");
    expect(catRow.conversionRatio).toBe(210);

    const parent = Array.from(tables.get("parentInventory")!.values())[0];
    expect(parent.lengthPerRoll).toBe(210);
  });

  it("does not expose catalog-only material mutations (single client write path)", async () => {
    const mod: any = await import("../owner/databaseFirstCatalogs");
    expect(mod.upsertMaterialCatalogItem).toBeUndefined();
    expect(mod.toggleMaterialCatalogActive).toBeUndefined();
  });
});
