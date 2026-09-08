/**
 * Schema ↔ shared-catalog drift assertion for the `serviceType` union.
 *
 * The canonical service id list lives in `src/shared/services.ts`. The
 * `convex/schema.ts → serviceType` validator mirrors it as a `v.union(...)`.
 * Drift between the two used to be silent — every caller would just compile
 * fine and look up the wrong label later. This module makes that mismatch a
 * loud, immediate failure by introspecting the validator at module load.
 *
 * The assertion is called from the seed entry points (`seedAll`,
 * `seedDemoLifecycle`, `seedYtAdvertisementWorkspace`) so any deploy that
 * ships a divergent schema is rejected before any data is written.
 */
import { SERVICE_IDS } from "../src/shared/services";
import { serviceType as schemaServiceType } from "./schema";

type Validator = { kind: string; value?: unknown; members?: Validator[] };

function isUnionOfLiterals(node: Validator): node is Validator & { members: Validator[] } {
  return node.kind === "union" && Array.isArray(node.members);
}

function literalValues(node: Validator): string[] {
  if (node.kind === "literal" && typeof node.value === "string") return [node.value];
  if (isUnionOfLiterals(node)) {
    return node.members.flatMap((member) => literalValues(member));
  }
  return [];
}

/**
 * Compares the schema's `serviceType` literal members against the canonical
 * shared-catalog id list. Throws on any drift (missing/extra id or
 * reordering). Returns the matched id list on success so callers can log it.
 */
export function assertServiceIdsMatchSchema(): string[] {
  const schemaIds = literalValues(schemaServiceType as unknown as Validator).sort();
  const sharedIds = [...SERVICE_IDS].sort();
  const sameLength = schemaIds.length === sharedIds.length;
  const sameSet = sameLength && schemaIds.every((id, index) => id === sharedIds[index]);
  if (!sameSet) {
    const missingInSchema = sharedIds.filter((id) => !schemaIds.includes(id as string));
    const extraInSchema = schemaIds.filter((id) => !(sharedIds as readonly string[]).includes(id));
    throw new Error(
      `serviceType drift detected between convex/schema.ts and src/shared/services.ts.\n` +
        `  Schema literals (${schemaIds.length}): ${schemaIds.join(", ")}\n` +
        `  Shared catalog (${sharedIds.length}): ${sharedIds.join(", ")}\n` +
        (missingInSchema.length ? `  Missing in schema: ${missingInSchema.join(", ")}\n` : "") +
        (extraInSchema.length ? `  Extra in schema:   ${extraInSchema.join(", ")}\n` : "") +
        `Fix by editing convex/schema.ts → serviceType so the union matches src/shared/services.ts → SERVICE_IDS.`,
    );
  }
  return sharedIds;
}
