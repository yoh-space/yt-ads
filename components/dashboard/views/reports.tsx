"use client";

import {
  BarChart3,
  Boxes,
  Factory,
  RefreshCw,
  Scissors,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { ReportPeriod } from "@/lib/report-types";

const periods: Array<{ id: ReportPeriod; label: string; english: string }> = [
  { id: "weekly", label: "ሳምንታዊ", english: "Weekly" },
  { id: "biweekly", label: "የሁለት ሳምንት", english: "Bi-weekly" },
  { id: "monthly", label: "ወርሃዊ", english: "Monthly" },
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

export function ReportsView() {
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>("weekly");
  const report = useQuery(api.reports.getSummary, { period: selectedPeriod });

  if (!report) {
    return (
      <div className="report-loading">
        <RefreshCw size={16} /> ሪፖርቱ እየተዘጋጀ ነው…
      </div>
    );
  }

  const periodLabel = periods.find(item => item.id === selectedPeriod);
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
        <div className="period-switcher" aria-label="Report period">
          {periods.map(period => (
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
            <Factory size={18} />
          </span>
          <strong>{report.production.jobCardsCreated}</strong>
          <p>በዚህ ጊዜ የተፈጠሩ ሥራዎች</p>
          <small>
            {report.production.activeJobs} active ·{" "}
            {report.production.completedJobs} completed
          </small>
        </article>
        <article className="report-stat violet">
          <span className="report-stat-icon">
            <BarChart3 size={18} />
          </span>
          <strong>
            {report.production.outputQuantity.toLocaleString("en-US", {
              maximumFractionDigits: 2,
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
              maximumFractionDigits: 2,
            })}
          </strong>
          <p>ብክነት</p>
          <small>
            {report.production.wasteRate}% recorded waste rate ·{" "}
            {report.recovery.scrapRecords} scrap records
          </small>
        </article>
      </section>

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

      <section className="report-note">
        <BarChart3 size={17} />
        <p>
          <strong>Data note:</strong> {report.seededDataNote}
        </p>
      </section>
    </div>
  );
}
