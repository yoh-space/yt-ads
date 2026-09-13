"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
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
} from "lucide-react";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { Button } from "@/components/shared/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/shared/ui/tabs";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { SlidePanel } from "@/components/dashboard/modals/slide-panel";
import { toast } from "sonner";

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
}

interface RoleConfigRecord {
  roleCode: string;
  workspaceId: string;
  homeRoute: string;
  machineSlug?: string;
  active: boolean;
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
}

export function DatabaseCatalogSuite() {
  const syncStatus = useQuery(api.catalog.getDatabaseFirstSyncStatus, {});
  const services = useQuery(api.catalog.listServices, { includeInactive: true });
  const materials = useQuery(api.catalog.listMaterialsCatalog, { includeInactive: true });
  const routes = useQuery(api.catalog.listServiceRoutes, { includeInactive: true });
  const roleConfigs = useQuery(api.catalog.listRoleWorkspaceConfigs, {});
  const permissions = useQuery(api.catalog.listRolePermissions, {});
  const categoryGroups = useQuery(api.catalog.listMaterialCategoryGroups, { includeInactive: true });

  const seedCatalogs = useMutation(api.catalog.seedDatabaseFirstCatalogs);
  const toggleService = useMutation(api.catalog.toggleServiceActive);
  const toggleMaterial = useMutation(api.catalog.toggleMaterialCatalogActive);
  const upsertServiceRoute = useMutation(api.catalog.upsertServiceRoute);
  const upsertServiceMutation = useMutation(api.catalog.upsertService);
  const upsertMaterialMutation = useMutation(api.catalog.upsertMaterialCatalogItem);
  const upsertRoleConfigMutation = useMutation(api.catalog.upsertRoleWorkspaceConfig);
  const upsertGroupMutation = useMutation(api.catalog.upsertMaterialCategoryGroup);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<MaterialRecord | null>(null);
  const [editingRoute, setEditingRoute] = useState<RouteRecord | null>(null);
  const [editingRole, setEditingRole] = useState<RoleConfigRecord | null>(null);
  const [editingGroup, setEditingGroup] = useState<CategoryGroupRecord | null>(null);

  // Filtered lists
  const filteredServices = useMemo<ServiceRecord[]>(() => {
    if (!services) return [];
    const list = services as ServiceRecord[];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (s: ServiceRecord) =>
        s.id.toLowerCase().includes(q) ||
        s.labelEn.toLowerCase().includes(q) ||
        s.labelAm.toLowerCase().includes(q) ||
        s.categoryNameEn.toLowerCase().includes(q),
    );
  }, [services, searchQuery]);

  const filteredMaterials = useMemo<MaterialRecord[]>(() => {
    if (!materials) return [];
    const list = materials as MaterialRecord[];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (m: MaterialRecord) =>
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.catalogFamily.toLowerCase().includes(q),
    );
  }, [materials, searchQuery]);

  const filteredRoutes = useMemo<RouteRecord[]>(() => {
    if (!routes) return [];
    const list = routes as RouteRecord[];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (r: RouteRecord) =>
        r.serviceId.toLowerCase().includes(q) ||
        r.preferredMaterialName.toLowerCase().includes(q) ||
        r.preferredMachineCode.toLowerCase().includes(q),
    );
  }, [routes, searchQuery]);

  async function handleSyncAll() {
    setIsSyncing(true);
    try {
      const res = await seedCatalogs();
      toast.success(
        `Synchronized successfully: ${res.servicesCount} services, ${res.materialsCount} materials, ${res.routesCount} routes, ${res.roleConfigsCount} roles.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    } 
  }

  function parseList(value: string): string[] {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }

  function formatList(value?: string[]): string {
    return (value ?? []).join(", ");
  }

  function parseAttributes(value: string): Record<string, string | number> {
    const result: Record<string, string | number> = {};
    for (const pair of value.split(",")) {
      const [key, val] = pair.split("=").map((s) => s.trim());
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
      });
      toast.success(`Service ${editingService.id} updated`);
      setEditingService(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update service");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveMaterial() {
    if (!editingMaterial) return;
    setIsSaving(true);
    try {
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
        attributes: editingMaterial.attributes,
        specificationOptions: editingMaterial.specificationOptions,
        compatibleMachineTypes: editingMaterial.compatibleMachineTypes,
        storageLocation: editingMaterial.storageLocation,
        averageUse: editingMaterial.averageUse,
        catalogDimensions: editingMaterial.catalogDimensions,
        catalogVariant: editingMaterial.catalogVariant,
        active: editingMaterial.active,
        expectedUpdatedAt: editingMaterial.updatedAt,
      });
      toast.success(`Material ${editingMaterial.name} updated`);
      setEditingMaterial(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update material");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveRoute() {
    if (!editingRoute) return;
    setIsSaving(true);
    try {
      await upsertServiceRoute({
        serviceId: editingRoute.serviceId,
        materialType: editingRoute.materialType,
        preferredMaterialName: editingRoute.preferredMaterialName,
        requiredCapabilities: editingRoute.requiredCapabilities,
        legacyCapabilities: editingRoute.legacyCapabilities,
        operatorRole: editingRoute.operatorRole,
        preferredMachineCode: editingRoute.preferredMachineCode,
        calculationUnit: editingRoute.calculationUnit,
        defaultWasteMarginPercent: editingRoute.defaultWasteMarginPercent,
        maxScrapLimitPercent: editingRoute.maxScrapLimitPercent,
        active: editingRoute.active,
      });
      toast.success("Route updated successfully");
      setEditingRoute(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update route");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveRole() {
    if (!editingRole) return;
    setIsSaving(true);
    try {
      await upsertRoleConfigMutation({
        roleCode: editingRole.roleCode,
        workspaceId: editingRole.workspaceId,
        homeRoute: editingRole.homeRoute,
        machineSlug: editingRole.machineSlug,
        active: editingRole.active,
      });
      toast.success(`Role ${editingRole.roleCode} updated`);
      setEditingRole(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update role");
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
      });
      toast.success(`Group ${editingGroup.labelEn} updated`);
      setEditingGroup(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update group");
    } finally {
      setIsSaving(false);
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
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          icon={<Sparkles size={18} className="text-cyan" />}
          label="Services"
          value={syncStatus.services.total}
          subtitle={`${syncStatus.services.active} active · ${syncStatus.services.publishable} published`}
        />
        <StatCard
          icon={<Layers size={18} className="text-amber-400" />}
          label="Materials"
          value={syncStatus.materials.total}
          subtitle={`${syncStatus.materials.active} active in DB`}
        />
        <StatCard
          icon={<Route size={18} className="text-blue-400" />}
          label="Routes"
          value={syncStatus.routes.total}
          subtitle={`${syncStatus.routes.active} active service routes`}
        />
        <StatCard
          icon={<Wrench size={18} className="text-purple-400" />}
          label="Cap Links"
          value={syncStatus.capabilityLinks.total}
          subtitle={`${syncStatus.capabilityLinks.active} machine links`}
        />
        <StatCard
          icon={<ShieldCheck size={18} className="text-emerald-400" />}
          label="Roles & Workspaces"
          value={syncStatus.roleConfigs.total}
          subtitle={`${syncStatus.rolePermissions.total} permissions active`}
        />
        <StatCard
          icon={<FolderTree size={18} className="text-slate-400" />}
          label="Category Groups"
          value={syncStatus.categoryGroups.total}
          subtitle="Main inventory visual groups"
        />
      </div>

      {/* Action Banner */}
      <Panel className="border-cyan/30 bg-gradient-to-r from-cyan/10 via-background to-background p-4">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan/40 bg-cyan/20 p-2.5 text-cyan">
              <Database size={22} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Authoritative Database Catalogs</h3>
              <p className="text-xs text-muted-foreground">
                All production catalogs are served from Convex database tables. Updates take effect immediately without code redeployments.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            disabled={isSyncing}
            onClick={handleSyncAll}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <RefreshCw size={15} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Syncing Catalogs…" : "Reseed & Sync Catalogs"}
          </Button>
        </div>
      </Panel>

      {/* Main Catalog Tabs */}
      <Tabs defaultValue="services" className="space-y-4">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <TabsList className="bg-secondary/60">
            <TabsTrigger value="services">Services ({services?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="materials">Materials ({materials?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="routes">Service Routes ({routes?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="roles">Roles & Access ({roleConfigs?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="groups">Groups ({categoryGroups?.length ?? 0})</TabsTrigger>
          </TabsList>

          <div className="relative w-full max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search catalog items…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-cyan focus:outline-none"
            />
          </div>
        </div>

        {/* Tab 1: Services */}
        <TabsContent value="services">
          <Panel>
            <PanelHeader title="Service Catalog" subtitle="Database-backed service definitions and customer availability." />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-muted-foreground">
                    <th className="p-3">Order</th>
                    <th className="p-3">Service Slug</th>
                    <th className="p-3">English Label</th>
                    <th className="p-3">Amharic Label</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-center">Customer Visible</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-sans">
                  {filteredServices.map((service: ServiceRecord) => (
                    <tr key={service.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3 font-mono text-muted-foreground">{service.sortOrder}</td>
                      <td className="p-3 font-mono font-medium text-cyan">{service.id}</td>
                      <td className="p-3 font-medium text-foreground">{service.labelEn}</td>
                      <td className="p-3 font-amharic text-muted-foreground">{service.labelAm}</td>
                      <td className="p-3">
                        <span className="rounded bg-secondary px-2 py-0.5 text-[11px] text-foreground">
                          {service.categoryNameEn}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {service.publishable ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                            <Eye size={12} /> Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <EyeOff size={12} /> Hidden
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {service.active ? (
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
                            Active
                          </span>
                        ) : (
                          <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-400">
                            Archived
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="tertiary"
                            className="h-7 px-2 text-xs"
                            onClick={() => setEditingService({ ...service })}
                          >
                            <Edit3 size={12} className="mr-1" /> Edit
                          </Button>
                          <Button
                            variant="tertiary"
                            className="h-7 px-2 text-xs"
                            onClick={async () => {
                              try {
                                await toggleService({ serviceId: service.id, active: !service.active });
                                toast.success(`Service ${service.id} ${service.active ? "disabled" : "enabled"}`);
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Update failed");
                              }
                            }}
                          >
                            {service.active ? "Deactivate" : "Activate"}
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

        {/* Tab 2: Materials */}
        <TabsContent value="materials">
          <Panel>
            <PanelHeader title="Material Specifications Catalog" subtitle="Master specification registry and conversion parameters." />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-muted-foreground">
                    <th className="p-3">Material Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Family</th>
                    <th className="p-3">Purchase Unit</th>
                    <th className="p-3">Base Unit</th>
                    <th className="p-3 text-right">Ratio</th>
                    <th className="p-3">Dimensions / Roll</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMaterials.map((mat: MaterialRecord) => (
                    <tr key={mat.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3 font-medium text-foreground">{mat.name}</td>
                      <td className="p-3 text-muted-foreground">{mat.category}</td>
                      <td className="p-3">
                        <span className="rounded bg-cyan/10 px-2 py-0.5 text-[11px] font-medium text-cyan">
                          {mat.catalogFamily}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{mat.purchaseUnit}</td>
                      <td className="p-3 font-medium text-foreground">{mat.baseUnit}</td>
                      <td className="p-3 text-right font-mono">{mat.conversionRatio}</td>
                      <td className="p-3 text-muted-foreground">
                        {mat.rollWidth ? `${mat.rollWidth}m width` : mat.catalogDimensions ?? "—"}
                      </td>
                      <td className="p-3 text-center">
                        {mat.active ? (
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
                            Active
                          </span>
                        ) : (
                          <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-400">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="tertiary"
                            className="h-7 px-2 text-xs"
                            onClick={() => setEditingMaterial({ ...mat })}
                          >
                            <Edit3 size={12} className="mr-1" /> Edit
                          </Button>
                          <Button
                            variant="tertiary"
                            className="h-7 px-2 text-xs"
                            onClick={async () => {
                              try {
                                await toggleMaterial({ id: mat.id, active: !mat.active });
                                toast.success(`Material ${mat.name} ${mat.active ? "disabled" : "enabled"}`);
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Update failed");
                              }
                            }}
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
            <PanelHeader title="Service Production Routes" subtitle="Live machine routing rules, waste margins, and scrap tolerances." />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-muted-foreground">
                    <th className="p-3">Service</th>
                    <th className="p-3">Preferred Material</th>
                    <th className="p-3">Assigned Machine</th>
                    <th className="p-3">Operator Role</th>
                    <th className="p-3 text-right">Waste Margin</th>
                    <th className="p-3 text-right">Max Scrap</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Configure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRoutes.map((route: RouteRecord) => (
                    <tr key={route.serviceId} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3 font-mono font-medium text-cyan">{route.serviceId}</td>
                      <td className="p-3 text-foreground">{route.preferredMaterialName}</td>
                      <td className="p-3 font-mono font-medium text-purple-400">{route.preferredMachineCode}</td>
                      <td className="p-3 text-muted-foreground">{route.operatorRole}</td>
                      <td className="p-3 text-right font-mono">{route.defaultWasteMarginPercent}%</td>
                      <td className="p-3 text-right font-mono">{route.maxScrapLimitPercent}%</td>
                      <td className="p-3 text-center">
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
                          Active
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="tertiary"
                          className="h-7 px-2 text-xs"
                          onClick={() => setEditingRoute({ ...route })}
                        >
                          <Sliders size={12} className="mr-1" /> Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>

        {/* Tab 4: Roles & Access */}
        <TabsContent value="roles">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Role Workspace Configuration" subtitle="Routing destinations and workspace boundaries." />
              <div className="divide-y divide-border text-xs">
                {(roleConfigs as RoleConfigRecord[] | undefined)?.map((cfg: RoleConfigRecord) => (
                  <div key={cfg.roleCode} className="flex items-center justify-between p-3">
                    <div>
                      <p className="font-mono font-medium text-foreground">{cfg.roleCode}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Workspace: <span className="text-cyan">{cfg.workspaceId}</span> · Home:{" "}
                        <span className="font-mono">{cfg.homeRoute}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {cfg.machineSlug ? (
                        <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[11px] text-purple-400">
                          {cfg.machineSlug}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Global</span>
                      )}
                      <Button
                        variant="tertiary"
                        className="h-7 px-2 text-xs"
                        onClick={() => setEditingRole({ ...cfg })}
                      >
                        <Edit3 size={12} className="mr-1" /> Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Database Permissions Summary" subtitle="Permissions granted to each role." />
              <div
                className="max-h-[500px] overflow-y-auto divide-y divide-border text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {(roleConfigs as RoleConfigRecord[] | undefined)?.map((cfg: RoleConfigRecord) => {
                  const rolePerms = ((permissions as PermissionRecord[] | undefined) ?? []).filter(
                    (p: PermissionRecord) => p.roleCode === cfg.roleCode,
                  );
                  return (
                    <div key={cfg.roleCode} className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-cyan">{cfg.roleCode}</span>
                        <span className="text-[11px] text-muted-foreground">{rolePerms.length} permissions</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {rolePerms.slice(0, 8).map((p: PermissionRecord) => (
                          <span key={p.permission} className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {p.permission}
                          </span>
                        ))}
                        {rolePerms.length > 8 ? (
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            +{rolePerms.length - 8} more
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* Tab 5: Category Groups */}
        <TabsContent value="groups">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(categoryGroups as CategoryGroupRecord[] | undefined)?.map((group: CategoryGroupRecord) => (
              <Panel key={group.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">{group.labelEn}</h4>
                    <p className="text-xs font-amharic text-muted-foreground">{group.labelAm}</p>
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
                <p className="text-xs text-muted-foreground">{group.descriptionEn}</p>
                <div className="border-t border-border pt-2">
                  <p className="text-[11px] font-medium text-foreground mb-1">Member Categories:</p>
                  <div className="flex flex-wrap gap-1">
                    {group.memberCategories.map((c: string) => (
                      <span key={c} className="rounded bg-cyan/10 px-1.5 py-0.5 text-[10px] text-cyan">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Service Edit Panel */}
      {editingService ? (
        <SlidePanel
          title={`Edit Service: ${editingService.id}`}
          subtitle="Database-backed service definition and customer availability."
          open
          onClose={() => setEditingService(null)}
          footer={
            <>
              <Button variant="tertiary" onClick={() => setEditingService(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveService} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save Changes"}
              </Button>
            </>
          }
        >
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">English Label</label>
            <input
              type="text"
              value={editingService.labelEn}
              onChange={(e) => setEditingService({ ...editingService, labelEn: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Amharic Label</label>
            <input
              type="text"
              value={editingService.labelAm}
              onChange={(e) => setEditingService({ ...editingService, labelAm: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-amharic focus:border-cyan focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category Key</label>
              <input
                type="text"
                value={editingService.categoryKey}
                onChange={(e) =>
                  setEditingService({ ...editingService, categoryKey: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category Name (EN)</label>
              <input
                type="text"
                value={editingService.categoryNameEn}
                onChange={(e) =>
                  setEditingService({ ...editingService, categoryNameEn: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category Name (AM)</label>
              <input
                type="text"
                value={editingService.categoryNameAm ?? ""}
                onChange={(e) =>
                  setEditingService({ ...editingService, categoryNameAm: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-amharic focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Icon Key</label>
              <input
                type="text"
                value={editingService.iconKey ?? ""}
                onChange={(e) => setEditingService({ ...editingService, iconKey: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Sort Order</label>
              <input
                type="number"
                value={editingService.sortOrder}
                onChange={(e) =>
                  setEditingService({ ...editingService, sortOrder: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Customer Visible</label>
              <select
                value={editingService.publishable ? "yes" : "no"}
                onChange={(e) =>
                  setEditingService({ ...editingService, publishable: e.target.value === "yes" })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              >
                <option value="yes">Visible</option>
                <option value="no">Hidden</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
              <select
                value={editingService.active ? "active" : "archived"}
                onChange={(e) =>
                  setEditingService({ ...editingService, active: e.target.value === "active" })
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

      {/* Material Edit Panel */}
      {editingMaterial ? (
        <SlidePanel
          title={`Edit Material: ${editingMaterial.name}`}
          subtitle="Master specification registry and conversion parameters."
          open
          onClose={() => setEditingMaterial(null)}
          footer={
            <>
              <Button variant="tertiary" onClick={() => setEditingMaterial(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveMaterial} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save Changes"}
              </Button>
            </>
          }
        >
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Material Name</label>
            <input
              type="text"
              value={editingMaterial.name}
              onChange={(e) => setEditingMaterial({ ...editingMaterial, name: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category</label>
              <input
                type="text"
                value={editingMaterial.category}
                onChange={(e) => setEditingMaterial({ ...editingMaterial, category: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Catalog Family</label>
              <input
                type="text"
                value={editingMaterial.catalogFamily}
                onChange={(e) =>
                  setEditingMaterial({ ...editingMaterial, catalogFamily: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Base Unit</label>
              <input
                type="text"
                value={editingMaterial.baseUnit}
                onChange={(e) => setEditingMaterial({ ...editingMaterial, baseUnit: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Purchase Unit</label>
              <input
                type="text"
                value={editingMaterial.purchaseUnit}
                onChange={(e) =>
                  setEditingMaterial({ ...editingMaterial, purchaseUnit: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Conversion Ratio</label>
              <input
                type="number"
                value={editingMaterial.conversionRatio}
                onChange={(e) =>
                  setEditingMaterial({
                    ...editingMaterial,
                    conversionRatio: Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Roll Width (m)</label>
              <input
                type="number"
                value={editingMaterial.rollWidth ?? ""}
                onChange={(e) =>
                  setEditingMaterial({
                    ...editingMaterial,
                    rollWidth: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Catalog Dimensions</label>
              <input
                type="text"
                value={editingMaterial.catalogDimensions ?? ""}
                onChange={(e) =>
                  setEditingMaterial({ ...editingMaterial, catalogDimensions: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Sheet Width (m)</label>
              <input
                type="number"
                value={editingMaterial.sheetWidth ?? ""}
                onChange={(e) =>
                  setEditingMaterial({
                    ...editingMaterial,
                    sheetWidth: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Sheet Length (m)</label>
              <input
                type="number"
                value={editingMaterial.sheetLength ?? ""}
                onChange={(e) =>
                  setEditingMaterial({
                    ...editingMaterial,
                    sheetLength: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Thickness</label>
              <input
                type="number"
                value={editingMaterial.thickness ?? ""}
                onChange={(e) =>
                  setEditingMaterial({
                    ...editingMaterial,
                    thickness: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Storage Location</label>
              <input
                type="text"
                value={editingMaterial.storageLocation ?? ""}
                onChange={(e) =>
                  setEditingMaterial({ ...editingMaterial, storageLocation: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Average Use</label>
              <input
                type="text"
                value={editingMaterial.averageUse ?? ""}
                onChange={(e) =>
                  setEditingMaterial({ ...editingMaterial, averageUse: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Aliases (comma-separated)</label>
            <input
              type="text"
              value={formatList(editingMaterial.aliases)}
              onChange={(e) =>
                setEditingMaterial({ ...editingMaterial, aliases: parseList(e.target.value) })
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Specification Options (comma-separated)</label>
            <input
              type="text"
              value={formatList(editingMaterial.specificationOptions)}
              onChange={(e) =>
                setEditingMaterial({
                  ...editingMaterial,
                  specificationOptions: parseList(e.target.value),
                })
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Compatible Machine Types (comma-separated)</label>
            <input
              type="text"
              value={formatList(editingMaterial.compatibleMachineTypes)}
              onChange={(e) =>
                setEditingMaterial({
                  ...editingMaterial,
                  compatibleMachineTypes: parseList(e.target.value),
                })
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Attributes (key=value, comma-separated)</label>
            <input
              type="text"
              value={formatAttributes(editingMaterial.attributes)}
              onChange={(e) =>
                setEditingMaterial({ ...editingMaterial, attributes: parseAttributes(e.target.value) })
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
            <select
              value={editingMaterial.active ? "active" : "inactive"}
              onChange={(e) =>
                setEditingMaterial({ ...editingMaterial, active: e.target.value === "active" })
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </SlidePanel>
      ) : null}

      {/* Route Edit Panel */}
      {editingRoute ? (
        <SlidePanel
          title={`Edit Route: ${editingRoute.serviceId}`}
          subtitle="Live machine routing rules, waste margins, and scrap tolerances."
          open
          onClose={() => setEditingRoute(null)}
          footer={
            <>
              <Button variant="tertiary" onClick={() => setEditingRoute(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveRoute} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save Changes"}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Preferred Machine</label>
              <input
                type="text"
                value={editingRoute.preferredMachineCode}
                onChange={(e) =>
                  setEditingRoute({ ...editingRoute, preferredMachineCode: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Preferred Material</label>
              <input
                type="text"
                value={editingRoute.preferredMaterialName}
                onChange={(e) =>
                  setEditingRoute({ ...editingRoute, preferredMaterialName: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Operator Role</label>
              <input
                type="text"
                value={editingRoute.operatorRole}
                onChange={(e) => setEditingRoute({ ...editingRoute, operatorRole: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Calculation Unit</label>
              <input
                type="text"
                value={editingRoute.calculationUnit}
                onChange={(e) =>
                  setEditingRoute({ ...editingRoute, calculationUnit: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Default Waste Margin (%)</label>
              <input
                type="number"
                value={editingRoute.defaultWasteMarginPercent}
                onChange={(e) =>
                  setEditingRoute({
                    ...editingRoute,
                    defaultWasteMarginPercent: Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Max Scrap Limit (%)</label>
              <input
                type="number"
                value={editingRoute.maxScrapLimitPercent}
                onChange={(e) =>
                  setEditingRoute({ ...editingRoute, maxScrapLimitPercent: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Required Capabilities (comma-separated)</label>
            <input
              type="text"
              value={formatList(editingRoute.requiredCapabilities)}
              onChange={(e) =>
                setEditingRoute({
                  ...editingRoute,
                  requiredCapabilities: parseList(e.target.value),
                })
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Legacy Capabilities (comma-separated)</label>
            <input
              type="text"
              value={formatList(editingRoute.legacyCapabilities)}
              onChange={(e) =>
                setEditingRoute({ ...editingRoute, legacyCapabilities: parseList(e.target.value) })
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
            <select
              value={editingRoute.active ? "active" : "inactive"}
              onChange={(e) =>
                setEditingRoute({ ...editingRoute, active: e.target.value === "active" })
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </SlidePanel>
      ) : null}

      {/* Role Workspace Edit Panel */}
      {editingRole ? (
        <SlidePanel
          title={`Edit Role: ${editingRole.roleCode}`}
          subtitle="Routing destinations and workspace boundaries."
          open
          onClose={() => setEditingRole(null)}
          footer={
            <>
              <Button variant="tertiary" onClick={() => setEditingRole(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveRole} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save Changes"}
              </Button>
            </>
          }
        >
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Role Code</label>
            <input
              type="text"
              value={editingRole.roleCode}
              onChange={(e) => setEditingRole({ ...editingRole, roleCode: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Workspace</label>
            <input
              type="text"
              value={editingRole.workspaceId}
              onChange={(e) => setEditingRole({ ...editingRole, workspaceId: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Home Route</label>
            <input
              type="text"
              value={editingRole.homeRoute}
              onChange={(e) => setEditingRole({ ...editingRole, homeRoute: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Machine Slug (optional)</label>
            <input
              type="text"
              value={editingRole.machineSlug ?? ""}
              onChange={(e) => setEditingRole({ ...editingRole, machineSlug: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
            <select
              value={editingRole.active ? "active" : "inactive"}
              onChange={(e) => setEditingRole({ ...editingRole, active: e.target.value === "active" })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </SlidePanel>
      ) : null}

      {/* Category Group Edit Panel */}
      {editingGroup ? (
        <SlidePanel
          title={`Edit Group: ${editingGroup.labelEn}`}
          subtitle="Main inventory visual grouping."
          open
          onClose={() => setEditingGroup(null)}
          footer={
            <>
              <Button variant="tertiary" onClick={() => setEditingGroup(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveGroup} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save Changes"}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">English Label</label>
              <input
                type="text"
                value={editingGroup.labelEn}
                onChange={(e) => setEditingGroup({ ...editingGroup, labelEn: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Amharic Label</label>
              <input
                type="text"
                value={editingGroup.labelAm}
                onChange={(e) => setEditingGroup({ ...editingGroup, labelAm: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-amharic focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description (EN)</label>
              <input
                type="text"
                value={editingGroup.descriptionEn ?? ""}
                onChange={(e) => setEditingGroup({ ...editingGroup, descriptionEn: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description (AM)</label>
              <input
                type="text"
                value={editingGroup.descriptionAm ?? ""}
                onChange={(e) => setEditingGroup({ ...editingGroup, descriptionAm: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-amharic focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Icon Name</label>
              <input
                type="text"
                value={editingGroup.iconName}
                onChange={(e) => setEditingGroup({ ...editingGroup, iconName: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tone</label>
              <input
                type="text"
                value={editingGroup.tone}
                onChange={(e) => setEditingGroup({ ...editingGroup, tone: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Sort Order</label>
              <input
                type="number"
                value={editingGroup.sortOrder}
                onChange={(e) => setEditingGroup({ ...editingGroup, sortOrder: Number(e.target.value) })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:border-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
              <select
                value={editingGroup.active ? "active" : "inactive"}
                onChange={(e) =>
                  setEditingGroup({ ...editingGroup, active: e.target.value === "active" })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Member Categories (comma-separated)</label>
            <input
              type="text"
              value={formatList(editingGroup.memberCategories)}
              onChange={(e) =>
                setEditingGroup({ ...editingGroup, memberCategories: parseList(e.target.value) })
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
            />
          </div>
        </SlidePanel>
      ) : null}
    </div>
  );
}
