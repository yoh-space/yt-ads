import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export interface AuthorizedMachineMaterial {
  linkId: Id<"machineMaterialLinks">;
  materialId: Id<"materials">;
  machineId: Id<"machines">;
  relationshipType: string;
  productionType?: string;
  conversionRatioOverride?: number;
  wasteMarginPercent?: number;
  required: boolean;
  active: boolean;
}

/**
 * Resolves active machine-material links for a given machine and an optional set of material IDs.
 * Strictly verifies that the material is actively linked and the material record itself is active.
 */
export async function resolveMachineMaterialAuthorization(
  ctx: QueryCtx | MutationCtx,
  machineId: Id<"machines">,
  materialIds?: Id<"materials">[]
): Promise<Map<Id<"materials">, AuthorizedMachineMaterial>> {
  const machine = await ctx.db.get(machineId);
  if (!machine || !machine.active) {
    return new Map();
  }

  let links = await ctx.db
    .query("machineMaterialLinks")
    .withIndex("by_machine", (q) => q.eq("machineId", machineId))
    .collect();

  // Filter for active links within valid effective dates
  const now = Date.now();
  links = links.filter((l) => {
    if (!l.active) return false;
    if (l.effectiveFrom && l.effectiveFrom > now) return false;
    if (l.effectiveTo && l.effectiveTo < now) return false;
    if (materialIds && !materialIds.includes(l.materialId)) return false;
    return true;
  });

  const resultMap = new Map<Id<"materials">, AuthorizedMachineMaterial>();

  for (const link of links) {
    const material = await ctx.db.get(link.materialId);
    if (!material || !material.active) continue;

    resultMap.set(link.materialId, {
      linkId: link._id,
      materialId: link.materialId,
      machineId: link.machineId,
      relationshipType: link.relationshipType,
      productionType: link.productionType,
      conversionRatioOverride: link.conversionRatioOverride,
      wasteMarginPercent: link.wasteMarginPercent,
      required: link.required,
      active: link.active,
    });
  }

  return resultMap;
}

/**
 * Asserts that a material is actively authorized and linked to a machine.
 * Throws a user-friendly error if unlinked.
 */
export async function assertMachineMaterialAuthorized(
  ctx: QueryCtx | MutationCtx,
  machineId: Id<"machines">,
  materialId: Id<"materials">
): Promise<AuthorizedMachineMaterial> {
  const authMap = await resolveMachineMaterialAuthorization(ctx, machineId, [materialId]);
  const auth = authMap.get(materialId);

  if (!auth) {
    const [machine, material] = await Promise.all([
      ctx.db.get(machineId),
      ctx.db.get(materialId),
    ]);
    const machineName = machine?.name ?? "Machine";
    const materialName = material?.name ?? "Material";
    throw new Error(
      `Material "${materialName}" is not authorized/linked to machine "${machineName}". Owner must configure the link before requesting or consuming this material.`
    );
  }

  return auth;
}
