import type { QueryCtx } from "../_generated/server";
import { OPERATOR_ROLES, requireOperator } from "../users";
import type { Role } from "../types";

export { OPERATOR_ROLES };

/**
 * Minimal machine shape the operator namespace works with. Machine documents
 * conform to this structurally, so callers can pass collected `machines` rows.
 */
export interface OperatorMachine {
  _id: string;
  name: string;
  code: string;
  type: string;
  operatorRole: Role;
  status: string;
  materialUnit: string;
  activeJob?: string;
  active: boolean;
}

/** Returns true when the role is one of the four production operator roles. */
export function isOperatorRole(role: Role): boolean {
  return OPERATOR_ROLES.includes(role);
}

/**
 * Pure machine-scoping rule shared by every operator handler. A machine matches
 * the URL slug by either type or code, the caller's operator role must equal
 * the machine's `operatorRole` (the same contract `canAccessMachine` enforces),
 * and — when the profile carries an explicit `assignedMachineIds` scope — the
 * machine must be within that per-user assignment. Throws so handlers fail
 * closed when an operator tries to scope to a machine they are not assigned to.
 */
export function resolveMachineForRole(
  machines: ReadonlyArray<OperatorMachine>,
  machineSlug: string,
  role: Role,
  assignedMachineIds?: ReadonlyArray<string>,
): OperatorMachine {
  const trimmed = machineSlug.trim();
  const normalized = trimmed.toLowerCase();

  // 1. Exact database machineId match
  let machine = machines.find((entry) => entry._id === trimmed);

  // 2. Exact canonical machine code match (case-insensitive)
  if (!machine) {
    machine = machines.find((entry) => entry.code.toLowerCase() === normalized);
  }

  // 3. Legacy slug substring compatibility with ambiguity rejection
  if (!machine) {
    const matches = machines.filter(
      (entry) =>
        entry.code.toLowerCase().includes(normalized) ||
        entry.type.toLowerCase().includes(normalized),
    );
    if (matches.length > 1) {
      throw new Error(`AMBIGUOUS_MACHINE_SCOPE: Multiple machines match the slug "${machineSlug}".`);
    }
    machine = matches[0];
  }

  if (!machine) throw new Error("Machine not found.");
  if (machine.operatorRole !== role) {
    throw new Error("This machine is not assigned to your operator role.");
  }
  if (assignedMachineIds?.length && !assignedMachineIds.includes(machine._id)) {
    throw new Error("This machine is outside your assigned machine scope.");
  }
  return machine;
}

type OperatorScope = Awaited<ReturnType<typeof requireOperator>> & { machine: OperatorMachine };

/**
 * Operator namespace scope guard: requires one of the production operator roles
 * and resolves the `machineSlug` from the operator's own role and per-user
 * machine assignment. All operator queries and mutations go through this so
 * reads are machine-scoped, never broad queries filtered client-side.
 */
export async function resolveOperatorMachine(ctx: QueryCtx, machineSlug: string): Promise<OperatorScope> {
  const { identity, profile } = await requireOperator(ctx);
  const machines = await ctx.db.query("machines").collect();
  const machine = resolveMachineForRole(machines, machineSlug, profile.role, profile.assignedMachineIds);
  return { identity, profile, machine };
}

/**
 * Shared floor-stock enrichment for this operator's machine, mirroring the
 * generic `inventory.listOperatorMachineStock` shape so existing widgets keep
 * working unchanged. Only batches raised for this machine (by the operator's
 * own custody or role) are included.
 */
export async function collectFloorStock(ctx: QueryCtx, machine: OperatorMachine, identity: { _id: string }, role: Role) {
  const [batches, materials, users] = await Promise.all([
    ctx.db.query("operatorSubStock").collect(),
    ctx.db.query("materials").collect(),
    ctx.db.query("users").collect(),
  ]);
  const materialById = new Map(materials.map((material) => [material._id, material]));
  const userNames = new Map(users.map((user) => [user.authUserId, user.name]));
  return batches
    .filter(
      (batch) =>
        batch.machineId === machine._id &&
        (batch.operatorId === identity._id || batch.operatorId === role)
    )
    .sort((left, right) => right.issuedAt - left.issuedAt)
    .map((batch) => {
      const material = materialById.get(batch.materialId);
      const baseUnit = material?.baseUnit ?? material?.unit ?? "m²";
      return {
        ...batch,
        _id: batch._id,
        materialName: material?.name ?? "Unknown material",
        machineName: machine.name,
        operatorName: userNames.get(batch.operatorId) ?? "Assigned operator",
        baseUnit,
        materialFamily:
          material?.materialFamily ??
          (material?.category === "Ink" ? "INK" : material?.isSolvent ? "SOLVENT" : "RAW_MATERIAL"),
        inkColor: material?.inkColor,
        isSolvent: material?.isSolvent ?? false,
        reorderAt: material?.reorderAt,
        conversionRatio: material?.conversionRatio,
        lowStockThreshold:
          material?.reorderAt !== undefined
            ? material?.conversionRatio
              ? material.reorderAt / material.conversionRatio
              : material.reorderAt
            : undefined,
        consumed: Number((batch.issuedQuantity - batch.currentRemaining).toFixed(3)),
        usagePercent:
          batch.issuedQuantity > 0
            ? Math.round(((batch.issuedQuantity - batch.currentRemaining) / batch.issuedQuantity) * 100)
            : 0,
      };
    });
}