"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CheckboxGroupField } from "@/components/dashboard/modals/catalog-select";
import {
  Database,
  RefreshCw,
  Sparkles,
  Layers,
  Wrench,
  Route,
  ShieldCheck,
  FolderTree,
  Search,
  Eye,
  EyeOff,
  Sliders,
  Edit3,
  PlusCircle,
  History,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ShieldAlert,
  HelpCircle,
  Trash2,
} from "lucide-react";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { Button } from "@/components/shared/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/shared/ui/tabs";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { SlidePanel } from "@/components/dashboard/modals/slide-panel";
import { toast } from "sonner";

const SERVICE_CATEGORIES = [
  { key: "PRINTING", nameEn: "Printing & Stickers" },
  { key: "FABRICATION_SIGNAGE", nameEn: "Fabrication & Signage" },
  { key: "DISPLAY_ACCESSORIES", nameEn: "Displays & Accessories" },
  { key: "GARMENT_PRINTING", nameEn: "Garment & Promotional" },
  { key: "SPECIALTY_FINISHING", nameEn: "Specialty & Finishing" },
];

const CATALOG_FAMILIES = [
  "ROLL",
  "RIGID_SHEET",
  "INK_SOLVENT",
  "HARDWARE",
  "ILLUMINATED_DISPLAY_SYSTEM",
  "SIGNAGE_FRAME_PROFILE",
] as const;
const BASE_UNITS = ["m²", "m", "sheet", "piece", "pcs", "L", "mL"] as const;
const PURCHASE_UNITS = [
  "roll",
  "sheet",
  "liter",
  "piece",
  "canister",
  "box",
  "pack",
] as const;
const GROUP_TONES = [
  "cyan",
  "blue",
  "violet",
  "gold",
  "green",
  "slate",
] as const;
const GROUP_ICONS = [
  "ScrollText",
  "Tags",
  "Layers",
  "FlaskConical",
  "Cable",
  "Boxes",
  "Wrench",
  "Sliders",
  "ShieldCheck",
  "FolderTree",
] as const;

const PERMISSION_GROUPS: Record<
  string,
  { label: string; permissions: string[] }
> = {
  jobs: {
    label: "Job Management",
    permissions: [
      "job.view",
      "job.create",
      "job.complete",
      "job.record_production",
    ],
  },
  materials: {
    label: "Materials & Store",
    permissions: [
      "material.view",
      "material.create",
      "material.edit",
      "material.delete",
      "stock.record",
      "stock.exception",
      "offcut.view",
      "offcut.create",
      "scrap.view",
      "scrap.create",
      "request.view",
      "request.create",
      "request.issue",
      "request.acknowledge",
    ],
  },
  machines: {
    label: "Machines",
    permissions: [
      "machine.view",
      "machine.create",
      "machine.update",
      "machine.delete",
    ],
  },
  orders: {
    label: "Orders & Front Desk",
    permissions: ["order.view", "order.create", "order.manage"],
  },
  admin: {
    label: "Admin & Governance",
    permissions: [
      "dashboard.view",
      "team.view",
      "team.manage",
      "company_settings.update",
      "reports.view",
      "audit.view",
    ],
  },
  reconciliation: {
    label: "Reconciliation",
    permissions: [
      "reconciliation.record",
      "reconciliation.review",
      "reconciliation.operator",
      "reconciliation.clearance",
    ],
  },
};

interface ServiceRecord {
  id: string;
  labelEn: string;
  labelAm: string;
  categoryKey: string;
  categoryNameEn: string;
  categoryNameAm?: string;
  iconKey?: string;
  sortOrder: number;
  active: boolean;
  publishable: boolean;
  attributes?: Record<string, string | number>;
  updatedAt?: number;
}

interface MaterialRecord {
  id: string;
  name: string;
  aliases?: string[];
  category: string;
  catalogFamily: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionRatio: number;
  rollWidth?: number;
  sheetWidth?: number;
  sheetLength?: number;
  thickness?: number;
  attributes?: Record<string, string | number>;
  specificationOptions?: string[];
  compatibleMachineTypes?: string[];
  storageLocation?: string;
  averageUse?: string;
  catalogDimensions?: string;
  catalogVariant?: string;
  inkColor?: string;
  active: boolean;
  updatedAt?: number;
}

interface RouteRecord {
  serviceId: string;
  materialType: string;
  preferredMaterialName: string;
  requiredCapabilities: string[];
  legacyCapabilities: string[];
  operatorRole: string;
  preferredMachineCode: string;
  calculationUnit: string;
  defaultWasteMarginPercent: number;
  maxScrapLimitPercent: number;
  active: boolean;
  updatedAt?: number;
}

interface RoleRecord {
  code: string;
  labelEn: string;
  labelAm: string;
  workspaceId: string;
  active: boolean;
  attributes?: Record<string, string | number>;
  updatedAt?: number;
}

interface RoleConfigRecord {
  roleCode: string;
  workspaceId: string;
  homeRoute: string;
  machineSlug?: string;
  active: boolean;
  updatedAt?: number;
}

interface PermissionRecord {
  roleCode: string;
  permission: string;
  active: boolean;
}

interface CategoryGroupRecord {
  id: string;
  labelEn: string;
  labelAm: string;
  descriptionEn?: string;
  descriptionAm?: string;
  iconName: string;
  tone: string;
  memberCategories: string[];
  sortOrder: number;
  active: boolean;
  updatedAt?: number;
}

interface MachineRecord {
  _id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  active: boolean;
}

export function DatabaseCatalogSuite() {
  const seedConfirmedMaterial = useMutation(api.owner.seedConfirmedMaterials.seedConfirmedMaterials)
  const seedMachines = useMutation(api.owner.seedMachines.seedMachines);
  const syncStatus = useQuery(api.catalog.getDatabaseFirstSyncStatus, {});
  const services = useQuery(api.catalog.listServices, {
    includeInactive: true,
  });
  const materials = useQuery(api.catalog.listMaterialsCatalog, {
    includeInactive: true,
  });
  const routes = useQuery(api.catalog.listServiceRoutes, {
    includeInactive: true,
  });
  const roles = useQuery(api.catalog.listRoles, { includeInactive: true });
  const roleConfigs = useQuery(api.catalog.listRoleWorkspaceConfigs, {});
  const workspaceRoutes = useQuery(api.catalog.listWorkspaceRoutes, {});
  const permissions = useQuery(api.catalog.listRolePermissions, {});
  const categoryGroups = useQuery(api.catalog.listMaterialCategoryGroups, {
    includeInactive: true,
  });
  const machines = useQuery(api.machines.list, {});
  const capabilities = useQuery(api.catalog.listCapabilities, {
    includeInactive: false,
  });
  const changeLogs = useQuery(api.catalog.listConfigChangeLog, { limit: 40 });
  const driftReport = useQuery(api.catalog.detectConfigDrift, {});

  const seedCatalogs = useMutation(api.catalog.seedDatabaseFirstCatalogs);
  const toggleService = useMutation(api.catalog.toggleServiceActive);
  const toggleMaterial = useMutation(api.catalog.toggleMaterialCatalogActive);
  const toggleRoleActive = useMutation(api.catalog.toggleRoleActive);
  const toggleRolePermissionMutation = useMutation(
    api.catalog.toggleRolePermission
  );
  const upsertServiceRoute = useMutation(api.catalog.upsertServiceRoute);
  const upsertServiceMutation = useMutation(api.catalog.upsertService);
  const upsertMaterialMutation = useMutation(
    api.catalog.upsertMaterialCatalogItem
  );
  const upsertRoleMutation = useMutation(api.catalog.upsertRole);
  const upsertGroupMutation = useMutation(
    api.catalog.upsertMaterialCategoryGroup
  );
  const reconcileDriftMutation = useMutation(api.catalog.reconcileConfigDrift);
  const upsertServiceMachineOptionsMutation = useMutation(
    api.owner.serviceMachineOptions.upsertServiceMachineOptions
  );

  const [isSyncing, setIsSyncing] = useState(false);
  const [isSeedingMaterials, setIsSeedingMaterials] = useState(false);
  const [isSeedingMachines, setIsSeedingMachines] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Slide panel state
  const [editingService, setEditingService] = useState<ServiceRecord | null>(
    null
  );
  const [editingMaterial, setEditingMaterial] = useState<MaterialRecord | null>(
    null
  );
  const [editingRoute, setEditingRoute] = useState<RouteRecord | null>(null);
  const [routeMachineCodes, setRouteMachineCodes] = useState<string[]>([]);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [editingGroup, setEditingGroup] = useState<CategoryGroupRecord | null>(
    null
  );

  const configuredRouteMachines = useQuery(
    api.owner.serviceMachineOptions.listServiceMachineOptions,
    editingRoute?.serviceId ? { serviceId: editingRoute.serviceId } : "skip"
  );

  function openEditRoute(rt: RouteRecord) {
    setEditingRoute({ ...rt });
    setRouteMachineCodes(
      rt.preferredMachineCode ? [rt.preferredMachineCode] : []
    );
  }

  useEffect(() => {
    if (configuredRouteMachines && configuredRouteMachines.length > 0) {
      setRouteMachineCodes(configuredRouteMachines.map((o) => o.machineCode));
    }
  }, [configuredRouteMachines]);

  // Dynamic checklist options derived from authoritative DB tables
  const machineTypeOptions = useMemo(() => {
    const types = new Set<string>();
    for (const m of (machines as MachineRecord[] | undefined) ?? []) {
      if (m.type) types.add(m.type);
    }
    if (types.size === 0) {
      [
        "Large Format Solvent Printer",
        "Eco-Solvent Printer & Cutter",
        "UV Flatbed Printer",
        "DTF Printer",
        "CO2 Laser Cutter",
        "Heavy Duty CNC Router",
      ].forEach((t) => types.add(t));
    }
    return Array.from(types).map((t) => ({ value: t, label: t }));
  }, [machines]);

  const capabilityOptions = useMemo(() => {
    return ((capabilities as any[]) ?? []).map((c) => ({
      value: c.code,
      label: c.name || c.code,
      description: c.description,
    }));
  }, [capabilities]);

  const categoryOptions = useMemo(() => {
    const cats = new Set<string>();
    for (const m of (materials as MaterialRecord[] | undefined) ?? []) {
      if (m.category) cats.add(m.category);
    }
    return Array.from(cats).map((c) => ({ value: c, label: c }));
  }, [materials]);

  const fleetMachineOptions = useMemo(() => {
    return ((machines as MachineRecord[] | undefined) ?? []).map((m) => ({
      value: m.code,
      label: `${m.name} (${m.code})`,
      description: `${m.type} · ${m.status}`,
    }));
  }, [machines]);

  const [materialPrice, setMaterialPrice] = useState<number | "">("");
  const [materialCurrency, setMaterialCurrency] = useState<string>("ETB");
  const [reorderLevel, setReorderLevel] = useState<number | "">("");
  const upsertPriceEstimateMutation = useMutation(
    (api.owner.databaseFirstCatalogs as any).upsertPriceEstimate ??
      api.owner.databaseFirstCatalogs.seedDatabaseFirstCatalogs
  );

  function openEditMaterial(mat: MaterialRecord) {
    setEditingMaterial({ ...mat });
    setMaterialPrice(
      typeof mat.attributes?.estimatedUnitPrice === "number"
        ? mat.attributes.estimatedUnitPrice
        : ""
    );
    setMaterialCurrency(
      typeof mat.attributes?.priceCurrency === "string"
        ? mat.attributes.priceCurrency
        : "ETB"
    );
    setReorderLevel(
      typeof mat.attributes?.reorderLevel === "number"
        ? mat.attributes.reorderLevel
        : ""
    );
  }

  // Elevated permission modal state (Section 7.2)
  const [pendingPermissionToggle, setPendingPermissionToggle] = useState<{
    roleCode: string;
    permission: string;
    granting: boolean;
  } | null>(null);

  // Filtered lists
  const filteredServices = useMemo<ServiceRecord[]>(() => {
    if (!services) return [];
    const list = services as ServiceRecord[];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      s =>
        s.id.toLowerCase().includes(q) ||
        s.labelEn.toLowerCase().includes(q) ||
        s.labelAm.toLowerCase().includes(q) ||
        s.categoryNameEn.toLowerCase().includes(q)
    );
  }, [services, searchQuery]);

  const filteredMaterials = useMemo<MaterialRecord[]>(() => {
    if (!materials) return [];
    const list = materials as MaterialRecord[];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      m =>
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.catalogFamily.toLowerCase().includes(q) ||
        (m.aliases ?? []).some(a => a.toLowerCase().includes(q))
    );
  }, [materials, searchQuery]);

  const filteredRoutes = useMemo<RouteRecord[]>(() => {
    if (!routes) return [];
    const list = routes as RouteRecord[];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      r =>
        r.serviceId.toLowerCase().includes(q) ||
        r.preferredMachineCode.toLowerCase().includes(q) ||
        r.preferredMaterialName.toLowerCase().includes(q) ||
        r.operatorRole.toLowerCase().includes(q)
    );
  }, [routes, searchQuery]);

  const distinctMaterialCategories = useMemo<string[]>(() => {
    if (!materials) return [];
    const set = new Set(
      (materials as MaterialRecord[]).map(m => m.category).filter(Boolean)
    );
    return Array.from(set).sort();
  }, [materials]);
  async function seedMaterial() {
    setIsSeedingMaterials(true);
    try {
      const res = await seedConfirmedMaterial({});
      toast.success(
        `Raw materials seeded successfully: ${res.materials ?? 0} operational records, ${res.catalogItems ?? 0} catalog specs.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to seed raw materials");
    } finally {
      setIsSeedingMaterials(false);
    }
  }
  async function seedMachine() {
    setIsSeedingMachines(true);
    try {
      const res = await seedMachines({});
      toast.success(
        `Machines seeded successfully: ${res.machines ?? 0} machines, ${res.capabilities ?? 0} capabilities.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to seed machines");
    } finally {
      setIsSeedingMachines(false);
    }
  }
  async function handleSyncAll() {
    setIsSyncing(true);
    try {
      const res = await seedCatalogs({});
      toast.success(
        `Catalogs synchronized: ${res.servicesCount} services, ${res.materialsCount} materials, ${res.rolesCount ?? 0} roles.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sync catalogs");
    } finally {
      setIsSyncing(false);
    }
  }
  async function handleReconcileDrift() {
    setIsReconciling(true);
    try {
      const res = await reconcileDriftMutation({});
      toast.success(`Reconciled ${res.reconciledCount} non-canonical records.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reconcile drift");
    } finally {
      setIsReconciling(false);
    }
  }

  function handleConflictError(e: unknown, fallback: string) {
    const msg = e instanceof Error ? e.message : fallback;
    if (msg.includes("CONFIG_CONFLICT") || msg.includes("MATERIAL_CONFLICT")) {
      toast.error(
        "Conflict detected: This record changed since you opened it. Reload to review the latest changes."
      );
    } else {
      toast.error(msg);
    }
  }

  function parseAttributes(raw: string): Record<string, string | number> {
    const result: Record<string, string | number> = {};
    for (const pair of raw.split(",")) {
      const [key, val] = pair.split("=").map(s => s.trim());
      if (key) {
        const num = Number(val);
        result[key] = Number.isNaN(num) || val === "" ? (val ?? "") : num;
      }
    }
    return result;
  }

  function formatAttributes(value?: Record<string, string | number>): string {
    return Object.entries(value ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
  }

  async function saveService() {
    if (!editingService) return;
    setIsSaving(true);
    try {
      await upsertServiceMutation({
        id: editingService.id,
        labelEn: editingService.labelEn,
        labelAm: editingService.labelAm,
        categoryKey: editingService.categoryKey,
        categoryNameEn: editingService.categoryNameEn,
        categoryNameAm: editingService.categoryNameAm,
        iconKey: editingService.iconKey,
        sortOrder: editingService.sortOrder,
        active: editingService.active,
        publishable: editingService.publishable,
        attributes: editingService.attributes,
        expectedUpdatedAt: editingService.updatedAt,
      });
      toast.success(`Service ${editingService.id} updated`);
      setEditingService(null);
    } catch (e) {
      handleConflictError(e, "Failed to update service");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveMaterial() {
    if (!editingMaterial) return;
    setIsSaving(true);
    try {
      const updatedAttributes = {
        ...editingMaterial.attributes,
        ...(materialPrice !== ""
          ? {
              estimatedUnitPrice: Number(materialPrice),
              priceCurrency: materialCurrency,
            }
          : {}),
        ...(reorderLevel !== "" ? { reorderLevel: Number(reorderLevel) } : {}),
      };

      await upsertMaterialMutation({
        id: editingMaterial.id,
        name: editingMaterial.name,
        aliases: editingMaterial.aliases,
        category: editingMaterial.category,
        catalogFamily: editingMaterial.catalogFamily,
        baseUnit: editingMaterial.baseUnit,
        purchaseUnit: editingMaterial.purchaseUnit,
        conversionRatio: editingMaterial.conversionRatio,
        rollWidth: editingMaterial.rollWidth,
        sheetWidth: editingMaterial.sheetWidth,
        sheetLength: editingMaterial.sheetLength,
        thickness: editingMaterial.thickness,
        attributes: updatedAttributes,
        specificationOptions: editingMaterial.specificationOptions,
        compatibleMachineTypes: editingMaterial.compatibleMachineTypes,
        storageLocation: editingMaterial.storageLocation,
        averageUse: editingMaterial.averageUse,
        catalogDimensions: editingMaterial.catalogDimensions,
        catalogVariant: editingMaterial.catalogVariant,
        inkColor: editingMaterial.inkColor || (updatedAttributes?.inkColor ? String(updatedAttributes.inkColor) : undefined),
        active: editingMaterial.active,
        expectedUpdatedAt: editingMaterial.updatedAt,
      });

      if (materialPrice !== "" && Number(materialPrice) >= 0) {
        try {
          await upsertPriceEstimateMutation({
            materialId: editingMaterial.id,
            amount: Number(materialPrice),
            currency: materialCurrency,
            purchaseUnit: editingMaterial.purchaseUnit,
          });
        } catch {
          // ignore non-critical price estimate errors
        }
      }

      toast.success(`Material ${editingMaterial.name} updated`);
      setEditingMaterial(null);
    } catch (e) {
      handleConflictError(e, "Failed to update material");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveRoute() {
    if (!editingRoute) return;
    setIsSaving(true);
    try {
      const preferredCode =
        routeMachineCodes[0] ?? editingRoute.preferredMachineCode;
      await upsertServiceRoute({
        serviceId: editingRoute.serviceId,
        materialType: editingRoute.materialType,
        preferredMaterialName: editingRoute.preferredMaterialName,
        requiredCapabilities: editingRoute.requiredCapabilities,
        legacyCapabilities: editingRoute.legacyCapabilities,
        operatorRole: editingRoute.operatorRole,
        preferredMachineCode: preferredCode,
        calculationUnit: editingRoute.calculationUnit,
        defaultWasteMarginPercent: editingRoute.defaultWasteMarginPercent,
        maxScrapLimitPercent: editingRoute.maxScrapLimitPercent,
        active: editingRoute.active,
        expectedUpdatedAt: editingRoute.updatedAt,
      });

      if (routeMachineCodes.length > 0) {
        try {
          await upsertServiceMachineOptionsMutation({
            serviceId: editingRoute.serviceId,
            machineCodes: routeMachineCodes,
          });
        } catch {
          // ignore non-critical options error
        }
      }

      toast.success(`Route for ${editingRoute.serviceId} updated`);
      setEditingRoute(null);
    } catch (e) {
      handleConflictError(e, "Failed to update route");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveRole() {
    if (!editingRole) return;
    setIsSaving(true);
    try {
      await upsertRoleMutation({
        code: editingRole.code,
        labelEn: editingRole.labelEn,
        labelAm: editingRole.labelAm,
        workspaceId: editingRole.workspaceId,
        active: editingRole.active,
        attributes: editingRole.attributes,
        expectedUpdatedAt: editingRole.updatedAt,
      });
      toast.success(`Role ${editingRole.code} saved successfully`);
      setEditingRole(null);
    } catch (e) {
      handleConflictError(e, "Failed to save role");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveGroup() {
    if (!editingGroup) return;
    setIsSaving(true);
    try {
      await upsertGroupMutation({
        id: editingGroup.id,
        labelEn: editingGroup.labelEn,
        labelAm: editingGroup.labelAm,
        descriptionEn: editingGroup.descriptionEn,
        descriptionAm: editingGroup.descriptionAm,
        iconName: editingGroup.iconName,
        tone: editingGroup.tone,
        memberCategories: editingGroup.memberCategories,
        sortOrder: editingGroup.sortOrder,
        active: editingGroup.active,
        expectedUpdatedAt: editingGroup.updatedAt,
      });
      toast.success(`Group ${editingGroup.labelEn} updated`);
      setEditingGroup(null);
    } catch (e) {
      handleConflictError(e, "Failed to update group");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmPermissionToggle() {
    if (!pendingPermissionToggle) return;
    const { roleCode, permission, granting } = pendingPermissionToggle;
    try {
      await toggleRolePermissionMutation({
        roleCode,
        permission,
        active: granting,
        elevatedConfirmed: true,
      });
      toast.success(
        `Permission '${permission}' ${granting ? "granted to" : "revoked from"} ${roleCode}`
      );
      setPendingPermissionToggle(null);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to toggle permission"
      );
    }
  }

  if (syncStatus === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <InventoryLoader label="Loading database-first catalogs…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Services Catalog"
          value={`${syncStatus.services.active} / ${syncStatus.services.total}`}
          description={`${syncStatus.services.publishable} published`}
          icon={<Database size={18} />}
        />
        <StatCard
          label="Material Catalog"
          value={`${syncStatus.materials.active} / ${syncStatus.materials.total}`}
          description="Database Authority"
          icon={<Layers size={18} />}
        />
        <StatCard
          label="Production Routes"
          value={`${syncStatus.routes.active} / ${syncStatus.routes.total}`}
          description="Configured"
          icon={<Route size={18} />}
        />
        <StatCard
          label="Canonical Roles"
          value={`${(roles as any[])?.length ?? 0}`}
          description="Data-Only Authority"
          icon={<ShieldCheck size={18} />}
        />
        <StatCard
          label="Category Groups"
          value={`${syncStatus.categoryGroups.active} / ${syncStatus.categoryGroups.total}`}
          description="UI Design Tokens"
          icon={<FolderTree size={18} />}
        />
      </div>

      {/* Synchronize & Status Banner */}
      <Panel className="p-4 bg-card/60 backdrop-blur border-border flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-cyan/10 p-2 text-cyan">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">
              Owner Full-Authority Catalogs
            </h3>
            <p className="text-xs text-muted-foreground">
              Master business catalogs runtime-backed in Convex. Zero code
              redeployments required.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {driftReport && !driftReport.clean ? (
            <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
              <AlertTriangle size={13} /> {driftReport.totalIssues} drift issues
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
              <CheckCircle2 size={13} /> Normalized
            </span>
          )}
          <Button
            variant="secondary"
            size="small"
            onClick={seedMaterial}
            disabled={isSeedingMaterials || isSyncing || isSeedingMachines}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <RefreshCw size={14} className={isSeedingMaterials ? "animate-spin" : ""} />
            {isSeedingMaterials ? "Seeding Materials…" : "Seed Raw Materials"}
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={seedMachine}
            disabled={isSeedingMachines || isSyncing || isSeedingMaterials}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <RefreshCw size={14} className={isSeedingMachines ? "animate-spin" : ""} />
            {isSeedingMachines ? "Seeding Machines…" : "Seed Machines"}
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Syncing Catalogs…" : "Reseed & Sync Catalogs"}
          </Button>
        </div>
      </Panel>

      {/* Main Catalog Tabs */}
      <Tabs defaultValue="services" className="space-y-4">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <TabsList className="bg-secondary/60">
            <TabsTrigger value="services">
              Services ({services?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="materials">
              Materials ({materials?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="routes">
              Service Routes ({routes?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="roles">
              Roles & Access ({(roles as any[])?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="groups">
              Groups ({categoryGroups?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="audit">
              <span className="flex items-center gap-1.5">
                <History size={13} /> Audit & Drift
              </span>
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Search catalog items…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-cyan focus:outline-none"
            />
          </div>
        </div>

        {/* Tab 1: Services */}
        <TabsContent value="services">
          <Panel>
            <PanelHeader
              title="Service Catalog"
              subtitle="Database-backed service definitions and customer availability."
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-muted-foreground">
                    <th className="p-3 font-medium">Service Key</th>
                    <th className="p-3 font-medium">English Name</th>
                    <th className="p-3 font-medium">Amharic Name</th>
                    <th className="p-3 font-medium">Category</th>
                    <th className="p-3 font-medium">Order</th>
                    <th className="p-3 font-medium">Customer View</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredServices.map(svc => (
                    <tr
                      key={svc.id}
                      className="hover:bg-secondary/20 transition-colors"
                    >
                      <td className="p-3 font-mono font-medium text-foreground">
                        {svc.id}
                      </td>
                      <td className="p-3 text-foreground">{svc.labelEn}</td>
                      <td className="p-3 font-amharic text-muted-foreground">
                        {svc.labelAm}
                      </td>
                      <td className="p-3">
                        <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                          {svc.categoryNameEn}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        #{svc.sortOrder}
                      </td>
                      <td className="p-3">
                        {svc.publishable ? (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <Eye size={12} /> Published
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <EyeOff size={12} /> Hidden
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            svc.active
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-zinc-500/10 text-zinc-400"
                          }`}
                        >
                          {svc.active ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="tertiary"
                            className="h-7 px-2 text-xs"
                            onClick={() => setEditingService({ ...svc })}
                          >
                            <Edit3 size={12} className="mr-1" /> Edit
                          </Button>
                          <Button
                            variant="tertiary"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              toggleService({
                                serviceId: svc.id,
                                active: !svc.active,
                              })
                            }
                          >
                            {svc.active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>

        {/* Tab 2: Materials Catalog */}
        <TabsContent value="materials">
          <Panel>
            <PanelHeader
              title="Material Specifications Catalog"
              subtitle="Canonical substrate, ink, sheet, and hardware specifications."
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-muted-foreground">
                    <th className="p-3 font-medium">Material Name</th>
                    <th className="p-3 font-medium">Family</th>
                    <th className="p-3 font-medium">Base Unit</th>
                    <th className="p-3 font-medium">Purchase Unit</th>
                    <th className="p-3 font-medium">Ratio</th>
                    <th className="p-3 font-medium">Dimensions / Variant</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMaterials.map(mat => (
                    <tr
                      key={mat.id}
                      className="hover:bg-secondary/20 transition-colors"
                    >
                      <td className="p-3 font-medium text-foreground">
                        <div>{mat.name}</div>
                        {mat.aliases && mat.aliases.length > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            Aliases: {mat.aliases.join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="rounded bg-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-cyan uppercase">
                          {mat.catalogFamily}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {mat.baseUnit}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {mat.purchaseUnit}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        1 : {mat.conversionRatio}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {mat.rollWidth ? `${mat.rollWidth}m roll` : ""}
                        {mat.sheetWidth && mat.sheetLength
                          ? `${mat.sheetWidth}m × ${mat.sheetLength}m`
                          : ""}
                        {mat.thickness ? ` (${mat.thickness}mm)` : ""}
                        {!mat.rollWidth && !mat.sheetWidth && !mat.thickness
                          ? (mat.catalogDimensions ?? "—")
                          : ""}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            mat.active
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-zinc-500/10 text-zinc-400"
                          }`}
                        >
                          {mat.active ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="tertiary"
                            className="h-7 px-2 text-xs"
                            onClick={() => openEditMaterial(mat)}
                          >
                            <Edit3 size={12} className="mr-1" /> Edit
                          </Button>
                          <Button
                            variant="tertiary"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              toggleMaterial({
                                id: mat.id,
                                active: !mat.active,
                              })
                            }
                          >
                            {mat.active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>

        {/* Tab 3: Service Routes */}
        <TabsContent value="routes">
          <Panel>
            <PanelHeader
              title="Service Production Routes"
              subtitle="Deterministic material, machine, and operator dispatch policies."
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-muted-foreground">
                    <th className="p-3 font-medium">Service ID</th>
                    <th className="p-3 font-medium">Preferred Machine</th>
                    <th className="p-3 font-medium">Substrate / Material</th>
                    <th className="p-3 font-medium">Operator Role</th>
                    <th className="p-3 font-medium">Waste Margin</th>
                    <th className="p-3 font-medium">Scrap Limit</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRoutes.map(rt => (
                    <tr
                      key={rt.serviceId}
                      className="hover:bg-secondary/20 transition-colors"
                    >
                      <td className="p-3 font-mono font-medium text-cyan">
                        {rt.serviceId}
                      </td>
                      <td className="p-3 font-mono text-foreground">
                        {rt.preferredMachineCode}
                      </td>
                      <td className="p-3 text-foreground">
                        {rt.preferredMaterialName}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {rt.operatorRole}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {rt.defaultWasteMarginPercent}%
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {rt.maxScrapLimitPercent}%
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            rt.active
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-zinc-500/10 text-zinc-400"
                          }`}
                        >
                          {rt.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="tertiary"
                          className="h-7 px-2 text-xs"
                          onClick={() => openEditRoute(rt)}
                        >
                          <Edit3 size={12} className="mr-1" /> Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>

        {/* Tab 4: Roles & Permissions Matrix (Stage 3) */}
        <TabsContent value="roles" className="space-y-6">
          {/* Top Banner: Data-only vs Structural Roles */}
          <div className="rounded-lg border border-cyan/20 bg-cyan/5 p-4 text-xs text-foreground flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-cyan">
                <ShieldCheck size={16} /> Canonical Role Authority (Section 8)
              </div>
              <p className="text-muted-foreground">
                The owner has full authority to configure data-only roles that
                reuse existing workspace routes and permission primitives. New
                hardware workflows or custom UI structures require engineering
                capability requests.
              </p>
            </div>
            <Button
              variant="primary"
              size="small"
              onClick={() =>
                setEditingRole({
                  code: "",
                  labelEn: "",
                  labelAm: "",
                  workspaceId: "operator",
                  active: true,
                })
              }
              className="flex items-center gap-1.5 whitespace-nowrap"
            >
              <PlusCircle size={14} /> Add Role
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Roles List */}
            <Panel>
              <PanelHeader
                title="Canonical Roles"
                subtitle="Data-backed roles and workspace routing destinations."
              />
              <div className="divide-y divide-border text-xs max-h-[600px] overflow-y-auto">
                {(roles as RoleRecord[] | undefined)?.map(r => (
                  <div
                    key={r.code}
                    className="flex items-center justify-between p-3.5 hover:bg-secondary/20 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-foreground">
                          {r.code}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] uppercase font-bold ${
                            r.active
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-zinc-500/10 text-zinc-400"
                          }`}
                        >
                          {r.active ? "Active" : "Archived"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {r.labelEn} ·{" "}
                        <span className="font-amharic">{r.labelAm}</span>
                      </p>
                      <p className="text-[10px] text-cyan mt-0.5">
                        Workspace: {r.workspaceId}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="tertiary"
                        className="h-7 px-2 text-xs"
                        onClick={() => setEditingRole({ ...r })}
                      >
                        <Edit3 size={12} className="mr-1" /> Edit
                      </Button>
                      <Button
                        variant="tertiary"
                        className="h-7 px-2 text-xs"
                        onClick={async () => {
                          try {
                            await toggleRoleActive({
                              code: r.code,
                              active: !r.active,
                            });
                            toast.success(
                              `Role ${r.code} ${r.active ? "deactivated" : "activated"}`
                            );
                          } catch (e) {
                            toast.error(
                              e instanceof Error
                                ? e.message
                                : "Failed to toggle role active state"
                            );
                          }
                        }}
                      >
                        {r.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Interactive Permission Matrix */}
            <Panel>
              <PanelHeader
                title="Interactive Permission Matrix"
                subtitle="Owner-gated RBAC enforcement. Granting capabilities triggers elevated confirmation."
              />
              <div className="p-3 text-xs space-y-4 max-h-[600px] overflow-y-auto">
                {Object.entries(PERMISSION_GROUPS).map(
                  ([groupKey, groupDef]) => (
                    <div
                      key={groupKey}
                      className="rounded-lg border border-border bg-card/40 p-3 space-y-2.5"
                    >
                      <h5 className="font-semibold text-foreground text-xs uppercase tracking-wider text-cyan">
                        {groupDef.label}
                      </h5>
                      <div className="space-y-1.5 divide-y divide-border/40">
                        {groupDef.permissions.map(perm => (
                          <div key={perm} className="pt-1.5 first:pt-0">
                            <div className="flex items-center justify-between py-1">
                              <span className="font-mono text-[11px] text-foreground font-medium">
                                {perm}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {(roles as RoleRecord[] | undefined)?.map(r => {
                                const isGranted = (
                                  permissions as PermissionRecord[] | undefined
                                )?.some(
                                  p =>
                                    p.roleCode === r.code &&
                                    p.permission === perm
                                );
                                return (
                                  <button
                                    key={r.code}
                                    type="button"
                                    onClick={() => {
                                      setPendingPermissionToggle({
                                        roleCode: r.code,
                                        permission: perm,
                                        granting: !isGranted,
                                      });
                                    }}
                                    className={`rounded px-2 py-0.5 text-[10px] font-mono transition-all ${
                                      isGranted
                                        ? "bg-cyan/15 text-cyan border border-cyan/30 hover:bg-cyan/25"
                                        : "bg-secondary/40 text-muted-foreground border border-transparent hover:border-border hover:text-foreground"
                                    }`}
                                  >
                                    {r.code.replace(/_operator$/, "")}:{" "}
                                    {isGranted ? "✓" : "—"}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* Tab 5: Category Groups */}
        <TabsContent value="groups">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(categoryGroups as CategoryGroupRecord[] | undefined)?.map(
              (group: CategoryGroupRecord) => (
                <Panel key={group.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-foreground text-sm">
                        {group.labelEn}
                      </h4>
                      <p className="text-xs font-amharic text-muted-foreground">
                        {group.labelAm}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                        #{group.sortOrder}
                      </span>
                      <Button
                        variant="tertiary"
                        className="h-7 px-2 text-xs"
                        onClick={() => setEditingGroup({ ...group })}
                      >
                        <Edit3 size={12} className="mr-1" /> Edit
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {group.descriptionEn}
                  </p>
                  <div className="border-t border-border pt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Tone:{" "}
                      <span className="text-foreground font-mono">
                        {group.tone}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      Icon:{" "}
                      <span className="text-foreground font-mono">
                        {group.iconName}
                      </span>
                    </span>
                  </div>
                  <div className="border-t border-border pt-2">
                    <p className="text-[11px] font-medium text-foreground mb-1">
                      Member Categories:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {group.memberCategories.map((c: string) => (
                        <span
                          key={c}
                          className="rounded bg-cyan/10 px-1.5 py-0.5 text-[10px] text-cyan"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </Panel>
              )
            )}
          </div>
        </TabsContent>

        {/* Tab 6: Audit & Drift Detection (Stage 5) */}
        <TabsContent value="audit" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Drift Detection Report */}
            <Panel className="lg:col-span-1 p-4 space-y-4">
              <PanelHeader
                title="Configuration Drift Scanner"
                subtitle="Detects non-canonical strings and orphaned routes."
              />
              <div className="rounded-lg border border-border p-3 space-y-2 bg-secondary/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  {driftReport?.clean ? (
                    <span className="text-xs font-semibold text-emerald-400">
                      Zero Drift Detected
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-400">
                      {driftReport?.totalIssues ?? 0} Issue(s) Found
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Last Scan:
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {driftReport?.scannedAt
                      ? new Date(driftReport.scannedAt).toLocaleTimeString()
                      : "—"}
                  </span>
                </div>
              </div>

              {driftReport &&
              driftReport.issues &&
              driftReport.issues.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto divide-y divide-border/60">
                  {driftReport.issues.map((issue, idx) => (
                    <div
                      key={idx}
                      className="pt-2 first:pt-0 text-xs space-y-1"
                    >
                      <div className="font-semibold text-amber-300">
                        {issue.entityName}
                      </div>
                      <div className="text-muted-foreground">
                        {issue.reason}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <Button
                variant="secondary"
                size="small"
                className="w-full"
                onClick={handleReconcileDrift}
                disabled={isReconciling || !driftReport || driftReport.clean}
              >
                {isReconciling
                  ? "Reconciling…"
                  : "One-Click Non-Destructive Reconcile"}
              </Button>
            </Panel>

            {/* Audit Change Log */}
            <Panel className="lg:col-span-2 p-4 space-y-3">
              <PanelHeader
                title="Configuration Audit Trail (configChangeLog)"
                subtitle="Immutable ledger of all owner configuration actions across tables."
              />
              <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30 text-muted-foreground">
                      <th className="p-2.5 font-medium">Timestamp</th>
                      <th className="p-2.5 font-medium">Entity Type</th>
                      <th className="p-2.5 font-medium">Entity ID</th>
                      <th className="p-2.5 font-medium">Action</th>
                      <th className="p-2.5 font-medium">Field Diffs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {changeLogs?.map((log: any) => (
                      <tr
                        key={log._id}
                        className="hover:bg-secondary/15 transition-colors"
                      >
                        <td className="p-2.5 font-mono text-muted-foreground whitespace-nowrap">
                          {new Date(log.changedAt).toLocaleString()}
                        </td>
                        <td className="p-2.5 font-mono text-cyan">
                          {log.entityType}
                        </td>
                        <td className="p-2.5 font-mono font-medium text-foreground">
                          {log.entityId}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] uppercase font-bold ${
                              log.action === "create"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : log.action === "update"
                                  ? "bg-blue-500/10 text-blue-400"
                                  : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="p-2.5 text-[11px] text-muted-foreground max-w-xs truncate">
                          {log.fieldChanges
                            ? Object.entries(log.fieldChanges)
                                .map(
                                  ([k, v]: [string, any]) =>
                                    `${k}: ${v.from ?? "null"} → ${v.to ?? "null"}`
                                )
                                .join(", ")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </TabsContent>
      </Tabs>

      {/* Elevated Confirmation Modal for RBAC Permission Changes (Section 7.2) */}
      {pendingPermissionToggle ? (
        <SlidePanel
          title="Elevated Confirmation: Role Permission"
          subtitle="Modifying access permissions expands operational authority."
          open
          onClose={() => setPendingPermissionToggle(null)}
          footer={
            <>
              <Button
                variant="tertiary"
                onClick={() => setPendingPermissionToggle(null)}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={confirmPermissionToggle}>
                {pendingPermissionToggle.granting
                  ? "Grant Permission"
                  : "Revoke Permission"}
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-300 flex items-start gap-3">
              <ShieldAlert size={20} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm">
                  Elevated Governance Action
                </p>
                <p className="text-amber-200/90 leading-relaxed">
                  You are about to{" "}
                  {pendingPermissionToggle.granting ? "grant" : "revoke"}{" "}
                  permission{" "}
                  <strong className="font-mono">
                    {pendingPermissionToggle.permission}
                  </strong>{" "}
                  for role{" "}
                  <strong className="font-mono">
                    {pendingPermissionToggle.roleCode}
                  </strong>
                  . This change takes effect immediately across all active
                  accounts assigned to this role.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target Role:</span>
                <span className="font-mono font-semibold text-foreground">
                  {pendingPermissionToggle.roleCode}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Permission:</span>
                <span className="font-mono text-cyan">
                  {pendingPermissionToggle.permission}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Action:</span>
                <span className="font-bold text-foreground">
                  {pendingPermissionToggle.granting
                    ? "GRANT AUTHORITY"
                    : "REVOKE AUTHORITY"}
                </span>
              </div>
            </div>
          </div>
        </SlidePanel>
      ) : null}

      {/* Service Edit Panel */}
      {editingService ? (
        <SlidePanel
          title={`Edit Service: ${editingService.id}`}
          subtitle="Define service metadata and catalog availability."
          open
          onClose={() => setEditingService(null)}
          footer={
            <>
              <Button
                variant="tertiary"
                onClick={() => setEditingService(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={saveService}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Save Changes"}
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  English Label
                </label>
                <input
                  type="text"
                  value={editingService.labelEn}
                  onChange={e =>
                    setEditingService({
                      ...editingService,
                      labelEn: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Amharic Label
                </label>
                <input
                  type="text"
                  value={editingService.labelAm}
                  onChange={e =>
                    setEditingService({
                      ...editingService,
                      labelAm: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-amharic focus:border-cyan focus:outline-none"
                />
              </div>
            </div>

            {/* Normalized Service Category Dropdown (Section 4.2) */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Service Category
              </label>
              <select
                value={editingService.categoryKey}
                onChange={e => {
                  const selectedCat = SERVICE_CATEGORIES.find(
                    c => c.key === e.target.value
                  );
                  setEditingService({
                    ...editingService,
                    categoryKey: e.target.value,
                    categoryNameEn: selectedCat
                      ? selectedCat.nameEn
                      : editingService.categoryNameEn,
                  });
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              >
                {SERVICE_CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>
                    {c.nameEn} ({c.key})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={editingService.sortOrder}
                  onChange={e =>
                    setEditingService({
                      ...editingService,
                      sortOrder: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Publish to Customers
                </label>
                <select
                  value={editingService.publishable ? "yes" : "no"}
                  onChange={e =>
                    setEditingService({
                      ...editingService,
                      publishable: e.target.value === "yes",
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
                >
                  <option value="yes">Published (Visible in mini-app)</option>
                  <option value="no">Unpublished (Hidden)</option>
                </select>
              </div>
            </div>

            {/* Stage 6 Extensibility: Dynamic Attributes */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Dynamic Attributes (key=val, comma-separated)
              </label>
              <input
                type="text"
                placeholder="featured=true, badge=Popular"
                value={formatAttributes(editingService.attributes)}
                onChange={e =>
                  setEditingService({
                    ...editingService,
                    attributes: parseAttributes(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Status
              </label>
              <select
                value={editingService.active ? "active" : "archived"}
                onChange={e =>
                  setEditingService({
                    ...editingService,
                    active: e.target.value === "active",
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Stage 5: Service Specification Fields */}
            <div className="pt-4 border-t border-border/40">
              <ServiceSpecFieldsManager serviceId={editingService.id} />
            </div>
          </div>
        </SlidePanel>
      ) : null}

      {/* Material Edit Panel */}
      {editingMaterial ? (
        <SlidePanel
          title={`Edit Material: ${editingMaterial.name}`}
          subtitle="Configure substrate specs, physical dimensions, and consumption profile."
          open
          onClose={() => setEditingMaterial(null)}
          footer={
            <>
              <Button
                variant="tertiary"
                onClick={() => setEditingMaterial(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={saveMaterial}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Save Changes"}
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Material Name
              </label>
              <input
                type="text"
                value={editingMaterial.name}
                onChange={e =>
                  setEditingMaterial({
                    ...editingMaterial,
                    name: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Aliases (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. Flex, Banner Roll"
                value={(editingMaterial.aliases ?? []).join(", ")}
                onChange={e =>
                  setEditingMaterial({
                    ...editingMaterial,
                    aliases: e.target.value
                      .split(",")
                      .map(s => s.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              />
            </div>

            {/* Normalized Dropdowns (Section 4.2) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Category
                </label>
                <input
                  type="text"
                  list="category-suggestions"
                  value={editingMaterial.category}
                  onChange={e =>
                    setEditingMaterial({
                      ...editingMaterial,
                      category: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
                />
                <datalist id="category-suggestions">
                  {distinctMaterialCategories.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Catalog Family
                </label>
                <select
                  value={editingMaterial.catalogFamily}
                  onChange={e =>
                    setEditingMaterial({
                      ...editingMaterial,
                      catalogFamily: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                >
                  {CATALOG_FAMILIES.map(f => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Base Unit
                </label>
                <select
                  value={editingMaterial.baseUnit}
                  onChange={e =>
                    setEditingMaterial({
                      ...editingMaterial,
                      baseUnit: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                >
                  {BASE_UNITS.map(u => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Purchase Unit
                </label>
                <select
                  value={editingMaterial.purchaseUnit}
                  onChange={e =>
                    setEditingMaterial({
                      ...editingMaterial,
                      purchaseUnit: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                >
                  {PURCHASE_UNITS.map(u => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Conversion Ratio
                </label>
                <input
                  type="number"
                  value={editingMaterial.conversionRatio}
                  onChange={e =>
                    setEditingMaterial({
                      ...editingMaterial,
                      conversionRatio: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                />
              </div>
            </div>

            {/* Category-Driven Physical Specifications */}
            {editingMaterial.catalogFamily === "ROLL" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Roll Width (m)
                  </label>
                  <input
                    type="number"
                    value={editingMaterial.rollWidth ?? ""}
                    onChange={e =>
                      setEditingMaterial({
                        ...editingMaterial,
                        rollWidth:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Media Finish / Surface
                  </label>
                  <input
                    type="text"
                    placeholder="Glossy, Matte, Frontlit"
                    value={String(editingMaterial.attributes?.finish ?? "")}
                    onChange={e =>
                      setEditingMaterial({
                        ...editingMaterial,
                        attributes: {
                          ...editingMaterial.attributes,
                          finish: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
                  />
                </div>
              </div>
            )}

            {editingMaterial.catalogFamily === "RIGID_SHEET" && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Sheet Width (m)
                  </label>
                  <input
                    type="number"
                    placeholder="W"
                    value={editingMaterial.sheetWidth ?? ""}
                    onChange={e =>
                      setEditingMaterial({
                        ...editingMaterial,
                        sheetWidth:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Sheet Length (m)
                  </label>
                  <input
                    type="number"
                    placeholder="L"
                    value={editingMaterial.sheetLength ?? ""}
                    onChange={e =>
                      setEditingMaterial({
                        ...editingMaterial,
                        sheetLength:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Thickness (mm)
                  </label>
                  <input
                    type="number"
                    value={editingMaterial.thickness ?? ""}
                    onChange={e =>
                      setEditingMaterial({
                        ...editingMaterial,
                        thickness:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                  />
                </div>
              </div>
            )}

            {editingMaterial.catalogFamily === "INK_SOLVENT" && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Ink Color Channel
                  </label>
                  <input
                    type="text"
                    placeholder="Cyan, Magenta, Yellow, Black"
                    value={String(editingMaterial.inkColor ?? editingMaterial.attributes?.inkColor ?? "")}
                    onChange={e =>
                      setEditingMaterial({
                        ...editingMaterial,
                        inkColor: e.target.value,
                        attributes: {
                          ...editingMaterial.attributes,
                          inkColor: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Container / Bottle Size
                  </label>
                  <input
                    type="text"
                    placeholder="1L, 5L Canister"
                    value={String(
                      editingMaterial.attributes?.containerSize ?? ""
                    )}
                    onChange={e =>
                      setEditingMaterial({
                        ...editingMaterial,
                        attributes: {
                          ...editingMaterial.attributes,
                          containerSize: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Chemistry / Solvent Base
                  </label>
                  <input
                    type="text"
                    placeholder="Eco-Solvent, UV, Dye-Sub"
                    value={String(editingMaterial.attributes?.chemistry ?? "")}
                    onChange={e =>
                      setEditingMaterial({
                        ...editingMaterial,
                        attributes: {
                          ...editingMaterial.attributes,
                          chemistry: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
                  />
                </div>
              </div>
            )}

            {editingMaterial.catalogFamily === "ILLUMINATED_DISPLAY_SYSTEM" && (
              <div className="space-y-3 rounded-lg border border-border/70 bg-card/40 p-3">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-cyan">
                  Illuminated Display System Specifications
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Display Width (mm)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 1200"
                      value={String(
                        editingMaterial.attributes?.displayWidth ?? ""
                      )}
                      onChange={e =>
                        setEditingMaterial({
                          ...editingMaterial,
                          attributes: {
                            ...editingMaterial.attributes,
                            displayWidth:
                              Number(e.target.value) || e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-cyan focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Display Height (mm)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 800"
                      value={String(
                        editingMaterial.attributes?.displayHeight ?? ""
                      )}
                      onChange={e =>
                        setEditingMaterial({
                          ...editingMaterial,
                          attributes: {
                            ...editingMaterial.attributes,
                            displayHeight:
                              Number(e.target.value) || e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-cyan focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Depth (mm)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 80"
                      value={String(
                        editingMaterial.attributes?.displayDepth ?? ""
                      )}
                      onChange={e =>
                        setEditingMaterial({
                          ...editingMaterial,
                          attributes: {
                            ...editingMaterial.attributes,
                            displayDepth:
                              Number(e.target.value) || e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-cyan focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Face / Screen Material
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Fabric SEG, Acrylic, Soft Film"
                      value={String(
                        editingMaterial.attributes?.faceMaterial ?? ""
                      )}
                      onChange={e =>
                        setEditingMaterial({
                          ...editingMaterial,
                          attributes: {
                            ...editingMaterial.attributes,
                            faceMaterial: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-cyan focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Illumination Voltage
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 12V DC, 220V AC"
                      value={String(editingMaterial.attributes?.voltage ?? "")}
                      onChange={e =>
                        setEditingMaterial({
                          ...editingMaterial,
                          attributes: {
                            ...editingMaterial.attributes,
                            voltage: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-cyan focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {editingMaterial.catalogFamily === "SIGNAGE_FRAME_PROFILE" && (
              <div className="space-y-3 rounded-lg border border-border/70 bg-card/40 p-3">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-cyan">
                  Signage Frame Profile Specifications
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Bar Length (m)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 6.0"
                      value={String(
                        editingMaterial.attributes?.barLength ?? ""
                      )}
                      onChange={e =>
                        setEditingMaterial({
                          ...editingMaterial,
                          attributes: {
                            ...editingMaterial.attributes,
                            barLength: Number(e.target.value) || e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-cyan focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Face Channel (mm)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 3, 5, 8"
                      value={String(
                        editingMaterial.attributes?.compatibleFaceThickness ??
                          ""
                      )}
                      onChange={e =>
                        setEditingMaterial({
                          ...editingMaterial,
                          attributes: {
                            ...editingMaterial.attributes,
                            compatibleFaceThickness:
                              Number(e.target.value) || e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-cyan focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Finish / Alloy
                    </label>
                    <input
                      type="text"
                      placeholder="Anodized Aluminum, Black Powder"
                      value={String(editingMaterial.attributes?.finish ?? "")}
                      onChange={e =>
                        setEditingMaterial({
                          ...editingMaterial,
                          attributes: {
                            ...editingMaterial.attributes,
                            finish: e.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-cyan focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {editingMaterial.catalogFamily === "HARDWARE" && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Pieces per Package
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 50"
                    value={String(editingMaterial.attributes?.pieceQty ?? "")}
                    onChange={e =>
                      setEditingMaterial({
                        ...editingMaterial,
                        attributes: {
                          ...editingMaterial.attributes,
                          pieceQty: Number(e.target.value) || e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-cyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Voltage / Power (W)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1.5W / 12V"
                    value={String(editingMaterial.attributes?.voltage ?? "")}
                    onChange={e =>
                      setEditingMaterial({
                        ...editingMaterial,
                        attributes: {
                          ...editingMaterial.attributes,
                          voltage: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-cyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Compatibility
                  </label>
                  <input
                    type="text"
                    placeholder="Universal / LED Box"
                    value={String(
                      editingMaterial.attributes?.compatibility ?? ""
                    )}
                    onChange={e =>
                      setEditingMaterial({
                        ...editingMaterial,
                        attributes: {
                          ...editingMaterial.attributes,
                          compatibility: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-cyan focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Reorder Policy & Price Estimate Section */}
            <div className="rounded-lg border border-border/80 bg-secondary/30 p-3 space-y-3">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Reorder Policy & Acquisition Price
              </span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <label className="text-xs font-medium text-muted-foreground truncate">
                      Unit Price ({editingMaterial.purchaseUnit})
                    </label>
                    {materialPrice !== "" && Number(materialPrice) > 0 && editingMaterial.conversionRatio > 0 && (
                      <span className="text-[10px] font-mono font-medium text-cyan bg-cyan/10 px-1.5 py-0.5 rounded shrink-0">
                        ≈ {(Number(materialPrice) / editingMaterial.conversionRatio).toFixed(2)} {materialCurrency} / {editingMaterial.baseUnit}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={materialPrice}
                    onChange={e =>
                      setMaterialPrice(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-cyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Currency
                  </label>
                  <select
                    value={materialCurrency}
                    onChange={e => setMaterialCurrency(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-cyan focus:outline-none"
                  >
                    <option value="ETB">ETB (Birr)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Reorder Level ({editingMaterial.purchaseUnit})
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 5"
                    value={reorderLevel}
                    onChange={e =>
                      setReorderLevel(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-cyan focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Dynamic Attributes (key=val, comma-separated)
              </label>
              <input
                type="text"
                placeholder="color=Blue, gsm=440"
                value={formatAttributes(editingMaterial.attributes)}
                onChange={e =>
                  setEditingMaterial({
                    ...editingMaterial,
                    attributes: parseAttributes(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>

            <CheckboxGroupField
              label="Compatible Machine Types"
              description="Equipment types compatible with this material"
              options={machineTypeOptions}
              selected={editingMaterial.compatibleMachineTypes ?? []}
              onChange={types =>
                setEditingMaterial({
                  ...editingMaterial,
                  compatibleMachineTypes: types,
                })
              }
              columns={2}
            />

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Status
              </label>
              <select
                value={editingMaterial.active ? "active" : "archived"}
                onChange={e =>
                  setEditingMaterial({
                    ...editingMaterial,
                    active: e.target.value === "active",
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </SlidePanel>
      ) : null}

      {/* Service Route Edit Panel */}
      {editingRoute ? (
        <SlidePanel
          title={`Edit Route: ${editingRoute.serviceId}`}
          subtitle="Configure default production routing, scrap thresholds, and dispatch."
          open
          onClose={() => setEditingRoute(null)}
          footer={
            <>
              <Button
                variant="tertiary"
                onClick={() => setEditingRoute(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={saveRoute} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save Changes"}
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Normalized Route Dropdowns (Section 4.2) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Preferred Machine
                </label>
                <select
                  value={editingRoute.preferredMachineCode}
                  onChange={e =>
                    setEditingRoute({
                      ...editingRoute,
                      preferredMachineCode: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                >
                  {(machines as any[] | undefined)?.map(m => (
                    <option key={m.code} value={m.code}>
                      {m.code} ({m.name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Preferred Material
                </label>
                <select
                  value={editingRoute.preferredMaterialName}
                  onChange={e =>
                    setEditingRoute({
                      ...editingRoute,
                      preferredMaterialName: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
                >
                  {(materials as MaterialRecord[] | undefined)?.map(m => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.catalogFamily})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Operator Role
                </label>
                <select
                  value={editingRoute.operatorRole}
                  onChange={e =>
                    setEditingRoute({
                      ...editingRoute,
                      operatorRole: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                >
                  {(roles as RoleRecord[] | undefined)?.map(r => (
                    <option key={r.code} value={r.code}>
                      {r.code} ({r.labelEn})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Calculation Unit
                </label>
                <select
                  value={editingRoute.calculationUnit}
                  onChange={e =>
                    setEditingRoute({
                      ...editingRoute,
                      calculationUnit: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                >
                  {BASE_UNITS.map(u => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Default Waste Margin (%)
                </label>
                <input
                  type="number"
                  value={editingRoute.defaultWasteMarginPercent}
                  onChange={e =>
                    setEditingRoute({
                      ...editingRoute,
                      defaultWasteMarginPercent: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Max Scrap Limit (%)
                </label>
                <input
                  type="number"
                  value={editingRoute.maxScrapLimitPercent}
                  onChange={e =>
                    setEditingRoute({
                      ...editingRoute,
                      maxScrapLimitPercent: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                />
              </div>
            </div>

            <CheckboxGroupField
              label="Required Capabilities"
              description="Technical capabilities required to produce this service"
              options={capabilityOptions}
              selected={editingRoute.requiredCapabilities ?? []}
              onChange={caps =>
                setEditingRoute({
                  ...editingRoute,
                  requiredCapabilities: caps,
                })
              }
              columns={2}
            />

            <CheckboxGroupField
              label="Configured Machines"
              description="Candidate equipment authorized for this service (load-balanced at dispatch)"
              options={fleetMachineOptions}
              selected={routeMachineCodes}
              onChange={codes => {
                setRouteMachineCodes(codes);
                if (codes.length > 0) {
                  setEditingRoute({
                    ...editingRoute,
                    preferredMachineCode: codes[0],
                  });
                }
              }}
              columns={2}
            />

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Status
              </label>
              <select
                value={editingRoute.active ? "active" : "inactive"}
                onChange={e =>
                  setEditingRoute({
                    ...editingRoute,
                    active: e.target.value === "active",
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </SlidePanel>
      ) : null}

      {/* Role Edit & Creation Panel (Stage 3 Data-Only Roles) */}
      {editingRole ? (
        <SlidePanel
          title={
            editingRole.code
              ? `Edit Role: ${editingRole.code}`
              : "Create Data-Only Role"
          }
          subtitle="Configure role slug, bilingual labels, and workspace assignment."
          open
          onClose={() => setEditingRole(null)}
          footer={
            <>
              <Button
                variant="tertiary"
                onClick={() => setEditingRole(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={saveRole} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save Role"}
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Role Code (Slug)
              </label>
              <input
                type="text"
                placeholder="e.g. digital_print_assistant"
                value={editingRole.code}
                onChange={e =>
                  setEditingRole({ ...editingRole, code: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  English Label
                </label>
                <input
                  type="text"
                  placeholder="Assistant Operator"
                  value={editingRole.labelEn}
                  onChange={e =>
                    setEditingRole({ ...editingRole, labelEn: e.target.value })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Amharic Label
                </label>
                <input
                  type="text"
                  placeholder="ረዳት ኦፕሬተር"
                  value={editingRole.labelAm}
                  onChange={e =>
                    setEditingRole({ ...editingRole, labelAm: e.target.value })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-amharic focus:border-cyan focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Target Workspace
              </label>
              <select
                value={editingRole.workspaceId}
                onChange={e =>
                  setEditingRole({
                    ...editingRole,
                    workspaceId: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              >
                {(workspaceRoutes as any[] | undefined)?.map(w => (
                  <option key={w.workspaceId} value={w.workspaceId}>
                    {w.label} ({w.workspaceId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Dynamic Attributes (key=val, comma-separated)
              </label>
              <input
                type="text"
                placeholder="department=Production, shift=Morning"
                value={formatAttributes(editingRole.attributes)}
                onChange={e =>
                  setEditingRole({
                    ...editingRole,
                    attributes: parseAttributes(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Status
              </label>
              <select
                value={editingRole.active ? "active" : "inactive"}
                onChange={e =>
                  setEditingRole({
                    ...editingRole,
                    active: e.target.value === "active",
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </SlidePanel>
      ) : null}

      {/* Category Group Edit Panel */}
      {editingGroup ? (
        <SlidePanel
          title={`Edit Group: ${editingGroup.labelEn}`}
          subtitle="Main inventory visual grouping and design tokens."
          open
          onClose={() => setEditingGroup(null)}
          footer={
            <>
              <Button
                variant="tertiary"
                onClick={() => setEditingGroup(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={saveGroup} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save Changes"}
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  English Label
                </label>
                <input
                  type="text"
                  value={editingGroup.labelEn}
                  onChange={e =>
                    setEditingGroup({
                      ...editingGroup,
                      labelEn: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Amharic Label
                </label>
                <input
                  type="text"
                  value={editingGroup.labelAm}
                  onChange={e =>
                    setEditingGroup({
                      ...editingGroup,
                      labelAm: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-amharic focus:border-cyan focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Design Tone
                </label>
                <select
                  value={editingGroup.tone}
                  onChange={e =>
                    setEditingGroup({ ...editingGroup, tone: e.target.value })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                >
                  {GROUP_TONES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Icon Token
                </label>
                <select
                  value={editingGroup.iconName}
                  onChange={e =>
                    setEditingGroup({
                      ...editingGroup,
                      iconName: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
                >
                  {GROUP_ICONS.map(i => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <CheckboxGroupField
              label="Member Categories"
              description="Material categories grouped under this taxonomy heading"
              options={categoryOptions}
              selected={editingGroup.memberCategories ?? []}
              onChange={cats =>
                setEditingGroup({
                  ...editingGroup,
                  memberCategories: cats,
                })
              }
              columns={2}
            />

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Status
              </label>
              <select
                value={editingGroup.active ? "active" : "inactive"}
                onChange={e =>
                  setEditingGroup({
                    ...editingGroup,
                    active: e.target.value === "active",
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </SlidePanel>
      ) : null}
    </div>
  );
}

function ServiceSpecFieldsManager({ serviceId }: { serviceId: string }) {
  const specFields = useQuery(api.catalog.listServiceSpecFields, {
    serviceId,
    includeInactive: true,
  });
  const upsertField = useMutation(api.catalog.upsertServiceSpecField);
  const toggleActive = useMutation(api.catalog.toggleServiceSpecFieldActive);
  const deleteField = useMutation(api.catalog.deleteServiceSpecField);

  const [isAdding, setIsAdding] = useState(false);
  const [fieldKey, setFieldKey] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [labelAm, setLabelAm] = useState("");
  const [optionsStr, setOptionsStr] = useState("");
  const [required, setRequired] = useState(true);
  const [sortOrder, setSortOrder] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldKey.trim() || !labelEn.trim()) {
      toast.error("Field Key and English Label are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const options = optionsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await upsertField({
        serviceId,
        fieldKey: fieldKey.trim(),
        labelEn: labelEn.trim(),
        labelAm: labelAm.trim() || undefined,
        options: options.length > 0 ? options : undefined,
        required,
        sortOrder: Number(sortOrder) || 1,
        active: true,
      });

      toast.success(`Specification field "${fieldKey}" saved.`);
      setFieldKey("");
      setLabelEn("");
      setLabelAm("");
      setOptionsStr("");
      setRequired(true);
      setSortOrder((specFields?.length ?? 0) + 2);
      setIsAdding(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save specification field.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span>Wizard Specification Fields</span>
            <span className="text-xs font-mono bg-cyan/10 text-cyan px-2 py-0.5 rounded-full border border-cyan/20">
              {specFields?.length ?? 0}
            </span>
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Custom dropdowns & inputs presented in the Customer Order Wizard.
          </p>
        </div>
        {!isAdding && (
          <Button
            size="small"
            variant="secondary"
            onClick={() => {
              setSortOrder((specFields?.length ?? 0) + 1);
              setIsAdding(true);
            }}
            className="text-xs h-8"
          >
            <PlusCircle className="h-3.5 w-3.5 mr-1" />
            Add Field
          </Button>
        )}
      </div>

      {/* Field List */}
      {specFields && specFields.length > 0 ? (
        <div className="space-y-2">
          {specFields.map((field: any) => (
            <div
              key={field._id}
              className={`p-3 rounded-lg border text-xs transition-colors ${
                field.active
                  ? "border-border/60 bg-muted/20"
                  : "border-border/30 bg-muted/5 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground font-mono">{field.fieldKey}</span>
                    <span className="text-muted-foreground">— {field.labelEn}</span>
                    {field.labelAm && (
                      <span className="text-neutral-400">({field.labelAm})</span>
                    )}
                    {field.required ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-medium border border-amber-500/20">
                        Required
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-neutral-500/10 text-neutral-400 text-[10px]">
                        Optional
                      </span>
                    )}
                  </div>
                  {field.options && field.options.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {field.options.map((opt: string) => (
                        <span
                          key={opt}
                          className="px-1.5 py-0.5 rounded bg-background text-neutral-300 text-[10px] border border-border"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="small"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await toggleActive({ id: field._id, active: !field.active });
                        toast.success(`Field ${field.active ? "deactivated" : "activated"}.`);
                      } catch (err: any) {
                        toast.error(err?.message || "Failed to update status.");
                      }
                    }}
                    className="h-7 px-2 text-[11px]"
                  >
                    {field.active ? "Active" : "Disabled"}
                  </Button>
                  <Button
                    size="small"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm(`Delete specification field "${field.fieldKey}"?`)) return;
                      try {
                        await deleteField({ id: field._id });
                        toast.success("Field deleted.");
                      } catch (err: any) {
                        toast.error(err?.message || "Failed to delete.");
                      }
                    }}
                    className="h-7 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 text-center rounded-lg border border-dashed border-border/40 text-xs text-muted-foreground">
          No specification fields configured for this service.
        </div>
      )}

      {/* Add Field Form */}
      {isAdding && (
        <form onSubmit={handleSave} className="p-3 rounded-lg border border-cyan/30 bg-cyan/5 space-y-3">
          <div className="text-xs font-semibold text-cyan">New Specification Field</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">Field Key (camelCase)</label>
              <input
                type="text"
                placeholder="e.g. powerSupply"
                value={fieldKey}
                onChange={(e) => setFieldKey(e.target.value)}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground font-mono focus:border-cyan focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">Sort Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">Label [EN]</label>
              <input
                type="text"
                placeholder="e.g. Power Supply"
                value={labelEn}
                onChange={(e) => setLabelEn(e.target.value)}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-cyan focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">Label [AM] (Optional)</label>
              <input
                type="text"
                placeholder="e.g. የኃይል አቅርቦት"
                value={labelAm}
                onChange={(e) => setLabelAm(e.target.value)}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Dropdown Options (comma-separated)</label>
            <input
              type="text"
              placeholder="e.g. 100W, 200W, 300W, 400W"
              value={optionsStr}
              onChange={(e) => setOptionsStr(e.target.value)}
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-cyan focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="req-checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="req-checkbox" className="text-xs text-foreground cursor-pointer">
              Required field in customer wizard
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="tertiary"
              size="small"
              onClick={() => setIsAdding(false)}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="small"
              disabled={isSubmitting}
              className="h-7 text-xs bg-cyan text-cyan-foreground hover:bg-cyan/90"
            >
              {isSubmitting ? "Saving..." : "Save Field"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
