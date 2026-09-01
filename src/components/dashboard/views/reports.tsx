"use client";

import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Calendar,
  Clock,
  DollarSign,
  Factory,
  Flame,
  Inbox,
  RefreshCw,
  Scissors,
  TrendingDown,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { ReportPeriod } from "@/lib/report-types";
import { cn } from "@/lib/utils";
import { DataTable, PanelHead, ReportLine, ReportList, StatCard } from "./report-atoms";

const periods: Array<{ id: ReportPeriod; label: string; english: string }> = [
  { id: "weekly", label: "ሳምንታዊ", english: "Weekly" },
  { id: "biweekly", label: "የሁለት ሳምንት", english: "Bi-weekly" },
  { id: "monthly", label: "ወርሃዊ", english: "Monthly" },
  { id: "custom", label: "Custom", english: "Date Range" },
];

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatUnitMap(values: Array<{ unit: string; quantity: number }>) {
  if (values.length === 0) return "—";
  return values
    .map(
      ({ unit, quantity }) =>
        `${quantity.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${unit}`
    )
    .join(" · ");
}

function formatNumber(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatCurrency(n: number) {
  return `ETB ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatDaysLeft(days: number | null) {
  if (days === null) return "—";
  if (days <= 3) return `${days}d — critical`;
  if (days <= 7) return `${days}d — low`;
  return `${days}d`;
}

/* ─────────────────────────── view ─────────────────────────── */

export function ReportsView({ canSeeFinancial = false }: { canSeeFinancial?: boolean }) {
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>("weekly");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split("T")[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split("T")[0]);

  const queryArgs = useMemo(() => {
    if (selectedPeriod === "custom") {
      const startAt = new Date(customStart + "T00:00:00").getTime();
      const endAt = new Date(customEnd + "T23:59:59").getTime();
      return { period: "custom" as const, startAt, endAt };
    }
    return { period: selectedPeriod };
  }, [selectedPeriod, customStart, customEnd]);

  const report = useQuery(api.reports.getSummary, queryArgs);

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-[240px] bg-white border border-line rounded-lg shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <RefreshCw size={16} className="animate-spin" /> ሪፖርቱ እየተዘጋጀ ነው…
        </div>
      </div>
    );
  }

  const periodLabel = periods.find((item) => item.id === selectedPeriod);
  const completionRate =
    report.production.plannedQuantity > 0
      ? Math.min(
          100,
          Math.round(
            (report.production.outputQuantity /
              report.production.plannedQuantity) *
              100
          )
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="bg-white border border-line rounded-lg p-6 shadow-sm">
        <div className="flex flex-col xl:flex-row items-start justify-between gap-5">
          <div>
            <span className="text-xs font-mono font-bold tracking-wider text-cyan-dark uppercase">
              PERIOD REPORT
            </span>
            <h2 className="text-xl font-bold text-navy mt-1">
              {periodLabel?.label} ሪፖርት <span className="text-sm font-normal text-gray-600">{periodLabel?.english}</span>
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {formatDate(report.startAt)} — {formatDate(report.endAt)} · {report.days} days
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
              {periods.map((period) => (
                <button
                  key={period.id}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2",
                    selectedPeriod === period.id
                      ? "bg-white text-navy shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                  onClick={() => setSelectedPeriod(period.id)}
                >
                  <div className="text-center">
                    <div>{period.label}</div>
                    <div className="text-xs text-gray-500">{period.english}</div>
                  </div>
                </button>
              ))}
            </div>

            {selectedPeriod === "custom" && (
              <div className="flex items-center gap-2 p-2 bg-gray-50 border border-line rounded-lg">
                <div className="flex items-center gap-1 px-2 py-1 bg-white border border-line rounded text-sm">
                  <Calendar size={12} className="text-gray-400" />
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="border-0 bg-transparent text-navy focus:outline-none"
                  />
                </div>
                <span className="text-gray-400">—</span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2 py-1 bg-white border border-line rounded text-sm text-navy focus:outline-none focus:ring-2 focus:ring-cyan"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          tone="cyan"
          icon={<Boxes size={18} />}
          value={report.inventory.trackedMaterials}
          label="የሚከታተሉ እቃዎች"
          sub={`${report.inventory.lowStockMaterials} low-stock · ${report.inventory.movementCount} movements`}
        />
        <StatCard
          tone="gold"
          icon={<Inbox size={18} />}
          value={report.financial.totalOrders}
          label="ጠቅላላ ትዕዛዞች"
          sub={`${report.financial.completedOrders} completed · ${report.financial.overdueOrders} overdue`}
        />
        <StatCard
          tone="violet"
          icon={<DollarSign size={18} />}
          value={canSeeFinancial ? formatCurrency(report.financial.estimatedRevenue) : formatNumber(report.financial.pendingOrders)}
          label={canSeeFinancial ? "የተገመተ ገንዘብ" : "Pending Orders"}
          sub={`${report.financial.pendingOrders} pending orders · ${report.financial.completedOrders} done`}
        />
        <StatCard
          tone="coral"
          icon={<Factory size={18} />}
          value={report.production.jobCardsCreated}
          label="የተፈጠሩ ሥራዎች"
          sub={`${report.production.completedJobs} completed · ${completionRate}% completion`}
        />
      </div>

      {/* Operational statistics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          tone="violet"
          icon={<BarChart3 size={18} />}
          value={report.production.outputQuantity.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          label="የተመዘገበ ምርት"
          sub={`${report.production.logCount} production logs · ${completionRate}% of planned`}
        />
        <StatCard
          tone="coral"
          icon={<Trash2 size={18} />}
          value={report.production.wasteQuantity.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          label="ብክነት"
          sub={`${report.production.wasteRate}% waste rate · ${report.recovery.scrapRecords} scrap records`}
        />
        <StatCard
          tone="gold"
          icon={<AlertTriangle size={18} />}
          value={report.exceptions.length}
          label="Direct Exception Stock-Out"
          sub={report.exceptions.length > 0 ? `Last: ${report.exceptions[0].materialName}` : "No exceptions recorded"}
        />
        <StatCard
          tone="cyan"
          icon={<Flame size={18} />}
          value={canSeeFinancial ? formatCurrency(report.machineEfficiency.wasteValue.estimatedETB) : formatNumber(report.executive.scrapCount)}
          label={canSeeFinancial ? "የወጪ ዋጋ" : "የተመዘገበ Scrap"}
          sub={`${report.machineEfficiency.wasteValue.totalWasteQuantity.toLocaleString("en-US", { maximumFractionDigits: 1 })} ${report.machineEfficiency.wasteValue.wasteUnit} total waste`}
        />
      </section>

      {/* Executive statistics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          tone="coral"
          icon={<TrendingDown size={18} />}
          value={canSeeFinancial ? formatCurrency(report.executive.totalConsumptionETB) : formatNumber(report.executive.totalConsumptionBaseQuantity)}
          label={canSeeFinancial ? "አጠቃላይ የእቃ ውጪ" : "ተጠቃሚ የእቃ መጠን"}
          sub={`${report.executive.totalConsumptionBaseQuantity.toLocaleString("en-US", { maximumFractionDigits: 0 })} base units of material value consumed`}
        />
        <StatCard
          tone="gold"
          icon={<AlertTriangle size={18} />}
          value={canSeeFinancial ? formatCurrency(report.executive.theftAlertsTotalLoss) : formatNumber(report.executive.theftAlerts.length)}
          label={canSeeFinancial ? "የሌብነት/የእቃ ጉድለት" : "ንቁ የመለያ ማንቂያዎች"}
          sub={`${report.executive.theftAlerts.length} shortage alert${report.executive.theftAlerts.length !== 1 ? "s" : ""} · estimated total loss`}
        />
        <StatCard
          tone="cyan"
          icon={<Trash2 size={18} />}
          value={`${report.executive.scrapRate}%`}
          label="የተመዘገበ ብክነት"
          sub={`${report.executive.scrapQuantity.toLocaleString("en-US", { maximumFractionDigits: 1 })} ${report.executive.recordedScrapUnit} logged`}
        />
        <StatCard
          tone="violet"
          icon={<XCircle size={18} />}
          value={report.executive.exceptionStockOuts.length}
          label="Exception Stock-Outs"
          sub="Materials issued without a job card in this period"
        />
      </section>

      {report.executive.theftAlerts.length > 0 ? (
        <section className="bg-white border border-line rounded-xl p-6 shadow-sm">
          <PanelHead
            kicker="STOCK DISCREPANCY ALERTS"
            tone="coral"
            title="የእቃ ጉድለት ማንቂያ"
            note={canSeeFinancial ? "Negative physical-count variance, ranked by monetary loss in ETB." : "Negative physical-count variance across materials."}
            icon={<AlertTriangle size={19} />}
          />
          <div className="mt-4">
            <DataTable
              minWidth={canSeeFinancial ? "grid-cols-[2fr_1fr_1fr_1fr]" : "grid-cols-[2fr_1fr_1fr]"}
              cols={[
                { label: "Material" },
                { label: "Variance" },
                ...(canSeeFinancial ? [{ label: "Monetary Loss" }] : []),
                { label: "Count Date" },
              ]}
              rows={report.executive.theftAlerts.map((alert) => ({
                key: alert.materialName,
                cells: [
                  <span key="m" className="text-sm font-semibold text-navy">{alert.materialName}</span>,
                  <span key="v" className="text-sm font-medium text-coral">
                    -{Math.abs(alert.variance).toLocaleString("en-US", { maximumFractionDigits: 2 })} {alert.unit}
                  </span>,
                  ...(canSeeFinancial ? [<span key="l" className="text-sm font-medium text-gold">{formatCurrency(alert.monetaryLoss)}</span>] : []),
                  <span key="d" className="text-sm text-gray-500">{formatDate(alert.countDate)}</span>,
                ],
              }))}
            />
          </div>
        </section>
      ) : null}

      {report.exceptions.length > 0 ? (
        <section className="bg-white border border-line rounded-xl p-6 shadow-sm">
          <PanelHead
            kicker="DIRECT EXCEPTION STOCK-OUT"
            tone="coral"
            title="ከትዕዛዝ ያልተፈለገ የእቃ ማውደም"
            note="Materials issued without job cards during this period"
            icon={<AlertTriangle size={19} />}
          />
          <div className="mt-4">
            <DataTable
              minWidth="grid-cols-[2fr_1fr_1.5fr_1fr_1fr]"
              cols={[
                { label: "Material" },
                { label: "Quantity" },
                { label: "Reason" },
                { label: "Operator" },
                { label: "Date" },
              ]}
              rows={report.exceptions.map((exception) => ({
                key: exception.id,
                cells: [
                  <span key="m" className="text-sm font-semibold text-navy">{exception.materialName}</span>,
                  <span key="q" className="text-sm font-medium text-coral">
                    {exception.quantity.toLocaleString("en-US", { maximumFractionDigits: 1 })} {exception.unit}
                  </span>,
                  <span key="r" className="text-sm text-gray-600">{exception.reason}</span>,
                  <span key="o" className="text-sm text-gray-600">{exception.operatorName}</span>,
                  <span key="d" className="text-sm text-gray-500">{formatDate(exception.createdAt)}</span>,
                ],
              }))}
            />
          </div>
        </section>
      ) : null}

      {/* Movement / Production / Recovery lists */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <article className="bg-white border border-line rounded-xl p-6 shadow-sm">
          <PanelHead
            kicker="INVENTORY MOVEMENT"
            title="የእቃ እንቅስቃሴ"
            note="Material movement recorded during this period"
            icon={<Boxes size={19} />}
          />
          <div className="mt-3">
            <ReportList>
              <ReportLine label="Stock-in">{formatUnitMap(report.inventory.stockInByUnit)}</ReportLine>
              <ReportLine label="Stock-out">{formatUnitMap(report.inventory.stockOutByUnit)}</ReportLine>
              <ReportLine label="Current active stock">
                {report.inventory.totalBaseQuantity.toLocaleString("en-US", { maximumFractionDigits: 2 })} base units
              </ReportLine>
              <ReportLine label="Low-stock materials">
                <span className={report.inventory.lowStockMaterials > 0 ? "text-gold" : "text-green"}>
                  {report.inventory.lowStockMaterials}
                </span>
              </ReportLine>
            </ReportList>
          </div>
        </article>

        <article className="bg-white border border-line rounded-xl p-6 shadow-sm">
          <PanelHead
            kicker="PRODUCTION PULSE"
            title="የምርት አፈጻጸም"
            note="Output, input, and waste from production logs"
            icon={<Factory size={19} />}
          />
          <div className="mt-3">
            <ReportList>
              <ReportLine label="Production input">
                {report.production.inputQuantity.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </ReportLine>
              <ReportLine label="Good output">
                <span className="text-green">
                  {report.production.outputQuantity.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </span>
              </ReportLine>
              <ReportLine label="Waste output">
                <span className="text-gold">
                  {report.production.wasteQuantity.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </span>
              </ReportLine>
              <ReportLine label="Machines running">
                {report.production.runningMachines} / {report.production.machineCount}
              </ReportLine>
            </ReportList>
          </div>
        </article>

        <article className="bg-white border border-line rounded-xl p-6 shadow-sm">
          <PanelHead
            kicker="RECOVERY & WASTE"
            title="ቅሪት እና Scrap"
            note="Reusable material recovery and unusable waste"
            icon={<Scissors size={19} />}
          />
          <div className="mt-3">
            <ReportList>
              <ReportLine label="Offcut returns">{report.recovery.offcutReturns}</ReportLine>
              <ReportLine label="Reusable offcuts">
                <span className="text-green">{report.recovery.reusableOffcuts}</span>
              </ReportLine>
              <ReportLine label="Scrap records">{report.recovery.scrapRecords}</ReportLine>
              <ReportLine label="Scrap quantity">
                <span className="text-gold">
                  {report.recovery.scrapQuantity.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </span>
              </ReportLine>
            </ReportList>
          </div>
        </article>
      </section>

      {/* Consumption / reorder / machine efficiency */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <article className="bg-white border border-line rounded-xl p-6 shadow-sm">
          <PanelHead
            kicker="TOP MATERIAL CONSUMPTION"
            title="ከፍተኛ የተጠቀሙ እቃዎች"
            note="Most consumed materials during this period"
            icon={<TrendingDown size={19} />}
          />
          <div className="mt-3">
            {report.consumption.topMaterials.length === 0 ? (
              <p className="text-sm text-gray-500">No consumption recorded</p>
            ) : (
              <ReportList>
                {report.consumption.topMaterials.map((item, index) => {
                  const maxConsumed = report.consumption.topMaterials[0]?.totalConsumed ?? 1;
                  const pct = Math.round((item.totalConsumed / maxConsumed) * 100);
                  return (
                    <div key={item.materialName} className="py-3">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span className="flex items-center gap-2 text-sm font-semibold text-navy">
                          <span className="flex items-center justify-center w-5 h-5 rounded bg-cyan/10 text-cyan-dark text-[10px] font-mono">
                            {index + 1}
                          </span>
                          <span className="truncate">{item.materialName}</span>
                        </span>
                        <span className="text-sm text-gray-600 flex-none">
                          {item.totalConsumed.toLocaleString("en-US", { maximumFractionDigits: 1 })} {item.unit}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-cyan" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="mt-1 block text-xs text-gray-500">{item.movementCount} movements</span>
                    </div>
                  );
                })}
              </ReportList>
            )}
          </div>
        </article>

        <article className="bg-white border border-line rounded-xl p-6 shadow-sm">
          <PanelHead
            kicker="REORDER FORECAST"
            title="የእቃ ማስቀመጫ ትንበያ"
            note="Materials at or below reorder level with estimated stock-out days"
            icon={<Clock size={19} />}
          />
          <div className="mt-3">
            <ReportList>
              {report.consumption.reorderAlerts.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No materials below reorder level</p>
              ) : (
                report.consumption.reorderAlerts.map((alert) => (
                  <div key={alert.materialName} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <span className="block text-sm font-semibold text-navy truncate">{alert.materialName}</span>
                      <span className="block text-xs text-gray-500">
                        {alert.currentStock.toLocaleString("en-US", { maximumFractionDigits: 1 })} / {alert.reorderAt.toLocaleString("en-US", { maximumFractionDigits: 1 })} {alert.unit}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold flex-none",
                        alert.estimatedDaysLeft !== null && alert.estimatedDaysLeft <= 3
                          ? "bg-coral/10 text-coral"
                          : alert.estimatedDaysLeft !== null && alert.estimatedDaysLeft <= 7
                            ? "bg-gold/10 text-gold"
                            : "bg-cyan/10 text-cyan-dark",
                      )}
                    >
                      <TrendingDown size={11} />
                      {formatDaysLeft(alert.estimatedDaysLeft)}
                    </span>
                  </div>
                ))
              )}
            </ReportList>
          </div>
        </article>

        <article className="bg-white border border-line rounded-xl p-6 shadow-sm">
          <PanelHead
            kicker="MACHINE EFFICIENCY"
            title="የማሽን አቀናብር"
            note="Utilization summary by machine type"
            icon={<Factory size={19} />}
          />
          <div className="mt-3">
            {report.machineEfficiency.byType.length === 0 ? (
              <p className="text-sm text-gray-500">No active machines</p>
            ) : (
              <ReportList>
                {report.machineEfficiency.byType.map((machine) => {
                  const totalLogs = report.machineEfficiency.byType.reduce(
                    (sum, m) => sum + m.logCount,
                    0,
                  );
                  const logPct = totalLogs > 0 ? Math.round((machine.logCount / totalLogs) * 100) : 0;
                  return (
                    <div key={machine.machineType} className="py-3">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span className="text-sm font-semibold text-navy">{machine.machineType}</span>
                        <span className="text-xs text-gray-500">{machine.machineCount} unit{machine.machineCount > 1 ? "s" : ""}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-violet" style={{ width: `${logPct}%` }} />
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                        <span>{machine.jobCount} jobs</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span>{machine.logCount} logs</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span>{machine.totalOutput.toLocaleString("en-US", { maximumFractionDigits: 1 })} out</span>
                        {machine.totalWaste > 0 ? (
                          <>
                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                            <span className="text-gold">{machine.totalWaste.toLocaleString("en-US", { maximumFractionDigits: 1 })} waste</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </ReportList>
            )}
          </div>
        </article>
      </section>

      {report.machineEfficiency.operatorActivity.length > 0 ? (
        <section className="bg-white border border-line rounded-xl p-6 shadow-sm">
          <PanelHead
            kicker="OPERATOR PRODUCTIVITY"
            title="የኦፕሬተር ተጠያቂነት"
            note="Activity summary per operator during this period"
            icon={<Users size={19} />}
          />
          <div className="mt-4">
            <DataTable
              minWidth="grid-cols-[2fr_1fr_1fr_1fr]"
              cols={[
                { label: "Operator" },
                { label: "Jobs Created" },
                { label: "Production Logs" },
                { label: "Output" },
              ]}
              rows={report.machineEfficiency.operatorActivity.map((op) => ({
                key: op.operatorName,
                cells: [
                  <span key="o" className="text-sm font-semibold text-navy">{op.operatorName}</span>,
                  <span key="j" className="text-sm text-gray-600">{op.jobCount}</span>,
                  <span key="l" className="text-sm text-gray-600">{op.logCount}</span>,
                  <span key="q" className="text-sm text-gray-600">{op.outputQuantity.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span>,
                ],
              }))}
            />
          </div>
        </section>
      ) : null}

      <div className="flex items-start gap-2.5 p-4 bg-cyan/5 border border-cyan/20 rounded-lg text-sm text-gray-600">
        <BarChart3 size={17} className="text-cyan-dark flex-none mt-0.5" />
        <p>
          <strong className="text-navy">Data note:</strong> {report.seededDataNote}
        </p>
      </div>
    </div>
  );
}