"use client";

import { AlertTriangle, CheckCircle2, ClipboardCheck, PackagePlus, RefreshCw, Scale, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Material } from "@/lib/operations-types";
import { cn } from "@/lib/utils";
import { Button, StatusPill } from "@/components/ui";
import { DataTable, PanelHead, StatCard } from "./report-atoms";

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

function formatNumber(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function ReconciliationView({
  materials,
  canRecord,
  canReview,
  canSeeFinancial,
  onCount,
  onReview,
}: {
  materials: Material[];
  canRecord: boolean;
  canReview: boolean;
  canSeeFinancial: boolean;
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
      <div className="flex items-center justify-center min-h-[240px] bg-white border border-line rounded-lg shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <RefreshCw size={16} className="animate-spin" /> የክምችት ማረጋገጫ እየተዘጋጀ ነው…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar / actions */}
      <section className="bg-white border border-line rounded-xl p-6 shadow-sm flex flex-col sm:flex-row items-start gap-5 justify-between">
        <div>
          <span className="block text-xs font-mono font-bold tracking-wider text-cyan-dark uppercase">PHYSICAL STOCK AUDIT</span>
          <h2 className="text-lg font-bold text-navy mt-1">
            የእቃ ቆጠራ ማረጋገጫ <span className="text-sm font-normal text-gray-600">Reconciliation</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Count physical stock and compare it against the system balance to surface shortages (leakage) and surpluses.
          </p>
        </div>
        {canRecord ? (
          <Button onClick={onCount} className="flex-none">
            <PackagePlus size={16} />Record physical count
          </Button>
        ) : null}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard tone="cyan" icon={<Scale size={18} />} value={summary.countRecords} label="ጠቅላላ ቆጠራ" sub="Total count records" />
        <StatCard tone="gold" icon={<ClipboardCheck size={18} />} value={summary.openCounts} label="ክፍት ቆጠራ" sub="Pending review" />
        <StatCard tone="violet" icon={<AlertTriangle size={18} />} value={summary.shortageCounts} label="የእቃ ጉድለት" sub="Shortage records count" />
        <StatCard
          tone="coral"
          icon={<TrendingDown size={18} />}
          value={canSeeFinancial ? formatCurrency(summary.totalMonetaryLoss) : formatNumber(summary.shortageCounts)}
          label={canSeeFinancial ? "የገንዘብ ኪሳራ" : "Shortages"}
          sub={canSeeFinancial ? "Total monetary loss (ETB)" : "Shortage records count"}
        />
      </section>

      {summary.currentVariances.length ? (
        <section className="bg-white border border-line rounded-xl p-6 shadow-sm">
          <PanelHead
            kicker="STOCK LEAKAGE ALERTS"
            tone="coral"
            title="የእቃ ጉድለት ማንቂያ"
            note={canSeeFinancial ? "Current variance per material, ranked by monetary loss. Negative variance = shortage." : "Current variance per material. Negative variance = shortage."}
            icon={<AlertTriangle size={19} />}
          />
          <div className="mt-4">
            <DataTable
              minWidth={canSeeFinancial ? "grid-cols-[2fr_1fr_1fr_1fr_1fr]" : "grid-cols-[2fr_1fr_1fr_1fr]"}
              cols={[
                { label: "Material" },
                { label: "Variance" },
                { label: "State" },
                ...(canSeeFinancial ? [{ label: "Monetary Loss" }] : []),
                { label: "Count Date" },
              ]}
              rows={summary.currentVariances.map((v) => {
                const shortage = v.variance < 0;
                return {
                  key: v.materialId,
                  cells: [
                    <span key="m" className="text-sm font-semibold text-navy">{v.materialName}</span>,
                    <span key="v" className={cn("text-sm font-medium", shortage ? "text-coral" : "text-green")}>
                      {shortage ? "-" : "+"}{Math.abs(v.variance).toLocaleString("en-US", { maximumFractionDigits: 2 })} {v.unit}
                    </span>,
                    <span key="s">
                      <StatusPill variant={shortage ? "warning" : "success"}>{shortage ? "Shortage" : "Surplus"}</StatusPill>
                    </span>,
                    ...(canSeeFinancial
                      ? [<span key="l" className={cn("text-sm", shortage ? "text-gold" : "text-green")}>{shortage ? formatCurrency(v.monetaryLoss) : "—"}</span>]
                      : []),
                    <span key="d" className="text-sm text-gray-500">{formatDate(v.countDate)}</span>,
                  ],
                };
              })}
            />
          </div>
          {canSeeFinancial ? (
            <div className="mt-4 flex items-start gap-2.5 p-4 bg-gold/10 border border-gold/20 rounded-lg text-sm text-gray-600">
              <AlertTriangle size={17} className="text-gold flex-none mt-0.5" />
              <p>
                <strong className="text-navy">Alert:</strong> total monetary loss from shortages is <b className="text-gold">{formatCurrency(summary.totalMonetaryLoss)}</b>. Review each shortage against recent job-card deductions and exception stock-outs.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Reconciliation history */}
      <section className="bg-white border border-line rounded-xl shadow-sm">
        <div className="p-6">
          <PanelHead
            kicker="RECONCILIATION HISTORY"
            title="የተመዘገቡ ቆጠራዎች"
            note="Physical counts, variance, and status per material."
            icon={<ClipboardCheck size={19} />}
          />
        </div>

        <div className="px-6 pb-2">
          <div className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-lg" aria-label="Reconciliation filter">
            {(["all", "open", "shortage"] as const).map((f) => (
              <button
                key={f}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-cyan",
                  filter === f ? "bg-white text-navy shadow-sm" : "text-gray-600 hover:text-gray-900",
                )}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "open" ? "Open" : "Shortages"}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="m-6 p-10 text-center text-sm text-gray-500 bg-gray-50 border border-dashed border-line rounded-lg">
            No reconciliation records in this view yet.
          </div>
        ) : (
          <div className="p-6 pt-3 space-y-2.5">
            {filtered.map((record) => {
              const shortage = record.variance < 0;
              return (
                <article key={record.id} className="flex items-center gap-4 p-4 bg-white border border-line rounded-lg hover:border-cyan/40 hover:bg-cyan/5 transition-colors">
                  <span className={cn("flex items-center justify-center w-10 h-10 rounded-lg flex-none", shortage ? "bg-coral/10 text-coral" : "bg-cyan/10 text-cyan-dark")}>
                    {shortage ? <AlertTriangle size={16} /> : record.variance > 0 ? <TrendingUp size={16} /> : <CheckCircle2 size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-semibold text-navy">{record.materialName}</strong>
                      <span className="text-xs text-gray-500">{record.materialUnit}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">
                      System {record.systemQuantity} · Counted {record.countedQuantity} ·{" "}
                      <b className={shortage ? "text-coral" : "text-green"}>
                        Variance {shortage ? "-" : record.variance > 0 ? "+" : ""}{Math.abs(record.variance)} {record.materialUnit}
                      </b>
                    </p>
                    <small className="block text-xs text-gray-500 mt-0.5">
                      {shortage && canSeeFinancial ? `Estimated loss ${formatCurrency(record.monetaryLoss ?? 0)} · ` : ""}
                      Counted by {record.countedByName} · {formatDate(record.createdAt)}
                      {record.note ? ` · ${record.note}` : ""}
                    </small>
                  </div>
                  <div className="flex items-center gap-2 flex-none">
                    <StatusPill variant={record.status === "Open" ? "warning" : record.status === "Resolved" ? "success" : "info"}>
                      {record.status}
                    </StatusPill>
                    {canReview && record.status === "Open" ? (
                      <Button size="small" variant="secondary" onClick={() => onReview(record.id, "Reviewed")}>Review</Button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex items-start gap-2.5 p-4 bg-coral/5 border border-coral/15 rounded-lg text-sm text-gray-600">
        <XCircle size={16} className="text-coral flex-none mt-0.5" />
        <p>
          <strong className="text-navy">Control note:</strong> negative variance is a shortage that flags potential stock leakage or theft. Final review and resolution are owner-only actions.
        </p>
      </div>
    </div>
  );
}