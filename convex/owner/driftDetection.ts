import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { requireOwner, requirePermission } from "../users";
import { logConfigChange } from "./configAudit";
import {
  deriveSlug,
  normalizeBaseUnit,
  normalizeCatalogFamily,
  normalizePurchaseUnit,
  normalizeText,
} from "../utils/normalizer";

const qTable = (ctx: QueryCtx | MutationCtx, table: string): any => (ctx.db.query as any)(table);

export interface DriftIssue {
  id: string;
  table: string;
  entityName: string;
  field: string;
  currentValue: any;
  suggestedValue: any;
  reason: string;
  fixable: boolean;
}

/**
 * Scans database tables for values that predate normalization, dangling references,
 * or discrepancies with canonical models (Stage 5 of Owner Authority architecture).
 */
export const detectConfigDrift = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "audit.view");
    const issues: DriftIssue[] = [];

    const [materials, services, routes, roles, machines] = await Promise.all([
      qTable(ctx, "materialCatalog").collect(),
      qTable(ctx, "serviceCatalog").collect(),
      qTable(ctx, "serviceRoutes").collect(),
      qTable(ctx, "roles").collect(),
      qTable(ctx, "machines").collect(),
    ]);

    const serviceIdSet = new Set(services.map((s: any) => s.id));
    const machineCodeSet = new Set(machines.map((m: any) => m.code));
    const materialIdSet = new Set(materials.map((m: any) => m.id));
    const materialNameSet = new Set(
      materials.flatMap((m: any) => [
        normalizeText(m.name).toLowerCase(),
        ...(m.aliases ?? []).map((a: string) => normalizeText(a).toLowerCase()),
      ]),
    );

    // 1. Scan materials catalog for unit or family drift
    for (const mat of materials) {
      try {
        const canonicalFamily = normalizeCatalogFamily(mat.catalogFamily);
        if (canonicalFamily !== mat.catalogFamily) {
          issues.push({
            id: mat._id,
            table: "materialCatalog",
            entityName: mat.name,
            field: "catalogFamily",
            currentValue: mat.catalogFamily,
            suggestedValue: canonicalFamily,
            reason: `Non-canonical catalog family representation '${mat.catalogFamily}'`,
            fixable: true,
          });
        }
      } catch (e) {
        issues.push({
          id: mat._id,
          table: "materialCatalog",
          entityName: mat.name,
          field: "catalogFamily",
          currentValue: mat.catalogFamily,
          suggestedValue: "HARDWARE",
          reason: `Invalid catalog family '${mat.catalogFamily}'`,
          fixable: true,
        });
      }

      try {
        const canonicalBaseUnit = normalizeBaseUnit(mat.baseUnit);
        if (canonicalBaseUnit !== mat.baseUnit) {
          issues.push({
            id: mat._id,
            table: "materialCatalog",
            entityName: mat.name,
            field: "baseUnit",
            currentValue: mat.baseUnit,
            suggestedValue: canonicalBaseUnit,
            reason: `Non-canonical base unit '${mat.baseUnit}'`,
            fixable: true,
          });
        }
      } catch (e) {
        // Unknown base unit
      }

      try {
        const canonicalPurchaseUnit = normalizePurchaseUnit(mat.purchaseUnit);
        if (canonicalPurchaseUnit !== mat.purchaseUnit) {
          issues.push({
            id: mat._id,
            table: "materialCatalog",
            entityName: mat.name,
            field: "purchaseUnit",
            currentValue: mat.purchaseUnit,
            suggestedValue: canonicalPurchaseUnit,
            reason: `Non-canonical purchase unit '${mat.purchaseUnit}'`,
            fixable: true,
          });
        }
      } catch (e) {
        // Unknown purchase unit
      }
    }

    // 2. Scan service routes for dangling references
    for (const route of routes) {
      if (!serviceIdSet.has(route.serviceId)) {
        issues.push({
          id: route._id,
          table: "serviceRoutes",
          entityName: `Route ${route.serviceId}`,
          field: "serviceId",
          currentValue: route.serviceId,
          suggestedValue: null,
          reason: `Service route references uncatalogued service '${route.serviceId}'`,
          fixable: false,
        });
      }

      if (route.preferredMachineCode && !machineCodeSet.has(route.preferredMachineCode)) {
        issues.push({
          id: route._id,
          table: "serviceRoutes",
          entityName: `Route ${route.serviceId}`,
          field: "preferredMachineCode",
          currentValue: route.preferredMachineCode,
          suggestedValue: null,
          reason: `Preferred machine code '${route.preferredMachineCode}' is not in machines table`,
          fixable: false,
        });
      }

      if (route.preferredMaterialName) {
        const normalizedRef = normalizeText(route.preferredMaterialName).toLowerCase();
        if (!materialNameSet.has(normalizedRef) && !materialIdSet.has(route.preferredMaterialName)) {
          issues.push({
            id: route._id,
            table: "serviceRoutes",
            entityName: `Route ${route.serviceId}`,
            field: "preferredMaterialName",
            currentValue: route.preferredMaterialName,
            suggestedValue: null,
            reason: `Preferred material '${route.preferredMaterialName}' not found in materialCatalog`,
            fixable: false,
          });
        }
      }
    }

    return {
      clean: issues.length === 0,
      totalIssues: issues.length,
      scannedAt: Date.now(),
      issues,
    };
  },
});

/**
 * Non-destructive one-click migration path to resolve fixable drift items (Stage 5).
 */
export const reconcileConfigDrift = mutation({
  args: {
    issueIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireOwner(ctx);
    const now = Date.now();
    let reconciledCount = 0;

    const materials = await qTable(ctx, "materialCatalog").collect();
    for (const mat of materials) {
      if (args.issueIds && !args.issueIds.includes(mat._id)) continue;

      let needsPatch = false;
      const patch: Record<string, any> = {};

      try {
        const canonicalFamily = normalizeCatalogFamily(mat.catalogFamily);
        if (canonicalFamily !== mat.catalogFamily) {
          patch.catalogFamily = canonicalFamily;
          needsPatch = true;
        }
      } catch (e) {}

      try {
        const canonicalBaseUnit = normalizeBaseUnit(mat.baseUnit);
        if (canonicalBaseUnit !== mat.baseUnit) {
          patch.baseUnit = canonicalBaseUnit;
          needsPatch = true;
        }
      } catch (e) {}

      try {
        const canonicalPurchaseUnit = normalizePurchaseUnit(mat.purchaseUnit);
        if (canonicalPurchaseUnit !== mat.purchaseUnit) {
          patch.purchaseUnit = canonicalPurchaseUnit;
          needsPatch = true;
        }
      } catch (e) {}

      if (needsPatch) {
        patch.updatedAt = now;
        await ctx.db.patch(mat._id, patch);
        await logConfigChange(ctx, {
          entityType: "material",
          entityId: mat.id,
          action: "update",
          fieldChanges: Object.fromEntries(
            Object.keys(patch).filter((k) => k !== "updatedAt").map((k) => [k, { from: mat[k], to: patch[k] }]),
          ),
          changedBy: profile._id,
          changedAt: now,
        });
        reconciledCount++;
      }
    }

    return {
      status: "SUCCESS",
      reconciledCount,
      reconciledAt: now,
    };
  },
});
