import { describe, expect, it } from "vitest";
import { materialNormalization } from "../migrations";
import type { MutationCtx } from "../_generated/server";

describe("Phase 8: materialNormalization migration", () => {
  function createMockCtx(initialDocs: Record<string, any> = {}) {
    const docs = new Map<string, any>(Object.entries(initialDocs));
    const patched: Array<{ id: string; patch: any }> = [];
    const inserted: Array<{ table: string; value: any }> = [];

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
            let eqVal: any = null;
            const qObj = {
              eq: (_field: string, val: any) => {
                eqVal = val;
                return qObj;
              },
            };
            if (filterFn) filterFn(qObj);
            return {
              unique: async () => {
                const all = Array.from(docs.values()).filter((d) => d.__table === table);
                if (eqVal) return all.find((d) => d.key === eqVal) ?? null;
                return all[0] ?? null;
              },
              collect: async () => {
                return Array.from(docs.values()).filter((d) => d.__table === table);
              },
            };
          },
          collect: async () => {
            return Array.from(docs.values()).filter((d) => d.__table === table);
          },
        }),
      },
    } as unknown as MutationCtx;

    return { mockCtx, docs, patched, inserted };
  }

  it("normalizes materialFamily, inkColor, and isSolvent on materials", async () => {
    const initialDocs = {
      mat_1: {
        _id: "mat_1",
        __table: "materials",
        name: "Banner Ink Cyan",
        category: "Ink",
        active: true,
      },
      mat_2: {
        _id: "mat_2",
        __table: "materials",
        name: "Banner Solvent",
        category: "Solvent",
        isSolvent: true,
        active: true,
      },
      mat_3: {
        _id: "mat_3",
        __table: "materials",
        name: "Banner Flex",
        category: "Roll",
        active: true,
      },
    };

    const { mockCtx, docs } = createMockCtx(initialDocs);

    const handler = (materialNormalization as any)._handler;
    const result = await handler(mockCtx, {});

    expect(result.patched).toBe(3);

    const cyan = docs.get("mat_1");
    expect(cyan.materialFamily).toBe("INK");
    expect(cyan.inkColor).toBe("CYAN");
    expect(cyan.isSolvent).toBe(false);

    const solvent = docs.get("mat_2");
    expect(solvent.materialFamily).toBe("SOLVENT");
    expect(solvent.isSolvent).toBe(true);

    const flex = docs.get("mat_3");
    expect(flex.materialFamily).toBe("RAW_MATERIAL");
  });

  it("is idempotent and skips on second execution", async () => {
    const initialDocs = {
      mig_1: {
        _id: "mig_1",
        __table: "migrations",
        key: "materialNormalization",
        ranAt: Date.now(),
      },
    };

    const { mockCtx } = createMockCtx(initialDocs);

    const handler = (materialNormalization as any)._handler;
    const result = await handler(mockCtx, {});

    expect(result.skipped).toBe(true);
    expect(result.patched).toBe(0);
  });
});
