import type { QueryCtx } from "./_generated/server";
import { resolveRouteForService, type MaterialTypeRoute } from "./orderAutomation";

/** Reads the active database routing row, with the versioned catalog as a bootstrap fallback. */
export async function resolveServiceRoute(ctx: QueryCtx, serviceType: string): Promise<MaterialTypeRoute | undefined> {
  const row = await ctx.db
    .query("materialTypeCatalog")
    .withIndex("by_service_active", (q) => q.eq("serviceType", serviceType as never).eq("active", true))
    .first();
  if (row) {
    return {
      serviceType: row.serviceType,
      materialType: row.materialType,
      preferredMaterialName: row.preferredMaterialName,
      machineCapabilities: row.machineCapabilities,
      operatorRole: row.operatorRole,
    };
  }
  return resolveRouteForService(serviceType);
}

/** Loads the active composite BOM used for job-card requirement snapshots. */
export async function loadActiveBomForService(ctx: QueryCtx, serviceType: string) {
  return ctx.db
    .query("serviceBOM")
    .withIndex("by_active_service", (q) => q.eq("active", true).eq("serviceType", serviceType as never))
    .collect();
}
