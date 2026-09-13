import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertServiceMachineOptions, listServiceMachineOptions } from "../owner/serviceMachineOptions";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import * as users from "../users";

beforeEach(() => {
  vi.spyOn(users, "requireActiveProfile").mockResolvedValue({
    identity: { _id: "user_owner", email: "owner@test.com" } as any,
    profile: { role: "owner", active: true, name: "Owner" } as any,
  } as any);
});

describe("serviceMachineOptions", () => {
  it("upserts and lists machine options with priority order", async () => {
    const machines = [
      { code: "CJ7K-01", name: "Crystal Jet 7K", active: true },
      { code: "CESP-01", name: "Crystc Eco-Solvent", active: true },
      { code: "RUV-01", name: "Ricoh UV", active: true },
    ];
    const optionsTable: any[] = [];
    const routesTable: any[] = [
      {
        _id: "route_banner",
        serviceId: "indoor_outdoor_printing",
        preferredMachineCode: "CESP-01",
        active: true,
      },
    ];

    const mockCtx = {
      db: {
        query: (table: string) => ({
          collect: async () => {
            if (table === "machines") return machines;
            if (table === "serviceMachineOptions") return optionsTable;
            return [];
          },
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
              collect: async () => {
                if (table === "serviceMachineOptions") {
                  return optionsTable.filter(
                    (r) =>
                      (!filters.serviceId || r.serviceId === filters.serviceId) &&
                      (filters.active === undefined || r.active === filters.active),
                  );
                }
                return [];
              },
              first: async () => {
                if (table === "serviceRoutes") {
                  return (
                    routesTable.find(
                      (r) =>
                        (!filters.serviceId || r.serviceId === filters.serviceId) &&
                        (filters.active === undefined || r.active === filters.active),
                    ) ?? null
                  );
                }
                return null;
              },
            };
          },
        }),
        delete: async (id: string) => {
          const idx = optionsTable.findIndex((o) => o._id === id);
          if (idx !== -1) optionsTable.splice(idx, 1);
        },
        insert: async (table: string, doc: any) => {
          const newDoc = { _id: `opt_${optionsTable.length + 1}`, ...doc };
          if (table === "serviceMachineOptions") {
            optionsTable.push(newDoc);
          }
          return newDoc._id;
        },
        patch: async (id: string, patch: any) => {
          const target = routesTable.find((r) => r._id === id);
          if (target) Object.assign(target, patch);
        },
      },
      auth: {
        getUserIdentity: async () => ({ subject: "user_owner", email: "owner@test.com" }),
      },
    } as unknown as MutationCtx;

    // Save machine options: CJ7K-01 (priority 0), RUV-01 (priority 1)
    const res = await (upsertServiceMachineOptions as any)._handler(mockCtx, {
      serviceId: "indoor_outdoor_printing",
      machineCodes: ["CJ7K-01", "RUV-01"],
    });

    expect(res.success).toBe(true);
    expect(res.count).toBe(2);
    expect(optionsTable.length).toBe(2);
    expect(optionsTable[0].machineCode).toBe("CJ7K-01");
    expect(optionsTable[0].priority).toBe(0);
    expect(optionsTable[1].machineCode).toBe("RUV-01");
    expect(optionsTable[1].priority).toBe(1);

    // Route preferredMachineCode synchronized with top priority
    expect(routesTable[0].preferredMachineCode).toBe("CJ7K-01");

    // Test listServiceMachineOptions query
    const list = await (listServiceMachineOptions as any)._handler(mockCtx as unknown as QueryCtx, {
      serviceId: "indoor_outdoor_printing",
    });
    expect(list.length).toBe(2);
    expect(list[0].machineCode).toBe("CJ7K-01");
  });

  it("rejects non-existent machine codes", async () => {
    const mockCtx = {
      db: {
        query: () => ({
          collect: async () => [{ code: "CJ7K-01", active: true }],
        }),
      },
      auth: {
        getUserIdentity: async () => ({ subject: "user_owner", email: "owner@test.com" }),
      },
    } as unknown as MutationCtx;

    await expect(
      (upsertServiceMachineOptions as any)._handler(mockCtx, {
        serviceId: "indoor_outdoor_printing",
        machineCodes: ["NON_EXISTENT_MACHINE"],
      }),
    ).rejects.toThrowError(/not registered/);
  });
});
