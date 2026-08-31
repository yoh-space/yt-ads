"use client";

import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Calendar,
  CheckCircle2,
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

export function ReportsView() {
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
      <div className="report-loading">
        <RefreshCw size={16} /> ሪፖርቱ እየተዘጋጀ ነው…
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
    <div className="reports-view">
      <section className="report-toolbar panel">
        <div>
          <span className="panel-kicker">PERIOD REPORT</span>
          <h2>
            {periodLabel?.label} ሪፖርት <small>{periodLabel?.english}</small>
          </h2>
          <p>
            {formatDate(report.startAt)} — {formatDate(report.endAt)} ·{" "}
            {report.days} days
          </p>
        </div>
        <div className="report-toolbar-right">
          <div className="period-switcher" aria-label="Report period">
            {periods.map((period) => (
              <button
                key={period.id}
                className={selectedPeriod === period.id ? "selected" : ""}
                onClick={() => setSelectedPeriod(period.id)}
              >
                {period.label}
                <small>{period.english}</small>
              </button>
            ))}
          </div>
          {selectedPeriod === "custom" ? (
            <div className="report-date-range">
              <label>
                <Calendar size={12} />
                <input
                  type="date"
                  value={customStart}
                  max={customEnd}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </label>
              <span className="date-sep">—</span>
              <label>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </label>
            </div>
          ) : null}
        </div>
      </section>

      <section className="report-stat-grid">
        <article className="report-stat cyan">
          <span className="report-stat-icon">
            <Boxes size={18} />
          </span>
          <strong>{report.inventory.trackedMaterials}</strong>
          <p>የሚከታተሉ እቃዎች</p>
          <small>
            {report.inventory.lowStockMaterials} low-stock ·{" "}
            {report.inventory.movementCount} movements
          </small>
        </article>
        <article className="report-stat gold">
          <span className="report-stat-icon">
            <Inbox size={18} />
          </span>
          <strong>{report.financial.totalOrders}</strong>
          <p>ጠቅላላ ትዕዛዞች</p>
          <small>
            {report.financial.completedOrders} completed ·{" "}
            {report.financial.overdueOrders} overdue
          </small>
        </article>
        <article className="report-stat violet">
          <span className="report-stat-icon">
            <DollarSign size={18} />
          </span>
          <strong>{formatCurrency(report.financial.estimatedRevenue)}</strong>
          <p>የተገመተ ገንዘብ</p>
          <small>
            {report.financial.pendingOrders} pending orders · {report.financial.completedOrders} done
          </small>
        </article>
        <article className="report-stat coral">
          <span className="report-stat-icon">
            <Factory size={18} />
          </span>
          <strong>{report.production.jobCardsCreated}</strong>
          <p>የተፈጠሩ ሥራዎች</p>
          <small>
            {report.production.completedJobs} completed · {completionRate}%
            completion
          </small>
        </article>
      </section>

      <section className="report-stat-grid">
        <article className="report-stat violet">
          <span className="report-stat-icon">
            <BarChart3 size={18} />
          </span>
          <strong>
            {report.production.outputQuantity.toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}
          </strong>
          <p>የተመዘገበ ምርት</p>
          <small>
            {report.production.logCount} production logs · {completionRate}% of
            planned
          </small>
        </article>
        <article className="report-stat coral">
          <span className="report-stat-icon">
            <Trash2 size={18} />
          </span>
          <strong>
            {report.production.wasteQuantity.toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}
          </strong>
          <p>ብክነት</p>
          <small>
            {report.production.wasteRate}% waste rate ·{" "}
            {report.recovery.scrapRecords} scrap records
          </small>
        </article>
        <article className="report-stat gold">
          <span className="report-stat-icon">
            <AlertTriangle size={18} />
          </span>
          <strong>{report.exceptions.length}</strong>
          <p>Direct Exception Stock-Out</p>
          <small>
            {report.exceptions.length > 0
              ? `Last: ${report.exceptions[0].materialName}`
              : "No exceptions recorded"}
          </small>
        </article>
        <article className="report-stat cyan">
          <span className="report-stat-icon">
            <Flame size={18} />
          </span>
          <strong>{formatCurrency(report.machineEfficiency.wasteValue.estimatedETB)}</strong>
          <p>የወጪ ዋጋ</p>
          <small>
            {report.machineEfficiency.wasteValue.totalWasteQuantity.toLocaleString("en-US", { maximumFractionDigits: 1 })}{" "}
            {report.machineEfficiency.wasteValue.wasteUnit} total waste
          </small>
        </article>
      </section>

      <section className="report-stat-grid executive-stat-grid">
        <article className="report-stat coral">
          <span className="report-stat-icon"><TrendingDown size={18} /></span>
          <strong>{formatCurrency(report.executive.totalConsumptionETB)}</strong>
          <p>አጠቃላይ የእቃ ውጪ</p>
          <small>
            {report.executive.totalConsumptionBaseQuantity.toLocaleString("en-US", { maximumFractionDigits: 0 })} base units of material value consumed
          </small>
        </article>
        <article className="report-stat gold">
          <span className="report-stat-icon"><AlertTriangle size={18} /></span>
          <strong>{formatCurrency(report.executive.theftAlertsTotalLoss)}</strong>
          <p>የሌብነት/የእቃ ጉድለት</p>
          <small>
            {report.executive.theftAlerts.length} shortage alert{report.executive.theftAlerts.length !== 1 ? "s" : ""} · estimated total loss
          </small>
        </article>
        <article className="report-stat cyan">
          <span className="report-stat-icon"><Trash2 size={18} /></span>
          <strong>{report.executive.scrapRate}%</strong>
          <p>የተመዘገበ ብክነት</p>
          <small>
            {report.executive.scrapQuantity.toLocaleString("en-US", { maximumFractionDigits: 1 })} {report.executive.recordedScrapUnit} logged
          </small>
        </article>
        <article className="report-stat violet">
          <span className="report-stat-icon"><XCircle size={18} /></span>
          <strong>{report.executive.exceptionStockOuts.length}</strong>
          <p>Exception Stock-Outs</p>
          <small>
            Materials issued without a job card in this period
          </small>
        </article>
      </section>

      {report.executive.theftAlerts.length > 0 ? (
        <section className="panel report-panel report-exception-section">
          <div className="panel-head">
            <div>
              <span className="panel-kicker coral">STOCK DISCREPANCY ALERTS</span>
              <h2>የእቃ ጉድለት ማንቂያ</h2>
              <p>Negative physical-count variance, ranked by monetary loss in ETB.</p>
            </div>
            <AlertTriangle size={19} className="report-head-icon" />
          </div>
          <div className="report-exception-table">
            <div className="report-table-header">
              <span>Material</span>
              <span>Variance</span>
              <span>Monetary Loss</span>
              <span>Count Date</span>
            </div>
            {report.executive.theftAlerts.map((alert) => (
              <div className="report-table-row" key={alert.materialName}>
                <span className="exception-material">{alert.materialName}</span>
                <span className="exception-qty shortage-text">
                  -{Math.abs(alert.variance).toLocaleString("en-US", { maximumFractionDigits: 2 })} {alert.unit}
                </span>
                <span className="warning-text">{formatCurrency(alert.monetaryLoss)}</span>
                <span className="exception-date">{formatDate(alert.countDate)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {report.exceptions.length > 0 ? (
        <section className="panel report-panel report-exception-section">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">DIRECT EXCEPTION STOCK-OUT</span>
              <h2>ከትዕዛዝ ያልተፈለገ የእቃ ማውደም</h2>
              <p>
                Materials issued without job cards during this period
              </p>
            </div>
            <AlertTriangle size={19} className="report-head-icon" />
          </div>
          <div className="report-exception-table">
            <div className="report-table-header">
              <span>Material</span>
              <span>Quantity</span>
              <span>Reason</span>
              <span>Operator</span>
              <span>Date</span>
            </div>
            {report.exceptions.map((exception) => (
              <div className="report-table-row" key={exception.id}>
                <span className="exception-material">{exception.materialName}</span>
                <span className="exception-qty">
                  {exception.quantity.toLocaleString("en-US", { maximumFractionDigits: 1 })} {exception.unit}
                </span>
                <span className={`exception-reason reason-${exception.reason.toLowerCase().replace(/\s+/g, "-")}`}>
                  {exception.reason}
                </span>
                <span className="exception-operator">{exception.operatorName}</span>
                <span className="exception-date">{formatDate(exception.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="report-grid">
        <article className="panel report-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">INVENTORY MOVEMENT</span>
              <h2>የእቃ እንቅስቃሴ</h2>
              <p>Material movement recorded during this period</p>
            </div>
            <Boxes size={19} className="report-head-icon" />
          </div>
          <div className="report-list">
            <div className="report-line">
              <span>Stock-in</span>
              <strong>{formatUnitMap(report.inventory.stockInByUnit)}</strong>
            </div>
            <div className="report-line">
              <span>Stock-out</span>
              <strong>{formatUnitMap(report.inventory.stockOutByUnit)}</strong>
            </div>
            <div className="report-line">
              <span>Current active stock</span>
              <strong>
                {report.inventory.totalBaseQuantity.toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })}{" "}
                base units
              </strong>
            </div>
            <div className="report-line">
              <span>Low-stock materials</span>
              <strong
                className={
                  report.inventory.lowStockMaterials > 0
                    ? "warning-text"
                    : "success-text"
                }
              >
                {report.inventory.lowStockMaterials}
              </strong>
            </div>
          </div>
        </article>

        <article className="panel report-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">PRODUCTION PULSE</span>
              <h2>የምርት አፈጻጸም</h2>
              <p>Output, input, and waste from production logs</p>
            </div>
            <Factory size={19} className="report-head-icon" />
          </div>
          <div className="report-list">
            <div className="report-line">
              <span>Production input</span>
              <strong>
                {report.production.inputQuantity.toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
            <div className="report-line">
              <span>Good output</span>
              <strong className="success-text">
                {report.production.outputQuantity.toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
            <div className="report-line">
              <span>Waste output</span>
              <strong className="warning-text">
                {report.production.wasteQuantity.toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
            <div className="report-line">
              <span>Machines running</span>
              <strong>
                {report.production.runningMachines} /{" "}
                {report.production.machineCount}
              </strong>
            </div>
          </div>
        </article>

        <article className="panel report-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">RECOVERY &amp; WASTE</span>
              <h2>ቅሪት እና Scrap</h2>
              <p>Reusable material recovery and unusable waste</p>
            </div>
            <Scissors size={19} className="report-head-icon" />
          </div>
          <div className="report-list">
            <div className="report-line">
              <span>Offcut returns</span>
              <strong>{report.recovery.offcutReturns}</strong>
            </div>
            <div className="report-line">
              <span>Reusable offcuts</span>
              <strong className="success-text">
                {report.recovery.reusableOffcuts}
              </strong>
            </div>
            <div className="report-line">
              <span>Scrap records</span>
              <strong>{report.recovery.scrapRecords}</strong>
            </div>
            <div className="report-line">
              <span>Scrap quantity</span>
              <strong className="warning-text">
                {report.recovery.scrapQuantity.toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
          </div>
        </article>
      </section>

      <section className="report-grid">
        <article className="panel report-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">TOP MATERIAL CONSUMPTION</span>
              <h2>ከፍተኛ የተጠቀሙ እቃዎች</h2>
              <p>Most consumed materials during this period</p>
            </div>
            <TrendingDown size={19} className="report-head-icon" />
          </div>
          <div className="report-list">
            {report.consumption.topMaterials.length === 0 ? (
              <div className="report-line">
                <span>No consumption recorded</span>
                <strong>—</strong>
              </div>
            ) : (
              report.consumption.topMaterials.map((item, index) => {
                const maxConsumed = report.consumption.topMaterials[0]?.totalConsumed ?? 1;
                const pct = Math.round((item.totalConsumed / maxConsumed) * 100);
                return (
                  <div className="report-consumption-row" key={item.materialName}>
                    <div className="consumption-header">
                      <span className="consumption-rank">#{index + 1}</span>
                      <span className="consumption-name">{item.materialName}</span>
                      <span className="consumption-qty">
                        {item.totalConsumed.toLocaleString("en-US", { maximumFractionDigits: 1 })} {item.unit}
                      </span>
                    </div>
                    <div className="consumption-bar-track">
                      <div
                        className="consumption-bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="consumption-meta">{item.movementCount} movements</span>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="panel report-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">REORDER FORECAST</span>
              <h2>የእቃ ማስቀመጫ ትንበያ</h2>
              <p>Materials at or below reorder level with estimated stock-out days</p>
            </div>
            <Clock size={19} className="report-head-icon" />
          </div>
          <div className="report-list">
            {report.consumption.reorderAlerts.length === 0 ? (
              <div className="report-line">
                <span>No materials below reorder level</span>
                <strong className="success-text">All stocked</strong>
              </div>
            ) : (
              report.consumption.reorderAlerts.map((alert) => (
                <div className="report-reorder-row" key={alert.materialName}>
                  <div className="reorder-info">
                    <span className="reorder-name">{alert.materialName}</span>
                    <span className="reorder-stock">
                      {alert.currentStock.toLocaleString("en-US", { maximumFractionDigits: 1 })} / {alert.reorderAt.toLocaleString("en-US", { maximumFractionDigits: 1 })} {alert.unit}
                    </span>
                  </div>
                  <span
                    className={`reorder-estimate ${
                      alert.estimatedDaysLeft !== null && alert.estimatedDaysLeft <= 3
                        ? "critical"
                        : alert.estimatedDaysLeft !== null && alert.estimatedDaysLeft <= 7
                          ? "warning"
                          : "normal"
                    }`}
                  >
                    <TrendingDown size={11} />
                    {formatDaysLeft(alert.estimatedDaysLeft)}
                  </span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel report-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">MACHINE EFFICIENCY</span>
              <h2>የማሽን አቀናብር</h2>
              <p>Utilization summary by machine type</p>
            </div>
            <Factory size={19} className="report-head-icon" />
          </div>
          <div className="report-list">
            {report.machineEfficiency.byType.length === 0 ? (
              <div className="report-line">
                <span>No active machines</span>
                <strong>—</strong>
              </div>
            ) : (
              report.machineEfficiency.byType.map((machine) => {
                const totalLogs = report.machineEfficiency.byType.reduce(
                  (sum, m) => sum + m.logCount,
                  0,
                );
                const logPct =
                  totalLogs > 0
                    ? Math.round((machine.logCount / totalLogs) * 100)
                    : 0;
                return (
                  <div className="report-machine-row" key={machine.machineType}>
                    <div className="machine-header">
                      <span className="machine-type">{machine.machineType}</span>
                      <span className="machine-count">
                        {machine.machineCount} unit{machine.machineCount > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="machine-bar-track">
                      <div
                        className="machine-bar-fill"
                        style={{ width: `${logPct}%` }}
                      />
                    </div>
                    <div className="machine-stats">
                      <span>{machine.jobCount} jobs</span>
                      <span>{machine.logCount} logs</span>
                      <span>
                        {machine.totalOutput.toLocaleString("en-US", { maximumFractionDigits: 1 })} out
                      </span>
                      {machine.totalWaste > 0 ? (
                        <span className="warning-text">
                          {machine.totalWaste.toLocaleString("en-US", { maximumFractionDigits: 1 })} waste
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>

      {report.machineEfficiency.operatorActivity.length > 0 ? (
        <section className="panel report-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">OPERATOR PRODUCTIVITY</span>
              <h2>የኦፕሬተር ተጠያቂነት</h2>
              <p>Activity summary per operator during this period</p>
            </div>
            <Users size={19} className="report-head-icon" />
          </div>
          <div className="report-exception-table">
            <div className="report-table-header report-table-operators">
              <span>Operator</span>
              <span>Jobs Created</span>
              <span>Production Logs</span>
              <span>Output</span>
            </div>
            {report.machineEfficiency.operatorActivity.map((op) => (
              <div className="report-table-row report-table-operators" key={op.operatorName}>
                <span className="exception-operator">{op.operatorName}</span>
                <span>{op.jobCount}</span>
                <span>{op.logCount}</span>
                <span>
                  {op.outputQuantity.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="report-note">
        <BarChart3 size={17} />
        <p>
          <strong>Data note:</strong> {report.seededDataNote}
        </p>
      </section>
    </div>
  );
}
