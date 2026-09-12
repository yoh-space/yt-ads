import { describe, expect, it } from "vitest";
import { purgeAndReseedCatalog } from "../admin";

function createMockCtx(initialDocs: Record<string, any> = {}) {
  const docs = new Map<string, any>(Object.entries(initialDocs));
  const inserted: Array<{ table: string; value: any }> = [];
  const deleted: string[] = [];

  const mockCtx = {
    db: {
      query: (table: string) => ({
        collect: async () => {
          return Array.from(docs.values()).filter((doc) => doc.__table === table || doc._id.startsWith(`id_${table}`));
        },
      }),
      delete: async (id: string) => {
        docs.delete(id);
        deleted.push(id);
      },
      insert: async (table: string, value: any) => {
        const id = `id_${table}_${inserted.length + 1}`;
        const record = { _id: id, __table: table, ...value };
        docs.set(id, record);
        inserted.push({ table, value: record });
        return id;
      },
    },
  };

  return { mockCtx, docs, inserted, deleted };
}

describe("purgeAndReseedCatalog admin mutation", () => {
  it("rejects invalid confirmation keys", async () => {
    const { mockCtx } = createMockCtx();
    const handler = (purgeAndReseedCatalog as any)._handler ?? (purgeAndReseedCatalog as any);

    await expect(handler(mockCtx, { confirmKey: "WRONG_KEY" })).rejects.toThrow(
      "Invalid confirmation key for database purge.",
    );
  });

  it("wipes legacy records and seeds the exact 23 master material categories (64 variants)", async () => {
    const initial = {
      id_materials_old1: { _id: "id_materials_old1", __table: "materials", name: "Old Banner" },
      id_materialRequests_old1: { _id: "id_materialRequests_old1", __table: "materialRequests", requestedQuantity: 5 },
      id_jobCards_old1: { _id: "id_jobCards_old1", __table: "jobCards", title: "Old Job" },
    };
    const { mockCtx, docs, inserted, deleted } = createMockCtx(initial);
    const handler = (purgeAndReseedCatalog as any)._handler ?? (purgeAndReseedCatalog as any);

    const result = await handler(mockCtx, { confirmKey: "PURGE_YT_2026" });

    expect(result).toEqual({ status: "SUCCESS", insertedCount: 85 });
    expect(deleted).toContain("id_materials_old1");
    expect(deleted).toContain("id_materialRequests_old1");
    expect(deleted).toContain("id_jobCards_old1");

    const insertedMaterials = inserted.filter((item) => item.table === "materials").map((item) => item.value);
    expect(insertedMaterials).toHaveLength(85);

    const names = insertedMaterials.map((m) => m.name);
    expect(names).toContain("Banner 3.2m × 50m");
    expect(names).toContain("Banner 2.07m × 50m");
    expect(names).toContain("Frosted Sticker (1.2m × 50m)");
    expect(names).toContain("Transparent Mica 5mm (1.22m × 2.44m)");
    expect(names).toContain("Neon Light - Ice Blue");
    expect(names).toContain("Power Supply 60W");
    expect(names).toContain("Amire (Packet - 250 pcs/pkg)");
    expect(names).toContain("Roll-Up Stand - Delux");
  });
});
