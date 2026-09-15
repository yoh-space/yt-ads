import { describe, expect, it } from "vitest";
import {
  issueMaterialRequestInternal,
  acknowledgeMaterialRequestInternal,
  createMaterialRequestInternal,
  getMaterialRequestEligibilityInternal,
} from "../materialRequests";
import { resolveMachineForRole } from "../operator/common";

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
        operatorRole: "crystal_jet_operator",
        active: true,
      },
      id_jobCards_1: {
        _id: "id_jobCards_1",
        __table: "jobCards",
        code: "JC-001",
        machineId: "id_machines_1",
        materialId: "id_materials_1",
      },
      id_users_operator: {
        _id: "id_users_operator",
        __table: "users",
        authUserId: "user_operator_printer",
        name: "Printer Operator",
        role: "crystal_jet_operator",
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
      id_machineMaterialLinks_1: {
        _id: "id_machineMaterialLinks_1",
        __table: "machineMaterialLinks",
        machineId: "id_machines_1",
        materialId: "id_materials_1",
        relationshipType: "primary",
        active: true,
        required: true,
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
    state.id_users_operator.role = "laser_operator"; // Mismatch with crystal_jet_operator machine
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
        "crystal_jet_operator"
      )
    ).rejects.toThrow("The request is still partially issued.");
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
      "crystal_jet_operator"
    );

    expect(result.status).toBe("Received");
    expect(result.receivedBy).toBe(baseOperator._id);
  });

  it("treats repeated receipt acknowledgement as idempotent", async () => {
    const state = buildValidState() as any;
    state.id_materialRequests_1.status = "Received";
    state.id_materialRequests_1.receivedBy = baseOperator._id;
    const { mockCtx } = createMockCtx(state);

    const result = await acknowledgeMaterialRequestInternal(
      mockCtx,
      { requestId: "id_materialRequests_1" as any },
      baseOperator,
      "crystal_jet_operator",
    );

    expect(result.status).toBe("Received");
    expect(result.receivedBy).toBe(baseOperator._id);
  });

  it("rejects acknowledgement when the related machine is unavailable", async () => {
    const state = buildValidState() as any;
    state.id_materialRequests_1.status = "Issued";
    state.id_materialRequests_1.issuedQuantity = 50;
    delete state.id_machines_1;
    const { mockCtx } = createMockCtx(state);

    await expect(
      acknowledgeMaterialRequestInternal(
        mockCtx,
        { requestId: "id_materialRequests_1" as any },
        baseOperator,
        "crystal_jet_operator",
      ),
    ).rejects.toThrow("The related machine is unavailable.");
  });

  it("requires every grouped line to be fully issued", async () => {
    const state = buildValidState() as any;
    state.id_materialRequests_1.status = "Issued";
    state.id_materialRequests_1.issuedQuantity = 50;
    state.id_materialRequests_1.requestGroupId = "group-1";
    state.id_materialRequestLines_1 = {
      _id: "id_materialRequestLines_1",
      __table: "materialRequestLines",
      requestGroupId: "group-1",
      materialId: "id_materials_1",
      requestedQuantity: 50,
      issuedQuantity: 20,
      status: "Partially Issued",
    };
    const { mockCtx } = createMockCtx(state);

    await expect(
      acknowledgeMaterialRequestInternal(
        mockCtx,
        { requestId: "id_materialRequests_1" as any },
        baseOperator,
        "crystal_jet_operator",
      ),
    ).rejects.toThrow("The grouped request is still partially issued.");
  });

  it("keeps acknowledgement successful when notification delivery fails", async () => {
    const state = buildValidState() as any;
    state.id_materialRequests_1.status = "Issued";
    state.id_materialRequests_1.issuedQuantity = 50;
    const { mockCtx, docs } = createMockCtx(state);
    const originalInsert = mockCtx.db.insert;
    mockCtx.db.insert = async (table: string, value: any) => {
      if (table === "notifications") throw new Error("notification service unavailable");
      return originalInsert(table, value);
    };

    const result = await acknowledgeMaterialRequestInternal(
      mockCtx,
      { requestId: "id_materialRequests_1" as any },
      baseOperator,
      "crystal_jet_operator",
    );

    expect(result.status).toBe("Received");
    expect(docs.get("id_materialRequests_1").status).toBe("Received");
  });
});

describe("operator material requests lifecycle and clean custody", () => {
  const operatorIdentity = { _id: "user_operator_printer" };
  const operatorProfile = { role: "crystal_jet_operator" as const };

  function buildCleanRequestState() {
    return {
      id_materials_1: {
        _id: "id_materials_1",
        __table: "materials",
        name: "Banner Flex 3.2m",
        unit: "m²",
        baseUnit: "m²",
        purchaseUnit: "roll",
        packageUnit: "ROLL",
        conversionRatio: 50,
        active: true,
        quantity: 500,
      },
      id_materials_ink: {
        _id: "id_materials_ink",
        __table: "materials",
        name: "Cyan Solvent Ink",
        unit: "L",
        baseUnit: "L",
        purchaseUnit: "canister",
        packageUnit: "CANISTER",
        conversionRatio: 5,
        active: true,
        quantity: 100,
      },
      id_materials_unrelated: {
        _id: "id_materials_unrelated",
        __table: "materials",
        name: "Acrylic Sheet 3mm",
        unit: "sheet",
        baseUnit: "sheet",
        active: true,
        quantity: 50,
      },
      id_machines_1: {
        _id: "id_machines_1",
        __table: "machines",
        name: "Polaris 3.2m",
        code: "M-POLARIS",
        type: "Large Format Printer",
        operatorRole: "crystal_jet_operator",
        active: true,
      },
      id_machines_2: {
        _id: "id_machines_2",
        __table: "machines",
        name: "Mimaki JV300",
        code: "M-MIMAKI",
        type: "Eco Solvent Printer",
        operatorRole: "crystal_jet_operator",
        active: true,
      },
      id_jobCards_1: {
        _id: "id_jobCards_1",
        __table: "jobCards",
        code: "JC-001",
        title: "Large Banner Print",
        client: "Acme Corp",
        status: "Queued",
        machineId: "id_machines_1",
        materialId: "id_materials_1",
        quantity: 100,
        unit: "m²",
      },
      id_jobMaterialRequirements_1: {
        _id: "id_jobMaterialRequirements_1",
        __table: "jobMaterialRequirements",
        jobCardId: "id_jobCards_1",
        materialId: "id_materials_ink",
        plannedBaseQuantity: 10,
        approvedScrapQuantity: 0,
      },
      id_users_storekeeper: {
        _id: "id_users_storekeeper",
        __table: "users",
        authUserId: "user_storekeeper",
        role: "storekeeper",
        active: true,
      },
      id_machineMaterialLinks_1: {
        _id: "id_machineMaterialLinks_1",
        __table: "machineMaterialLinks",
        machineId: "id_machines_1",
        materialId: "id_materials_1",
        relationshipType: "primary",
        active: true,
        required: true,
      },
      id_machineMaterialLinks_ink: {
        _id: "id_machineMaterialLinks_ink",
        __table: "machineMaterialLinks",
        machineId: "id_machines_1",
        materialId: "id_materials_ink",
        relationshipType: "ink",
        active: true,
        required: true,
      },
    };
  }

  it("allows an operator with NO previous stock to create a material request", async () => {
    const state = buildCleanRequestState();
    const { mockCtx, inserted } = createMockCtx(state);

    const result = await createMaterialRequestInternal(
      mockCtx as any,
      operatorIdentity,
      operatorProfile,
      {
        jobCardId: "id_jobCards_1" as any,
        materialId: "id_materials_1" as any,
        requestedQuantity: 50,
        unit: "m²",
        requestedPackages: 1,
        packageUnit: "ROLL",
      },
      "id_machines_1",
    );

    expect(result).toBeDefined();
    expect(result.status).toBe("Requested");
    expect(result.jobCardId).toBe("id_jobCards_1");
    expect(result.machineId).toBe("id_machines_1");

    // Assert machineId was persisted on the inserted materialRequest record
    const requestInsert = inserted.find((i) => i.table === "materialRequests");
    expect(requestInsert).toBeDefined();
    expect(requestInsert?.value.machineId).toBe("id_machines_1");
  });

  it("allows an operator with depleted stock (currentRemaining = 0) to create a material request", async () => {
    const state = buildCleanRequestState();
    (state as any).id_operatorSubStock_old = {
      _id: "id_operatorSubStock_old",
      __table: "operatorSubStock",
      operatorId: "user_operator_printer",
      machineId: "id_machines_1",
      materialId: "id_materials_1",
      currentRemaining: 0,
      status: "ACTIVE",
    };
    const { mockCtx } = createMockCtx(state);

    const result = await createMaterialRequestInternal(
      mockCtx as any,
      operatorIdentity,
      operatorProfile,
      {
        jobCardId: "id_jobCards_1" as any,
        materialId: "id_materials_1" as any,
        requestedQuantity: 50,
        unit: "m²",
        requestedPackages: 1,
        packageUnit: "ROLL",
      },
      "id_machines_1",
    );

    expect(result.status).toBe("Requested");
  });

  it("allows an operator with active stock on a different machine to request on their assigned machine", async () => {
    const state = buildCleanRequestState();
    // Active stock on machine 2, but requesting for machine 1
    (state as any).id_operatorSubStock_other = {
      _id: "id_operatorSubStock_other",
      __table: "operatorSubStock",
      operatorId: "user_operator_printer",
      machineId: "id_machines_2",
      materialId: "id_materials_1",
      currentRemaining: 100,
      status: "ACTIVE",
    };
    const { mockCtx } = createMockCtx(state);

    const result = await createMaterialRequestInternal(
      mockCtx as any,
      operatorIdentity,
      operatorProfile,
      {
        jobCardId: "id_jobCards_1" as any,
        materialId: "id_materials_1" as any,
        requestedQuantity: 50,
        unit: "m²",
        requestedPackages: 1,
        packageUnit: "ROLL",
      },
      "id_machines_1",
    );

    expect(result.status).toBe("Requested");
  });

  it("rejects request when material is not in Job Card or BOM requirements", async () => {
    const state = buildCleanRequestState();
    const { mockCtx } = createMockCtx(state);

    await expect(
      createMaterialRequestInternal(
        mockCtx as any,
        operatorIdentity,
        operatorProfile,
        {
          jobCardId: "id_jobCards_1" as any,
          materialId: "id_materials_unrelated" as any,
          requestedQuantity: 5,
          unit: "sheet" as any,
          requestedPackages: 5,
          packageUnit: "PIECE" as any,
        },
        "id_machines_1",
      )
    ).rejects.toThrow("The requested material and unit must match the job card.");
  });

  it("rejects request when there is an active batch with remaining stock on the same machine and material", async () => {
    const state = buildCleanRequestState();
    (state as any).id_operatorSubStock_active = {
      _id: "id_operatorSubStock_active",
      __table: "operatorSubStock",
      operatorId: "user_operator_printer",
      machineId: "id_machines_1",
      materialId: "id_materials_1",
      currentRemaining: 25.5,
      status: "ACTIVE",
      baseUnit: "m²",
    };
    const { mockCtx } = createMockCtx(state);

    await expect(
      createMaterialRequestInternal(
        mockCtx as any,
        operatorIdentity,
        operatorProfile,
        {
          jobCardId: "id_jobCards_1" as any,
          materialId: "id_materials_1" as any,
          requestedQuantity: 50,
          unit: "m²",
          requestedPackages: 1,
          packageUnit: "ROLL",
        },
        "id_machines_1",
      )
    ).rejects.toThrow("ACTIVE_CUSTODY_EXISTS");
  });

  it("rejects request when there is a pending clearance batch on the same machine and material", async () => {
    const state = buildCleanRequestState();
    (state as any).id_operatorSubStock_pending = {
      _id: "id_operatorSubStock_pending",
      __table: "operatorSubStock",
      operatorId: "user_operator_printer",
      machineId: "id_machines_1",
      materialId: "id_materials_1",
      currentRemaining: 5,
      status: "PENDING_CLEARANCE",
    };
    const { mockCtx } = createMockCtx(state);

    await expect(
      createMaterialRequestInternal(
        mockCtx as any,
        operatorIdentity,
        operatorProfile,
        {
          jobCardId: "id_jobCards_1" as any,
          materialId: "id_materials_1" as any,
          requestedQuantity: 50,
          unit: "m²",
          requestedPackages: 1,
          packageUnit: "ROLL",
        },
        "id_machines_1",
      )
    ).rejects.toThrow("UNRESOLVED_CUSTODY_CLEARANCE");
  });

  it("returns structured eligibility with allowed materials including BOM requirements", async () => {
    const state = buildCleanRequestState();
    const { mockCtx } = createMockCtx(state);

    const eligibility = await getMaterialRequestEligibilityInternal(
      mockCtx as any,
      operatorIdentity,
      operatorProfile,
      {
        machineId: "id_machines_1" as any,
        jobCardId: "id_jobCards_1" as any,
      },
    );

    expect(eligibility.eligible).toBe(true);
    expect(eligibility.blockingReasons).toHaveLength(0);
    expect(eligibility.allowedMaterials).toHaveLength(2); // primary material + ink requirement
    expect(eligibility.allowedMaterials.map((m) => m.id)).toEqual(
      expect.arrayContaining(["id_materials_1", "id_materials_ink"]),
    );
    expect(eligibility.conversionSnapshots).toHaveLength(2);
  });

  it("resolveMachineForRole matches exact ID, exact code, and throws on ambiguous slugs", () => {
    const machines = [
      {
        _id: "mach_101",
        code: "M-POLARIS-1",
        name: "Polaris Alpha",
        type: "Large Format Printer",
        operatorRole: "crystal_jet_operator" as const,
        status: "Available",
        materialUnit: "m²",
        active: true,
      },
      {
        _id: "mach_102",
        code: "M-POLARIS-2",
        name: "Polaris Beta",
        type: "Large Format Printer",
        operatorRole: "crystal_jet_operator" as const,
        status: "Available",
        materialUnit: "m²",
        active: true,
      },
      {
        _id: "mach_103",
        code: "M-MIMAKI",
        name: "Mimaki Roll",
        type: "Eco Solvent Printer",
        operatorRole: "crystal_jet_operator" as const,
        status: "Available",
        materialUnit: "m²",
        active: true,
      },
    ];

    // 1. Exact ID
    expect(resolveMachineForRole(machines, "mach_101", "crystal_jet_operator")._id).toBe("mach_101");

    // 2. Exact Code (case-insensitive)
    expect(resolveMachineForRole(machines, "m-mimaki", "crystal_jet_operator")._id).toBe("mach_103");

    // 3. Ambiguous slug matches multiple machines (e.g. "polaris")
    expect(() => resolveMachineForRole(machines, "polaris", "crystal_jet_operator")).toThrow(
      "AMBIGUOUS_MACHINE_SCOPE",
    );

    // 4. Unique substring matches
    expect(resolveMachineForRole(machines, "polaris-1", "crystal_jet_operator")._id).toBe("mach_101");
  });
});
