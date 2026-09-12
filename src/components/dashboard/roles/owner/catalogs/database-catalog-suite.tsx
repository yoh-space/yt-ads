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
  X,
} from "lucide-react";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { Button } from "@/components/shared/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/shared/ui/tabs";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { toast } from "sonner";

interface ServiceRecord {
  id: string;
  labelEn: string;
  labelAm: string;
  categoryKey: string;
  categoryNameEn: string;
  categoryNameAm?: string;
  sortOrder: number;
  active: boolean;
  publishable: boolean;
}

interface MaterialRecord {
  id: string;
  name: string;
  category: string;
  catalogFamily: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionRatio: number;
  rollWidth?: number;
  catalogDimensions?: string;
  active: boolean;
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

  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoute, setSelectedRoute] = useState<RouteRecord | null>(null);

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
                          onClick={() => setSelectedRoute({ ...route })}
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
                    {cfg.machineSlug ? (
                      <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[11px] text-purple-400">
                        {cfg.machineSlug}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Global</span>
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Database Permissions Summary" subtitle="Permissions granted to each role." />
              <div className="max-h-[500px] overflow-y-auto divide-y divide-border text-xs">
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
                  <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                    #{group.sortOrder}
                  </span>
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

      {/* Route Edit Modal */}
      {selectedRoute ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-semibold text-foreground">
                Edit Route: {selectedRoute.serviceId}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedRoute(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">Preferred Machine</label>
                <input
                  type="text"
                  value={selectedRoute.preferredMachineCode}
                  onChange={(e) =>
                    setSelectedRoute({ ...selectedRoute, preferredMachineCode: e.target.value })
                  }
                  className="w-full rounded border border-border bg-background p-2 text-foreground font-mono"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Default Waste Margin (%)</label>
                <input
                  type="number"
                  value={selectedRoute.defaultWasteMarginPercent}
                  onChange={(e) =>
                    setSelectedRoute({
                      ...selectedRoute,
                      defaultWasteMarginPercent: Number(e.target.value),
                    })
                  }
                  className="w-full rounded border border-border bg-background p-2 text-foreground font-mono"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Max Scrap Limit (%)</label>
                <input
                  type="number"
                  value={selectedRoute.maxScrapLimitPercent}
                  onChange={(e) =>
                    setSelectedRoute({
                      ...selectedRoute,
                      maxScrapLimitPercent: Number(e.target.value),
                    })
                  }
                  className="w-full rounded border border-border bg-background p-2 text-foreground font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="tertiary" onClick={() => setSelectedRoute(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    await upsertServiceRoute({
                      serviceId: selectedRoute.serviceId,
                      materialType: selectedRoute.materialType,
                      preferredMaterialName: selectedRoute.preferredMaterialName,
                      requiredCapabilities: selectedRoute.requiredCapabilities,
                      legacyCapabilities: selectedRoute.legacyCapabilities,
                      operatorRole: selectedRoute.operatorRole,
                      preferredMachineCode: selectedRoute.preferredMachineCode,
                      calculationUnit: selectedRoute.calculationUnit,
                      defaultWasteMarginPercent: selectedRoute.defaultWasteMarginPercent,
                      maxScrapLimitPercent: selectedRoute.maxScrapLimitPercent,
                      active: selectedRoute.active,
                    });
                    toast.success("Route updated successfully");
                    setSelectedRoute(null);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed to update route");
                  }
                }}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
