import { describe, it, expect, vi, beforeEach } from "vitest";
import { seedConfirmedMaterials } from "../owner/seedConfirmedMaterials";
import type { MutationCtx } from "../_generated/server";
import * as users from "../users";
import * as auth from "../auth";

beforeEach(() => {
  vi.spyOn(auth.authComponent, "safeGetAuthUser").mockResolvedValue({
    _id: "user_owner",
    email: "owner@test.com",
  } as any);
  vi.spyOn(users, "requireOwner").mockResolvedValue({
    identity: { _id: "user_owner", email: "owner@test.com" } as any,
    profile: { role: "owner", active: true, name: "Owner", authUserId: "user_owner" } as any,
  } as any);
});

describe("seedConfirmedMaterials", () => {
  it("seeds materialCatalog and links materials via catalogMaterialId", async () => {
    const catalogTable: any[] = [];
    const materialsTable: any[] = [];

    const mockCtx = {
      db: {
        query: (table: string) => ({
          withIndex: (_idx: string, fn: any) => {
            const filters: Record<string, any> = {};
            const q = {
              eq: (f: string, v: any) => {
                filters[f] = v;
                return q;
              },
            };
            fn(q);
            return {
              unique: async () => {
                if (table === "materialCatalog") {
                  return catalogTable.find((c) => !filters.id || c.id === filters.id) ?? null;
                }
                return null;
              },
              first: async () => {
                if (table === "materials") {
                  return materialsTable.find((m) => !filters.name || m.name === filters.name) ?? null;
                }
                return null;
              },
              collect: async () => {
                if (table === "materialCatalog") return catalogTable;
                if (table === "materials") return materialsTable;
                return [];
              },
            };
          },
        }),
        insert: async (table: string, doc: any) => {
          if (table === "materialCatalog") {
            const newDoc = { _id: `cat_${catalogTable.length + 1}`, ...doc };
            catalogTable.push(newDoc);
            return newDoc._id;
          }
          if (table === "materials") {
            const newDoc = { _id: `mat_${materialsTable.length + 1}`, ...doc };
            materialsTable.push(newDoc);
            return newDoc._id;
          }
          return "id_1";
        },
        patch: async (id: string, patch: any) => {
          const cat = catalogTable.find((c) => c._id === id);
          if (cat) Object.assign(cat, patch);
          const mat = materialsTable.find((m) => m._id === id);
          if (mat) Object.assign(mat, patch);
        },
      },
      auth: {
        getUserIdentity: async () => ({ subject: "user_owner", email: "owner@test.com" }),
      },
    } as unknown as MutationCtx;

    const res = await (seedConfirmedMaterials as any)._handler(mockCtx, {});

    expect(res.success).toBe(true);
    expect(res.catalogItems).toBeGreaterThan(0);
    expect(res.materials).toBeGreaterThan(0);
    expect(catalogTable.length).toBeGreaterThan(0);
    expect(materialsTable.length).toBeGreaterThan(0);

    // Verify catalogMaterialId link
    const bannerMaterial = materialsTable.find((m) => m.name === "Banner Flex");
    expect(bannerMaterial).toBeDefined();
    expect(bannerMaterial.catalogMaterialId).toBeDefined();

    const bannerCatalog = catalogTable.find((c) => c._id === bannerMaterial.catalogMaterialId);
    expect(bannerCatalog).toBeDefined();
    expect(bannerCatalog.name).toBe("Banner Flex");
    expect(bannerCatalog.conversionRatio).toBe(160);

    // Test idempotency: second run shouldn't duplicate
    const prevCatalogCount = catalogTable.length;
    const prevMatCount = materialsTable.length;

    const res2 = await (seedConfirmedMaterials as any)._handler(mockCtx, {});
    expect(res2.success).toBe(true);
    expect(catalogTable.length).toBe(prevCatalogCount);
    expect(materialsTable.length).toBe(prevMatCount);
  });
});
