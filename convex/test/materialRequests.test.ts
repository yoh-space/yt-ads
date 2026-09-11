import { describe, expect, it } from "vitest";
import {
  issueMaterialRequestInternal,
  acknowledgeMaterialRequestInternal,
} from "../materialRequests";

function createMockCtx(initialDocs: Record<string, any> = {}) {
  const docs = new Map<string, any>(Object.entries(initialDocs));
  const inserted: Array<{ table: string; value: any }> = [];
  const patched: Array<{ id: string; patch: any }> = [];

  const mockCtx = {
    db: {
      get: async (id: string) => docs.get(id) ?? null,
      patch: async (id: string, patch: any) => {
        const current = docs.get(id);
        if (current) {
          const updated = { ...current, ...patch };
          docs.set(id, updated);
          patched.push({ id, patch });
        }
      },
      insert: async (table: string, value: any) => {
        const id = `id_${table}_${inserted.length + 1}`;
        const record = { _id: id, ...value };
        docs.set(id, record);
        inserted.push({ table, value: record });
        return id;
      },
      query: (table: string) => ({
        withIndex: (_indexName: string, filterFn?: (q: any) => any) => {
          let eqField: string | null = null;
          let eqVal: any = null;
          const qObj = {
            eq: (field: string, val: any) => {
              eqField = field;
              eqVal = val;
              return qObj;
            },
          };
          if (filterFn) filterFn(qObj);
          return {
            collect: async () => {
              const all = Array.from(docs.values()).filter((d) =>
                d._id?.startsWith(`id_${table}`) || d.__table === table
              );
              if (eqField) {
                return all.filter((d) => d[eqField!] === eqVal);
              }
              return all;
            },
            first: async () => {
              const all = Array.from(docs.values()).filter((d) =>
                d._id?.startsWith(`id_${table}`) || d.__table === table
              );
              if (eqField) {
                return all.find((d) => d[eqField!] === eqVal) ?? null;
              }
              return all[0] ?? null;
            },
            unique: async () => {
              const all = Array.from(docs.values()).filter((d) =>
                d._id?.startsWith(`id_${table}`) || d.__table === table
              );
              if (eqField) {
                return all.find((d) => d[eqField!] === eqVal) ?? null;
              }
              return all[0] ?? null;
            },
          };
        },
        collect: async () => {
          return Array.from(docs.values()).filter((d) =>
            d._id?.startsWith(`id_${table}`) || d.__table === table
          );
        },
      }),
    },
  };

  return { mockCtx, docs, inserted, patched };
}

describe("materialRequests issuance and acknowledgement invariants", () => {
  const baseStorekeeper = { _id: "user_storekeeper", name: "Storekeeper" };
  const baseOperator = { _id: "user_operator_printer", name: "Printer Operator" };

  function buildValidState() {
    return {
      id_materials_1: {
        _id: "id_materials_1",
        __table: "materials",
        name: "Banner Flex 3.2m",
        unit: "m²",
        baseUnit: "m²",
        active: true,
        quantity: 500,
      },
      id_parentInventory_1: {
        _id: "id_parentInventory_1",
        __table: "parentInventory",
        materialId: "id_materials_1",
        totalStockQuantity: 10,
        unitType: "ROLL",
        lengthPerRoll: 50,
      },
      id_machines_1: {
        _id: "id_machines_1",
        __table: "machines",
        name: "Polaris 3.2m",
                code: "M-POLARIS",
        operatorRole: "printer_operator",
        active: true,
      },
      id_jobCards_1: {
        _id: "id_jobCards_1",
        __table: "jobCards",
        code: "JC-001",
        machineId: "id_machines_1",
        materialId: "id_materials_1",
      },
      id_profiles_operator: {
        _id: "id_profiles_operator",
        __table: "profiles",
                authUserId: "user_operator_printer",
        role: "printer_operator",
        active: true,
      },
      id_materialRequests_1: {
        _id: "id_materialRequests_1",
        __table: "materialRequests",
        jobCardId: "id_jobCards_1",
        materialId: "id_materials_1",
        requestedQuantity: 50,
        issuedQuantity: 0,
        requestedPackages: 1,
        issuedPackages: 0,
        unit: "m²",
        packageUnit: "ROLL",
        status: "Pending",
        requestedBy: "user_operator_printer",
        requestedAt: Date.now(),
      },
    };
  }

  it("successfully issues material and decrements central packages", async () => {
    const { mockCtx, docs } = createMockCtx(buildValidState());

    const result = await issueMaterialRequestInternal(
      mockCtx,
      {
        requestId: "id_materialRequests_1" as any,
        issuedQuantity: 50,
        issuedPackages: 1,
      },
      baseStorekeeper
    );

    expect(result.status).toBe("Issued");
    expect(result.issuedQuantity).toBe(50);
    expect(result.issuedPackages).toBe(1);

    const parent = docs.get("id_parentInventory_1");
    expect(parent.totalStockQuantity).toBe(9); // 10 - 1 = 9
  });

  it("rejects issuance on invalid states (Received, Short Stock, Discrepancy)", async () => {
    const state = buildValidState();
    state.id_materialRequests_1.status = "Short Stock";
    const { mockCtx } = createMockCtx(state);

    await expect(
      issueMaterialRequestInternal(
        mockCtx,
        {
          requestId: "id_materialRequests_1" as any,
          issuedQuantity: 50,
        },
        baseStorekeeper
      )
    ).rejects.toThrow("Only an open material request can be issued.");
  });

  it("rejects duplicate issue when request is already Issued", async () => {
    const state = buildValidState();
    state.id_materialRequests_1.status = "Issued";
    state.id_materialRequests_1.issuedQuantity = 50;
    const { mockCtx } = createMockCtx(state);

    await expect(
      issueMaterialRequestInternal(
        mockCtx,
        {
          requestId: "id_materialRequests_1" as any,
          issuedQuantity: 50,
        },
        baseStorekeeper
      )
    ).rejects.toThrow("Only an open material request can be issued.");
  });

  it("rejects over-issuing remaining requested quantity", async () => {
    const state = buildValidState();
    state.id_materialRequests_1.issuedQuantity = 30; // remaining is 20
    const { mockCtx } = createMockCtx(state);

    await expect(
      issueMaterialRequestInternal(
        mockCtx,
        {
          requestId: "id_materialRequests_1" as any,
          issuedQuantity: 25,
        },
        baseStorekeeper
      )
    ).rejects.toThrow("Issued quantity cannot exceed the remaining requested quantity.");
  });

  it("rejects issuance when central package stock is insufficient", async () => {
    const state = buildValidState();
    state.id_parentInventory_1.totalStockQuantity = 0; // 0 rolls left
    const { mockCtx } = createMockCtx(state);

    await expect(
      issueMaterialRequestInternal(
        mockCtx,
        {
          requestId: "id_materialRequests_1" as any,
          issuedQuantity: 50,
          issuedPackages: 1,
        },
        baseStorekeeper
      )
    ).rejects.toThrow("Insufficient central package stock");
  });

      it("rejects issuance when requesting operator role does not match machine role", async () => {
    const state = buildValidState();
    state.id_profiles_operator.role = "laser_operator"; // Mismatch with printer_operator machine
    const { mockCtx } = createMockCtx(state);

    await expect(
      issueMaterialRequestInternal(
        mockCtx,
        {
          requestId: "id_materialRequests_1" as any,
          issuedQuantity: 50,
          issuedPackages: 1,
        },
        baseStorekeeper
      )
    ).rejects.toThrow("does not match the machine operator role");
  });

  it("rejects acknowledgement of partially issued request if not fully issued", async () => {
    const state = buildValidState();
    state.id_materialRequests_1.status = "Partially Issued";
    state.id_materialRequests_1.issuedQuantity = 20; // requested is 50
    const { mockCtx } = createMockCtx(state);

                  await expect(
      acknowledgeMaterialRequestInternal(
        mockCtx,
        { requestId: "id_materialRequests_1" as any },
        baseOperator,
        "printer_operator"
      )
    ).rejects.toThrow("Cannot acknowledge receipt while request is still partially issued.");
  });

  it("allows acknowledgement when request is Issued", async () => {
    const state = buildValidState();
    state.id_materialRequests_1.status = "Issued";
    state.id_materialRequests_1.issuedQuantity = 50;
    const { mockCtx } = createMockCtx(state);

                const result = await acknowledgeMaterialRequestInternal(
      mockCtx,
      { requestId: "id_materialRequests_1" as any },
      baseOperator,
      "printer_operator"
    );

    expect(result.status).toBe("Received");
    expect(result.receivedBy).toBe(baseOperator._id);
  });
});
