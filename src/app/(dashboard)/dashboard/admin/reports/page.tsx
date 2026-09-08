"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SectionLabel, MetricValue } from "@/components/ui/typography";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { FileBarChart, AlertTriangle, History, Coins, TrendingUp, PackageOpen } from "lucide-react";

const etb = (value: number) => `ETB ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function AdminReportsPage() {
  const summary = useQuery(api.admin.reports.getReportSummary);
  const forecast = useQuery(api.dashboard.getStockoutForecast);

  if (summary === undefined || forecast === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Reports…" />
      </div>
    );
  }

  const marginPercent =
    summary.todaysSales > 0
      ? Math.round((summary.todaysNetProfit / summary.todaysSales) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Reports · ሪፖርቶች"
        title="Reports"
        subtitle="Daily performance, stock runway, and loss summaries."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Today's Sales"
          subtitle="የዛሬ ሽያጭ"
          value={etb(summary.todaysSales)}
          variant="sales"
        />
        <StatCard
          icon={<Coins size={16} />}
          label="Today's Material Cost"
          subtitle="የዛሬ ወጪ"
          value={etb(summary.todaysMaterialCost)}
          variant="cost"
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Net Profit Today"
          subtitle={`የዛሬ ትርፍ · ${marginPercent}% margin`}
          value={etb(summary.todaysNetProfit)}
          variant="profit"
          isNegative={summary.todaysNetProfit < 0}
        />
        <StatCard
          icon={<History size={16} />}
          label="Audited Stock Loss"
          subtitle="የተረጋገጠ ኪሳራ"
          value={etb(summary.auditedStockLoss)}
          description={`${summary.auditedShortageCount} shortage records.`}
          variant="alert"
          isAlert={summary.auditedStockLoss > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Stock Runway"
            subtitle="የክምችት ጊዜ"
            kicker="Forecast"
            icon={<PackageOpen size={16} />}
          />
          <div className="grid gap-3 p-[17px] sm:grid-cols-3">
            <div className="rounded-lg border border-danger/40 bg-danger/10 p-3">
              <SectionLabel tone="muted">Critical · አሳሳቢ</SectionLabel>
              <MetricValue size="lg" tone="negative">{forecast.criticalCount}</MetricValue>
            </div>
            <div className="rounded-lg border border-gold/40 bg-gold/10 p-3">
              <SectionLabel tone="muted">Warning · ማስጠንቀቂያ</SectionLabel>
              <MetricValue size="lg" tone="default">{forecast.warningCount}</MetricValue>
            </div>
            <div className="rounded-lg border border-green/40 bg-green/10 p-3">
              <SectionLabel tone="muted">Healthy · ጥሩ</SectionLabel>
              <MetricValue size="lg" tone="default">{forecast.items.length - forecast.criticalCount - forecast.warningCount}</MetricValue>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Margin Snapshot"
            subtitle="የትርፍ ህዳግ"
            kicker="Summary"
            icon={<FileBarChart size={16} />}
          />
          <div className="p-[17px] space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
              <span className="text-[12px] text-muted-foreground">Profit margin today</span>
              <MetricValue size="sm">{marginPercent}%</MetricValue>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
              <span className="text-[12px] text-muted-foreground">Orders created today</span>
              <MetricValue size="sm">{summary.todaysOrderCount}</MetricValue>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
              <span className="text-[12px] text-muted-foreground">Production logs today</span>
              <MetricValue size="sm">{summary.todaysJobCount}</MetricValue>
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Lowest Stock First"
          subtitle="በጣም ዝቅተኛ ክምችት"
          kicker="Reorder needs"
          icon={<AlertTriangle size={16} />}
        />
        {forecast.items.length === 0 ? (
          <p className="p-[17px] text-[12px] text-muted-foreground">No tracked materials.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>On hand</TableHead>
                  <TableHead>Reorder at</TableHead>
                  <TableHead>Daily use</TableHead>
                  <TableHead>Days left</TableHead>
                  <TableHead>Urgency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecast.items.slice(0, 12).map((item) => (
                  <TableRow key={item.materialId}>
                    <TableCell className="font-medium text-foreground">{item.materialName}</TableCell>
                    <TableCell muted>{item.category}</TableCell>
                    <TableCell mono>{item.currentStock}</TableCell>
                    <TableCell mono muted>{item.reorderAt}</TableCell>
                    <TableCell mono muted>{item.dailyRate}</TableCell>
                    <TableCell mono>{item.runwayDays === null ? "—" : item.runwayDays}</TableCell>
                    <TableCell>
                      <span
                        className={
                          item.urgency === "CRITICAL"
                            ? "rounded-full border border-danger/50 bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger"
                            : item.urgency === "WARNING"
                              ? "rounded-full border border-gold/50 bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold"
                              : "rounded-full border border-green/50 bg-green/10 px-2 py-0.5 text-[10px] font-medium text-green"
                        }
                      >
                        {item.urgency}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}