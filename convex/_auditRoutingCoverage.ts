import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { resolveServiceRoute } from "./bomResolver";
import { resolveAutoRouting } from "./orders";
import { compatibleMachines } from "./orderAutomation";
import { CANONICAL_SERVICE_ROUTES } from "../src/shared/production-manifest";

/**
 * ⚠️ TEMPORARY READ-ONLY AUDIT — DELETE THIS FILE AFTER THE COVERAGE REPORT IS
 * REVIEWED. It is an `internalQuery`, so it is NOT exposed to any client — it
 * can only be invoked from the Convex dashboard function runner or
 * `npx convex run` (function id: `_auditRoutingCoverage/auditRoutingCoverage`).
 *
 * Purpose: for every service route that the job-card auto-router can resolve
 * (a `materialTypeCatalog` DB row, falling back to the static canonical
 * catalog), run the EXACT same resolution `resolveAutoRouting` performs and
 * report which routes currently have:
 *   - no active `materials` row matching by_name(preferredMaterialName) OR
 *     by_category(materialType) (the union resolveAutoRouting builds), and
 *   - no compatible machine (compatibleMachines() returns an empty list).
 *
 * It never writes, patches, inserts, or deletes anything.
 */
export const auditRoutingCoverage = internalQuery({
  args: {
    /** Optional: echo which route (if any) a specific order would hit. */
    orderId: v.optional(v.id("customerOrders")),
  },
  handler: async (ctx, args) => {
    const machines = await ctx.db.query("machines").collect();
    const allMaterials = await ctx.db.query("materials").collect();
    const catalogRows = await ctx.db.query("materialTypeCatalog").collect();
    const dbServiceTypes = new Set(catalogRows.map((row) => row.serviceType as string));

    const serviceTypes = Array.from(
      new Set<string>([
        ...catalogRows.map((row) => row.serviceType as string),
        ...Object.keys(CANONICAL_SERVICE_ROUTES),
      ]),
    ).sort();

    type Problem =
      | "ok"
      | "no_route"
      | "no_active_material"
      | "no_compatible_machine"
      | "unexpected_error";

    type ReportRow = {
      serviceType: string;
      routeSource: "materialTypeCatalog_row" | "static_catalog" | "none";
      materialType?: string;
      preferredMaterialName?: string;
      operatorRole?: string;
      routingStatus: Problem;
      routingError?: string;
      activeMaterialByName: number;
      inactiveMaterialByName: number;
      activeMaterialByCategory: number;
      inactiveMaterialByCategory: number;
      compatibleMachineCount: number;
      totalMachines: number;
    };

    const rows: ReportRow[] = [];

    for (const serviceType of serviceTypes) {
      const route = await resolveServiceRoute(ctx, serviceType as never);

      const row: ReportRow = {
        serviceType,
        routeSource: dbServiceTypes.has(serviceType) ? "materialTypeCatalog_row" : "static_catalog",
        materialType: route?.materialType,
        preferredMaterialName: route?.preferredMaterialName,
        operatorRole: route?.operatorRole,
        routingStatus: "ok",
        activeMaterialByName: 0,
        inactiveMaterialByName: 0,
        activeMaterialByCategory: 0,
        inactiveMaterialByCategory: 0,
        compatibleMachineCount: 0,
        totalMachines: machines.length,
      };

      if (!route) {
        // Mirrors resolveAutoRouting's guard message verbatim.
        row.routingStatus = "no_route";
        row.routingError = `No production routing is defined for the ${serviceType} service.`;
      } else {
        row.activeMaterialByName = allMaterials.filter(
          (material) => material.name === route.preferredMaterialName && material.active,
        ).length;
        row.inactiveMaterialByName = allMaterials.filter(
          (material) => material.name === route.preferredMaterialName && !material.active,
        ).length;
        row.activeMaterialByCategory = allMaterials.filter(
          (material) => material.category === route.materialType && material.active,
        ).length;
        row.inactiveMaterialByCategory = allMaterials.filter(
          (material) => material.category === route.materialType && !material.active,
        ).length;
        row.compatibleMachineCount = compatibleMachines(route, machines as any).length;

        // Run the real auto-router with a neutral probe order so the audit can
        // never disagree with production routing (same throw sites, same order
        // of checks: route → material → machine).
        try {
          await resolveAutoRouting(
            ctx,
            {
              serviceType,
              quantity: "1",
              length: 1,
              width: 1,
            } as any,
            {},
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          row.routingError = message;
          if (message.includes("No production routing is defined")) {
            row.routingStatus = "no_route";
          } else if (message.includes("No active raw material is registered")) {
            row.routingStatus = "no_active_material";
          } else if (message.includes("No available machine can produce")) {
            row.routingStatus = "no_compatible_machine";
          } else {
            row.routingStatus = "unexpected_error";
          }
        }
      }

      rows.push(row);
    }

    const withProblems = rows.filter((r) => r.routingStatus !== "ok");
    const summary = {
      totalRoutes: rows.length,
      okCount: rows.length - withProblems.length,
      problemCount: withProblems.length,
      byStatus: Object.fromEntries(
        [...new Set(withProblems.map((r) => r.routingStatus))].map((status) => [
          status,
          withProblems.filter((r) => r.routingStatus === status).map((r) => r.serviceType),
        ]),
      ),
    };

    let orderCrossReference: any = null;
    if (args.orderId) {
      const order = await ctx.db.get(args.orderId);
      if (!order) {
        orderCrossReference = { orderId: args.orderId, error: "Order not found." };
      } else {
        const row = rows.find((r) => r.serviceType === order.serviceType);
        orderCrossReference = {
          orderId: args.orderId,
          code: order.code,
          serviceType: order.serviceType,
          routingStatus: row?.routingStatus ?? "no_route",
          routingError: row?.routingError,
          compatibleMachineCount: row?.compatibleMachineCount ?? 0,
        };
      }
    }

    return {
      generatedAt: Date.now(),
      note: "READ-ONLY audit. Review the report before touching any service route or material.",
      summary,
      orderCrossReference,
      rows,
    };
  },
});