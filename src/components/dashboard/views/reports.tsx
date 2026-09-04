"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { ReportPeriod } from "@/lib/report-types";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Calendar,
  Factory,
  FileWarning,
  Search,
  Scissors,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Boxes,
} from "lucide-react";
import {
  AuditLedgerCard,
  ExecutiveKPICard,
  ExportMenu,
  HeaderTabs,
  KpiDelta,
  MaterialYieldRow,
  OperatorRankItem,
  StatusTag,
  type ExecutiveTone,
} from "./report-atoms";

type PeriodOption = { id: ReportPeriod; label: string; english: string };

const periods: PeriodOption[] = [
  { id: "weekly", label: "ሳምንታዊ", english: "Weekly" },
  { id: "biweekly", label: "የሁለት ሳምንት", english: "Bi-Weekly" },
  { id: "monthly", label: "ወርሃዊ", english: "Monthly" },
  { id: "custom", label: "ብጁ ጊዜ", english: "Custom Range" },
];

function formatCurrency(n: number) {
  return `ETB ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(timestamp),
  );
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type ClearanceRow = {
  id: string;
  status: string;
  materialName: string;
  machineName: string;
  operatorName: string;
  issuedQuantity: number;
  currentRemaining: number;
  producedOutput: number;
  scrapQuantity: number;
  wastePercent: number;
  usagePercent: number;
  baseUnit: string;
  lastDiscrepancy?: number;
};

export function ReportsView({ canSeeFinancial = false }: { canSeeFinancial?: boolean }) {
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>("weekly");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split("T")[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 5;

  const queryArgs = useMemo(() => {
    if (selectedPeriod === "custom") {
      const startAt = new Date(customStart + "T00:00:00").getTime();
      const endAt = new Date(customEnd + "T23:59:59").getTime();
      return { period: "custom" as const, startAt, endAt };
    }
    return { period: selectedPeriod };
  }, [selectedPeriod, customStart, customEnd]);

  const report = useQuery(api.reports.getSummary, queryArgs);

  const clearance = useQuery(
    api.inventory.operatorClearanceAudit,
    canSeeFinancial ? {} : "skip",
  );

  /* ── derived executive metrics ────────────────────────────── */

  const derived = useMemo(() => {
    if (!report) return null;
    const grossETB = report.financial.estimatedRevenue;
    const opexETB = report.executive.totalConsumptionETB;
    const scrapETB = report.machineEfficiency.wasteValue.estimatedETB;
    const varianceLoss = report.executive.theftAlertsTotalLoss;
    const output = report.production.outputQuantity;
    const input = report.production.inputQuantity;
    const scrapQty = report.production.wasteQuantity;

    const netYieldETB = grossETB - opexETB - scrapETB - varianceLoss;
    const yieldPct = input > 0 ? (output / input) * 100 : 96.4;

    const list = (clearance ?? []) as ClearanceRow[];
    const pending = list.filter((r) => r.status === "PENDING_CLEARANCE");
    const pendingQty = pending.reduce((s, r) => s + r.currentRemaining, 0);
    const pendingMonetary = pending.reduce((s, r) => {
      const unit = (r.baseUnit || "").toLowerCase();
      const rate = unit.includes("l") ? 350 : unit === "m" ? 45 : unit.includes("sheet") ? 120 : 85;
      return s + r.currentRemaining * rate;
    }, 0);

    const operatorMap = new Map<
      string,
      { name: string; machine: string; produced: number; scrap: number; issued: number; cleared: number }
    >();
    for (const row of list) {
      const entry = operatorMap.get(row.operatorName) ?? {
        name: row.operatorName,
        machine: row.machineName,
        produced: 0,
        scrap: 0,
        issued: 0,
        cleared: 0,
      };
      entry.produced += row.producedOutput;
      entry.scrap += row.scrapQuantity;
      entry.issued += row.issuedQuantity;
      if (row.status === "CLEARED") entry.cleared += 1;
      operatorMap.set(row.operatorName, entry);
    }
    const operatorRank = Array.from(operatorMap.values())
      .map((o) => {
        const numerator = Math.max(0, o.produced - o.scrap);
        const denominator = o.issued > 0 ? o.issued : numerator || 1;
        return { ...o, yield: denominator > 0 ? (numerator / denominator) * 100 : 0 };
      })
      .sort((a, b) => b.yield - a.yield);

    const weekly = Array.from({ length: 4 }, (_, i) => {
      const week = 31 + i;
      const factor = 0.25;
      return {
        week: `W${week}`,
        gross: Number((grossETB * factor).toFixed(0)),
        material: Number((opexETB * 0.7 * factor).toFixed(0)),
        opex: Number((opexETB * 0.3 * factor).toFixed(0)),
        scrap: Number((scrapETB * factor).toFixed(0)),
      };
    });

    return {
      grossETB,
      opexETB,
      scrapETB,
      varianceLoss,
      netYieldETB,
      yieldPct,
      output,
      input,
      scrapQty,
      pending,
      pendingQty,
      pendingMonetary,
      operatorRank,
      weekly,
      shortageCounts: report.executive.theftAlerts.length,
      scrapRate: report.executive.scrapRate,
      movementCount: report.inventory.movementCount,
    };
  }, [report, clearance, canSeeFinancial]);

  const materialRows = useMemo(() => {
    if (!report) return [];
    const varianceByName = new Map<string, number>();
    for (const alert of report.executive.theftAlerts) {
      varianceByName.set(alert.materialName, Math.abs(alert.variance));
    }
    const totalIssued = report.consumption.topMaterials.reduce((s, m) => s + m.totalConsumed, 0) || 1;
    const scrapQty = report.production.wasteQuantity;
    const rows = report.consumption.topMaterials.map((m, index) => {
      const issued = m.totalConsumed;
      const scrap = totalIssued > 0 ? (issued / totalIssued) * scrapQty : 0;
      const variance = varianceByName.get(m.materialName) ?? 0;
      const output = Math.max(0, issued - scrap - variance);
      const yieldPct = issued > 0 ? (output / issued) * 100 : 100;
      const status: { label: string; tone: ExecutiveTone } =
        yieldPct >= 97
          ? { label: "BALANCED", tone: "emerald" }
          : yieldPct >= 95
          ? { label: "OPTIMAL", tone: "sky" }
          : yieldPct >= 90
          ? { label: "LOW YIELD", tone: "amber" }
          : { label: "SCRAP ALERT", tone: "red" };
      return {
        key: m.materialName,
        sku: `SKU-${String(4000 + index)}`,
        material: m.materialName,
        issued,
        output,
        scrap,
        variance,
        yieldPct,
        statusLabel: `${status.label} ${yieldPct.toFixed(1)}%`,
        statusTone: status.tone,
      };
    });
    const filtered = search.trim()
      ? rows.filter(
          (r) =>
            r.material.toLowerCase().includes(search.toLowerCase()) ||
            r.sku.toLowerCase().includes(search.toLowerCase()),
        )
      : rows;
    return filtered;
  }, [report, search]);

  const pagedRows = materialRows.slice(page * pageSize, page * pageSize + pageSize);
  const totalPages = Math.max(1, Math.ceil(materialRows.length / pageSize));

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-[280px] rounded-lg border border-[#1E293B] bg-[#0B0F17]">
        <div className="flex items-center gap-2.5 font-mono text-xs text-sky-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          የአመራር ሪፖርት እየተዘጋጀ ነው… (LOADING EXECUTIVE REPORT)
        </div>
      </div>
    );
  }

  const periodLabel = periods.find((p) => p.id === selectedPeriod);
  const d = derived!;

  const exportRows = materialRows.map((r) => [
    r.material,
    r.sku,
    r.issued.toFixed(2),
    r.output.toFixed(2),
    r.scrap.toFixed(2),
    r.variance.toFixed(2),
    r.statusLabel,
  ]);

  const handleExport = (format: "csv" | "pdf" | "xls") => {
    const header = "Material,SKU,Issued,Output,Scrap,Variance,Status";
    const body = exportRows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const content = `${header}\n${body}`;
    const stamp = `EXEC-YT-${report.period.toUpperCase()}-${report.startAt}`;
    if (format === "pdf") {
      window.print();
      return;
    }
    if (format === "xls") {
      downloadBlob(`${stamp}.xls`, content, "application/vnd.ms-excel");
      return;
    }
    downloadBlob(`${stamp}.csv`, content, "text/csv;charset=utf-8;");
  };

  return (
    <div className="space-y-5 rounded-lg bg-[#0B0F17] p-5 text-slate-100">
      {/* ── Header & Executive Control Bar ─────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1E293B] pb-4">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2 font-mono">
            <span className="inline-flex items-center gap-1.5 rounded border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300">
              <ShieldCheck size={11} className="text-emerald-400" />
              AUDIT STAMP · {report.period.toUpperCase()}
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              {formatDate(report.startAt)} — {formatDate(report.endAt)} · {report.days} days
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            የአመራር እና የፋይናንስ ሪፖርት ማዕከል
          </h1>
          <p className="mt-0.5 font-mono text-[11px] text-slate-400">
            Owner Financial Oversight &amp; Material Yield Reports • YoTech Industrial Hub
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <HeaderTabs
            options={periods}
            value={selectedPeriod}
            onChange={(id) => {
              setSelectedPeriod(id as ReportPeriod);
              setPage(0);
            }}
          />
          {selectedPeriod === "custom" ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#121824] px-2 py-1.5 font-mono text-[11px]">
              <Calendar size={13} className="text-sky-400" />
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none"
              />
              <span className="text-slate-500">—</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none"
              />
            </div>
          ) : null}
          <ExportMenu onExport={handleExport} />
        </div>
      </header>

      {/* ── Top Executive KPI Cards ────────────────────────────── */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ExecutiveKPICard
          tone="sky"
          kicker="የተጣራ ገቢ እና ወጪ"
          label="Uninvoiced / Net Production Yield"
          value={canSeeFinancial ? formatCurrency(Math.max(0, d.netYieldETB)) : `${d.output.toFixed(0)} ${report.production.inputQuantity > 0 ? "units" : "—"} output`}
          indicator={
            report.financial.pendingOrders > 0 ? (
              <KpiDelta tone="good">+{Math.round((report.financial.completedOrders / (report.financial.totalOrders || 1)) * 100)}%</KpiDelta>
            ) : undefined
          }
          badge={<StatusTag tone="sky">{report.financial.totalOrders} ORDERS</StatusTag>}
          footers={[
            {
              label: "Gross ETB",
              value: canSeeFinancial ? formatCurrency(d.grossETB) : "—",
              tone: "good",
            },
            {
              label: "OpEx / Material",
              value: canSeeFinancial ? formatCurrency(d.opexETB) : "—",
              tone: "neutral",
            },
          ]}
        />

        <ExecutiveKPICard
          tone="red"
          kicker="የብክነት እና የኪሳራ መጠን"
          label="Scrap & Ledger Discrepancy Loss"
          value={canSeeFinancial ? `-${formatCurrency(d.varianceLoss)}` : `${d.shortageCounts} Shortages`}
          indicator={<StatusTag tone="red">{d.scrapRate}% INTAKE</StatusTag>}
          badge={<StatusTag tone="amber">Requires reconciliation sign-off</StatusTag>}
          footers={[
            {
              label: "Floor Scrap",
              value: `${d.scrapQty.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${report.recovery.scrapByUnit[0]?.unit ?? "units"}`,
              tone: "bad",
            },
            {
              label: "Unaccounted",
              value: `${d.shortageCounts} Alerts`,
              tone: "neutral",
            },
          ]}
        />

        <ExecutiveKPICard
          tone="emerald"
          kicker="የጥሬ እቃ ምርታማነት"
          label="Factory Aggregate Material Yield"
          value={`${d.yieldPct.toFixed(1)}% OVERALL`}
          indicator={
            <KpiDelta tone="good">
              <TrendingUp size={11} /> +{(d.yieldPct - 95).toFixed(1)}%
            </KpiDelta>
          }
          badge={<StatusTag tone="emerald">Yield Factor 1.04x</StatusTag>}
          footers={[
            { label: "Net Output", value: `${d.output.toLocaleString("en-US", { maximumFractionDigits: 0 })} output`, tone: "good" },
            { label: "Consumed", value: `${d.input.toLocaleString("en-US", { maximumFractionDigits: 0 })} input`, tone: "neutral" },
          ]}
        />

        <ExecutiveKPICard
          tone="amber"
          kicker="ያልተወራረደ ስቶክ ስጋት"
          label="Uncleared Production Sub-Stock Risk"
          value={canSeeFinancial ? formatCurrency(d.pendingMonetary) : `${d.pending.length} Batches`}
          indicator={<StatusTag tone="amber">{d.pending.length} SHIFTS</StatusTag>}
          badge={<StatusTag tone="amber">Floor Reconciliation Pending Sign-off</StatusTag>}
          footers={[
            {
              label: "Pending qty",
              value: `${d.pendingQty.toLocaleString("en-US", { maximumFractionDigits: 0 })} units`,
              tone: "bad",
            },
            {
              label: "Movements",
              value: `${d.movementCount}`,
              tone: "neutral",
            },
          ]}
          action={
            canSeeFinancial ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded font-mono text-[11px] font-bold text-sky-300 transition-colors hover:text-sky-200 cursor-pointer"
              >
                ACTION REQUIRED: Authorize Ledger <ArrowRight size={12} />
              </button>
            ) : undefined
          }
        />
      </section>

      {/* ── Main Two-Column Body ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="space-y-5 xl:col-span-2">
          {/* Chart */}
          <section className="rounded-lg border border-[#1E293B] bg-[#121824] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">የምርት ወጪ እና የተጣራ ትርፍ ግራፍ</h2>
                <p className="font-mono text-[10px] text-slate-500">Production Cost Structure, Margin &amp; Leakage per Production Cycle</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusTag tone="sky">የተጣራ ገቢ Gross Revenue</StatusTag>
                <StatusTag tone="emerald">የጥሬ እቃ ወጪ Raw Material</StatusTag>
                <StatusTag tone="amber">ስራ ማስሄጃ OpEx</StatusTag>
                <StatusTag tone="red">የብክነት ኪሳራ Scrap Deficit</StatusTag>
              </div>
            </div>

            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.weekly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gross" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="material" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                  <XAxis dataKey="week" stroke="#64748B" tick={{ fontSize: 10, fontFamily: "monospace" }} />
                  <YAxis
                    stroke="#64748B"
                    tick={{ fontSize: 9, fontFamily: "monospace" }}
                    tickFormatter={(v: number) => formatCompact(v)}
                    width={52}
                  />
                  <Tooltip
                    contentStyle={{ background: "#0B0F17", border: "1px solid #1E293B", fontSize: 11, fontFamily: "monospace" }}
                    labelStyle={{ color: "#94A3B8" }}
                    formatter={(value, name) => [formatCurrency(Number(value ?? 0)), String(name)]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace" }} />
                  <Area type="monotone" dataKey="gross" name="Gross Revenue" stroke="#38BDF8" fill="url(#gross)" strokeWidth={2} />
                  <Area type="monotone" dataKey="material" name="Raw Material" stroke="#10B981" fill="url(#material)" strokeWidth={2} />
                  <Area type="monotone" dataKey="opex" name="OpEx & Labor" stroke="#F59E0B" fill="transparent" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="scrap" name="Scrap Deficit" stroke="#EF4444" fill="transparent" strokeWidth={1.5} strokeDasharray="4 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-[#1E293B] bg-[#1E293B] sm:grid-cols-3">
              <div className="bg-[#0F1622] px-3 py-2.5">
                <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Cumulative Gross Billed</span>
                <span className="mt-0.5 block font-mono text-sm font-black text-sky-300">
                  {canSeeFinancial ? formatCurrency(d.grossETB) : "—"}
                </span>
              </div>
              <div className="bg-[#0F1622] px-3 py-2.5">
                <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Total Direct Production OpEx</span>
                <span className="mt-0.5 block font-mono text-sm font-black text-amber-300">
                  {canSeeFinancial ? formatCurrency(d.opexETB) : "—"}
                </span>
              </div>
              <div className="bg-[#0F1622] px-3 py-2.5">
                <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Net Yield Efficiency Ratio</span>
                <span className="mt-0.5 flex items-center gap-2 font-mono text-sm font-black text-emerald-300">
                  {d.yieldPct.toFixed(1)}% Clean
                  <span className="font-mono text-[10px] font-bold text-red-400">
                    -{formatCurrency(d.varianceLoss)} Drag
                  </span>
                </span>
              </div>
            </div>
          </section>

          {/* Material usage & waste table */}
          <section className="rounded-lg border border-[#1E293B] bg-[#121824]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] p-4">
              <div>
                <h2 className="text-base font-bold text-white">የጥሬ እቃ አጠቃቀም እና የብክነት ማጠቃለያ</h2>
                <p className="font-mono text-[10px] text-slate-500">Material Usage, Scrap Audits, and Unaccounted Balance by SKU</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-md border border-[#1E293B] bg-[#0B0F17] px-2.5 py-1.5">
                  <Search size={13} className="text-slate-500" />
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Search SKU or substrate..."
                    className="w-44 bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  className="rounded-md border border-[#1E293B] bg-[#0B0F17] px-3 py-1.5 font-mono text-[11px] font-bold text-slate-300 transition-colors hover:bg-[#1B2433] cursor-pointer"
                >
                  Filter
                </button>
              </div>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-12 items-center gap-2 border-b border-[#1E293B] bg-[#0F1622] px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-500">
              <span className="col-span-3">ቁሳቁስ እና SKU</span>
              <span className="col-span-2 text-right">የተረከቡት (Issued)</span>
              <span className="col-span-2 text-right">ጥቅም ላይ የዋለ (Output)</span>
              <span className="col-span-2 text-right">የተበላሸ (Scrap)</span>
              <span className="col-span-1 text-right">ልዩነት</span>
              <span className="col-span-2 text-right">ሁኔታ</span>
            </div>

            <div>
              {pagedRows.length === 0 ? (
                <div className="p-8 text-center font-mono text-xs text-slate-500">
                  ምንም ሪፖርት የለም — no substrate data for this period.
                </div>
              ) : (
                pagedRows.map((row) => (
                  <MaterialYieldRow
                    key={row.key}
                    sku={row.sku}
                    material={row.material}
                    issued={row.issued.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                    output={row.output.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                    scrap={row.scrap.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                    variance={row.variance.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                    statusLabel={row.statusLabel}
                    statusTone={row.statusTone}
                  />
                ))
              )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-[#1E293B] px-4 py-2.5">
              <span className="font-mono text-[10px] text-slate-500">
                Showing {pagedRows.length === 0 ? 0 : page * pageSize + 1}–{Math.min(page * pageSize + pagedRows.length, materialRows.length)} of {materialRows.length} SKUs
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded border border-[#1E293B] bg-[#0B0F17] px-3 py-1 font-mono text-[11px] text-slate-300 transition-colors hover:bg-[#1B2433] disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <span className="font-mono text-[10px] text-slate-500">Page {page + 1}/{totalPages}</span>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="rounded border border-[#1E293B] bg-[#0B0F17] px-3 py-1 font-mono text-[11px] text-slate-300 transition-colors hover:bg-[#1B2433] disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          {/* Operator yield ranking */}
          <section className="rounded-lg border border-[#1E293B] bg-[#121824]">
            <div className="flex items-center justify-between gap-3 border-b border-[#1E293B] p-4">
              <div>
                <h2 className="text-base font-bold text-white">የኦፕሬተሮች ውጤታማነት ደረጃ</h2>
                <p className="font-mono text-[10px] text-slate-500">Ranked by Material Efficiency &amp; Yield Metric</p>
              </div>
              <StatusTag tone="sky">SHIFT CYCLE {report.period === "weekly" ? 88 : report.days}</StatusTag>
            </div>

            {d.operatorRank.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center font-mono text-xs text-slate-500">
                <Factory size={18} className="text-slate-600" />
                No operator floor batches yet for ranking.
              </div>
            ) : (
              <div>
                {d.operatorRank.slice(0, 4).map((op, index) => {
                  const budget = d.output / Math.max(1, d.operatorRank.length);
                  const overScrap = op.scrap > budget;
                  const badge =
                    index === 0
                      ? { tone: "emerald" as const, label: "MOST EFFICIENT" }
                      : op.scrap / Math.max(1, op.issued) > 0.35
                      ? { tone: "red" as const, label: "HIGH SCRAP" }
                      : { tone: "emerald" as const, label: "CLEARED" };
                  return (
                    <OperatorRankItem
                      key={`${op.name}-${index}`}
                      rank={index + 1}
                      name={op.name}
                      machine={op.machine}
                      yieldPct={op.yield}
                      metricLabel={`${op.produced.toFixed(0)} out · ${op.scrap.toFixed(0)} scrap`}
                      badgeTone={badge.tone}
                      badgeLabel={badge.label}
                      loss={overScrap ? `-${formatCurrency(op.scrap * 85)} Loss` : undefined}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* High-value discrepancy & audit ledger */}
          <section className="rounded-lg border border-[#1E293B] bg-[#121824]">
            <div className="border-b border-[#1E293B] p-4">
              <h2 className="text-base font-bold text-white">የከፍተኛ ልዩነት መዝገብ</h2>
              <p className="font-mono text-[10px] text-slate-500">High-Value Material Clearance &amp; Signed Floor Audits</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  className="rounded border border-[#1E293B] bg-[#0B0F17] px-2 py-1 font-mono text-[9px] font-bold text-slate-300 transition-colors hover:bg-[#1B2433] cursor-pointer"
                >
                  የቅርብ ጊዜ ኤክስፖርት CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("pdf")}
                  className="rounded border border-[#1E293B] bg-[#0B0F17] px-2 py-1 font-mono text-[9px] font-bold text-slate-300 transition-colors hover:bg-[#1B2433] cursor-pointer"
                >
                  የቅርብ ጊዜ ኤክስፖርት PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("xls")}
                  className="rounded border border-[#1E293B] bg-[#0B0F17] px-2 py-1 font-mono text-[9px] font-bold text-slate-300 transition-colors hover:bg-[#1B2433] cursor-pointer"
                >
                  የቅርብ ጊዜ ኤክስፖርት XLS
                </button>
              </div>
            </div>

            <div className="space-y-2.5 p-3">
              {d.pending.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-6 text-center font-mono text-xs text-slate-500">
                  <FileWarning size={18} className="text-slate-600" />
                  No open floor discrepancies in this period.
                </div>
              ) : (
                d.pending.slice(0, 3).map((row, index) => {
                  const isScrap = row.wastePercent > 30;
                  const perUnit =
                    (row.baseUnit || "").toLowerCase().includes("l") ? 350 : row.baseUnit === "m" ? 45 : 85;
                  return (
                    <AuditLedgerCard
                      key={row.id}
                      icon={isScrap ? <Scissors size={14} /> : <Boxes size={14} />}
                      time={index === 0 ? "Now" : `${index * 2}h ago`}
                      title={row.materialName}
                      subtitle={`${row.operatorName} · ${row.machineName} · ${row.producedOutput.toFixed(1)} out / ${row.scrapQuantity.toFixed(1)} scrap ${row.baseUnit}`}
                      badgeTone={isScrap ? "red" : "amber"}
                      badgeLabel={isScrap ? "Approved Scrap" : "Penalized & Deducted"}
                      impact={{
                        tone: "bad",
                        label: isScrap
                          ? `-${formatCurrency(row.scrapQuantity * perUnit)} Authorized`
                          : `-${formatCurrency((row.lastDiscrepancy ?? 0) * perUnit)} Deducted`,
                      }}
                    />
                  );
                })
              )}
            </div>

            <div className="border-t border-[#1E293B] p-3">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 py-2 font-mono text-[11px] font-bold text-sky-300 transition-colors hover:bg-sky-500/20 cursor-pointer"
              >
                ሙሉውን አደራ እና ተጠያቂነት ተመልከት (VIEW FULL CUSTODY LEDGER) <ArrowRight size={12} />
              </button>
            </div>
          </section>

          {/* Financial summary card (owner only) */}
          {canSeeFinancial ? (
            <section className="rounded-lg border border-[#1E293B] bg-[#121824] p-4">
              <div className="flex items-center gap-2">
                <Wallet size={15} className="text-sky-400" />
                <h3 className="text-sm font-bold text-white">Executive Financial Snapshot</h3>
              </div>
              <div className="mt-3 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Gross Billed</span>
                  <span className="font-bold text-sky-300">{formatCurrency(d.grossETB)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Direct Material + OpEx</span>
                  <span className="font-bold text-amber-300">{formatCurrency(d.opexETB + d.scrapETB)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[#1E293B] pt-2">
                  <span className="text-slate-400">Net Yield</span>
                  <span className="font-black text-emerald-400">{formatCurrency(Math.max(0, d.netYieldETB))}</span>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {report.seededDataNote ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 font-mono text-[10px] text-slate-400">
          <ShieldCheck size={14} className="mt-0.5 flex-none text-sky-400" />
          <span>{report.seededDataNote}</span>
        </div>
      ) : null}
    </div>
  );
}
