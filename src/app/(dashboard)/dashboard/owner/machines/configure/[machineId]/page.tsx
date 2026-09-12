"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OwnerPageHeader } from "@/components/dashboard/roles/owner/owner-page-header";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { Button } from "@/components/shared/ui/button";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/shared/ui/tabs";
import { Factory, Droplets, Link2, Route, Package, AlertTriangle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

export default function MachineConfigurePage() {
  const params = useParams();
  const router = useRouter();
  const machineId = params.machineId as Id<"machines">;

  const machine = useQuery(api.machines.get, machineId ? { id: machineId } : "skip");
  const inkRules = useQuery(api.owner.machineInkRules.list, machineId ? { machineId } : "skip");
  const serviceRoutes = useQuery(api.owner.machineServiceRoutes.list, machineId ? { machineId } : "skip");
  const capabilities = useQuery(api.catalog.listCapabilities, {});

  if (machine === undefined || inkRules === undefined || serviceRoutes === undefined) {
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

  const inkRuleCount = inkRules.length;
  const routeCount = serviceRoutes.length;
  const activeRoutes = serviceRoutes.filter((r) => r.active && r.customerVisible).length;

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        kicker="Machine Configuration · የማሽን ቅርጽ በመాßen"
        title={machine.name}
        subtitle={`${machine.code} · ${machine.type}`}
        action={
          <Button variant="secondary" onClick={() => router.push("/dashboard/owner/machines")}>
            Back to Machines
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Droplets size={16} />}
          label="Ink Rules"
          subtitle="የብርุด መጠን ደንብ"
          value={inkRuleCount}
          variant="default"
        />
        <StatCard
          icon={<Link2 size={16} />}
          label="Material Links"
          subtitle="የቁሳቁስ አገናኞች"
          value={0}
          variant="sales"
        />
        <StatCard
          icon={<Route size={16} />}
          label="Service Routes"
          subtitle="የአገልግሎት መንገዶች"
          value={routeCount}
          variant="cost"
        />
        <StatCard
          icon={<Package size={16} />}
          label="Publishable Routes"
          subtitle="መzensa ሊያስተዋይ የሚችል"
          value={activeRoutes}
          variant={activeRoutes > 0 ? "default" : "alert"}
          isAlert={activeRoutes === 0}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview">
            <Factory size={14} className="mr-1.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="ink-rules">
            <Droplets size={14} className="mr-1.5" />
            Ink Rules ({inkRuleCount})
          </TabsTrigger>
          <TabsTrigger value="service-routes">
            <Route size={14} className="mr-1.5" />
            Service Routes ({routeCount})
          </TabsTrigger>
          <TabsTrigger value="warnings">
            <AlertTriangle size={14} className="mr-1.5" />
            Warnings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <MachineOverviewTab machine={machine} />
        </TabsContent>

        <TabsContent value="ink-rules">
          <InkRulesTab machineId={machineId} inkRules={inkRules} />
        </TabsContent>

        <TabsContent value="service-routes">
          <ServiceRoutesTab machineId={machineId} serviceRoutes={serviceRoutes} capabilities={capabilities ?? []} />
        </TabsContent>

        <TabsContent value="warnings">
          <WarningsTab machine={machine} inkRuleCount={inkRuleCount} routeCount={routeCount} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MachineOverviewTab({ machine }: { machine: any }) {
  return (
    <Panel>
      <PanelHeader
        title="Machine Overview"
        subtitle="የማሽን አጠቃላይ ዕይታ"
        kicker="Identity"
        icon={<Factory size={16} />}
      />
      <div className="p-[17px] grid gap-6 sm:grid-cols-2">
        <dl className="space-y-3">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</dt>
            <dd className="text-sm font-medium text-foreground">{machine.name}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Code</dt>
            <dd className="text-sm font-mono text-foreground">{machine.code}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</dt>
            <dd className="text-sm text-foreground">{machine.type}</dd>
          </div>
          {machine.manufacturer && (
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Manufacturer</dt>
              <dd className="text-sm text-foreground">{machine.manufacturer}</dd>
            </div>
          )}
          {machine.model && (
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Model</dt>
              <dd className="text-sm text-foreground">{machine.model}</dd>
            </div>
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
          {machine.capability && (
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Capability</dt>
              <dd className="text-sm text-foreground">{machine.capability}</dd>
            </div>
          )}
          {machine.activeJob && (
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Active Job</dt>
              <dd className="text-sm text-foreground">{machine.activeJob}</dd>
            </div>
          )}
        </dl>
      </div>
    </Panel>
  );
}

function InkRulesTab({ machineId, inkRules }: { machineId: Id<"machines">; inkRules: any[] }) {
  return (
    <Panel>
      <PanelHeader
        title="Ink Consumption Rules"
        subtitle="የብርุด የመጠን ደንቦች"
        kicker="Production"
        icon={<Droplets size={16} />}
      />
      {inkRules.length === 0 ? (
        <div className="p-[17px] text-center space-y-3">
          <p className="text-[12px] text-muted-foreground">No ink consumption rules configured for this machine.</p>
          <p className="text-[10px] text-muted-foreground">
            Rules define how much ink this machine consumes per unit of production.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border/60">
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Ink Color</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Material</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Rate</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Unit</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Waste %</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Default</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {inkRules.map((rule) => (
                <tr key={rule._id} className="border-b border-border/30 hover:bg-background/40">
                  <td className="p-[17px] font-medium text-foreground">{rule.inkColor}</td>
                  <td className="p-[17px] text-muted-foreground">{rule.materialId}</td>
                  <td className="p-[17px] font-mono text-foreground">{rule.rate}</td>
                  <td className="p-[17px] text-muted-foreground">{rule.consumptionUnit}</td>
                  <td className="p-[17px] font-mono text-foreground">{rule.wasteAllowancePercent ?? "—"}</td>
                  <td className="p-[17px]">
                    {rule.isDefault ? (
                      <span className="text-[10px] font-medium text-cyan">Default</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-[17px]">
                    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${rule.active ? "bg-green/10 text-green" : "bg-muted text-muted-foreground"}`}>
                      {rule.active ? "Active" : "Archived"}
                    </span>
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

function ServiceRoutesTab({ machineId, serviceRoutes, capabilities }: { machineId: Id<"machines">; serviceRoutes: any[]; capabilities: any[] }) {
  const getCapName = (capId: string) => {
    const cap = capabilities.find((c: any) => c._id === capId);
    return cap?.name ?? capId;
  };

  return (
    <Panel>
      <PanelHeader
        title="Service Routes"
        subtitle="የአገልግሎት መንገዶች"
        kicker="Routing"
        icon={<Route size={16} />}
      />
      {serviceRoutes.length === 0 ? (
        <div className="p-[17px] text-center space-y-3">
          <p className="text-[12px] text-muted-foreground">No service routes configured for this machine.</p>
          <p className="text-[10px] text-muted-foreground">
            Routes define which services this machine can produce.
          </p>
        </div>
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
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Customer Visible</th>
                <th className="p-[17px] text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {serviceRoutes.map((route) => (
                <tr key={route._id} className="border-b border-border/30 hover:bg-background/40">
                  <td className="p-[17px] font-medium text-foreground">{route.serviceId}</td>
                  <td className="p-[17px] text-muted-foreground">{getCapName(route.capabilityId)}</td>
                  <td className="p-[17px] font-mono text-foreground">{route.priority}</td>
                  <td className="p-[17px] text-muted-foreground">{route.calculationUnit}</td>
                  <td className="p-[17px] font-mono text-foreground">{route.defaultWasteMarginPercent ?? "—"}</td>
                  <td className="p-[17px]">
                    {route.customerVisible ? (
                      <span className="text-[10px] font-medium text-cyan">Yes</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="p-[17px]">
                    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${route.active ? "bg-green/10 text-green" : "bg-muted text-muted-foreground"}`}>
                      {route.active ? "Active" : "Archived"}
                    </span>
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

function WarningsTab({ machine, inkRuleCount, routeCount }: { machine: any; inkRuleCount: number; routeCount: number }) {
  const warnings: Array<{ severity: "error" | "warning"; message: string }> = [];

  if (inkRuleCount === 0) {
    warnings.push({ severity: "warning", message: "No ink consumption rules configured. Ink deductions will use global defaults." });
  }
  if (routeCount === 0) {
    warnings.push({ severity: "error", message: "No service routes configured. This machine cannot produce any services." });
  }
  if (!machine.active) {
    warnings.push({ severity: "error", message: "This machine is archived and cannot be used for production." });
  }
  if (machine.status === "Maintenance" || machine.status === "Unavailable") {
    warnings.push({ severity: "warning", message: `Machine status is "${machine.status}". It will not receive new jobs.` });
  }

  return (
    <Panel>
      <PanelHeader
        title="Configuration Warnings"
        subtitle="የቅርጽ ማስጠን̄Kit"
        kicker="Health"
        icon={<AlertTriangle size={16} />}
      />
      {warnings.length === 0 ? (
        <div className="p-[17px] text-center">
          <p className="text-[12px] text-green font-medium">No warnings. Machine configuration looks healthy.</p>
        </div>
      ) : (
        <div className="p-[17px] space-y-3">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-lg border p-3 text-[12px] ${
                w.severity === "error"
                  ? "border-danger/30 bg-danger/5 text-danger"
                  : "border-gold/30 bg-gold/5 text-gold"
              }`}
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
