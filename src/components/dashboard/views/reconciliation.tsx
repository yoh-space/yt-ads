"use client";

import { AlertTriangle, CheckCircle2, ClipboardCheck, PackagePlus, RefreshCw, Scale, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Material, ReconciliationRecord, ReconciliationSummary } from "@/lib/operations-types";

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatCurrency(n: number) {
  return `ETB ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function ReconciliationView({
  materials,
  canRecord,
  canReview,
  onCount,
  onReview,
}: {
  materials: Material[];
  canRecord: boolean;
  canReview: boolean;
  onCount: () => void;
  onReview: (id: string, status: "Reviewed" | "Resolved", note?: string) => void;
}) {
  const summary = useQuery(api.reconciliation.summary);
  const records = useQuery(api.reconciliation.list);
  const [filter, setFilter] = useState<"all" | "open" | "shortage">("all");

  const filtered = useMemo(() => {
    if (!records) return [];
    if (filter === "open") return records.filter((r) => r.status === "Open");
    if (filter === "shortage") return records.filter((r) => r.variance < 0);
    return records;
  }, [records, filter]);

  if (!summary || !records) {
    return (
      <div className="report-loading"><RefreshCw size={16} /> የክምችት ማረጋገጫ እየተዘጋጀ ነው…</div>
    );
  }

  return (
    <div className="reconciliation-view">
      <section className="report-toolbar panel">
        <div>
          <span className="panel-kicker">PHYSICAL STOCK AUDIT</span>
          <h2>የእቃ ቆጠራ ማረጋገጫ <small>Reconciliation</small></h2>
          <p>Count physical stock and compare it against the system balance to surface shortages (leakage) and surpluses.</p>
        </div>
        <div className="report-toolbar-right">
          {canRecord ? <button className="button primary" onClick={onCount}><PackagePlus size={16} />Record physical count</button> : null}
        </div>
      </section>

      <section className="report-stat-grid">
        <article className="report-stat cyan">
          <span className="report-stat-icon"><Scale size={18} /></span>
          <strong>{summary.countRecords}</strong>
          <p>ጠቅላላ ቆጠራ</p>
          <small>Total count records</small>
        </article>
        <article className="report-stat gold">
          <span className="report-stat-icon"><ClipboardCheck size={18} /></span>
          <strong>{summary.openCounts}</strong>
          <p>ክፍት ቆጠራ</p>
          <small>Pending review</small>
        </article>
        <article className="report-stat violet">
          <span className="report-stat-icon"><AlertTriangle size={18} /></span>
          <strong>{summary.shortageCounts}</strong>
          <p>የእቃ ጉድለት</p>
          <small>Shortage records count</small>
        </article>
        <article className="report-stat coral">
          <span className="report-stat-icon"><TrendingDown size={18} /></span>
          <strong>{formatCurrency(summary.totalMonetaryLoss)}</strong>
          <p>የገንዘብ ኪሳራ</p>
          <small>Total monetary loss (ETB)</small>
        </article>
      </section>

      {summary.currentVariances.length ? (
        <section className="panel report-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker coral">STOCK LEAKAGE ALERTS</span>
              <h2>የእቃ ጉድለት ማንቂያ</h2>
              <p>Current variance per material, ranked by monetary loss. Negative variance = shortage.</p>
            </div>
            <AlertTriangle size={19} className="report-head-icon" />
          </div>
          <div className="report-exception-table">
            <div className="report-table-header">
              <span>Material</span>
              <span>Variance</span>
              <span>State</span>
              <span>Monetary Loss</span>
              <span>Count Date</span>
            </div>
            {summary.currentVariances.map((v) => {
              const shortage = v.variance < 0;
              return (
                <div className="report-table-row" key={v.materialId}>
                  <span className="exception-material">{v.materialName}</span>
                  <span className={`exception-qty ${shortage ? "shortage-text" : "success-text"}`}>
                    {shortage ? "-" : "+"}{Math.abs(v.variance).toLocaleString("en-US", { maximumFractionDigits: 2 })} {v.unit}
                  </span>
                  <span>
                    <span className={`status-pill ${shortage ? "warning" : "success"}`}>
                      {shortage ? "Shortage" : "Surplus"}
                    </span>
                  </span>
                  <span className={shortage ? "warning-text" : "success-text"}>
                    {shortage ? formatCurrency(v.monetaryLoss) : "—"}
                  </span>
                  <span className="exception-date">{formatDate(v.countDate)}</span>
                </div>
              );
            })}
          </div>
          <div className="report-note" style={{ marginTop: 16 }}>
            <AlertTriangle size={17} />
            <p><strong>Alert:</strong> total monetary loss from shortages is <b>{formatCurrency(summary.totalMonetaryLoss)}</b>. Review each shortage against recent job-card deductions and exception stock-outs.</p>
          </div>
        </section>
      ) : null}

      <section className="panel audit-panel">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">RECONCILIATION HISTORY</span>
            <h2>የተመዘገቡ ቆጠራዎች</h2>
            <p>Physical counts, variance, and status per material.</p>
          </div>
          <ClipboardCheck size={19} className="report-head-icon" />
        </div>
        <div className="audit-filters" aria-label="Reconciliation filter" style={{ marginBottom: 16 }}>
          {(["all", "open", "shortage"] as const).map((f) => (
            <button key={f} className={filter === f ? "selected" : ""} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "open" ? "Open" : "Shortages"}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">No reconciliation records in this view yet.</div>
        ) : (
          <div className="audit-list">
            {filtered.map((record) => {
              const shortage = record.variance < 0;
              return (
                <article className="audit-entry" key={record.id}>
                  <span className={`audit-icon ${shortage ? "coral" : "cyan"}`}>
                    {shortage ? <AlertTriangle size={16} /> : record.variance > 0 ? <TrendingUp size={16} /> : <CheckCircle2 size={16} />}
                  </span>
                  <div className="audit-entry-main">
                    <div className="audit-entry-title">
                      <strong>{record.materialName}</strong>
                      <span>{record.materialUnit}</span>
                    </div>
                    <p>
                      System {record.systemQuantity} · Counted {record.countedQuantity} ·{" "}
                      <b className={shortage ? "warning-text" : "success-text"}>
                        Variance {shortage ? "-" : record.variance > 0 ? "+" : ""}{Math.abs(record.variance)} {record.materialUnit}
                      </b>
                    </p>
                    <small>
                      {shortage ? `Estimated loss ${formatCurrency(record.monetaryLoss ?? 0)} · ` : ""}
                      Counted by {record.countedByName} · {formatDate(record.createdAt)}
                      {record.note ? ` · ${record.note}` : ""}
                    </small>
                  </div>
                  <div className="audit-entry-actions">
                    <span className={`status-pill ${record.status === "Open" ? "warning" : record.status === "Resolved" ? "success" : "info"}`}>
                      {record.status}
                    </span>
                    {canReview && record.status === "Open" ? (
                      <button className="button secondary small" onClick={() => onReview(record.id, "Reviewed")}>Review</button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="audit-note">
        <XCircle size={16} />
        <p><strong>Control note:</strong> negative variance is a shortage — its ETB value flags potential stock leakage or theft and should be investigated by the owner before resolution.</p>
      </section>
    </div>
  );
}
