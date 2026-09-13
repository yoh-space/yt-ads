import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  deriveSlug,
  normalizeText,
  normalizeCatalogFamily,
  normalizeBaseUnit,
  normalizePurchaseUnit,
  normalizeGroupTone,
} from "../utils/normalizer";
import {
  upsertRole,
  toggleRoleActive,
  toggleRolePermission,
  upsertService,
  listConfigChangeLog,
} from "../owner/databaseFirstCatalogs";
import { detectConfigDrift, reconcileConfigDrift } from "../owner/driftDetection";
import { recordExceptionStockOut } from "../orders";
import * as users from "../users";
import * as systemConfigs from "../systemConfigs";

beforeEach(() => {
  vi.spyOn(users, "requireOwner").mockResolvedValue({
    identity: { _id: "user_owner", email: "owner@test.com" } as any,
    profile: { _id: "user_owner_profile", role: "owner", active: true } as any,
  } as any);
  vi.spyOn(users, "requirePermission").mockResolvedValue({
    identity: { _id: "user_owner", email: "owner@test.com" } as any,
    profile: { _id: "user_owner_profile", role: "owner", active: true } as any,
  } as any);
  vi.spyOn(users, "requireAnyPermission").mockResolvedValue({
    identity: { _id: "user_owner", email: "owner@test.com" } as any,
    profile: { _id: "user_owner_profile", role: "owner", active: true } as any,
  } as any);
});

function createMockDb(initialDocs: Record<string, any[]> = {}) {
  const tables = new Map<string, Map<string, any>>();
  for (const [tName, rows] of Object.entries(initialDocs)) {
    const tableMap = new Map();
    rows.forEach((r, idx) => {
      const id = r._id ?? `id_${tName}_${idx}`;
      tableMap.set(id, { ...r, _id: id });
    });
    tables.set(tName, tableMap);
  }

  function getTable(name: string) {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  }

  let counter = 1;
  const db = {
    get: async (id: any) => {
      for (const tableMap of tables.values()) {
        if (tableMap.has(id)) return tableMap.get(id);
      }
      return null;
    },
    insert: async (table: string, doc: any) => {
      const id = doc._id ?? `id_${table}_${counter++}`;
      const saved = { ...doc, _id: id };
      getTable(table).set(id, saved);
      return id;
    },
    patch: async (id: any, patch: any) => {
      for (const tableMap of tables.values()) {
        if (tableMap.has(id)) {
          const current = tableMap.get(id);
          const updated = { ...current, ...patch };
          tableMap.set(id, updated);
          return;
        }
      }
    },
    delete: async (id: any) => {
      for (const tableMap of tables.values()) {
        if (tableMap.has(id)) {
          tableMap.delete(id);
          return;
        }
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
        filter: (filterCallback: (q: any) => any) => {
          const prev = filterFn;
          const conditions: Array<{ field: string; value: any }> = [];
          const filterQ = {
            eq: (left: any, right: any) => {
              conditions.push({ field: left.fieldName, value: right });
              return true;
            },
            field: (fieldName: string) => ({ fieldName }),
          };
          filterCallback(filterQ);
          filterFn = (row) => {
            if (prev && !prev(row)) return false;
            return conditions.every((c) => row[c.field] === c.value);
          };
          return builder;
        },
        collect: async () => {
          const all = Array.from(t.values());
          return filterFn ? all.filter(filterFn) : all;
        },
        first: async () => {
          const all = Array.from(t.values());
          return filterFn ? all.find(filterFn) ?? null : all[0] ?? null;
        },
        unique: async () => {
          const all = Array.from(t.values());
          return filterFn ? all.find(filterFn) ?? null : all[0] ?? null;
        },
      };
      return builder;
    },
  };

  return { mockCtx: { db } as any, tables };
}

describe("Owner Full-Authority Architecture Specification", () => {
  describe("Section 4: Normalization Module", () => {
    it("derives deterministic, trimmed slugs", () => {
      expect(deriveSlug("  Banner Flex 440gsm  ")).toBe("banner_flex_440gsm");
      expect(deriveSlug("Ricoh UV Flatbed (White)")).toBe("ricoh_uv_flatbed_white");
      expect(deriveSlug("---Special--Name---")).toBe("special_name");
    });

    it("normalizes catalog families and maps synonyms", () => {
      expect(normalizeCatalogFamily("rolls")).toBe("ROLL");
      expect(normalizeCatalogFamily("rigid")).toBe("RIGID_SHEET");
      expect(normalizeCatalogFamily("ink")).toBe("INK_SOLVENT");
      expect(normalizeCatalogFamily("accessory")).toBe("HARDWARE");
      expect(() => normalizeCatalogFamily("unknown_family")).toThrow(/Unknown catalog family/);
    });

    it("normalizes base units and purchase units", () => {
      expect(normalizeBaseUnit("sqm")).toBe("m²");
      expect(normalizeBaseUnit("m2")).toBe("m²");
      expect(normalizeBaseUnit("liter")).toBe("L");
      expect(normalizeBaseUnit("pcs")).toBe("piece");
      expect(normalizePurchaseUnit("rolls")).toBe("roll");
      expect(normalizePurchaseUnit("litres")).toBe("liter");
    });

    it("normalizes group tones", () => {
      expect(normalizeGroupTone("CYAN")).toBe("cyan");
      expect(normalizeGroupTone("blue")).toBe("blue");
      expect(() => normalizeGroupTone("magenta")).toThrow(/Unknown group tone/);
    });
  });

  describe("Section 5: Concurrency Safety (expectedUpdatedAt)", () => {
    it("rejects stale updates with CONFIG_CONFLICT when updatedAt has changed", async () => {
      const { mockCtx } = createMockDb({
        serviceCatalog: [
          {
            _id: "svc_1",
            id: "banner_print",
            labelEn: "Banner Print",
            labelAm: "የባነር ማተሚያ",
            categoryKey: "PRINTING",
            categoryNameEn: "Printing & Stickers",
            sortOrder: 1,
            active: true,
            publishable: true,
            updatedAt: 1000,
          },
        ],
      });

      const handler = (upsertService as any)._handler ?? upsertService;

      // Stale update (expectedUpdatedAt is 900 while stored is 1000)
      await expect(
        handler(mockCtx, {
          id: "banner_print",
          labelEn: "Banner Print Updated",
          labelAm: "የባነር ማተሚያ",
          categoryKey: "PRINTING",
          categoryNameEn: "Printing & Stickers",
          sortOrder: 1,
          active: true,
          publishable: true,
          expectedUpdatedAt: 900,
        }),
      ).rejects.toThrow(/CONFIG_CONFLICT/);

      // Concurrent safe update (expectedUpdatedAt matches 1000)
      const res = await handler(mockCtx, {
        id: "banner_print",
        labelEn: "Banner Print Updated",
        labelAm: "የባነር ማተሚያ",
        categoryKey: "PRINTING",
        categoryNameEn: "Printing & Stickers",
        sortOrder: 1,
        active: true,
        publishable: true,
        expectedUpdatedAt: 1000,
      });
      expect(res).toBe("svc_1");
    });
  });

  describe("Section 7.1: Configuration Audit Logging (configChangeLog)", () => {
    it("records audit trail entries on entity mutations with field diffs", async () => {
      const { mockCtx, tables } = createMockDb({
        serviceCatalog: [
          {
            _id: "svc_1",
            id: "banner_print",
            labelEn: "Banner Print",
            labelAm: "የባነር ማተሚያ",
            categoryKey: "PRINTING",
            categoryNameEn: "Printing & Stickers",
            sortOrder: 1,
            active: true,
            publishable: true,
            updatedAt: 1000,
          },
        ],
      });

      const handler = (upsertService as any)._handler ?? upsertService;
      await handler(mockCtx, {
        id: "banner_print",
        labelEn: "Banner Ultra Print",
        labelAm: "የባነር ማተሚያ",
        categoryKey: "PRINTING",
        categoryNameEn: "Printing & Stickers",
        sortOrder: 2,
        active: true,
        publishable: true,
        expectedUpdatedAt: 1000,
      });

      const logs = Array.from(tables.get("configChangeLog")?.values() ?? []);
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = logs[logs.length - 1];
      expect(lastLog.entityType).toBe("service");
      expect(lastLog.entityId).toBe("banner_print");
      expect(lastLog.action).toBe("update");
      expect(lastLog.fieldChanges.labelEn).toEqual({ from: "Banner Print", to: "Banner Ultra Print" });
      expect(lastLog.fieldChanges.sortOrder).toEqual({ from: 1, to: 2 });
    });
  });

  describe("Section 7.2: Elevated Confirmation for Role Permissions", () => {
    it("requires elevated confirmation when granting a permission", async () => {
      const { mockCtx } = createMockDb({
        rolePermissions: [],
      });

      const handler = (toggleRolePermission as any)._handler ?? toggleRolePermission;

      // Attempting to grant without elevated confirmation must reject
      await expect(
        handler(mockCtx, {
          roleCode: "storekeeper",
          permission: "stock.exception",
          active: true,
          elevatedConfirmed: false,
        }),
      ).rejects.toThrow(/ELEVATED_CONFIRMATION_REQUIRED/);

      // Succeeded with elevated confirmation
      await handler(mockCtx, {
        roleCode: "storekeeper",
        permission: "stock.exception",
        active: true,
        elevatedConfirmed: true,
      });
    });
  });

  describe("Section 8: Canonical Data-Only Roles CRUD & Referential Integrity", () => {
    it("creates data-only roles linked to existing workspaces", async () => {
      const { mockCtx, tables } = createMockDb({
        workspaceRoutes: [
          { _id: "wr_op", workspaceId: "operator", routePrefix: "/dashboard/operator" },
        ],
        roles: [],
        roleWorkspaceConfig: [],
      });

      const handler = (upsertRole as any)._handler ?? upsertRole;
      await handler(mockCtx, {
        code: "assist_print_operator",
        labelEn: "Assistant Print Operator",
        labelAm: "ረዳት ፕሪንት ኦፕሬተር",
        workspaceId: "operator",
        active: true,
      });

      const roles = Array.from(tables.get("roles")?.values() ?? []);
      expect(roles).toHaveLength(1);
      expect(roles[0].code).toBe("assist_print_operator");
      expect(roles[0].workspaceId).toBe("operator");

      const roleConfigs = Array.from(tables.get("roleWorkspaceConfig")?.values() ?? []);
      expect(roleConfigs).toHaveLength(1);
      expect(roleConfigs[0].roleCode).toBe("assist_print_operator");
    });

    it("blocks deactivation of a role if active staff users are assigned (Section 6.1)", async () => {
      const { mockCtx } = createMockDb({
        roles: [
          { _id: "r_cnc", code: "cnc_operator", labelEn: "CNC Operator", labelAm: "ሲኤንሲ", active: true },
        ],
        users: [
          { _id: "u_1", email: "cnc@company.com", role: "cnc_operator", active: true },
        ],
      });

      const handler = (toggleRoleActive as any)._handler ?? toggleRoleActive;
      await expect(
        handler(mockCtx, {
          code: "cnc_operator",
          active: false,
        }),
      ).rejects.toThrow(/ROLE_REFERENCED/);
    });
  });

  describe("Section 2.2: Enforce SystemConfigs Risk Controls on Exception Stock-Outs", () => {
    it("requires admin authorization note/PIN when requireAdminPinForExceptions is enabled", async () => {
      const { mockCtx } = createMockDb({
        materials: [
          { _id: "m_banner", name: "Banner Roll", quantity: 50, baseUnit: "m²", etbValue: 200, active: true },
        ],
        systemConfigs: [
          {
            key: "default",
            requireAdminPinForExceptions: true,
            maxDirectStockOutEtb: 5000,
          },
        ],
        stockExceptions: [],
        inventoryLedger: [],
        notifications: [],
      });

      const handler = (recordExceptionStockOut as any)._handler ?? recordExceptionStockOut;

      // Missing authorization note
      await expect(
        handler(mockCtx, {
          materialId: "m_banner",
          quantity: 2,
          unit: "m²",
          reason: "Sample Print",
        }),
      ).rejects.toThrow(/ADMIN_PIN_REQUIRED/);

      // Exceeds maxDirectStockOutEtb ceiling (quantity 30 * 200 ETB = 6000 ETB > 5000 limit)
      await expect(
        handler(mockCtx, {
          materialId: "m_banner",
          quantity: 30,
          unit: "m²",
          reason: "Sample Print",
          authorizationNote: "PIN-1234 Owner verbal",
        }),
      ).rejects.toThrow(/EXCEEDS_MAX_DIRECT_STOCK_OUT/);

      // Successful when within bounds and PIN note provided
      const res = await handler(mockCtx, {
        materialId: "m_banner",
        quantity: 5,
        unit: "m²",
        reason: "Sample Print",
        authorizationNote: "PIN-1234 Owner approved",
      });
      expect(res.exceptionId).toBeDefined();
    });
  });

  describe("Stage 5: Drift Detection & Reconciliation", () => {
    it("detects non-canonical catalog entries and reconciles them non-destructively", async () => {
      const { mockCtx } = createMockDb({
        materialCatalog: [
          {
            _id: "mat_drift",
            id: "vinyl_gloss",
            name: "Vinyl Gloss",
            catalogFamily: "rolls", // non-canonical family
            baseUnit: "sqm", // non-canonical unit
            purchaseUnit: "rolls", // non-canonical purchase unit
            active: true,
          },
        ],
        serviceCatalog: [],
        serviceRoutes: [],
        roles: [],
        machines: [],
      });

      const detectHandler = (detectConfigDrift as any)._handler ?? detectConfigDrift;
      const report = await detectHandler(mockCtx, {});
      expect(report.clean).toBe(false);
      expect(report.totalIssues).toBeGreaterThan(0);

      const reconcileHandler = (reconcileConfigDrift as any)._handler ?? reconcileConfigDrift;
      const recResult = await reconcileHandler(mockCtx, {});
      expect(recResult.reconciledCount).toBe(1);

      const postReport = await detectHandler(mockCtx, {});
      expect(postReport.clean).toBe(true);
    });
  });
});
