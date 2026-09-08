"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OwnerPageHeader } from "@/components/dashboard/owner/owner-page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SectionLabel, MetricValue } from "@/components/ui/typography";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { CircleDollarSign, Coins, TrendingUp, ClipboardList, Factory, Scale, PackageOpen, AlertTriangle } from "lucide-react";

const etb = (value: number) => `ETB ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function OwnerOverviewPage() {
  const overview = useQuery(api.owner.overview.getOverviewSummary);
  const financial = useQuery(api.dashboard.financialMetrics);

  if (overview === undefined || financial === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Overview…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        kicker="Main Overview · ዋና ማዕከል"
        title="Overview"
        subtitle="Today's business picture at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<CircleDollarSign size={16} />}
          label="Today's Sales"
          subtitle="የዛሬ ሽያጭ"
          value={etb(overview.todaysSales)}
          description="Total value of orders created today."
          variant="sales"
        />
        <StatCard
          icon={<Coins size={16} />}
          label="Production Material Cost"
          subtitle="የማምረቻ ዕቃ ወጪ"
          value={etb(overview.todaysMaterialCost)}
          description="Estimated material value consumed today."
          variant="cost"
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Net Profit Today"
          subtitle="የዛሬ ትርፍ"
          value={etb(overview.todaysNetProfit)}
          description="Sales minus today's material cost."
          variant="profit"
          isNegative={overview.todaysNetProfit < 0}
        />
        <StatCard
          icon={<ClipboardList size={16} />}
          label="Active Jobs"
          subtitle="በስራ ላይ ያሉ ሥራዎች"
          value={overview.activeJobs}
          description={`${overview.queuedJobs} queued · ${overview.todaysOrderCount} orders today`}
          variant="default"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Machine Status"
            subtitle="የማሽን ሁኔታ"
            kicker="Machines"
            icon={<Factory size={16} />}
          />
          <div className="grid gap-3 p-[17px] sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <SectionLabel tone="cyan">Running · በሥራ ላይ</SectionLabel>
              <MetricValue size="lg">{overview.runningMachines}</MetricValue>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <SectionLabel tone="muted">Total machines · ጠቅላላ</SectionLabel>
              <MetricValue size="lg">{overview.machinesCount}</MetricValue>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <SectionLabel tone="amber">Queued jobs · ወረፋ</SectionLabel>
              <MetricValue size="lg">{overview.queuedJobs}</MetricValue>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Pending Clearance"
            subtitle="የጥበቃ ማረጋገጫ"
            kicker="Approvals"
            icon={<Scale size={16} />}
          />
          <div className="p-[17px] space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
              <span className="text-[12px] text-muted-foreground">Open reconciliations</span>
              <MetricValue size="sm">{overview.pendingClearance}</MetricValue>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
              <span className="text-[12px] text-muted-foreground">Audited stock loss (ETB)</span>
              <MetricValue size="sm" tone="negative">
                {etb(financial.auditedStockLoss)}
              </MetricValue>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
              <span className="text-[12px] text-muted-foreground">Shortages found</span>
              <MetricValue size="sm" tone="negative">
                {financial.auditedShortageCount}
              </MetricValue>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Low Stock / Reorder Materials"
            subtitle="ክምችት እጥረት"
            kicker="Inventory"
            icon={<PackageOpen size={16} />}
          />
          <div className="p-[17px]">
            {overview.reorderMaterials > 0 ? (
              <StatCard
                icon={<AlertTriangle size={16} />}
                label="Materials at or below reorder point"
                subtitle="መልሶ ለማዘዝ ደረጃ"
                value={overview.reorderMaterials}
                description="Restock these soon to avoid halting production."
                variant="alert"
              />
            ) : (
              <p className="text-[12px] text-muted-foreground">All stock is above its reorder point.</p>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Today Summary"
            subtitle="የዛሬ ማጠቃለያ"
            kicker="Snapshot"
            icon={<TrendingUp size={16} />}
          />
          <div className="p-[17px] grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
              <SectionLabel tone="muted">Orders created</SectionLabel>
              <MetricValue size="md">{overview.todaysOrderCount}</MetricValue>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
              <SectionLabel tone="muted">Jobs in queue</SectionLabel>
              <MetricValue size="md">{overview.queuedJobs}</MetricValue>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
              <SectionLabel tone="muted">Running machines</SectionLabel>
              <MetricValue size="md">{overview.runningMachines}</MetricValue>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
              <SectionLabel tone="muted">Finished today</SectionLabel>
              <MetricValue size="md">{financial.todaysJobCount}</MetricValue>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}