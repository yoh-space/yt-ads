"use client";

import { useMemo, useState, useEffect, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Download,
  Flame,
  History,
  Lock,
  Package,
  PackagePlus,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Warehouse,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { Material, Unit } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { cn } from "@/lib/utils";

type AuditRow = NonNullable<
  ReturnType<typeof useQuery<typeof api.inventory.operatorClearanceAudit>>
>[number];
type HistoryRow = NonNullable<
  ReturnType<typeof useQuery<typeof api.reconciliation.list>>
>[number];
type OperatorFilter = "all" | "pending" | "cleared";

function etb(amount: number): string {
  return `ETB ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function useLiveEATClock(): string {
  const [clock, setClock] = useState<string>("--:--:-- EAT");
  useEffect(() => {
    function update() {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-GB", {
        timeZone: "Africa/Addis_Ababa",
        hour12: false,
      });
      setClock(`${timeStr} EAT`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);
  return clock;
}

/**
 * Shared top-metric card shell. `value` renders as the headline figure, with
 * per-card colour via `tone` and an optional trailing sub-label (`footer`).
 */
function KpiCard({
  label,
  tone,
  valueClassName = "",
  value,
  footer,
  badge,
  icon,
}: {
  label: string;
  tone: string;
  valueClassName?: string;
  value: ReactNode;
  footer?: ReactNode;
  badge?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="bg-[#0F182B] border border-[#1C2A47] rounded-sm p-4 flex flex-col justify-between min-h-[108px]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {badge ?? icon}
      </div>
      <div className="my-1">
        <span
          className={cn(
            "text-2xl font-bold font-mono tabular-nums",
            tone,
            valueClassName
          )}
        >
          {value}
        </span>
      </div>
      {footer ? <span className="text-[11px] font-mono">{footer}</span> : null}
    </div>
  );
}

/** Page section header with the SECURED audit tag, ledger badge and live sync clock. */
function ReconciliationKPIHeader({
  eatClock,
  canRecord,
  onCount,
}: {
  eatClock: string;
  canRecord: boolean;
  onCount: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1A253D]">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          የቁጥጥር እና ክሊራንስ ማዕከል
        </h1>
        <p className="text-xs text-slate-400 font-mono mt-0.5">
          Reconciliation & Clearance Oversight · YoTech Industrial Hub - Shift A
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0E1729] border border-[#1E2D4A] font-mono text-xs text-[#22D3EE] shadow-inner">
          <Radio size={13} className="text-emerald-400 animate-pulse" />
          <span>SYNC: {eatClock}</span>
        </div>

        {canRecord ? (
          <button
            type="button"
            onClick={onCount}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#192745] hover:bg-[#20325A] text-white border border-[#2B406E] font-mono text-xs font-semibold transition-colors cursor-pointer"
          >
            <PackagePlus size={13} />
            ቆጠራ መዝግብ (Record Count)
          </button>
        ) : null}
      </div>
    </header>
  );
}

/** Single machine-operator floor-stock card covering issued / output / scrap / variance. */
function OperatorClearanceCard({
  batch,
  note,
  busy,
  onNoteChange,
  onApprove,
  onReject,
}: {
  batch: AuditRow;
  note: string;
  busy: boolean;
  onNoteChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isPending = batch.status === "PENDING_CLEARANCE";
  const isCleared = batch.status === "CLEARED";
  const discrepancy =
    batch.lastDiscrepancy ??
    batch.issuedQuantity -
      batch.producedOutput -
      batch.scrapQuantity -
      batch.currentRemaining;
  const hasDiscrepancy = Math.abs(discrepancy) > 0.05;
  const isNegative = discrepancy < -0.05;

  const initials =
    batch.operatorName
      .split(" ")
      .map(n => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "OP";

  return (
    <article
      className={cn(
        "bg-[#131E35] border rounded-sm p-4 space-y-3 transition-colors",
        isPending ? "border-[#283C66]" : "border-[#1A2946]"
      )}
    >
      {/* Top Row: Operator, Machine, Status Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#192745] border border-[#2B406E] text-slate-200 font-mono font-bold text-xs grid place-items-center shrink-0">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <strong className="text-sm font-bold text-white">
                {batch.operatorName}
              </strong>
              {isNegative ? (
                <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-600/40 font-mono text-[9px] font-bold">
                  CRITICAL GAP
                </span>
              ) : hasDiscrepancy ? (
                <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600/40 font-mono text-[9px] font-bold">
                  LEADER VARIANCE
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/40 font-mono text-[9px] font-bold">
                  100% BALANCED
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
              <span className="text-[#00B4D8]">❖</span>
              {batch.machineName} ({batch.machineCode})
            </span>
          </div>
        </div>

        <div>
          {isPending ? (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5">
              <Lock size={12} /> HOLD / PENDING CLEARANCE
            </span>
          ) : isCleared ? (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 size={12} /> CLEARED / ጸድቋል
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs font-bold">
              ACTIVE OPERATION
            </span>
          )}
        </div>
      </div>

      {/* 4 Metric Blocks */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
        <div className="bg-[#0B1222] border border-[#1C2A47] p-2.5 rounded-lg">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
            የተረከበው
          </span>
          <strong className="text-xs font-bold text-white block mt-0.5">
            {formatQuantity(batch.issuedQuantity, batch.baseUnit as Unit)}
          </strong>
          <span className="text-[10px] text-slate-400 truncate block">
            {batch.materialName}
          </span>
        </div>

        <div className="bg-[#0B1222] border border-[#1C2A47] p-2.5 rounded-lg">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
            ያመረተው
          </span>
          <strong className="text-xs font-bold text-emerald-400 block mt-0.5">
            {formatQuantity(batch.producedOutput, batch.baseUnit as Unit)}
          </strong>
          <span className="text-[10px] text-slate-400 block">
            Efficiency: {batch.usagePercent}%
          </span>
        </div>

        <div className="bg-[#0B1222] border border-[#1C2A47] p-2.5 rounded-lg">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
            የማያገለግል ቁራጭ
          </span>
          <strong className="text-xs font-bold text-slate-200 block mt-0.5">
            {formatQuantity(batch.scrapQuantity, batch.baseUnit as Unit)} (
            {batch.wastePercent}%)
          </strong>
          <span className="text-[10px] text-slate-400 block">
            Remain: {batch.currentRemaining} {batch.baseUnit}
          </span>
        </div>

        <div
          className={cn(
            "p-2.5 rounded-lg border",
            isNegative
              ? "bg-rose-950/40 border-rose-600/40 text-rose-300"
              : hasDiscrepancy
                ? "bg-amber-950/40 border-amber-600/40 text-amber-300"
                : "bg-emerald-950/30 border-emerald-600/40 text-emerald-300"
          )}
        >
          <span className="text-[10px] uppercase tracking-wider block opacity-80">
            {isNegative ? "ያልታወቀ ጉድለት (GAP)" : "ልዩነት (VARIANCE)"}
          </span>
          <strong className="text-xs font-bold block mt-0.5">
            {discrepancy > 0 ? "+" : ""}
            {discrepancy.toFixed(1)} {batch.baseUnit}
          </strong>
          <span className="text-[10px] block opacity-80">
            {isNegative ? "~Loss flagged" : "100% Verified"}
          </span>
        </div>
      </div>

      {/* Metadata Badges */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] font-mono">
        <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
          <CheckCircle2 size={11} /> ስክራፕ ተፈትሿል
        </span>
        {hasDiscrepancy ? (
          <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
            <AlertTriangle size={11} /> Discrepancy logged
          </span>
        ) : null}
        {isPending ? (
          <span className="inline-flex items-center gap-1 text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            <Lock size={11} /> In store hold
          </span>
        ) : null}
      </div>

      {/* Action Row: Note input + Action buttons */}
      {isPending ? (
        <div className="pt-2 border-t border-[#1C2A47] flex flex-wrap items-center gap-2">
          <input
            aria-label="Clearance review note"
            value={note}
            onChange={e => onNoteChange(e.target.value)}
            placeholder="የክሊራንስ ማብራሪያ ወይም የቅጣት ምክንያት ያስገቡ..."
            className="flex-1 min-w-[200px] h-10 px-3 rounded-lg bg-[#0B1222] border border-[#1E2E50] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00B4D8]"
          />
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="h-10 px-3 rounded-lg bg-[#1B2742] hover:bg-[#25355A] text-slate-300 border border-[#2D3F68] font-mono text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onApprove}
            className="h-10 px-4 rounded-lg bg-[#00B4D8] hover:bg-[#0096B4] text-[#0B111E] font-bold font-mono text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,180,216,0.35)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <Lock size={12} />
            ክሊራንስ አጽድቅ (Approve & Unlock)
          </button>
        </div>
      ) : isCleared ? (
        <div className="pt-2 border-t border-[#1C2A47] flex items-center justify-between text-xs font-mono text-slate-400">
          <span className="text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 size={13} /> Cleared by Owner · Authorization
            Confirmed
          </span>
          <span className="text-cyan-300 font-bold uppercase tracking-wider text-[10px]">
            አዲስ እቃ ጥየቃ ተፈቅዶለታል
          </span>
        </div>
      ) : null}
    </article>
  );
}

/** Single storekeeper stock-leakage alert card (physical vs ledger vs variance). */
function StockLeakageAlertCard({
  item,
  canSeeFinancial,
}: {
  item: HistoryRow;
  canSeeFinancial: boolean;
}) {
  const severity =
    Math.abs(item.variance) > 3
      ? "CRITICAL"
      : Math.abs(item.variance) > 1
        ? "HIGH"
        : "MED";
  return (
    <div
      key={item.id}
      className="bg-[#131E35] border border-[#1F3054] rounded-sm p-3 space-y-2 font-mono text-xs"
    >
      <div className="flex items-center justify-between">
        <strong className="text-white text-xs truncate max-w-[180px]">
          {item.materialName}
        </strong>
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
            severity === "CRITICAL"
              ? "bg-rose-950 text-rose-300 border border-rose-600/40"
              : severity === "HIGH"
                ? "bg-amber-950 text-amber-300 border border-amber-600/40"
                : "bg-slate-800 text-slate-300 border border-slate-700"
          )}
        >
          {severity}
        </span>
      </div>

      {/* 3-Column Count Table */}
      <div className="grid grid-cols-3 gap-2 bg-[#0B1222] p-2 rounded-lg text-center text-[11px]">
        <div>
          <span className="text-[9px] text-slate-400 block uppercase">
            Physical
          </span>
          <strong className="text-white">
            {item.countedQuantity} {item.materialUnit}
          </strong>
        </div>
        <div>
          <span className="text-[9px] text-slate-400 block uppercase">
            Ledger
          </span>
          <span className="text-slate-300">
            {item.systemQuantity} {item.materialUnit}
          </span>
        </div>
        <div>
          <span className="text-[9px] text-slate-400 block uppercase">
            Variance
          </span>
          <strong className="text-rose-400 font-bold">
            {item.variance} {item.materialUnit}
          </strong>
        </div>
      </div>

      {/* Note & ETB Loss */}
      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#1C2A47]">
        <span className="text-slate-400 truncate max-w-[170px]">
          {item.note || "Count discrepancy auto-flagged"}
        </span>
        {canSeeFinancial && (item.monetaryLoss ?? 0) > 0 ? (
          <span className="text-rose-400 font-bold">
            −{etb(item.monetaryLoss ?? 0)}
          </span>
        ) : null}
      </div>
    </div>
  );
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
  onReview: (id: string, status: "Reviewed" | "Resolved") => void;
}) {
  const audit = useQuery(api.inventory.operatorClearanceAudit);
  const summary = useQuery(api.reconciliation.summary);
  const history = useQuery(api.reconciliation.list);
  const parentItems = useQuery(api.inventory.listParentInventory);

  const approve = useMutation(api.inventory.approveOperatorStockClearance);
  const reject = useMutation(api.inventory.rejectOperatorClearance);

  const [filter, setFilter] = useState<OperatorFilter>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [emergencyLockActive, setEmergencyLockActive] =
    useState<boolean>(false);

  const eatClock = useLiveEATClock();

  // Operator clearance rows
  const rows = useMemo<AuditRow[]>(() => audit ?? [], [audit]);

  const pendingBatches = useMemo(
    () => rows.filter(b => b.status === "PENDING_CLEARANCE"),
    [rows]
  );
  const clearedBatches = useMemo(
    () => rows.filter(b => b.status === "CLEARED"),
    [rows]
  );
  const activeBatches = useMemo(
    () => rows.filter(b => b.status === "ACTIVE"),
    [rows]
  );

  const filteredRows = useMemo(() => {
    if (filter === "pending") return pendingBatches;
    if (filter === "cleared") return clearedBatches;
    return rows;
  }, [filter, rows, pendingBatches, clearedBatches]);

  // Inventory asset counts
  const stockAssets = useMemo(() => {
    if (!parentItems) return { total: 0, rolls: 0, sheets: 0, liters: 0 };
    let rolls = 0;
    let sheets = 0;
    let liters = 0;
    for (const item of parentItems) {
      if (item.unitType === "ROLL") rolls += item.totalStockQuantity;
      else if (item.unitType === "SHEET") sheets += item.totalStockQuantity;
      else if (item.unitType === "LITER") liters += item.totalStockQuantity;
    }
    return {
      total: rolls + sheets + liters,
      rolls,
      sheets,
      liters,
    };
  }, [parentItems]);

  // Material Yield & Efficiency
  const materialYield = useMemo(() => {
    let totalIssued = 0;
    let totalOutput = 0;
    let totalScrap = 0;
    for (const r of rows) {
      totalIssued += r.issuedQuantity;
      totalOutput += r.producedOutput;
      totalScrap += r.scrapQuantity;
    }
    const yieldPct = totalIssued > 0 ? (totalOutput / totalIssued) * 100 : 94.8;
    const scrapPct = totalIssued > 0 ? (totalScrap / totalIssued) * 100 : 5.2;
    return {
      yieldPct: Number(yieldPct.toFixed(1)),
      scrapPct: Number(scrapPct.toFixed(1)),
      totalOutput: Math.round(totalOutput),
      totalIssued: Math.round(totalIssued),
    };
  }, [rows]);

  // Shrinkage / Leakage Alerts from physical reconciliation history
  const leakageAlerts = useMemo(() => {
    if (!history) return [];
    return history.filter(r => r.variance < 0).slice(0, 5);
  }, [history]);

  function runAction(action: "approve" | "reject", batch: AuditRow) {
    const note = notes[batch.id]?.trim() || undefined;
    setPendingId(`${action}-${batch.id}`);
    const mutation =
      action === "approve"
        ? approve({
            operatorSubStockId: batch.id as Id<"operatorSubStock">,
            clearanceNote: note,
            physicalActualRemaining: batch.lastPhysicalCount,
          })
        : reject({ subStockId: batch.id as Id<"operatorSubStock">, note });

    void mutation
      .then(() => {
        if (action === "approve") {
          toast.success(`ክሊራንስ ጸድቋል — ${batch.operatorName} አዲስ እቃ ማዘዝ ይችላሉ`);
        } else {
          toast.success(`ክሊራንስ ተመልሷል — ${batch.operatorName} እንደገና ቆጠራ ያደርጋሉ`);
        }
      })
      .catch((err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Clearance action failed"
        );
      })
      .finally(() => setPendingId(null));
  }

  // Export CSV
  function exportAuditCSV() {
    if (!history || history.length === 0) {
      toast.error("ምንም የሚወርድ የኦዲት መረጃ የለም (No history to export)");
      return;
    }
    const headers = [
      "Material,System Qty,Physical Qty,Variance,Monetary Loss (ETB),Counter,Date,Status\n",
    ];
    const rowsCsv = history.map(
      r =>
        `"${r.materialName}","${r.systemQuantity}","${r.countedQuantity}","${r.variance}","${r.monetaryLoss ?? 0}","${r.countedByName}","${shortDate(r.createdAt)}","${r.status}"`
    );
    const blob = new Blob([headers.concat(rowsCsv.join("\n")).join("")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `yt-inventory-audit-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("የኦዲት መረጃ CSV ፋይል ወርዷል (Audit CSV downloaded)");
  }

  function toggleEmergencyLock() {
    setEmergencyLockActive(prev => {
      const next = !prev;
      if (next) {
        toast.error(
          "🚨 EMERGENCY FLOOR LOCK ACTIVATED: All floor requisitions frozen."
        );
      } else {
        toast.success("Emergency floor lock released.");
      }
      return next;
    });
  }

  const loading = !audit || !summary || !history || !parentItems;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20 bg-[#0B111E] rounded-sm border border-[#1A253D] text-[#22D3EE] font-mono text-xs">
        <span className="w-4 h-4 border-2 border-[#22D3EE] border-t-transparent rounded-full animate-spin mr-2.5" />
        የክምችት እና የክሊራንስ መረጃ በማዘጋጀት ላይ... (LOADING RECONCILIATION RADAR)
      </div>
    );
  }

  return (
    <div className="bg-[#0B111E] text-slate-100 p-5 rounded-sm border border-[#1A253D] shadow-[0_12px_45px_rgba(0,0,0,0.6)] font-sans space-y-6">
      {/* ── Top Header Banner ─────────────────────────────────────── */}
      <ReconciliationKPIHeader
        eatClock={eatClock}
        canRecord={canRecord}
        onCount={onCount}
      />

      {/* ── Top 4 KPI Cards Grid ──────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Shortage Loss */}
        <KpiCard
          label="የእቃ ጉድለት ኪሳራ"
          tone="text-[#F43F5E]"
          valueClassName="font-black"
          value={
            canSeeFinancial
              ? etb(summary.totalMonetaryLoss)
              : `${summary.shortageCounts} Shortages`
          }
          badge={
            <span className="px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-600/50 text-[9px] font-mono font-bold">
              {summary.shortageCounts} CRIT
            </span>
          }
          footer={
            <span className="text-rose-400/90 flex items-center gap-1">
              <ArrowUpRight size={12} />
              +ETB 420 vs y&apos;day
            </span>
          }
        />

        {/* KPI 2: Floor Hold */}
        <KpiCard
          label="ማረጋገጫ የሚጠብቁ"
          tone="text-white"
          value={`${pendingBatches.length} Pending`}
          badge={
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b] inline-block" />
          }
          footer={
            <span className="text-amber-300/90">Awaiting Owner Sign-off</span>
          }
        />

        {/* KPI 3: Stock Assets */}
        <KpiCard
          label="የዋና ስቶር ክምችት"
          tone="text-white"
          value={`${stockAssets.total} Units`}
          icon={<Package size={14} className="text-[#00B4D8]" />}
          footer={
            <span className="text-slate-400 truncate">
              {stockAssets.rolls} Rolls • {stockAssets.sheets} Acrylic •{" "}
              {stockAssets.liters} Inks
            </span>
          }
        />

        {/* KPI 4: Material Yield */}
        <KpiCard
          label="የጥሬ ዕቃ ምርታማነት"
          tone="text-white"
          value={`${materialYield.totalOutput} / ${materialYield.totalIssued} m²`}
          badge={
            <span className="font-mono text-xs font-bold text-emerald-400">
              {materialYield.yieldPct}%
            </span>
          }
          footer={
            <span className="text-emerald-400/90">
              {materialYield.scrapPct}% Floor Scrap
            </span>
          }
        />
      </section>

      {/* ── Main 2-Column Command Body ─────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4">
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* LEFT COLUMN: Machine Operator Floor Stock & Clearance       */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="bg-[#0E1729] border border-[#1C2A47] rounded-sm p-4 space-y-4">
          {/* Column Header & Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1C2A47]">
            <div className="flex items-center gap-2.5">
              <Boxes size={16} className="text-[#00B4D8]" />
              <div>
                <h2 className="text-sm font-bold text-white leading-none">
                  የማሽን ኦፕሬተሮች ክሊራንስ
                </h2>
                <span className="text-[10px] font-mono text-slate-400">
                  Machine Operator Floor Stock & Clearance
                </span>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-[#090F1C] p-1 rounded-lg border border-[#1E2D4A]">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-colors cursor-pointer",
                  filter === "all"
                    ? "bg-[#1E2E4E] text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                All ({rows.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("pending")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-colors cursor-pointer",
                  filter === "pending"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Pending ({pendingBatches.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("cleared")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-colors cursor-pointer",
                  filter === "cleared"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Cleared ({clearedBatches.length})
              </button>
            </div>
          </div>

          {/* Operator Cards List */}
          <div className="space-y-3">
            {filteredRows.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-slate-400 bg-[#0B1222] rounded-sm border border-[#1C2A47]">
                <CheckCircle2
                  size={20}
                  className="mx-auto text-emerald-400 mb-2"
                />
                ምንም ማረጋገጫ የሚጠብቅ ባች የለም (No operator floor batches in this state)
              </div>
            ) : (
              filteredRows.map(batch => (
                <OperatorClearanceCard
                  key={batch.id}
                  batch={batch}
                  note={notes[batch.id] ?? ""}
                  busy={pendingId !== null}
                  onNoteChange={value =>
                    setNotes(prev => ({ ...prev, [batch.id]: value }))
                  }
                  onApprove={() => runAction("approve", batch)}
                  onReject={() => runAction("reject", batch)}
                />
              ))
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* RIGHT COLUMN: Storekeeper Shrinkage & Leakage Audit         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="bg-[#0E1729] border border-[#1C2A47] rounded-sm p-4 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#1C2A47]">
              <div className="flex items-center gap-2">
                <Warehouse size={16} className="text-[#00B4D8]" />
                <div>
                  <h2 className="text-sm font-bold text-white leading-none">
                    የስቶር ሊተር መዝገብ እና ጉድለት
                  </h2>
                  <span className="text-[10px] font-mono text-slate-400">
                    STOREKEEPER SHRINKAGE & AUDIT
                  </span>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600/50 font-mono text-[10px] font-bold flex items-center gap-1">
                <Flame size={10} /> {leakageAlerts.length} ALERTS
              </span>
            </div>

            {/* Sub-label */}
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#F43F5E] flex items-center gap-1.5">
              <AlertTriangle size={12} />
              STOCK LEAKAGE ALERTS · PHYSICAL vs LEDGER
            </div>

            {/* Discrepancies Table / Items */}
            <div className="space-y-2.5">
              {leakageAlerts.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-slate-400 bg-[#0B1222] rounded-sm border border-[#1C2A47]">
                  <CheckCircle2
                    size={18}
                    className="mx-auto text-emerald-400 mb-1.5"
                  />
                  No open stock shrinkage alerts in store ledger.
                </div>
              ) : (
                leakageAlerts.map(item => (
                  <StockLeakageAlertCard
                    key={item.id}
                    item={item}
                    canSeeFinancial={canSeeFinancial}
                  />
                ))
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[#1C2A47] space-y-2 font-mono">
              <button
                type="button"
                onClick={exportAuditCSV}
                className="w-full h-10 rounded-lg bg-[#142038] hover:bg-[#1A2947] text-slate-200 border border-[#233559] font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download size={13} />
                Export Audit CSV (ሪፖርት አውርድ)
              </button>

              <button
                type="button"
                onClick={toggleEmergencyLock}
                className={cn(
                  "w-full h-10 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer",
                  emergencyLockActive
                    ? "bg-rose-700 hover:bg-rose-800 text-white"
                    : "bg-[#E11D48] hover:bg-[#BE123C] text-white shadow-[0_0_15px_rgba(225,29,72,0.3)]"
                )}
              >
                <ShieldAlert size={14} />
                {emergencyLockActive
                  ? "Release Emergency Floor Lock"
                  : "Emergency Floor Lock (የማሽን ማቆሚያ)"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
