"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OwnerPageHeader } from "@/components/dashboard/roles/owner/owner-page-header";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { Button } from "@/components/shared/ui/button";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/shared/ui/tabs";
import { Factory, Droplets, Link2, Route, Package, AlertTriangle, Plus, Pencil, Archive, RotateCcw, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";

export default function MachineConfigurePage() {
  const params = useParams();
  const router = useRouter();
  const machineId = params.machineId as Id<"machines">;

  const machine = useQuery(api.machines.get, machineId ? { id: machineId } : "skip");
  const inkRules = useQuery(api.owner.machineInkRules.list, machineId ? { machineId, includeInactive: true } : "skip");
  const serviceRoutes = useQuery(api.owner.machineServiceRoutes.list, machineId ? { machineId, includeInactive: true } : "skip");
  const materialLinks = useQuery(api.owner.machineMaterialLinks.list, machineId ? { machineId, includeInactive: true } : "skip");
  const capabilities = useQuery(api.catalog.listCapabilities, {});
  const materials = useQuery(api.materials.list, {});
  const serviceDefinitions = useQuery(api.owner.serviceDefinitions.list, {});

  const [drawer, setDrawer] = useState<{ type: string; item?: any } | null>(null);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  // Close drawer on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrawer(); };
    if (drawer) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [drawer, closeDrawer]);

  if (machine === undefined || inkRules === undefined || serviceRoutes === undefined || materialLinks === undefined || capabilities === undefined || materials === undefined || serviceDefinitions === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Machine Configuration…" />
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Machine not found.</p>
          <Button variant="secondary" onClick={() => router.push("/dashboard/owner/machines")}>
            Back to Machines
          </Button>
        </div>
      </div>
    );
  }

  const inkRuleCount = inkRules.filter((r) => r.active).length;
  const routeCount = serviceRoutes.filter((r) => r.active).length;
  const activeRoutes = serviceRoutes.filter((r) => r.active && r.customerVisible).length;
  const linkCount = materialLinks.filter((l) => l.active).length;

  // Build lookup maps once for all tabs
  const materialMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const mat of materials) m.set(mat._id, mat.name);
    return m;
  }, [materials]);
  const capMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of capabilities) m.set(c._id, c.name);
    return m;
  }, [capabilities]);
  const serviceDefMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of serviceDefinitions) m.set(s._id, s.nameEn);
    return m;
  }, [serviceDefinitions]);

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        kicker="Machine Configuration"
        title={machine.name}
        subtitle={`${machine.code} · ${machine.type}`}
        action={
          <Button variant="secondary" onClick={() => router.push("/dashboard/owner/machines")}>
            Back to Machines
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Droplets size={16} />} label="Ink Rules" value={inkRuleCount} variant="default" />
        <StatCard icon={<Link2 size={16} />} label="Material Links" value={linkCount} variant="sales" />
        <StatCard icon={<Route size={16} />} label="Service Routes" value={routeCount} variant="cost" />
        <StatCard icon={<Package size={16} />} label="Publishable" value={activeRoutes} variant={activeRoutes > 0 ? "default" : "alert"} isAlert={activeRoutes === 0} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview"><Factory size={14} className="mr-1.5" />Overview</TabsTrigger>
          <TabsTrigger value="ink-rules"><Droplets size={14} className="mr-1.5" />Ink Rules ({inkRuleCount})</TabsTrigger>
          <TabsTrigger value="material-links"><Link2 size={14} className="mr-1.5" />Material Links ({linkCount})</TabsTrigger>
          <TabsTrigger value="service-routes"><Route size={14} className="mr-1.5" />Service Routes ({routeCount})</TabsTrigger>
          <TabsTrigger value="warnings"><AlertTriangle size={14} className="mr-1.5" />Warnings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <MachineOverviewTab machine={machine} />
        </TabsContent>
        <TabsContent value="ink-rules">
          <InkRulesTab inkRules={inkRules} materialMap={materialMap} onOpenDrawer={setDrawer} />
        </TabsContent>
        <TabsContent value="material-links">
          <MaterialLinksTab materialLinks={materialLinks} materialMap={materialMap} onOpenDrawer={setDrawer} />
        </TabsContent>
        <TabsContent value="service-routes">
          <ServiceRoutesTab serviceRoutes={serviceRoutes} capMap={capMap} serviceDefMap={serviceDefMap} onOpenDrawer={setDrawer} />
        </TabsContent>
        <TabsContent value="warnings">
          <WarningsTab machine={machine} inkRuleCount={inkRuleCount} routeCount={routeCount} linkCount={linkCount} />
        </TabsContent>
      </Tabs>

      {/* Right-side slide-in drawer */}
      {drawer && (
        <DrawerShell title={
          drawer.type === "ink-rule" ? (drawer.item ? "Edit Ink Rule" : "New Ink Rule") :
          drawer.type === "material-link" ? (drawer.item ? "Edit Material Link" : "New Material Link") :
          (drawer.item ? "Edit Service Route" : "New Service Route")
        } onClose={closeDrawer}>
          {drawer.type === "ink-rule" && (
            <InkRuleForm machineId={machineId} item={drawer.item} materialMap={materialMap} materials={materials} onDone={closeDrawer} />
          )}
          {drawer.type === "material-link" && (
            <MaterialLinkForm machineId={machineId} item={drawer.item} materialMap={materialMap} materials={materials} onDone={closeDrawer} />
          )}
          {drawer.type === "service-route" && (
            <ServiceRouteForm machineId={machineId} item={drawer.item} capMap={capMap} serviceDefMap={serviceDefMap} capabilities={capabilities} serviceDefinitions={serviceDefinitions} onDone={closeDrawer} />
          )}
        </DrawerShell>
      )}
    </div>
  );
}

/* ───────── Drawer Shell ───────── */

function DrawerShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-background border-l border-border/60 shadow-2xl flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </>
  );
}

/* ───────── Overview Tab ───────── */

function MachineOverviewTab({ machine }: { machine: any }) {
  return (
    <Panel>
      <PanelHeader title="Machine Overview" kicker="Identity" icon={<Factory size={16} />} />
      <div className="p-[17px] grid gap-6 sm:grid-cols-2">
        <dl className="space-y-3">
          {(["name", "code", "type", "manufacturer", "model"] as const).map((key) =>
            machine[key] ? (
              <div key={key}>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{key}</dt>
                <dd className="text-sm font-medium text-foreground">{machine[key]}</dd>
              </div>
            ) : null
          )}
        </dl>
        <dl className="space-y-3">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</dt>
            <dd className="text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] font-medium">
                {machine.status === "Running" && <span className="h-1.5 w-1.5 rounded-full bg-green" />}
                {machine.status === "Available" && <span className="h-1.5 w-1.5 rounded-full bg-cyan" />}
                {machine.status === "Maintenance" && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
                {machine.status === "Unavailable" && <span className="h-1.5 w-1.5 rounded-full bg-danger" />}
                {machine.status}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Operator Role</dt>
            <dd className="text-sm text-foreground">{machine.operatorRole}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Material Unit</dt>
            <dd className="text-sm text-foreground">{machine.materialUnit}</dd>
          </div>
        </dl>
      </div>
    </Panel>
  );
}

/* ───────── Ink Rules Tab ───────── */

function InkRulesTab({ inkRules, materialMap, onOpenDrawer }: { inkRules: any[]; materialMap: Map<string, string>; onOpenDrawer: (m: { type: string; item?: any }) => void }) {
  const archiveMutation = useMutation(api.owner.machineInkRules.archive);
  const restoreMutation = useMutation(api.owner.machineInkRules.restore);

  return (
    <Panel>
      <PanelHeader
        title="Ink Consumption Rules"
        kicker="Production"
        icon={<Droplets size={16} />}
        action={
          <button onClick={() => onOpenDrawer({ type: "ink-rule" })} className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-background/80 hover:text-foreground transition-colors">
            <Plus size={12} /> Add Rule
          </button>
        }
      />
      {inkRules.length === 0 ? (
        <div className="p-[17px] text-center text-[12px] text-muted-foreground">No ink rules configured.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border/60">
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Color</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Material</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Rate</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Unit</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Waste %</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Default</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                <th className="p-[17px] text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inkRules.map((rule) => (
                <tr key={rule._id} className="border-b border-border/30 hover:bg-background/40">
                  <td className="p-[17px] font-medium text-foreground">{rule.inkColor}</td>
                  <td className="p-[17px] text-muted-foreground">{materialMap.get(rule.materialId) ?? "—"}</td>
                  <td className="p-[17px] font-mono text-foreground">{rule.rate}</td>
                  <td className="p-[17px] text-muted-foreground">{rule.consumptionUnit}</td>
                  <td className="p-[17px] font-mono text-foreground">{rule.wasteAllowancePercent ?? "—"}</td>
                  <td className="p-[17px]">{rule.isDefault ? <span className="text-[10px] font-medium text-cyan">Default</span> : "—"}</td>
                  <td className="p-[17px]">
                    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${rule.active ? "bg-green/10 text-green" : "bg-muted text-muted-foreground"}`}>
                      {rule.active ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td className="p-[17px] text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => onOpenDrawer({ type: "ink-rule", item: rule })} className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"><Pencil size={12} /></button>
                      {rule.active ? (
                        <button onClick={async () => { await archiveMutation({ id: rule._id }); toast.success("Archived"); }} className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-danger transition-colors"><Archive size={12} /></button>
                      ) : (
                        <button onClick={async () => { await restoreMutation({ id: rule._id }); toast.success("Restored"); }} className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-green transition-colors"><RotateCcw size={12} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ───────── Material Links Tab ───────── */

function MaterialLinksTab({ materialLinks, materialMap, onOpenDrawer }: { materialLinks: any[]; materialMap: Map<string, string>; onOpenDrawer: (m: { type: string; item?: any }) => void }) {
  const archiveMutation = useMutation(api.owner.machineMaterialLinks.archive);
  const restoreMutation = useMutation(api.owner.machineMaterialLinks.restore);

  return (
    <Panel>
      <PanelHeader
        title="Material Links"
        kicker="Compatibility"
        icon={<Link2 size={16} />}
        action={
          <button onClick={() => onOpenDrawer({ type: "material-link" })} className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-background/80 hover:text-foreground transition-colors">
            <Plus size={12} /> Add Link
          </button>
        }
      />
      {materialLinks.length === 0 ? (
        <div className="p-[17px] text-center text-[12px] text-muted-foreground">No material links configured.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border/60">
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Material</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Relationship</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Production Type</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Required</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Waste %</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                <th className="p-[17px] text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {materialLinks.map((link) => (
                <tr key={link._id} className="border-b border-border/30 hover:bg-background/40">
                  <td className="p-[17px] font-medium text-foreground">{materialMap.get(link.materialId) ?? "—"}</td>
                  <td className="p-[17px] text-muted-foreground capitalize">{link.relationshipType}</td>
                  <td className="p-[17px] text-muted-foreground capitalize">{link.productionType ?? "—"}</td>
                  <td className="p-[17px]">{link.required ? <span className="text-[10px] font-medium text-cyan">Yes</span> : "—"}</td>
                  <td className="p-[17px] font-mono text-foreground">{link.wasteMarginPercent ?? "—"}</td>
                  <td className="p-[17px]">
                    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${link.active ? "bg-green/10 text-green" : "bg-muted text-muted-foreground"}`}>
                      {link.active ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td className="p-[17px] text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => onOpenDrawer({ type: "material-link", item: link })} className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"><Pencil size={12} /></button>
                      {link.active ? (
                        <button onClick={async () => { await archiveMutation({ id: link._id }); toast.success("Archived"); }} className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-danger transition-colors"><Archive size={12} /></button>
                      ) : (
                        <button onClick={async () => { await restoreMutation({ id: link._id }); toast.success("Restored"); }} className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-green transition-colors"><RotateCcw size={12} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ───────── Service Routes Tab ───────── */

function ServiceRoutesTab({ serviceRoutes, capMap, serviceDefMap, onOpenDrawer }: { serviceRoutes: any[]; capMap: Map<string, string>; serviceDefMap: Map<string, string>; onOpenDrawer: (m: { type: string; item?: any }) => void }) {
  const archiveMutation = useMutation(api.owner.machineServiceRoutes.archive);
  const restoreMutation = useMutation(api.owner.machineServiceRoutes.restore);

  return (
    <Panel>
      <PanelHeader
        title="Service Routes"
        kicker="Routing"
        icon={<Route size={16} />}
        action={
          <button onClick={() => onOpenDrawer({ type: "service-route" })} className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-background/80 hover:text-foreground transition-colors">
            <Plus size={12} /> Add Route
          </button>
        }
      />
      {serviceRoutes.length === 0 ? (
        <div className="p-[17px] text-center text-[12px] text-muted-foreground">No service routes configured.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border/60">
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Service</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Capability</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Priority</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Unit</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Waste %</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Visible</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                <th className="p-[17px] text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {serviceRoutes.map((route) => (
                <tr key={route._id} className="border-b border-border/30 hover:bg-background/40">
                  <td className="p-[17px] font-medium text-foreground">{serviceDefMap.get(route.serviceId) ?? "—"}</td>
                  <td className="p-[17px] text-muted-foreground">{capMap.get(route.capabilityId) ?? "—"}</td>
                  <td className="p-[17px] font-mono text-foreground">{route.priority}</td>
                  <td className="p-[17px] text-muted-foreground">{route.calculationUnit}</td>
                  <td className="p-[17px] font-mono text-foreground">{route.defaultWasteMarginPercent ?? "—"}</td>
                  <td className="p-[17px]">{route.customerVisible ? <span className="text-[10px] font-medium text-cyan">Yes</span> : "No"}</td>
                  <td className="p-[17px]">
                    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${route.active ? "bg-green/10 text-green" : "bg-muted text-muted-foreground"}`}>
                      {route.active ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td className="p-[17px] text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => onOpenDrawer({ type: "service-route", item: route })} className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"><Pencil size={12} /></button>
                      {route.active ? (
                        <button onClick={async () => { await archiveMutation({ id: route._id }); toast.success("Archived"); }} className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-danger transition-colors"><Archive size={12} /></button>
                      ) : (
                        <button onClick={async () => { await restoreMutation({ id: route._id }); toast.success("Restored"); }} className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-green transition-colors"><RotateCcw size={12} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ───────── Warnings Tab ───────── */

function WarningsTab({ machine, inkRuleCount, routeCount, linkCount }: { machine: any; inkRuleCount: number; routeCount: number; linkCount: number }) {
  const warnings: Array<{ severity: "error" | "warning"; message: string }> = [];
  if (inkRuleCount === 0) warnings.push({ severity: "warning", message: "No ink consumption rules. Ink deductions use global defaults." });
  if (routeCount === 0) warnings.push({ severity: "error", message: "No service routes. This machine cannot produce any services." });
  if (linkCount === 0) warnings.push({ severity: "warning", message: "No material links. Machine-material compatibility is not explicitly defined." });
  if (!machine.active) warnings.push({ severity: "error", message: "Machine is archived." });
  if (machine.status === "Maintenance" || machine.status === "Unavailable") warnings.push({ severity: "warning", message: `Status is "${machine.status}".` });

  return (
    <Panel>
      <PanelHeader title="Configuration Warnings" kicker="Health" icon={<AlertTriangle size={16} />} />
      {warnings.length === 0 ? (
        <div className="p-[17px] text-center text-[12px] text-green font-medium">No warnings. Configuration looks healthy.</div>
      ) : (
        <div className="p-[17px] space-y-3">
          {warnings.map((w, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 text-[12px] ${w.severity === "error" ? "border-danger/30 bg-danger/5 text-danger" : "border-gold/30 bg-gold/5 text-gold"}`}>
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ───────── Ink Rule Form (inside drawer) ───────── */

function InkRuleForm({ machineId, item, materialMap, materials, onDone }: { machineId: Id<"machines">; item?: any; materialMap: Map<string, string>; materials: any[]; onDone: () => void }) {
  const upsert = useMutation(api.owner.machineInkRules.upsert);
  const inkMaterials = useMemo(() => materials.filter((m) => m.materialFamily === "INK" || m.name.toLowerCase().includes("ink")), [materials]);
  const [form, setForm] = useState({
    materialId: item?.materialId ?? inkMaterials[0]?._id ?? "",
    inkColor: item?.inkColor ?? "Cyan",
    consumptionUnit: item?.consumptionUnit ?? "ml_per_sqm",
    rate: item?.rate?.toString() ?? "1",
    wasteAllowancePercent: item?.wasteAllowancePercent?.toString() ?? "",
    isDefault: item?.isDefault ?? false,
    notes: item?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.materialId || !form.inkColor || !form.rate) { toast.error("Fill required fields"); return; }
    setSaving(true);
    try {
      await upsert({
        id: item?._id,
        machineId,
        materialId: form.materialId as Id<"materials">,
        inkColor: form.inkColor,
        consumptionUnit: form.consumptionUnit as any,
        rate: Number(form.rate),
        wasteAllowancePercent: form.wasteAllowancePercent ? Number(form.wasteAllowancePercent) : undefined,
        isDefault: form.isDefault,
        active: true,
        notes: form.notes || undefined,
      });
      toast.success(item ? "Rule updated" : "Rule created");
      onDone();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Material *">
        <select value={form.materialId} onChange={(e) => setForm({ ...form, materialId: e.target.value })} className="input-field">
          <option value="">Select ink material</option>
          {inkMaterials.map((m: any) => <option key={m._id} value={m._id}>{m.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ink Color *">
          <select value={form.inkColor} onChange={(e) => setForm({ ...form, inkColor: e.target.value })} className="input-field">
            {["Cyan", "Magenta", "Yellow", "Black", "White", "Red", "Green", "Blue"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Unit *">
          <select value={form.consumptionUnit} onChange={(e) => setForm({ ...form, consumptionUnit: e.target.value })} className="input-field">
            <option value="ml_per_sqm">mL per m²</option>
            <option value="ml_per_rm">mL per rm</option>
            <option value="ml_per_piece">mL per piece</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rate *">
          <input type="number" step="0.001" min="0" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} className="input-field" />
        </Field>
        <Field label="Waste Allowance %">
          <input type="number" step="0.1" min="0" max="100" value={form.wasteAllowancePercent} onChange={(e) => setForm({ ...form, wasteAllowancePercent: e.target.value })} className="input-field" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[12px] text-foreground">
        <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="rounded border-border/60" />
        Default rule for this machine/color
      </label>
      <Field label="Notes">
        <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field" />
      </Field>
      <DrawerFooter saving={saving} savingText={item ? "Updating…" : "Creating…"} onCancel={onDone} />
    </form>
  );
}

/* ───────── Material Link Form (inside drawer) ───────── */

function MaterialLinkForm({ machineId, item, materialMap, materials, onDone }: { machineId: Id<"machines">; item?: any; materialMap: Map<string, string>; materials: any[]; onDone: () => void }) {
  const upsert = useMutation(api.owner.machineMaterialLinks.upsert);
  const [form, setForm] = useState({
    materialId: item?.materialId ?? materials[0]?._id ?? "",
    relationshipType: item?.relationshipType ?? "primary",
    productionType: item?.productionType ?? "area",
    conversionRatioOverride: item?.conversionRatioOverride?.toString() ?? "",
    wasteMarginPercent: item?.wasteMarginPercent?.toString() ?? "",
    required: item?.required ?? true,
    notes: item?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.materialId) { toast.error("Select a material"); return; }
    setSaving(true);
    try {
      await upsert({
        id: item?._id,
        machineId,
        materialId: form.materialId as Id<"materials">,
        relationshipType: form.relationshipType as any,
        productionType: form.productionType as any || undefined,
        conversionRatioOverride: form.conversionRatioOverride ? Number(form.conversionRatioOverride) : undefined,
        wasteMarginPercent: form.wasteMarginPercent ? Number(form.wasteMarginPercent) : undefined,
        required: form.required,
        active: true,
        notes: form.notes || undefined,
      });
      toast.success(item ? "Link updated" : "Link created");
      onDone();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Material *">
        <select value={form.materialId} onChange={(e) => setForm({ ...form, materialId: e.target.value })} className="input-field">
          <option value="">Select material</option>
          {materials.map((m: any) => <option key={m._id} value={m._id}>{m.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Relationship *">
          <select value={form.relationshipType} onChange={(e) => setForm({ ...form, relationshipType: e.target.value })} className="input-field">
            {["primary", "supported", "ink", "solvent", "accessory", "consumable"].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Production Type">
          <select value={form.productionType} onChange={(e) => setForm({ ...form, productionType: e.target.value })} className="input-field">
            <option value="">None</option>
            {["area", "linear", "ink", "unit"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Conversion Ratio Override">
          <input type="number" step="0.001" min="0" value={form.conversionRatioOverride} onChange={(e) => setForm({ ...form, conversionRatioOverride: e.target.value })} className="input-field" />
        </Field>
        <Field label="Waste Margin %">
          <input type="number" step="0.1" min="0" max="100" value={form.wasteMarginPercent} onChange={(e) => setForm({ ...form, wasteMarginPercent: e.target.value })} className="input-field" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[12px] text-foreground">
        <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} className="rounded border-border/60" />
        Required material
      </label>
      <Field label="Notes">
        <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field" />
      </Field>
      <DrawerFooter saving={saving} savingText={item ? "Updating…" : "Creating…"} onCancel={onDone} />
    </form>
  );
}

/* ───────── Service Route Form (inside drawer) ───────── */

function ServiceRouteForm({ machineId, item, capMap, serviceDefMap, capabilities, serviceDefinitions, onDone }: { machineId: Id<"machines">; item?: any; capMap: Map<string, string>; serviceDefMap: Map<string, string>; capabilities: any[]; serviceDefinitions: any[]; onDone: () => void }) {
  const upsert = useMutation(api.owner.machineServiceRoutes.upsert);
  const [form, setForm] = useState({
    serviceId: item?.serviceId ?? serviceDefinitions[0]?._id ?? "",
    capabilityId: item?.capabilityId ?? capabilities[0]?._id ?? "",
    priority: item?.priority?.toString() ?? "1",
    calculationUnit: item?.calculationUnit ?? "m²",
    defaultWasteMarginPercent: item?.defaultWasteMarginPercent?.toString() ?? "",
    maxScrapLimitPercent: item?.maxScrapLimitPercent?.toString() ?? "",
    customerVisible: item?.customerVisible ?? false,
    requiresManualReview: item?.requiresManualReview ?? false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.serviceId || !form.capabilityId) { toast.error("Select service and capability"); return; }
    setSaving(true);
    try {
      await upsert({
        id: item?._id,
        machineId,
        serviceId: form.serviceId as Id<"serviceDefinitions">,
        capabilityId: form.capabilityId as Id<"capabilities">,
        priority: Number(form.priority),
        calculationUnit: form.calculationUnit,
        defaultWasteMarginPercent: form.defaultWasteMarginPercent ? Number(form.defaultWasteMarginPercent) : undefined,
        maxScrapLimitPercent: form.maxScrapLimitPercent ? Number(form.maxScrapLimitPercent) : undefined,
        customerVisible: form.customerVisible,
        requiresManualReview: form.requiresManualReview,
        active: true,
      });
      toast.success(item ? "Route updated" : "Route created");
      onDone();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Service Definition *">
        <select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })} className="input-field">
          <option value="">Select service</option>
          {serviceDefinitions.map((s: any) => <option key={s._id} value={s._id}>{s.nameEn}</option>)}
        </select>
      </Field>
      <Field label="Capability *">
        <select value={form.capabilityId} onChange={(e) => setForm({ ...form, capabilityId: e.target.value })} className="input-field">
          <option value="">Select capability</option>
          {capabilities.map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority *">
          <input type="number" min="1" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input-field" />
        </Field>
        <Field label="Calculation Unit">
          <select value={form.calculationUnit} onChange={(e) => setForm({ ...form, calculationUnit: e.target.value })} className="input-field">
            {["m²", "rm", "piece", "hour"].map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Waste Margin %">
          <input type="number" step="0.1" min="0" max="100" value={form.defaultWasteMarginPercent} onChange={(e) => setForm({ ...form, defaultWasteMarginPercent: e.target.value })} className="input-field" />
        </Field>
        <Field label="Max Scrap Limit %">
          <input type="number" step="0.1" min="0" max="100" value={form.maxScrapLimitPercent} onChange={(e) => setForm({ ...form, maxScrapLimitPercent: e.target.value })} className="input-field" />
        </Field>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-[12px] text-foreground">
          <input type="checkbox" checked={form.customerVisible} onChange={(e) => setForm({ ...form, customerVisible: e.target.checked })} className="rounded border-border/60" />
          Customer visible
        </label>
        <label className="flex items-center gap-2 text-[12px] text-foreground">
          <input type="checkbox" checked={form.requiresManualReview} onChange={(e) => setForm({ ...form, requiresManualReview: e.target.checked })} className="rounded border-border/60" />
          Requires manual review
        </label>
      </div>
      <DrawerFooter saving={saving} savingText={item ? "Updating…" : "Creating…"} onCancel={onDone} />
    </form>
  );
}

/* ───────── Shared Form Primitives ───────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function DrawerFooter({ saving, savingText, onCancel }: { saving: boolean; savingText: string; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
      <button type="button" onClick={onCancel} className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
      <button type="submit" disabled={saving} className="px-4 py-1.5 rounded bg-cyan text-[11px] font-semibold text-black hover:bg-cyan/80 disabled:opacity-50 transition-colors">{saving ? savingText : "Save"}</button>
    </div>
  );
}
