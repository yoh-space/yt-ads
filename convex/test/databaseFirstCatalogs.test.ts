import { describe, expect, it, vi, beforeEach } from "vitest";
import { runDatabaseFirstSeed, assertServiceCatalogSync, assertRoleCatalogSync } from "../owner/seedDatabaseFirst";
import { upsertMaterialCatalogItem } from "../owner/databaseFirstCatalogs";
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
    expect(result.materialsCount).toBe(28);
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

  it("normalizes names, derives ids, and rejects invalid family dimensions", async () => {
    const { mockCtx, tables } = createMockDb();
    const handler = (upsertMaterialCatalogItem as any)._handler ?? upsertMaterialCatalogItem;
    const id = await handler(mockCtx, {
      name: "  Banner   Flex  ",
      category: " Banner ",
      catalogFamily: "roll",
      baseUnit: "m²",
      purchaseUnit: " Roll ",
      conversionRatio: 160,
      rollWidth: 3.2,
      active: true,
    });
    const row = Array.from(tables.get("materialCatalog")!.values())[0] as any;
    expect(id).toBe(row._id);
    expect(row.id).toBe("banner_flex");
    expect(row.name).toBe("Banner Flex");
    await expect(handler(mockCtx, {
      name: "Rigid Board",
      category: "Board",
      catalogFamily: "RIGID_SHEET",
      baseUnit: "m²",
      purchaseUnit: "sheet",
      conversionRatio: 2.9,
      active: true,
    })).rejects.toThrow("sheetWidth");
  });

  it("rejects stale edits and renames referenced by active service routes", async () => {
    const { mockCtx, tables } = createMockDb();
    const handler = (upsertMaterialCatalogItem as any)._handler ?? upsertMaterialCatalogItem;
    const id = await handler(mockCtx, {
      id: "banner_flex",
      name: "Banner Flex",
      category: "Banner",
      catalogFamily: "ROLL",
      baseUnit: "m²",
      purchaseUnit: "roll",
      conversionRatio: 160,
      rollWidth: 3.2,
      active: true,
    });
    const material = Array.from(tables.get("materialCatalog")!.values()).find((row: any) => row._id === id) as any;
    await mockCtx.db.insert("serviceRoutes", { serviceId: "banner_print", preferredMaterialName: "Banner Flex", active: true });
    await expect(handler(mockCtx, {
      id: "banner_flex",
      name: "Renamed Banner Flex",
      category: "Banner",
      catalogFamily: "ROLL",
      baseUnit: "m²",
      purchaseUnit: "roll",
      conversionRatio: 160,
      rollWidth: 3.2,
      active: true,
      expectedUpdatedAt: material.updatedAt,
    })).rejects.toThrow("MATERIAL_REFERENCED");
    await expect(handler(mockCtx, {
      id: "banner_flex",
      name: "Banner Flex",
      category: "Banner",
      catalogFamily: "ROLL",
      baseUnit: "m²",
      purchaseUnit: "roll",
      conversionRatio: 160,
      rollWidth: 3.2,
      active: true,
      expectedUpdatedAt: material.updatedAt - 1,
    })).rejects.toThrow("MATERIAL_CONFLICT");
  });
});
