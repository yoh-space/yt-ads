import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  fileURLToPath(new URL("./database-catalog-suite.tsx", import.meta.url)),
  "utf8",
);

describe("Master Catalogs Material tab is read-only", () => {
  it("routes material editing to the Raw Materials page", () => {
    expect(source).toContain("/dashboard/owner/raw-materials");
    expect(source).toMatch(/Edit in Raw\s*Materials/);
  });

  it("describes the Material tab as a read-only reference", () => {
    expect(source).toContain("Read-only reference");
  });

  it("no longer wires catalog-only material mutations or toggle endpoints", () => {
    expect(source).not.toContain("upsertMaterialCatalogItem");
    expect(source).not.toContain("toggleMaterialCatalogActive");
  });

  it("no longer references the catalog material edit panel", () => {
    expect(source).not.toContain("editingMaterial");
  });
});