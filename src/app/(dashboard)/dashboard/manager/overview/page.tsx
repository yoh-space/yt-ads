"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowDownToLine, ArrowRight, ClipboardList, Factory, ShoppingCart, Truck } from "lucide-react";
import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SectionLabel, MetricValue } from "@/components/ui/typography";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { WorkspaceModuleGate } from "@/components/dashboard/workspace-renderer";
import type { AccessContext } from "@/lib/access-policy";

function unitLabel(unitType: string) {
  return unitType === "ROLL" ? "ROLLS" : unitType === "SHEET" ? "SHEETS" : "CANISTERS";
}

function physicalQuantity(quantity: number, unitType: string) {
  return `${Number(quantity.toFixed(1))} ${unitLabel(unitType)}`;
}

export default function ManagerOverviewPage() {
  const router = useRouter();
  const profile = useQuery(api.users.getCurrentProfile);
  const overview = useQuery(api.manager.overview.getOverview);

  if (overview === undefined || !profile) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Manager Overview…" />
      </div>
    );
  }

  const accessContext: AccessContext = {
    profile: { role: profile.role, active: profile.active },
  };

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Operations Hub · የኦፕሬሽን ማእከል"
        title="Overview"
        subtitle="Fleet status, job pressure, order intake, and material reorder signals."
      />

      <WorkspaceModuleGate context={accessContext} moduleId="dashboard.kpis">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Factory size={16} />}
            label="Running Machines"
            subtitle="በሥራ ላይ ያሉ ማሽኖች"
            value={overview.runningMachines}
            description={`${overview.availableMachines} available · ${overview.maintenanceMachines} in maintenance`}
            variant="default"
          />
          <StatCard
            icon={<ClipboardList size={16} />}
            label="Queued Jobs"
            subtitle="ወረፋ ላይ ያሉ ሥራዎች"
            value={overview.queuedJobs}
            description={`${overview.activeJobs} in production · ${overview.pausedJobs} paused`}
            variant="default"
          />
          <StatCard
            icon={<ShoppingCart size={16} />}
            label="Orders Today"
            subtitle="የዛሬ ማዘዣዎች"
            value={overview.todaysOrderCount}
            description={`${overview.activeOrderCount} in production`}
            variant="sales"
          />
          <StatCard
            icon={<Truck size={16} />}
            label="Pending Material Requests"
            subtitle="ፈቃድ የሚጠብቁ ጥያቄዎች"
            value={overview.pendingRequests}
            description={`${overview.lowStockCount} item${overview.lowStockCount === 1 ? "" : "s"} at reorder point`}
            variant="alert"
            isAlert={overview.pendingRequests > 0 || overview.lowStockCount > 0}
          />
        </div>
      </WorkspaceModuleGate>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Machines"
            subtitle="የማሽን ሁኔታ"
            kicker="Fleet Status"
            icon={<Factory size={16} />}
          />
          <div className="grid gap-3 p-[17px] sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <SectionLabel tone="cyan">Running · በሥራ ላይ</SectionLabel>
              <MetricValue size="lg">{overview.runningMachines}</MetricValue>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <SectionLabel tone="muted">Available · ዝግጁ</SectionLabel>
              <MetricValue size="lg">{overview.availableMachines}</MetricValue>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <SectionLabel tone="amber">Maintenance · ጥገና</SectionLabel>
              <MetricValue size="lg">{overview.maintenanceMachines}</MetricValue>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 px-[17px] pb-[17px]">
            <button
              onClick={() => router.push("/dashboard/manager/machines")}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              Manage Machines <ArrowRight size={13} />
            </button>
            <button
              onClick={() => router.push("/dashboard/manager/orders")}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              Orders Queue <ArrowRight size={13} />
            </button>
            <button
              onClick={() => router.push("/dashboard/manager/inventory")}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              Inventory <ArrowRight size={13} />
            </button>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Reorder Pressure"
            subtitle="ክምችት እጥረት"
            kicker="Inventory"
            icon={<ArrowDownToLine size={16} />}
          />
          <div className="p-[17px]">
            {overview.lowStockItems.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">All stock is above its reorder point.</p>
            ) : (
              <ul className="space-y-2">
                {overview.lowStockItems.slice(0, 4).map((item) => (
                  <li
                    key={`${item.materialName}-${item.unitType}`}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
                  >
                    <span className="text-[12px] text-muted-foreground">{item.materialName}</span>
                    <MetricValue size="sm" tone="negative">
                      {physicalQuantity(item.totalStockQuantity, item.unitType)}
                    </MetricValue>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}