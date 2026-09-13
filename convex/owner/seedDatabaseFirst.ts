import type { MutationCtx } from "../_generated/server";
import { SERVICE_IDS, SERVICE_CATEGORIES, AMHARIC_SERVICE_LABELS } from "../../src/shared/services";
import { MATERIAL_SPECIFICATIONS } from "../../src/shared/material-specifications";
import { CANONICAL_SERVICE_ROUTES } from "../../src/shared/production-manifest";
import { SERVICE_SPECIFICATION_FIELDS } from "../../src/shared/service-specifications";
import { ROLE_PERMISSIONS } from "../../src/shared/role-permissions";
import { ROLE_HOME_ROUTE } from "../../src/lib/role-routing";
import { roleLabels } from "../../src/lib/operations-types";

const qTable = (ctx: MutationCtx, table: string): any => (ctx.db.query as any)(table);

function extractThickness(options: readonly string[] | undefined): { thickness?: number; attributes?: Record<string, string | number> } {
  const values = (options ?? [])
    .flatMap((option) => [...option.matchAll(/(\d+(?:\.\d+)?)\s*mm\b/gi)].map((match) => Number(match[1])))
    .filter((value) => Number.isFinite(value));
  const unique = [...new Set(values)];
  if (unique.length === 0) return {};
  return { thickness: unique[0], attributes: { thicknessOptions: unique.join(",") } };
}

export async function runDatabaseFirstSeed(ctx: MutationCtx) {
  const now = Date.now();
  let servicesCount = 0;
  let materialsCount = 0;
  let routesCount = 0;
  let capLinksCount = 0;
  let specFieldsCount = 0;
  let roleConfigsCount = 0;
  let permissionsCount = 0;
  let categoryGroupsCount = 0;

  // 1. Seed Service Catalog (22 canonical services)
  const categoryLookup = new Map<string, { key: string; name: string }>();
  for (const cat of SERVICE_CATEGORIES) {
    for (const item of cat.items) {
      categoryLookup.set(item.id, { key: cat.categoryId, name: cat.categoryName });
    }
  }

  for (let index = 0; index < SERVICE_IDS.length; index++) {
    const id = SERVICE_IDS[index];
    const cat = categoryLookup.get(id) ?? { key: "OTHER", name: "Other Services" };
    const labelAm = AMHARIC_SERVICE_LABELS[id] ?? id;
    
    // Find english label from category items
    let labelEn = id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    for (const c of SERVICE_CATEGORIES) {
      const found = c.items.find((i) => i.id === id);
      if (found) {
        labelEn = found.label;
        break;
      }
    }

    const existing = await qTable(ctx, "serviceCatalog")
      .withIndex("by_service_id", (q: any) => q.eq("id", id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        labelEn,
        labelAm,
        categoryKey: cat.key,
        categoryNameEn: cat.name,
        sortOrder: index + 1,
        active: true,
        publishable: true,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("serviceCatalog", {
        id,
        labelEn,
        labelAm,
        categoryKey: cat.key,
        categoryNameEn: cat.name,
        categoryNameAm: undefined,
        iconKey: undefined,
        sortOrder: index + 1,
        active: true,
        publishable: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    servicesCount++;
  }

  // 2. Seed dynamic material attributes and material specifications (Phase 2)
  const attributeDefinitions = [
    { key: "thickness", label: "Thickness (mm)", valueType: "number" as const, applicableCatalogFamily: ["RIGID_SHEET", "ROLL"] },
    { key: "color", label: "Color", valueType: "string" as const, applicableCatalogFamily: ["RIGID_SHEET", "INK_SOLVENT", "HARDWARE"] },
    { key: "wattage", label: "Wattage (W)", valueType: "number" as const, applicableCatalogFamily: ["HARDWARE"] },
    { key: "gsm", label: "Grams per square metre", valueType: "number" as const, applicableCatalogFamily: ["ROLL", "RIGID_SHEET"] },
    { key: "height_cm", label: "Height (cm)", valueType: "number" as const, applicableCatalogFamily: ["HARDWARE"] },
  ];
  for (const definition of attributeDefinitions) {
    const existing = await qTable(ctx, "materialAttributeDefinitions")
      .withIndex("by_key", (q: any) => q.eq("key", definition.key))
      .first();
    if (existing) await ctx.db.patch(existing._id, { ...definition, active: true });
    else await ctx.db.insert("materialAttributeDefinitions", { ...definition, active: true });
  }

  for (const spec of MATERIAL_SPECIFICATIONS) {
    const slug = spec.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const existing = await qTable(ctx, "materialCatalog")
      .withIndex("by_material_id", (q: any) => q.eq("id", slug))
      .first();

    const thickness = extractThickness(spec.specificationOptions);
    const payload = {
      id: slug,
      name: spec.name,
      aliases: spec.aliases ? [...spec.aliases] : undefined,
      category: spec.category,
      catalogFamily: spec.catalogFamily ?? "HARDWARE",
      baseUnit: spec.baseUnit,
      purchaseUnit: spec.purchaseUnit,
      conversionRatio: spec.conversionRatio ?? 1,
      rollWidth: spec.rollWidth,
      sheetWidth: spec.sheetWidth,
      sheetLength: spec.sheetLength,
      ...(thickness.thickness !== undefined ? { thickness: thickness.thickness } : {}),
      ...(thickness.attributes ? { attributes: thickness.attributes } : {}),
      specificationOptions: spec.specificationOptions ? [...spec.specificationOptions] : undefined,
      compatibleMachineTypes: spec.compatibleMachineTypes ? [...spec.compatibleMachineTypes] : undefined,
      storageLocation: spec.storageLocation,
      averageUse: spec.averageUse,
      catalogDimensions: spec.catalogDimensions,
      catalogVariant: spec.catalogVariant,
      active: true,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("materialCatalog", {
        ...payload,
        createdAt: now,
      });
    }
    materialsCount++;
  }

  // 3. Seed Service Routes (Phase 3)
  for (const [serviceId, route] of Object.entries(CANONICAL_SERVICE_ROUTES)) {
    const existing = await qTable(ctx, "serviceRoutes")
      .withIndex("by_service_active", (q: any) => q.eq("serviceId", serviceId).eq("active", true))
      .first();

    const payload = {
      serviceId,
      materialType: route.materialType,
      preferredMaterialName: route.preferredMaterialName,
      requiredCapabilities: [...route.requiredCapabilities],
      legacyCapabilities: [...route.legacyCapabilities],
      operatorRole: route.operatorRole,
      preferredMachineCode: route.preferredMachineCode,
      calculationUnit: route.calculationUnit,
      defaultWasteMarginPercent: route.defaultWasteMarginPercent,
      maxScrapLimitPercent: route.maxScrapLimitPercent,
      active: true,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("serviceRoutes", {
        ...payload,
        createdAt: now,
      });
    }
    routesCount++;
  }

  // 4. Seed Machine Capability Links (Phase 4)
  const CONFIRMED_MACHINE_CAPS: Array<{ machineCode: string; capabilityCode: string }> = [
    { machineCode: "CJ7K-01", capabilityCode: "PRINT_ROLL_3_2M" },
    { machineCode: "CESP-01", capabilityCode: "PRINT_ROLL_1_6M" },
    { machineCode: "RUV-01", capabilityCode: "PRINT_RIGID_UV_122_244" },
    { machineCode: "DTF-01", capabilityCode: "PRINT_ROLL_0_6M_DTF" },
    { machineCode: "LAS-01", capabilityCode: "CUT_RIGID_122_244_LASER" },
    { machineCode: "CNC-01", capabilityCode: "CUT_RIGID_2030_CNC" },
  ];

  for (const link of CONFIRMED_MACHINE_CAPS) {
    const existing = await qTable(ctx, "machineCapabilityLinks")
      .withIndex("by_machine", (q: any) => q.eq("machineCode", link.machineCode))
      .filter((q: any) => q.eq(q.field("capabilityCode"), link.capabilityCode))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { active: true, updatedAt: now });
    } else {
      await ctx.db.insert("machineCapabilityLinks", {
        machineCode: link.machineCode,
        capabilityCode: link.capabilityCode,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    capLinksCount++;
  }

  // 5. Seed Service Specifications Fields (Phase 5)
  for (const [serviceId, fields] of Object.entries(SERVICE_SPECIFICATION_FIELDS)) {
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const existing = await qTable(ctx, "serviceSpecFields")
        .withIndex("by_service", (q: any) => q.eq("serviceId", serviceId).eq("active", true))
        .filter((q: any) => q.eq(q.field("fieldKey"), field.key))
        .first();

      const payload = {
        serviceId,
        fieldKey: field.key,
        labelEn: field.label,
        labelAm: undefined,
        materialName: field.material,
        options: field.options ? [...field.options] : undefined,
        required: true,
        sortOrder: i + 1,
        active: true,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("serviceSpecFields", {
          ...payload,
          createdAt: now,
        });
      }
      specFieldsCount++;
    }
  }

  // 6. Seed Role Workspace Config & Workspace Routes (Phase 6)
  const OPERATOR_MACHINE_SLUGS: Record<string, string> = {
    crystal_jet_operator: "crystal_jet",
    crystek_operator: "crystek",
    ricoh_uv_operator: "ricoh_uv",
    dtf_operator: "dtf",
    laser_operator: "laser",
    cnc_operator: "cnc",
  };

  for (const [roleCode, homeRoute] of Object.entries(ROLE_HOME_ROUTE)) {
    const workspaceId = roleCode.endsWith("_operator") ? "operator" : roleCode;
    const machineSlug = OPERATOR_MACHINE_SLUGS[roleCode];

    const existing = await qTable(ctx, "roleWorkspaceConfig")
      .withIndex("by_role", (q: any) => q.eq("roleCode", roleCode))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        workspaceId,
        homeRoute,
        machineSlug,
        active: true,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("roleWorkspaceConfig", {
        roleCode,
        workspaceId,
        homeRoute,
        machineSlug,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    roleConfigsCount++;
  }

  // Workspace routes
  const WORKSPACE_ROUTES_DEFINITIONS = [
    {
      workspaceId: "admin",
      routePrefix: "/dashboard/admin",
      allowedRoles: ["admin"],
      label: "Admin Workspace",
      labelAm: "አድሚን ወርክስፔስ",
      sortOrder: 1,
    },
    {
      workspaceId: "owner",
      routePrefix: "/dashboard/owner",
      allowedRoles: ["owner"],
      label: "Owner Executive Suite",
      labelAm: "የባለቤት አስተዳደር",
      sortOrder: 2,
    },
    {
      workspaceId: "manager",
      routePrefix: "/dashboard/manager",
      allowedRoles: ["manager", "admin", "owner"],
      label: "Production Manager",
      labelAm: "የምርት ስራ አስኪያጅ",
      sortOrder: 3,
    },
    {
      workspaceId: "storekeeper",
      routePrefix: "/dashboard/storekeeper",
      allowedRoles: ["storekeeper", "admin", "owner"],
      label: "Store & Inventory",
      labelAm: "የዕቃ ግምጃ ቤት",
      sortOrder: 4,
    },
    {
      workspaceId: "receptionist",
      routePrefix: "/dashboard/receptionist",
      allowedRoles: ["receptionist", "admin", "owner"],
      label: "Reception & Intake",
      labelAm: "እንግዳ መቀበያ እና ትዕዛዝ",
      sortOrder: 5,
    },
    {
      workspaceId: "operator",
      routePrefix: "/dashboard/operator",
      allowedRoles: [
        "crystal_jet_operator",
        "crystek_operator",
        "ricoh_uv_operator",
        "dtf_operator",
        "laser_operator",
        "cnc_operator",
        "admin",
        "owner",
      ],
      label: "Machine Operator Workstation",
      labelAm: "የማሽን ኦፕሬተር",
      sortOrder: 6,
    },
  ];

  for (const wr of WORKSPACE_ROUTES_DEFINITIONS) {
    const existing = await qTable(ctx, "workspaceRoutes")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceId", wr.workspaceId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        routePrefix: wr.routePrefix,
        allowedRoles: wr.allowedRoles,
        label: wr.label,
        labelAm: wr.labelAm,
        sortOrder: wr.sortOrder,
        active: true,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("workspaceRoutes", {
        ...wr,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // 6b. Seed Canonical Roles Catalog (Section 8.1)
  let rolesCount = 0;
  for (const [code, meta] of Object.entries(roleLabels)) {
    const workspaceId = code.endsWith("_operator") ? "operator" : code;
    const existing = await qTable(ctx, "roles")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        labelEn: meta.en,
        labelAm: meta.am,
        workspaceId,
        active: true,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("roles", {
        code,
        labelEn: meta.en,
        labelAm: meta.am,
        workspaceId,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    rolesCount++;
  }

  // 7. Seed Role Permissions (Phase 7 - Idempotent on retry)
  for (const [roleCode, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permission of permissions) {
      const existing = await qTable(ctx, "rolePermissions")
        .withIndex("by_role", (q: any) => q.eq("roleCode", roleCode))
        .filter((q: any) => q.eq(q.field("permission"), permission))
        .first();

      if (existing) {
        if (!existing.active) {
          await ctx.db.patch(existing._id, { active: true, updatedAt: now });
        }
      } else {
        await ctx.db.insert("rolePermissions", {
          roleCode,
          permission,
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      permissionsCount++;
    }
  }

  // 8. Seed Material Category Groups (Phase 8)
  const CATEGORY_GROUPS_DEFINITIONS = [
    {
      id: "roll-substrates",
      labelEn: "Roll Substrates",
      labelAm: "የሮል እቃዎች",
      descriptionEn: "Wide-format banners, fabrics, and printing films in 30m–50m continuous rolls.",
      descriptionAm: "ሰፊ የባነር እና የጨርቅ ሮሎች",
      iconName: "ScrollText",
      tone: "cyan",
      memberCategories: ["Banner", "Fabric roll", "Film"],
      sortOrder: 1,
    },
    {
      id: "stickers-vinyl",
      labelEn: "Stickers & Vinyl",
      labelAm: "ስቲከሮች እና ቪናይል",
      descriptionEn: "Self-adhesive, frosted, reflective, mesh, and clear printing vinyl.",
      descriptionAm: "ተለጣፊ ስቲከሮች እና ቪናይሎች",
      iconName: "Tags",
      tone: "blue",
      memberCategories: ["Sticker roll"],
      sortOrder: 2,
    },
    {
      id: "rigid-sheets",
      labelEn: "Rigid Sheets & Boards",
      labelAm: "ደረቅ ሉሆች እና ቦርዶች",
      descriptionEn: "Mica/acrylic sheets, foam boards, aluminium cladding, and composite panels.",
      descriptionAm: "ሚካ፣ ፎም ቦርድ እና የአሉሚኒየም ክላዲንግ",
      iconName: "Layers",
      tone: "violet",
      memberCategories: ["Rigid sheet", "Foam board"],
      sortOrder: 3,
    },
    {
      id: "ink-solvents",
      labelEn: "Inks & Solvents",
      labelAm: "ቀለሞች እና ሶልቨንቶች",
      descriptionEn: "Banner inks, DTF textile inks, UV curing inks, and flushing solvents.",
      descriptionAm: "የማተሚያ ቀለሞች እና ሶልቨንቶች",
      iconName: "FlaskConical",
      tone: "gold",
      memberCategories: ["Ink", "Solvent"],
      sortOrder: 4,
    },
    {
      id: "signage-hardware",
      labelEn: "Signage Hardware",
      labelAm: "የማስታወቂያ እቃዎች",
      descriptionEn: "LED modules, power supplies, digital displays, and installation brackets.",
      descriptionAm: "ኤልኢዲ፣ ፓወር ሰፕላይ እና ዲጂታል ስክሪኖች",
      iconName: "Cable",
      tone: "green",
      memberCategories: ["Hardware", "Electrical", "Display hardware"],
      sortOrder: 5,
    },
    {
      id: "apparel-textile",
      labelEn: "Apparel & Finished Goods",
      labelAm: "አልባሳት እና ያለቁ እቃዎች",
      descriptionEn: "T-shirts, caps, fabrics, and ready-to-deliver merchandise.",
      descriptionAm: "ቲሸርቶች እና የተዘጋጁ አልባሳት",
      iconName: "Boxes",
      tone: "slate",
      memberCategories: ["Textile & Apparel", "Finished component"],
      sortOrder: 6,
    },
  ];

  for (const group of CATEGORY_GROUPS_DEFINITIONS) {
    const existing = await qTable(ctx, "materialCategoryGroups")
      .withIndex("by_active", (q: any) => q.eq("active", true).eq("sortOrder", group.sortOrder))
      .filter((q: any) => q.eq(q.field("id"), group.id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        labelEn: group.labelEn,
        labelAm: group.labelAm,
        descriptionEn: group.descriptionEn,
        descriptionAm: group.descriptionAm,
        iconName: group.iconName,
        tone: group.tone,
        memberCategories: group.memberCategories,
        sortOrder: group.sortOrder,
        active: true,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("materialCategoryGroups", {
        ...group,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    categoryGroupsCount++;
  }

  return {
    status: "SUCCESS",
    servicesCount,
    materialsCount,
    routesCount,
    capLinksCount,
    specFieldsCount,
    roleConfigsCount,
    rolesCount,
    permissionsCount,
    categoryGroupsCount,
    seededAt: now,
  };
}

// ─── Drift Check Utilities ──────────────────────────────────────────────────

export async function assertServiceCatalogSync(ctx: MutationCtx): Promise<string[]> {
  const dbServices: any[] = await qTable(ctx, "serviceCatalog")
    .withIndex("by_active", (q: any) => q.eq("active", true))
    .collect();

  const dbIds = new Set(dbServices.map((s) => s.id));
  const missing = SERVICE_IDS.filter((id) => !dbIds.has(id));
  if (missing.length > 0) {
    throw new Error(
      `ServiceCatalog drift detected: Database is missing active canonical services: ${missing.join(", ")}. Run seedDatabaseFirstCatalogs() to synchronize.`,
    );
  }
  return Array.from(dbIds);
}

export async function assertRoleCatalogSync(ctx: MutationCtx): Promise<string[]> {
  const configs: any[] = await qTable(ctx, "roleWorkspaceConfig").collect();
  const configuredRoles = new Set(configs.filter((c: any) => c.active).map((c: any) => c.roleCode));
  const expectedRoles = Object.keys(ROLE_HOME_ROUTE);
  const missing = expectedRoles.filter((r) => !configuredRoles.has(r));
  if (missing.length > 0) {
    throw new Error(
      `RoleCatalog drift detected: Missing active role configs for: ${missing.join(", ")}. Run seedDatabaseFirstCatalogs() to synchronize.`,
    );
  }
  return Array.from(configuredRoles);
}
