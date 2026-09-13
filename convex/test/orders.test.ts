import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";
import { computeStandardAllocation } from "../orderAutomation";
import { previewAutoRouting } from "../orders";
import * as users from "../users";

describe("Phase 6 & Orders Auto-Routing Invariants", () => {
  it("computes standard allocation accurately for standard order sizes", () => {
    const order = { length: 3, width: 2, quantity: "2" };
    const material = {
      name: "Banner Flex",
      unit: "m²",
      baseUnit: "m²",
      productionType: "area" as const,
      consumptionRate: 1,
    };
    const config = {
      standardWasteMargin: 5,
      maxAllowedScrapLimit: 10,
    };

    const alloc = computeStandardAllocation(order, material, config);
    // Net: 3 * 2 * 2 = 12 m²
    expect(alloc.netBaseQuantity).toBe(12);
    // Planned with 5% waste: 12 * 1.05 = 12.6 m²
    expect(alloc.plannedBaseQuantity).toBe(12.6);
    // Approved scrap with 10% limit: 12 * 0.1 = 1.2 m²
    expect(alloc.approvedScrapQuantity).toBe(1.2);
    expect(alloc.wasteMarginPercent).toBe(5);
    expect(alloc.maxScrapLimitPercent).toBe(10);
  });

  it("handles unit/piece orders without length/width", () => {
    const order = { quantity: "5" };
    const material = {
      name: "Acrylic Stand",
      unit: "pcs",
      baseUnit: "pcs",
      productionType: "unit" as const,
      consumptionRate: 1,
    };
    const config = {
      standardWasteMargin: 0,
      maxAllowedScrapLimit: 5,
    };

    const alloc = computeStandardAllocation(order, material, config);
    expect(alloc.netBaseQuantity).toBe(5);
    expect(alloc.plannedBaseQuantity).toBe(5);
    expect(alloc.approvedScrapQuantity).toBe(0.25);
  });
});

// ---------------------------------------------------------------------------
// previewAutoRouting must surface routing failures as ConvexError so the
// rejection reason reaches Reception instead of Convex redacting plain Error
// messages into an opaque "Server Error" in production.
// ---------------------------------------------------------------------------

function createMockDb() {
  const tables = new Map<string, Map<string, any>>();

  const getTable = (name: string) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  };

  const db = {
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
        collect: async () => {
          const rows = Array.from(t.values());
          return filterFn ? rows.filter(filterFn) : rows;
        },
        first: async () => {
          const rows = await builder.collect();
          return rows[0] ?? null;
        },
        unique: async () => {
          const rows = await builder.collect();
          return rows.length > 0 ? rows[0] : null;
        },
        take: async (limit: number) => {
          const rows = await builder.collect();
          return rows.slice(0, limit);
        },
      };
      return builder;
    },
    insert: async (table: string, doc: any) => {
      const t = getTable(table);
      const id = `${table}_${t.size + 1}`;
      t.set(id, { _id: id, ...doc });
      return id;
    },
    patch: async (id: string, patch: any) => {
      for (const t of tables.values()) {
        if (t.has(id)) {
          t.set(id, { ...t.get(id), ...patch });
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

  return { mockCtx: { db } as any, tables };
}

function makeOrder(serviceType: string) {
  return {
    code: `ORD-${serviceType}-test`,
    clientName: "Test Client",
    phone: "+251900000000",
    serviceType,
    dimensions: "1m × 1m",
    quantity: "1",
    preferredDueDate: Date.now() + 86_400_000,
    status: "PRICED_AND_PENDING_PAYMENT",
    priority: "Medium",
    source: "walk_in",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

async function captureError(operation: () => Promise<unknown>): Promise<any> {
  try {
    await operation();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the operation to throw, but it resolved successfully.");
}

describe("previewAutoRouting surfaces diagnosable ConvexErrors", () => {
  beforeEach(() => {
    vi.spyOn(users, "requirePermission").mockResolvedValue({
      identity: { _id: "user_reception", email: "reception@test.com" },
      profile: { _id: "profile_reception", role: "receptionist", active: true },
    } as any);
  });

  it("re-throws as ConvexError (not a redacted Error) when no routing exists for the service", async () => {
    const { mockCtx } = createMockDb();
    await mockCtx.db.insert("customerOrders", makeOrder("hologram_print"));

    const handler = (previewAutoRouting as any)._handler ?? previewAutoRouting;
    const error = await captureError(() => handler(mockCtx, { orderId: "customerOrders_1" }));

    expect(error).toBeInstanceOf(ConvexError);
    expect(error.message).toContain("No production routing is defined");
    expect(error.message).toContain("hologram_print");
    expect(error.data).toBe(error.message);
  });

  it("re-throws as ConvexError when the routed material type has no active material", async () => {
    const { mockCtx } = createMockDb();
    await mockCtx.db.insert("customerOrders", makeOrder("banner_print"));
    await mockCtx.db.insert("materialTypeCatalog", {
      serviceType: "banner_print",
      materialType: "Banner Flex",
      preferredMaterialName: "Banner",
      machineCapabilities: ["PRINT_ROLL_3_2M"],
      operatorRole: "crystal_jet_operator",
      active: true,
    });

    const handler = (previewAutoRouting as any)._handler ?? previewAutoRouting;
    const error = await captureError(() => handler(mockCtx, { orderId: "customerOrders_1" }));

    expect(error).toBeInstanceOf(ConvexError);
    expect(error.message).toContain("No active raw material is registered");
    expect(error.message).toContain("Banner Flex");
    expect(error.data).toBe(error.message);
  });
});
