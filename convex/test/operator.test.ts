import { describe, expect, it } from "vitest";
import type { OperatorMachine } from "../operator/common";
import { resolveMachineForRole } from "../operator/common";
import { completeJobInternal } from "../jobs";
import { createOffcutInternal, logScrapInternal } from "../offcuts";

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
              return Array.from(docs.values()).filter((d) =>
                d._id?.startsWith(`id_${table}`) || d.__table === table
              ).filter((d) => (eqField ? d[eqField!] === eqVal : true));
            },
            first: async () => {
              const all = Array.from(docs.values()).filter((d) =>
                d._id?.startsWith(`id_${table}`) || d.__table === table
              );
              return (eqField ? all.find((d) => d[eqField!] === eqVal) : all[0]) ?? null;
            },
            unique: async () => {
              const all = Array.from(docs.values()).filter((d) =>
                d._id?.startsWith(`id_${table}`) || d.__table === table
              );
              return (eqField ? all.find((d) => d[eqField!] === eqVal) : all[0]) ?? null;
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

const PRINTER_MACHINE: OperatorMachine = {
  _id: "id_machines_printer",
  name: "Polaris 3.2m",
  code: "BAN-01",
  type: "Banner Printer",
  operatorRole: "crystal_jet_operator",
  status: "Running",
  materialUnit: "m²",
  active: true,
};

const LASER_MACHINE: OperatorMachine = {
  _id: "id_machines_laser",
  name: "Laser Cutter",
  code: "LAS-01",
  type: "Laser Cutter",
  operatorRole: "laser_operator",
  status: "Available",
  materialUnit: "m²",
  active: true,
};

describe("operator namespace machine scoping", () => {
  it("resolves a machine by type or code for the matching operator role", () => {
    const resolved = resolveMachineForRole([PRINTER_MACHINE, LASER_MACHINE], "ban", "crystal_jet_operator");
    expect(resolved._id).toBe("id_machines_printer");
  });

  it("rejects a slug that resolves to a machine of a different operator role", () => {
    expect(() =>
      resolveMachineForRole([PRINTER_MACHINE, LASER_MACHINE], "las", "crystal_jet_operator")
    ).toThrow("This machine is not assigned to your operator role.");
  });

  it("rejects an unknown machine slug when no machine exists for the role", () => {
    // "uv" matches no code/type/name, and the only available machine belongs to a
    // different operator role, so neither slug nor role fallback can resolve it.
    expect(() => resolveMachineForRole([PRINTER_MACHINE], "uv", "dtf_operator")).toThrow(
      "Machine not found."
    );
  });

  it("resolves role-derived slugs that no machine code, type or name tracks", () => {
    const CrystekMachine: OperatorMachine = {
      _id: "id_machines_crystek",
      name: "Crystc Eco-Solvent Printer",
      code: "CESP-01",
      type: "Eco-Solvent Printer & Cutter",
      operatorRole: "crystek_operator",
      status: "Available",
      materialUnit: "m²",
      active: true,
    };
    const RicohUvMachine: OperatorMachine = {
      _id: "id_machines_ricoh",
      name: "Ricoh Flatbed UV Machine",
      code: "RUV-01",
      type: "UV Flatbed Printer",
      operatorRole: "ricoh_uv_operator",
      status: "Available",
      materialUnit: "m²",
      active: true,
    };
    expect(resolveMachineForRole([PRINTER_MACHINE, CrystekMachine], "crystek", "crystek_operator")._id).toBe(
      "id_machines_crystek"
    );
    expect(resolveMachineForRole([PRINTER_MACHINE, RicohUvMachine], "ricoh_uv", "ricoh_uv_operator")._id).toBe(
      "id_machines_ricoh"
    );
  });

  it("returns the machine when the role matches by code even if type differs", () => {
    const resolved = resolveMachineForRole([PRINTER_MACHINE], "BAN-01", "crystal_jet_operator");
    expect(resolved._id).toBe("id_machines_printer");
  });
});

describe("operator job-completion scope (completeJobInternal)", () => {
  it("rejects completing a job assigned to a machine of another operator role", async () => {
    const { mockCtx } = createMockCtx({
      id_materials_1: { _id: "id_materials_1", __table: "materials", name: "Banner Flex", unit: "m²", baseUnit: "m²", quantity: 100, active: true },
      id_machines_printer: { ...PRINTER_MACHINE, __table: "machines" },
      id_jobCards_1: {
        _id: "id_jobCards_1",
        __table: "jobCards",
        code: "JC-001",
        machineId: "id_machines_printer",
        materialId: "id_materials_1",
        status: "In production",
        quantity: 10,
        unit: "m²",
      },
    });

    await expect(
      completeJobInternal(
        mockCtx,
        { _id: "auth_laser" },
        { role: "laser_operator" },
        { jobId: "id_jobCards_1" },
      )
    ).rejects.toThrow("You are not assigned to this machine.");
  });

  it("returns early for an already-completed job without touching other tables", async () => {
    const { mockCtx } = createMockCtx({
      id_materials_1: { _id: "id_materials_1", __table: "materials", name: "Banner Flex", unit: "m²", baseUnit: "m²", quantity: 100, active: true },
      id_machines_printer: { ...PRINTER_MACHINE, __table: "machines" },
      id_jobCards_1: {
        _id: "id_jobCards_1",
        __table: "jobCards",
        code: "JC-001",
        machineId: "id_machines_printer",
        materialId: "id_materials_1",
        status: "Completed",
        quantity: 10,
        unit: "m²",
      },
    });

    const result = await completeJobInternal(
      mockCtx,
      { _id: "auth_printer" },
      { role: "crystal_jet_operator" },
      { jobId: "id_jobCards_1" },
    );

    expect(result).toEqual({ success: true, deduction: undefined });
  });
});

describe("operator offcut entry scope (createOffcutInternal)", () => {
  const operator = { _id: "auth_printer" };
  const baseState = {
    id_materials_1: {
      _id: "id_materials_1",
      __table: "materials",
      name: "Banner Flex",
      unit: "m²",
      baseUnit: "m²",
      quantity: 100,
      active: true,
    },
    id_machines_printer: { ...PRINTER_MACHINE, __table: "machines" },
    id_operatorSubStock_1: {
      _id: "id_operatorSubStock_1",
      __table: "operatorSubStock",
      machineId: "id_machines_printer",
      materialId: "id_materials_1",
      operatorId: "auth_printer",
      issuedQuantity: 20,
      issuedUnits: 0,
      issuedPackages: 0,
      issuedBaseQuantity: 20,
      remainingBaseQuantity: 12,
      currentRemaining: 12,
      status: "ACTIVE",
      issuedAt: Date.now(),
    },
  };

  it("rejects returning an offcut against floor stock held by another operator", async () => {
    const state = structuredClone(baseState);
    state.id_operatorSubStock_1.operatorId = "auth_other";
    const { mockCtx } = createMockCtx(state);

    await expect(
      createOffcutInternal(
        mockCtx,
        operator,
        { role: "crystal_jet_operator" },
        {
          materialId: "id_materials_1",
          width: 1,
          length: 2,
          location: "Shelf 1",
          operatorSubStockId: "id_operatorSubStock_1",
          machineId: "id_machines_printer",
        },
      )
    ).rejects.toThrow("You can only return offcuts from your assigned floor stock.");
  });

  it("rejects returning an offcut when the stock machine does not match", async () => {
    const state = structuredClone(baseState);
    state.id_operatorSubStock_1.machineId = "id_machines_laser";
    const { mockCtx } = createMockCtx(state);

    await expect(
      createOffcutInternal(
        mockCtx,
        operator,
        { role: "crystal_jet_operator" },
        {
          materialId: "id_materials_1",
          width: 1,
          length: 2,
          location: "Shelf 1",
          operatorSubStockId: "id_operatorSubStock_1",
          machineId: "id_machines_printer",
        },
      )
    ).rejects.toThrow("You can only return offcuts from your assigned floor stock.");
  });

  it("records the offcut and the audited inventory event for owned floor stock", async () => {
    const { mockCtx, docs, inserted } = createMockCtx(structuredClone(baseState));

    const result = await createOffcutInternal(
      mockCtx,
      operator,
      { role: "crystal_jet_operator" },
      {
        materialId: "id_materials_1",
        width: 1,
        length: 2,
        location: "Shelf 1",
        operatorSubStockId: "id_operatorSubStock_1",
        machineId: "id_machines_printer",
      },
    );

    expect(result).toBeTruthy();
    const offcuts = inserted.filter((entry) => entry.table === "offcuts");
    const movements = inserted.filter((entry) => entry.table === "stock_movements");
    expect(offcuts).toHaveLength(1);
    expect(offcuts[0].value.area).toBe(2);
    expect(offcuts[0].value.location).toBe("Shelf 1");
    expect(movements).toHaveLength(1);
    expect(movements[0].value.eventType).toBe("OFFCUT_RETURN");
    expect(docs.get("id_materials_1").quantity).toBe(102);
  });
});

describe("operator scrap entry scope (logScrapInternal)", () => {
  const operator = { _id: "auth_printer" };
  const baseState = {
    id_materials_1: {
      _id: "id_materials_1",
      __table: "materials",
      name: "Banner Flex",
      unit: "m²",
      baseUnit: "m²",
      quantity: 100,
      active: true,
    },
    id_machines_printer: { ...PRINTER_MACHINE, __table: "machines" },
    id_operatorSubStock_1: {
      _id: "id_operatorSubStock_1",
      __table: "operatorSubStock",
      machineId: "id_machines_printer",
      materialId: "id_materials_1",
      operatorId: "auth_printer",
      issuedQuantity: 20,
      issuedUnits: 0,
      issuedPackages: 0,
      issuedBaseQuantity: 20,
      remainingBaseQuantity: 12,
      currentRemaining: 12,
      status: "ACTIVE",
      issuedAt: Date.now(),
    },
  };

  it("rejects logging scrap when the stock machine does not match", async () => {
    const state = structuredClone(baseState);
    state.id_operatorSubStock_1.machineId = "id_machines_laser";
    const { mockCtx } = createMockCtx(state);

    await expect(
      logScrapInternal(
        mockCtx,
        operator,
        { role: "crystal_jet_operator" },
        {
          materialId: "id_materials_1",
          quantity: 2,
          reason: "Test cut failure",
          operatorSubStockId: "id_operatorSubStock_1",
          machineId: "id_machines_printer",
        },
      )
    ).rejects.toThrow("You can only log scrap against your assigned floor stock.");
  });

  it("records the scrap and the audited inventory event against owned floor stock", async () => {
    const { mockCtx, docs, inserted } = createMockCtx(structuredClone(baseState));

    const result = await logScrapInternal(
      mockCtx,
      operator,
      { role: "crystal_jet_operator" },
      {
        materialId: "id_materials_1",
        quantity: 2,
        reason: "Test cut failure",
        operatorSubStockId: "id_operatorSubStock_1",
        machineId: "id_machines_printer",
      },
    );

    expect(result).toBeTruthy();
    const scraps = inserted.filter((entry) => entry.table === "scraps");
    const movements = inserted.filter((entry) => entry.table === "stock_movements");
    expect(scraps).toHaveLength(1);
    expect(scraps[0].value.reason).toBe("Test cut failure");
    expect(movements).toHaveLength(1);
    expect(movements[0].value.eventType).toBe("SCRAP_LOG");
    expect(docs.get("id_operatorSubStock_1").currentRemaining).toBe(10);
  });
});