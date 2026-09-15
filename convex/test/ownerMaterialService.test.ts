import { describe, expect, it, vi, beforeEach } from "vitest";
import { normalizeCatalogFamily, ALLOWED_CATALOG_FAMILIES } from "../utils/normalizer";
import { createRawMaterial, updateReorderLevel, updateReorderPolicy } from "../owner/materials";
import { upsertPriceEstimate, deactivatePriceEstimate } from "../owner/priceEstimates";
import * as users from "../users";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

beforeEach(() => {
  vi.spyOn(users, "requireOwner").mockResolvedValue({
    identity: { _id: "user_owner", email: "owner@test.com" } as any,
    profile: { _id: "prof_owner", authUserId: "user_owner", role: "owner", active: true, name: "Owner Test" } as any,
  } as any);
  vi.spyOn(users, "requireActiveProfile").mockResolvedValue({
    identity: { _id: "user_owner", email: "owner@test.com" } as any,
    profile: { _id: "prof_owner", authUserId: "user_owner", role: "owner", active: true, name: "Owner Test" } as any,
  } as any);
});

describe("Owner-Managed Materials, Pricing & Category Configuration", () => {
  describe("Catalog Family Normalization & Aliases", () => {
    it("includes ILLUMINATED_DISPLAY_SYSTEM and SIGNAGE_FRAME_PROFILE in allowed families", () => {
      expect(ALLOWED_CATALOG_FAMILIES).toContain("ILLUMINATED_DISPLAY_SYSTEM");
      expect(ALLOWED_CATALOG_FAMILIES).toContain("SIGNAGE_FRAME_PROFILE");
    });

    it("normalizes canonical family names and aliases for illuminated displays", () => {
      expect(normalizeCatalogFamily("ILLUMINATED_DISPLAY_SYSTEM")).toBe("ILLUMINATED_DISPLAY_SYSTEM");
      expect(normalizeCatalogFamily("lightbox")).toBe("ILLUMINATED_DISPLAY_SYSTEM");
      expect(normalizeCatalogFamily("LIGHT_BOX")).toBe("ILLUMINATED_DISPLAY_SYSTEM");
      expect(normalizeCatalogFamily("screen-lightbox")).toBe("ILLUMINATED_DISPLAY_SYSTEM");
      expect(normalizeCatalogFamily("SCREEN_LIGHT_BOX")).toBe("ILLUMINATED_DISPLAY_SYSTEM");
      expect(normalizeCatalogFamily("fabric_lightbox")).toBe("ILLUMINATED_DISPLAY_SYSTEM");
      expect(normalizeCatalogFamily("seg_lightbox")).toBe("ILLUMINATED_DISPLAY_SYSTEM");
      expect(normalizeCatalogFamily("backlit_display")).toBe("ILLUMINATED_DISPLAY_SYSTEM");
    });

    it("normalizes canonical family names and aliases for signage frame profiles", () => {
      expect(normalizeCatalogFamily("SIGNAGE_FRAME_PROFILE")).toBe("SIGNAGE_FRAME_PROFILE");
      expect(normalizeCatalogFamily("frame_profile")).toBe("SIGNAGE_FRAME_PROFILE");
      expect(normalizeCatalogFamily("extrusion")).toBe("SIGNAGE_FRAME_PROFILE");
      expect(normalizeCatalogFamily("extrusions")).toBe("SIGNAGE_FRAME_PROFILE");
      expect(normalizeCatalogFamily("frame")).toBe("SIGNAGE_FRAME_PROFILE");
      expect(normalizeCatalogFamily("framing")).toBe("SIGNAGE_FRAME_PROFILE");
      expect(normalizeCatalogFamily("metal_profile")).toBe("SIGNAGE_FRAME_PROFILE");
      expect(normalizeCatalogFamily("aluminum_profile")).toBe("SIGNAGE_FRAME_PROFILE");
      expect(normalizeCatalogFamily("lightbox_bars")).toBe("SIGNAGE_FRAME_PROFILE");
    });

    it("rejects unknown catalog families with an informative error", () => {
      expect(() => normalizeCatalogFamily("random_family")).toThrowError(/Unknown catalog family/);
      expect(() => normalizeCatalogFamily("")).toThrowError(/Catalog family is required/);
    });
  });

  describe("Reorder Policy Synchronization", () => {
    it("updates reorder policy and synchronizes reorderAt compatibility projection", async () => {
      let patched: Record<string, any> = {};
      const mockMaterial = {
        _id: "mat_1" as Id<"materials">,
        name: "Acrylic Sheet 3mm",
        active: true,
        unit: "sheet",
        reorderAt: 0,
      };

      const mockDb = {
        get: async (id: string) => (id === "mat_1" ? mockMaterial : null),
        patch: async (id: string, updates: any) => {
          patched = updates;
        },
        insert: async () => "change_1",
      };

      const mockCtx = {
        db: mockDb,
        auth: {
          getUserIdentity: async () => ({ subject: "user_owner", email: "owner@test.com" }),
        },
      } as unknown as MutationCtx;

      // When enabled, level synchronizes to reorderAt
      const res = await (updateReorderPolicy as any)._handler(mockCtx, {
        materialId: "mat_1" as Id<"materials">,
        reorderPolicy: {
          enabled: true,
          level: 15,
          unit: "sheet",
          leadTimeDays: 7,
          safetyStock: 5,
        },
      });

      expect(res.reorderAt).toBe(15);
      expect(patched.reorderAt).toBe(15);
      expect(patched.reorderPolicy.enabled).toBe(true);
      expect(patched.reorderPolicy.leadTimeDays).toBe(7);

      // When disabled, reorderAt projects to 0
      const disabledRes = await (updateReorderPolicy as any)._handler(mockCtx, {
        materialId: "mat_1" as Id<"materials">,
        reorderPolicy: {
          enabled: false,
          level: 15,
          unit: "sheet",
        },
      });

      expect(disabledRes.reorderAt).toBe(0);
      expect(patched.reorderAt).toBe(0);
      expect(patched.reorderPolicy.enabled).toBe(false);
    });

    it("backwards-compatible updateReorderLevel populates structured reorderPolicy", async () => {
      let patched: Record<string, any> = {};
      const mockMaterial = {
        _id: "mat_2" as Id<"materials">,
        name: "Banner Flex 440g",
        active: true,
        baseUnit: "m²",
        reorderAt: 0,
      };

      const mockDb = {
        get: async (id: string) => (id === "mat_2" ? mockMaterial : null),
        patch: async (id: string, updates: any) => {
          patched = updates;
        },
        insert: async () => "change_2",
      };

      const mockCtx = {
        db: mockDb,
        auth: {
          getUserIdentity: async () => ({ subject: "user_owner", email: "owner@test.com" }),
        },
      } as unknown as MutationCtx;

      const res = await (updateReorderLevel as any)._handler(mockCtx, {
        materialId: "mat_2" as Id<"materials">,
        reorderAt: 50,
      });

      expect(res.reorderAt).toBe(50);
      expect(patched.reorderPolicy).toEqual({
        enabled: true,
        level: 50,
        unit: "m²",
      });
    });
  });

  describe("Material Price Estimates", () => {
    it("upserts price estimate, deactivates previous active, and preserves version history", async () => {
      const docs: Array<any> = [
        {
          _id: "est_old",
          materialId: "banner_flex",
          amount: 250,
          currency: "ETB",
          purchaseUnit: "roll",
          active: true,
          effectiveAt: 1000,
        },
      ];
      const catalogs = [
        {
          id: "banner_flex",
          name: "Banner Flex",
          conversionRatio: 50, // 50 m² per roll
          active: true,
        },
      ];
      const materials = [
        {
          _id: "mat_banner",
          name: "Banner Flex",
          etbValue: 5,
        },
      ];
      const inserted: Array<any> = [];

      const mockDb = {
        query: (table: string) => ({
          withIndex: (_idx: string, fn: any) => {
            const filters: Record<string, any> = {};
            const q = {
              eq: (field: string, val: any) => {
                filters[field] = val;
                return q;
              },
            };
            fn(q);
            return {
              collect: async () => {
                if (table === "materialCatalog") {
                  return catalogs.filter(
                    (c) => !filters.id || c.id === filters.id,
                  );
                }
                if (table === "materials") {
                  return materials.filter(
                    (m) => !filters.name || m.name === filters.name,
                  );
                }
                return docs.filter(
                  (d) =>
                    (!filters.materialId || d.materialId === filters.materialId) &&
                    (filters.active === undefined || d.active === filters.active),
                );
              },
              unique: async () => {
                if (table === "materialCatalog") {
                  return catalogs.find((c) => !filters.id || c.id === filters.id) ?? null;
                }
                return null;
              },
            };
          },
        }),
        patch: async (id: string, patch: any) => {
          const target = docs.find((d) => d._id === id);
          if (target) Object.assign(target, patch);
          const matTarget = materials.find((m) => m._id === id);
          if (matTarget) Object.assign(matTarget, patch);
        },
        insert: async (table: string, doc: any) => {
          if (table === "materialPriceEstimates") {
            const newDoc = { _id: `est_${docs.length + 1}`, ...doc };
            docs.push(newDoc);
            inserted.push(newDoc);
            return newDoc._id;
          }
          return "log_1";
        },
      };

      const mockCtx = {
        db: mockDb,
        auth: {
          getUserIdentity: async () => ({ subject: "user_owner", email: "owner@test.com" }),
        },
      } as unknown as MutationCtx;

      // Upsert new price estimate for banner_flex
      const newId = await (upsertPriceEstimate as any)._handler(mockCtx, {
        materialId: "banner_flex",
        amount: 280,
        currency: "etb", // test normalization to ETB
        purchaseUnit: "roll",
        source: "Supplier Alpha Invoice #991",
        notes: "Price increased due to import freight",
      });

      expect(newId).toBeDefined();
      // Old estimate should have been deactivated
      expect(docs[0].active).toBe(false);
      // New estimate should be active with normalized currency
      const activeEst = docs.find((d) => d._id === newId);
      expect(activeEst?.amount).toBe(280);
      expect(activeEst?.currency).toBe("ETB");
      expect(activeEst?.active).toBe(true);
      expect(activeEst?.source).toBe("Supplier Alpha Invoice #991");
      // Derived baseUnitEquivalent: 280 / 50 = 5.6
      expect(activeEst?.baseUnitEquivalent).toBe(5.6);
      // Materials etbValue projection updated
      expect(materials[0].etbValue).toBe(5.6);
    });

    it("rejects negative price amounts", async () => {
      const mockCtx = {
        db: {},
        auth: {
          getUserIdentity: async () => ({ subject: "user_owner", email: "owner@test.com" }),
        },
      } as unknown as MutationCtx;

      await expect(
        (upsertPriceEstimate as any)._handler(mockCtx, {
          materialId: "banner_flex",
          amount: -10,
          currency: "ETB",
          purchaseUnit: "roll",
        }),
      ).rejects.toThrowError(/non-negative/);
    });

    it("deactivates price estimate cleanly", async () => {
      const doc = {
        _id: "est_deactivate",
        materialId: "acrylic_sheet",
        amount: 500,
        currency: "ETB",
        purchaseUnit: "sheet",
        active: true,
      };

      const mockDb = {
        get: async (id: string) => (id === "est_deactivate" ? doc : null),
        patch: async (_id: string, patch: any) => {
          Object.assign(doc, patch);
        },
        insert: async () => "log_2",
      };

      const mockCtx = {
        db: mockDb,
        auth: {
          getUserIdentity: async () => ({ subject: "user_owner", email: "owner@test.com" }),
        },
      } as unknown as MutationCtx;

      await (deactivatePriceEstimate as any)._handler(mockCtx, {
        estimateId: "est_deactivate" as Id<"materialPriceEstimates">,
      });

      expect(doc.active).toBe(false);
    });
  });

  describe("Raw Material Create Path Produces Operational + Catalog Rows", () => {
    it("creates a materialCatalog row and linked materials row with operational fields", async () => {
      const tables = new Map<string, Map<string, any>>();
      let counter = 1;
      const getTable = (name: string) => {
        if (!tables.has(name)) tables.set(name, new Map());
        return tables.get(name)!;
      };
      const db = {
        get: async (id: string) => {
          for (const t of tables.values()) {
            if (t.has(id)) return t.get(id);
          }
          return null;
        },
        insert: async (table: string, doc: any) => {
          const _id = `${table}_${counter++}`;
          getTable(table).set(_id, { _id, ...doc });
          return _id;
        },
        query: (table: string) => {
          const t = getTable(table);
          let filterFn: ((row: any) => boolean) | null = null;
          const builder = {
            withIndex: (_name: string, indexFn?: (q: any) => any) => {
              if (indexFn) {
                const conditions: Array<{ field: string; value: any }> = [];
                const indexQ: any = {
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
            first: async () => {
              const all = Array.from(t.values());
              return filterFn ? all.find(filterFn) ?? null : all[0] ?? null;
            },
          };
          return builder;
        },
      };
      const mockCtx = { db } as unknown as MutationCtx;

      const res = await (createRawMaterial as any)._handler(mockCtx, {
        name: "Banner Flex 440g",
        category: "Substrate",
        catalogFamily: "ROLL",
        unit: "m²",
        baseUnit: "m²",
        purchaseUnit: "roll",
        conversionRatio: 160,
        rollWidth: 3.2,
        reorderAt: 8,
        storageLocation: "Substrate Rack A",
        averageUse: "2.0 m² per order",
        maxScrap: 5,
        minOffcutWidth: 0.5,
        minOffcutLength: 0.5,
        wasteLimitPolicy: "warn",
      });

      const catalogRow = await db.get(res.catalogId);
      expect(catalogRow).toBeDefined();
      expect(catalogRow.id).toBe("banner_flex_440g");
      expect(catalogRow.name).toBe("Banner Flex 440g");
      expect(catalogRow.active).toBe(true);
      expect(catalogRow.storageLocation).toBe("Substrate Rack A");

      const materialRow = await db.get(res.materialId);
      expect(materialRow.catalogMaterialId).toBe(res.catalogId);
      expect(materialRow.reorderAt).toBe(8);
      expect(materialRow.storageLocation).toBe("Substrate Rack A");
      expect(materialRow.averageUse).toBe("2.0 m² per order");
      expect(materialRow.maxScrap).toBe(5);
      expect(materialRow.minOffcutWidth).toBe(0.5);
      expect(materialRow.minOffcutLength).toBe(0.5);
      expect(materialRow.wasteLimitPolicy).toBe("warn");
      expect(materialRow.quantity).toBe(0);
      expect(materialRow.active).toBe(true);

      const parentInv = Array.from(tables.get("parentInventory")!.values());
      expect(parentInv).toHaveLength(1);
      expect(parentInv[0].materialId).toBe(res.materialId);
      expect(parentInv[0].unitType).toBe("ROLL");

      const changes = Array.from(tables.get("configurationChanges")!.values());
      expect(changes).toHaveLength(1);
      expect(changes[0].configKey).toBe(`material:${res.materialId}`);
      expect(changes[0].actorAuthUserId).toBe("user_owner");
    });
  });
});
