import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getPublishedCatalog,
  listServiceSpecFields,
  upsertServiceSpecField,
  toggleServiceSpecFieldActive,
  deleteServiceSpecField,
  validateServiceSpecificationsAgainstDb,
} from "../owner/databaseFirstCatalogs";
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

  let idCounter = 1;

  const db = {
    query: (table: string) => {
      const t = getTable(table);
      let filterFns: Array<(row: any) => boolean> = [];

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
            filterFns.push((row) => conditions.every((c) => row[c.field] === c.value));
          }
          return builder;
        },
        filter: (filterCallback: (q: any) => any) => {
          const conditionFn = (row: any) => {
            const filterQ = {
              eq: (left: any, right: any) => {
                const leftVal = typeof left === "function" ? left(row) : left;
                const rightVal = typeof right === "function" ? right(row) : right;
                return leftVal === rightVal;
              },
              field: (f: string) => (r: any) => r[f],
            };
            return filterCallback(filterQ);
          };
          filterFns.push(conditionFn);
          return builder;
        },
        collect: async () => {
          let rows = Array.from(t.values());
          for (const fn of filterFns) {
            rows = rows.filter(fn);
          }
          return rows;
        },
        first: async () => {
          const rows = await builder.collect();
          return rows[0] ?? null;
        },
      };
      return builder;
    },
    get: async (id: string) => {
      for (const t of tables.values()) {
        if (t.has(id)) return t.get(id);
      }
      return null;
    },
    insert: async (table: string, value: any) => {
      const id = `${table}_${idCounter++}`;
      const doc = { _id: id, ...value };
      getTable(table).set(id, doc);
      return id;
    },
    patch: async (id: string, patch: any) => {
      for (const t of tables.values()) {
        if (t.has(id)) {
          const existing = t.get(id);
          const updated = { ...existing, ...patch };
          t.set(id, updated);
          return;
        }
      }
      throw new Error(`Doc ${id} not found`);
    },
    delete: async (id: string) => {
      for (const t of tables.values()) {
        if (t.has(id)) {
          t.delete(id);
          return;
        }
      }
    },
  };

  return { db, getTable };
}

const h = (fn: any) => fn._handler ?? fn;

describe("Dynamic Service Catalog & Spec Fields", () => {
  it("returns empty list if no publishable services exist in database", async () => {
    const { db } = createMockDb();
    const ctx = { db } as any;

    const catalog = await h(getPublishedCatalog)(ctx, {});
    expect(catalog).toEqual([]);
  });

  it("returns only active and publishable services grouped by category with spec fields attached", async () => {
    const { db } = createMockDb();
    const ctx = { db } as any;

    // Insert services into serviceCatalog
    await db.insert("serviceCatalog", {
      id: "acrylic_letters",
      labelEn: "Acrylic 3D Letters",
      labelAm: "የአክሪሊክ 3D ፊደላት",
      categoryKey: "SIGNAGE",
      categoryNameEn: "Signage & Displays",
      categoryNameAm: "የምልክት እና ማሳያ ስራዎች",
      iconKey: "SunMedium",
      sortOrder: 1,
      active: true,
      publishable: true,
    });

    // Inactive service (should be excluded)
    await db.insert("serviceCatalog", {
      id: "neon_classic",
      labelEn: "Classic Neon",
      labelAm: "ክላሲክ ኒዮን",
      categoryKey: "SIGNAGE",
      categoryNameEn: "Signage & Displays",
      iconKey: "Zap",
      sortOrder: 2,
      active: false,
      publishable: true,
    });

    // Non-publishable service (should be excluded from customer wizard)
    await db.insert("serviceCatalog", {
      id: "internal_assembly",
      labelEn: "Internal Assembly",
      labelAm: "የውስጥ ስራ",
      categoryKey: "FABRICATION",
      categoryNameEn: "Fabrication",
      sortOrder: 3,
      active: true,
      publishable: false,
    });

    // Insert spec fields for acrylic_letters
    await db.insert("serviceSpecFields", {
      serviceId: "acrylic_letters",
      fieldKey: "thickness",
      labelEn: "Acrylic Thickness",
      labelAm: "ውፍረት",
      options: ["3mm", "5mm", "10mm"],
      required: true,
      sortOrder: 1,
      active: true,
    });

    await db.insert("serviceSpecFields", {
      serviceId: "acrylic_letters",
      fieldKey: "lighting",
      labelEn: "Backlight LED",
      options: ["None", "Warm White", "Cold White"],
      required: false,
      sortOrder: 2,
      active: true,
    });

    // Deactivated spec field (should be excluded)
    await db.insert("serviceSpecFields", {
      serviceId: "acrylic_letters",
      fieldKey: "deprecated_field",
      labelEn: "Old Spec",
      required: false,
      sortOrder: 3,
      active: false,
    });

    const catalog = await h(getPublishedCatalog)(ctx, {});
    expect(catalog.length).toBe(1);
    expect(catalog[0].categoryId).toBe("SIGNAGE");
    expect(catalog[0].categoryName).toBe("የምልክት እና ማሳያ ስራዎች");
    expect(catalog[0].items.length).toBe(1);

    const svc = catalog[0].items[0];
    expect(svc.id).toBe("acrylic_letters");
    expect(svc.labelEn).toBe("Acrylic 3D Letters");
    expect(svc.labelAm).toBe("የአክሪሊክ 3D ፊደላት");
    expect(svc.specFields.length).toBe(2);
    expect(svc.specFields[0].key).toBe("thickness");
    expect(svc.specFields[0].required).toBe(true);
    expect(svc.specFields[0].options).toEqual(["3mm", "5mm", "10mm"]);
    expect(svc.specFields[1].key).toBe("lighting");
  });

  it("manages specification fields with CRUD operations", async () => {
    const { db } = createMockDb();
    const ctx = { db } as any;

    await db.insert("serviceCatalog", {
      id: "car_branding",
      labelEn: "Vehicle Branding",
      labelAm: "የመኪና ብራንዲንግ",
      categoryKey: "VEHICLE",
      categoryNameEn: "Vehicle Graphics",
      sortOrder: 1,
      active: true,
      publishable: true,
    });

    // Create spec field
    const fieldId = await h(upsertServiceSpecField)(ctx, {
      serviceId: "car_branding",
      fieldKey: "coverage",
      labelEn: "Wrap Coverage",
      labelAm: "የሽፋን መጠን",
      options: ["Full Wrap", "Half Wrap", "Logo Only"],
      required: true,
      sortOrder: 1,
      active: true,
    });

    expect(fieldId).toBeDefined();

    // List spec fields
    const fields = await h(listServiceSpecFields)(ctx, { serviceId: "car_branding" });
    expect(fields.length).toBe(1);
    expect(fields[0].fieldKey).toBe("coverage");

    // Toggle active
    await h(toggleServiceSpecFieldActive)(ctx, { id: fieldId, active: false });
    const activeFields = await h(listServiceSpecFields)(ctx, { serviceId: "car_branding" });
    expect(activeFields.length).toBe(0);

    const allFields = await h(listServiceSpecFields)(ctx, {
      serviceId: "car_branding",
      includeInactive: true,
    });
    expect(allFields.length).toBe(1);

    // Delete field
    await h(deleteServiceSpecField)(ctx, { id: fieldId });
    const afterDelete = await h(listServiceSpecFields)(ctx, {
      serviceId: "car_branding",
      includeInactive: true,
    });
    expect(afterDelete.length).toBe(0);
  });

  it("validates specifications strictly against database definitions", async () => {
    const { db } = createMockDb();
    const ctx = { db } as any;

    await db.insert("serviceCatalog", {
      id: "laser_acrylic",
      labelEn: "Laser Acrylic Cutting",
      categoryKey: "CNC",
      categoryNameEn: "Laser & CNC",
      sortOrder: 1,
      active: true,
      publishable: true,
    });

    await db.insert("serviceSpecFields", {
      serviceId: "laser_acrylic",
      fieldKey: "thickness",
      labelEn: "Material Thickness",
      options: ["2mm", "3mm", "5mm", "8mm"],
      required: true,
      sortOrder: 1,
      active: true,
    });

    // Valid spec input
    const valid = await validateServiceSpecificationsAgainstDb(ctx, "laser_acrylic", {
      thickness: "3mm",
    });
    expect(valid).toEqual({ thickness: "3mm" });

    // Missing required field
    await expect(
      validateServiceSpecificationsAgainstDb(ctx, "laser_acrylic", {}),
    ).rejects.toThrow("Material Thickness is required.");

    // Invalid option
    await expect(
      validateServiceSpecificationsAgainstDb(ctx, "laser_acrylic", { thickness: "20mm" }),
    ).rejects.toThrow("Material Thickness must be selected from the confirmed options.");

    // Unknown or inactive service
    await expect(
      validateServiceSpecificationsAgainstDb(ctx, "non_existent_service", {}),
    ).rejects.toThrow('Service "non_existent_service" is not available in the service catalog.');
  });
});
