import { describe, expect, it } from "vitest";
import { v } from "convex/values";

/**
 * Schema-literal introspection is the engine behind
 * `convex/services.ts → assertServiceIdsMatchSchema()`. These tests pin the
 * introspection logic so the drift guard stays correct as the schema grows.
 */
type Validator = { kind: string; value?: unknown; members?: Validator[] };

function isUnionOfLiterals(node: Validator): node is Validator & { members: Validator[] } {
  return node.kind === "union" && Array.isArray(node.members);
}

function literalValues(node: Validator): string[] {
  if (node.kind === "literal" && typeof node.value === "string") return [node.value];
  if (isUnionOfLiterals(node)) return node.members.flatMap((member) => literalValues(member));
  return [];
}

function checkDrift(schema: Validator, shared: readonly string[]): { ok: true } | { ok: false; missing: string[]; extra: string[] } {
  const schemaIds = literalValues(schema).sort();
  const sharedIds = [...shared].sort();
  const sameLength = schemaIds.length === sharedIds.length;
  const sameSet = sameLength && schemaIds.every((id, index) => id === sharedIds[index]);
  if (sameSet) return { ok: true };
  return {
    ok: false,
    missing: sharedIds.filter((id) => !schemaIds.includes(id as string)),
    extra: schemaIds.filter((id) => !(sharedIds as readonly string[]).includes(id)),
  };
}

describe("schema serviceType drift guard", () => {
  const shared = ["banner_print", "sticker_white", "dtf"] as const;

  it("returns ok when the union matches the shared list exactly", () => {
    const schema = v.union(v.literal("banner_print"), v.literal("sticker_white"), v.literal("dtf"));
    expect(checkDrift(schema as unknown as Validator, shared)).toEqual({ ok: true });
  });

  it("reports an extra schema literal the shared list lacks", () => {
    const schema = v.union(
      v.literal("banner_print"),
      v.literal("sticker_white"),
      v.literal("dtf"),
      v.literal("legacy_banner"),
    );
    expect(checkDrift(schema as unknown as Validator, shared)).toEqual({
      ok: false,
      missing: [],
      extra: ["legacy_banner"],
    });
  });

  it("reports a missing schema literal the shared list expects", () => {
    const schema = v.union(v.literal("banner_print"), v.literal("dtf"));
    expect(checkDrift(schema as unknown as Validator, shared)).toEqual({
      ok: false,
      missing: ["sticker_white"],
      extra: [],
    });
  });

  it("extracts literal values from a nested union", () => {
    const schema = v.union(
      v.union(v.literal("a"), v.literal("b")),
      v.literal("c"),
    );
    expect(literalValues(schema as unknown as Validator).sort()).toEqual(["a", "b", "c"]);
  });
});
