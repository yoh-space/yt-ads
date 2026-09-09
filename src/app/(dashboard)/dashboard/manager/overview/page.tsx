"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowDownToLine, ArrowRight, CalendarClock, ClipboardList, Factory, ShoppingCart } from "lucide-react";
import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SectionLabel, MetricValue } from "@/components/ui/typography";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { WorkspaceModuleGate } from "@/components/dashboard/workspace-renderer";
import type { AccessContext } from "@/lib/access-policy";
import { cn } from "@/lib/utils";

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
        kicker="Today · የዛሬ እይታ"
        title="Overview"
        subtitle="A quick look at today's machines, jobs, orders, and materials."
      />

      <WorkspaceModuleGate context={accessContext} moduleId="dashboard.kpis">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <StatCard
            icon={<Factory size={16} />}
            label="Machines Running"
            subtitle="በሥራ ላይ ያሉ ማሽኖች"
            value={overview.runningMachines}
            description={`${overview.availableMachines} available · ${overview.maintenanceMachines} in maintenance`}
            variant="default"
          />
          <StatCard
            icon={<ClipboardList size={16} />}
            label="Jobs Waiting"
            subtitle="ወረፋ ላይ ያሉ ሥራዎች"
            value={overview.queuedJobs}
            description={`${overview.activeJobs} active · ${overview.pausedJobs} paused`}
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
            icon={<CalendarClock size={16} />}
            label="Orders Due"
            subtitle="የማስረከቢያ ቀናቸው የደረሱ ትዕዛዞች"
            value={overview.dueOrderCount}
            description="Past the due date and still open"
            variant="alert"
            isAlert={overview.dueOrderCount > 0}
          />
        </div>
      </WorkspaceModuleGate>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Machine status"
            subtitle="የማሽን ሁኔታ · A quick look at today's machines"
            kicker="Today"
            icon={<Factory size={16} />}
          />
          <div className="flex items-center justify-between gap-4 border-b border-border/60 px-[17px] py-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">All machines</p>
              <MetricValue size="lg">{overview.machinesCount}</MetricValue>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Working now</p>
              <p className="mt-1 text-sm font-semibold text-cyan-dark">{overview.runningMachines} of {overview.machinesCount}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 divide-y divide-border/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              { label: "Running", amharic: "በሥራ ላይ", value: overview.runningMachines, color: "bg-cyan", text: "text-cyan-dark" },
              { label: "Available", amharic: "ዝግጁ", value: overview.availableMachines, color: "bg-green", text: "text-green" },
              { label: "Maintenance", amharic: "ጥገና", value: overview.maintenanceMachines, color: "bg-amber-500", text: "text-amber-500" },
            ].map((status) => {
              const percentage = overview.machinesCount > 0 ? Math.round((status.value / overview.machinesCount) * 100) : 0;
              return (
                <div key={status.label} className="px-[17px] py-4">
                  <div className="flex items-center justify-between gap-2">
                    <SectionLabel tone="muted"><span className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full", status.color)} />{status.label} · {status.amharic}</SectionLabel>
                    <span className={cn("font-mono text-[10px]", status.text)}>{percentage}%</span>
                  </div>
                  <MetricValue size="lg">{status.value}</MetricValue>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/30">
                    <div className={cn("h-full rounded-full transition-all", status.color)} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border/60 px-[17px] py-4">
            <button
              onClick={() => router.push("/dashboard/manager/machines")}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              View machines <ArrowRight size={13} />
            </button>
            <button
              onClick={() => router.push("/dashboard/manager/orders")}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              View orders <ArrowRight size={13} />
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
            title="Low stock"
            subtitle="ክምችት እጥረት"
            kicker="Materials"
            icon={<ArrowDownToLine size={16} />}
          />
          <div className="p-[17px]">
            {overview.lowStockItems.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">All materials are above the reorder level.</p>
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