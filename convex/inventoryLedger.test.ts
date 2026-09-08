import { describe, expect, it } from "vitest";
import { recordInventoryEvent } from "./inventoryLedger";
import type { MutationCtx } from "./_generated/server";

describe("inventoryLedger.recordInventoryEvent invariants", () => {
  function createMockCtx(initialDocs: Record<string, any> = {}) {
    const docs = new Map<string, any>(Object.entries(initialDocs));
    const inserted: Array<{ table: string; value: any }> = [];
    const patched: Array<{ id: string; patch: any }> = [];

    const mockCtx = {
      db: {
        get: async (id: string) => docs.get(id),
        patch: async (id: string, patch: any) => {
          const current = docs.get(id);
          if (current) {
            const updated = { ...current, ...patch };
            docs.set(id, updated);
            patched.push({ id, patch });
          }
        },
        insert: async (table: string, value: any) => {
          const id = `id_${inserted.length + 1}`;
          const record = { _id: id, ...value };
          docs.set(id, record);
          inserted.push({ table, value: record });
          return id;
        },
      },
    } as unknown as MutationCtx;

    return { mockCtx, docs, inserted, patched };
  }

  it("rejects non-positive quantities", async () => {
    const { mockCtx } = createMockCtx();
    await expect(
      recordInventoryEvent(mockCtx, {
        materialId: "mat_1" as any,
        eventType: "STOCK_IN",
        custody: "parent",
        balanceEffect: "in",
        quantity: -5,
        unit: "m²",
        baseUnit: "m²",
        baseQuantity: -5,
        note: "Invalid",
        createdBy: "user_1",
      })
    ).rejects.toThrow("greater than zero");
  });

  it("rejects missing notes", async () => {
    const { mockCtx } = createMockCtx();
    await expect(
      recordInventoryEvent(mockCtx, {
        materialId: "mat_1" as any,
        eventType: "STOCK_IN",
        custody: "parent",
        balanceEffect: "in",
        quantity: 10,
        unit: "m²",
        baseUnit: "m²",
        baseQuantity: 10,
        note: "   ",
        createdBy: "user_1",
      })
    ).rejects.toThrow("note is required");
  });

  it("rejects inactive or missing materials", async () => {
    const { mockCtx } = createMockCtx({
      mat_inactive: { _id: "mat_inactive", name: "Old Banner", active: false, quantity: 10 },
    });

    await expect(
      recordInventoryEvent(mockCtx, {
        materialId: "mat_inactive" as any,
        eventType: "STOCK_IN",
        custody: "parent",
        balanceEffect: "in",
        quantity: 10,
        unit: "m²",
        baseUnit: "m²",
        baseQuantity: 10,
        note: "Should fail",
        createdBy: "user_1",
      })
    ).rejects.toThrow("Active material not found");
  });

  it("updates parent inventory packages and material quantity on STOCK_IN", async () => {
    const { mockCtx, docs } = createMockCtx({
      mat_1: { _id: "mat_1", name: "Banner Flex", active: true, quantity: 0 },
      parent_1: { _id: "parent_1", totalStockQuantity: 0 },
    });

    await recordInventoryEvent(mockCtx, {
      materialId: "mat_1" as any,
      eventType: "STOCK_IN",
      custody: "parent",
      balanceEffect: "in",
      quantity: 2,
      unit: "roll",
      baseUnit: "m²",
      baseQuantity: 320,
      packageQuantity: 2,
      parentInventoryId: "parent_1" as any,
      note: "Receiving 2 rolls",
      createdBy: "user_1",
    });

    expect(docs.get("mat_1").quantity).toBe(320);
    expect(docs.get("parent_1").totalStockQuantity).toBe(2);
  });

  it("tracks operator floor sub-stock transfer and decrements central package stock", async () => {
    const { mockCtx, docs } = createMockCtx({
      mat_1: { _id: "mat_1", name: "Banner Flex", active: true, quantity: 320 },
      parent_1: { _id: "parent_1", totalStockQuantity: 2 },
      sub_1: {
        _id: "sub_1",
        currentRemaining: 0,
        issuedQuantity: 0,
        issuedUnits: 0,
        remainingPackages: 0,
        issuedPackages: 0,
        consumedBaseQuantity: 0,
      },
    });

    await recordInventoryEvent(mockCtx, {
      materialId: "mat_1" as any,
      eventType: "STORE_TO_OPERATOR_TRANSFER",
      custody: "operator",
      balanceEffect: "transfer",
      quantity: 160,
      unit: "m²",
      baseUnit: "m²",
      baseQuantity: 160,
      packageQuantity: 1,
      conversionRatio: 160,
      parentInventoryId: "parent_1" as any,
      operatorSubStockId: "sub_1" as any,
      note: "Issue 1 roll to floor",
      createdBy: "user_1",
    });

    expect(docs.get("mat_1").quantity).toBe(160);
    expect(docs.get("parent_1").totalStockQuantity).toBe(1);
    expect(docs.get("sub_1").currentRemaining).toBe(160);
  });
});
