import type { MutationCtx } from "../_generated/server";

export type ConfigAction = "create" | "update" | "deactivate";

export interface LogConfigChangeArgs {
  entityType: "material" | "service" | "role" | "route" | "group" | "permission" | "ink_rule" | string;
  entityId: string;
  action: ConfigAction;
  fieldChanges?: Record<string, { from: any; to: any }>;
  changedBy: string;
  changedAt?: number;
}

/**
 * Records an auditable configuration change to the `configChangeLog` table.
 * Computes changedAt timestamp if not provided.
 */
export async function logConfigChange(
  ctx: MutationCtx,
  args: LogConfigChangeArgs,
) {
  const changedAt = args.changedAt ?? Date.now();
  await (ctx.db.insert as any)("configChangeLog", {
    entityType: args.entityType,
    entityId: args.entityId,
    action: args.action,
    fieldChanges: args.fieldChanges,
    changedBy: args.changedBy,
    changedAt,
  });
}

/**
 * Helper to compute diff between old record and new attributes.
 */
export function computeFieldChanges(
  oldDoc: Record<string, any> | null | undefined,
  newDoc: Record<string, any>,
  ignoredKeys: string[] = ["createdAt", "updatedAt", "createdBy", "updatedBy", "_id", "_creationTime"],
): Record<string, { from: any; to: any }> | undefined {
  if (!oldDoc) return undefined;
  const changes: Record<string, { from: any; to: any }> = {};

  const allKeys = new Set([...Object.keys(oldDoc), ...Object.keys(newDoc)]);
  for (const key of allKeys) {
    if (ignoredKeys.includes(key)) continue;
    const from = oldDoc[key];
    const to = newDoc[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[key] = { from, to };
    }
  }

  return Object.keys(changes).length > 0 ? changes : undefined;
}
