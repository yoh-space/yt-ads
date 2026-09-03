"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Gauge,
  History,
  Package,
  PackagePlus,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { Material, Unit } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { Panel, PanelHeader, Button, Badge, Input, StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";

type AuditRow = NonNullable<ReturnType<typeof useQuery<typeof api.inventory.operatorClearanceAudit>>>[number];
type HistoryRow = NonNullable<ReturnType<typeof useQuery<typeof api.reconciliation.list>>>[number];
type DiscrepancyFilter = "all" | "discrepancies" | "cleared" | "pending";

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

function Kpi({
  label,
  value,
  unit,
  tone,
  badge,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: string;
  badge?: { text: string; up?: boolean };
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="block truncate font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </span>
        {badge ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-[1px] font-mono text-[8.5px] font-bold uppercase tracking-[0.1em]",
              badge.up
                ? "border-rose-800/50 bg-rose-950/30 text-rose-300"
                : "border-emerald-800/50 bg-emerald-950/30 text-emerald-400",
            )}
          >
            {badge.up ? <ArrowUpRight size={9} /> : null}
            {badge.text}
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <strong
          className={cn(
            "block truncate font-mono text-[17px] font-extrabold leading-tight tabular-nums text-foreground",
            tone,
          )}
        >
          {value}
        </strong>
        {unit ? <span className="font-mono text-[10px] font-semibold text-slate-400">{unit}</span> : null}
      </div>
    </div>
  );
}

function EmptyHint({
  message,
  icon,
  tone = "neutral",
}: {
  message: string;
  icon: React.ReactNode;
  tone?: "neutral" | "success";
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <span
        className={cn(
          "grid h-12 w-12 place-items-center rounded-xl border",
          tone === "success"
            ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-400"
            : "border-border/60 bg-secondary/40 text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

export function ReconciliationView({
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
  const audit = useQuery(api.inventory.operatorClearanceAudit);
  const parentItems = useQuery(api.inventory.listParentInventory);
  const summary = useQuery(api.reconciliation.summary);
  const history = useQuery(api.reconciliation.list);
  const approve = useMutation(api.inventory.approveOperatorClearance);
  const reject = useMutation(api.inventory.rejectOperatorClearance);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [discFilter, setDiscFilter] = useState<DiscrepancyFilter>("all");
  const [search, setSearch] = useState("");

  const rows = useMemo<AuditRow[]>(() => audit ?? [], [audit]);
  const pendingCount = rows.filter((row) => row.status === "PENDING_CLEARANCE").length;
  const activeCount = rows.filter((row) => row.status === "ACTIVE").length;
  const clearedCount = rows.filter((row) => row.status === "CLEARED").length;
  const parentList = parentItems ?? [];

  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        operatorName: string;
        machineName: string;
        machineCode: string;
        machineType: string;
        topStatus: AuditRow["status"];
        batches: AuditRow[];
      }
    >();
    for (const row of rows) {
      const key = `${row.operatorId}|${row.machineId}`;
      const group = map.get(key) ?? {
        operatorName: row.operatorName,
        machineName: row.machineName,
        machineCode: row.machineCode,
        machineType: row.machineType,
        topStatus: row.status,
        batches: [],
      };
      if (row.status === "PENDING_CLEARANCE") group.topStatus = "PENDING_CLEARANCE";
      else if (group.topStatus === "CLEARED" && row.status === "ACTIVE") group.topStatus = "ACTIVE";
      group.batches.push(row);
      map.set(key, group);
    }
    return [...map.values()];
  }, [rows]);

  const shortages = useMemo(
    () => (summary?.currentVariances ?? []).filter((item) => item.variance < 0),
    [summary],
  );

  const scrapEfficiency = useMemo(() => {
    const totalIssued = rows.reduce((sum, row) => sum + (row.issuedQuantity || 0), 0);
    const totalScrap = rows.reduce((sum, row) => sum + (row.scrapQuantity || 0), 0);
    if (totalIssued <= 0) return { scrapPct: 0, efficiency: 100 };
    const scrapPct = (totalScrap / totalIssued) * 100;
    return { scrapPct, efficiency: Math.max(0, 100 - scrapPct) };
  }, [rows]);

  const auditProgress = useMemo(() => {
    const total = rows.length;
    if (total === 0) return 0;
    const resolved = clearedCount;
    return Math.round((resolved / total) * 100);
  }, [rows, clearedCount]);

  const filteredHistory = useMemo<HistoryRow[]>(() => {
    let list = history ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.materialName.toLowerCase().includes(q) || String(r.materialUnit).toLowerCase().includes(q));
    }
    switch (discFilter) {
      case "discrepancies":
        return list.filter((r) => r.variance < 0);
      case "cleared":
        return list.filter((r) => r.status === "Resolved");
      case "pending":
        return list.filter((r) => r.status === "Open");
      default:
        return list;
    }
  }, [history, search, discFilter]);

  function runAction(action: "approve" | "reject", batch: AuditRow) {
    const note = notes[batch.id]?.trim() || undefined;
    setPendingId(`${action}-${batch.id}`);
    const mutation = action === "approve"
      ? approve({ subStockId: batch.id as Id<"operatorSubStock">, note })
      : reject({ subStockId: batch.id as Id<"operatorSubStock">, note });
    void mutation
      .then(() =>
        action === "approve"
          ? toast.success("Owner clearance granted — operator can request new stock")
          : toast.success("Clearance returned — operator must re-reconcile"),
      )
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : `Unable to ${action} clearance.`;
        toast.error(message);
      })
      .finally(() => setPendingId(null));
  }

  const loading = !audit || !summary || !history || !parentItems;

  if (loading) {
    return (
      <Panel className="flex items-center justify-center p-14">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck size={16} className="animate-pulse text-cyan" />
          የክምችት ማረጋገጫ እየተዘጋጀ ነው…
        </div>
      </Panel>
    );
  }

  return (
    <div className="grid gap-6">
      {/* ============ Top KPI bar ============ */}
      <Panel className="overflow-hidden">
        <PanelHeader
          kicker="RECONCILIATION & CLEARANCE CONTROL"
          title="የክምችት ማረጋገጫ እና ክሊራንስ ክፍል"
          subtitle="Real-time stock integrity, operator sub-stock, and owner clearance denial/approval"
          icon={<Gauge size={17} />}
          action={
            canRecord ? (
              <Button size="small" onClick={onCount}>
                <PackagePlus size={13} />
                Record physical count
              </Button>
            ) : null
          }
        />
        <div className="grid grid-cols-1 gap-px border-t border-border/60 bg-border/40 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-card p-4">
            <Kpi
              label="Total monetary leakage"
              value={canSeeFinancial ? etb(summary.totalMonetaryLoss) : `${shortages.length}`}
              unit={canSeeFinancial ? undefined : "shortage(s)"}
              tone="text-rose-300"
              badge={canSeeFinancial && summary.totalMonetaryLoss > 0 ? { text: "Leaking", up: true } : undefined}
            />
          </div>
          <div className="bg-card p-4">
            <Kpi
              label="Pending clearances"
              value={`${pendingCount}`}
              unit={pendingCount === 1 ? "batch" : "batches"}
              tone={pendingCount > 0 ? "text-amber-400" : "text-emerald-400"}
              badge={pendingCount > 0 ? { text: "Action needed" } : undefined}
            />
          </div>
          <div className="bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="block truncate font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Audit & reconciliation progress
              </span>
              <span className="font-mono text-[11px] font-bold tabular-nums text-cyan-dark">{auditProgress}%</span>
            </div>
            <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-[#0f172a]">
              <span className="h-full bg-[#00B4D8]" style={{ width: `${auditProgress}%` }} />
            </div>
            <p className="mt-1.5 font-mono text-[9.5px] text-slate-400">
              {clearedCount} cleared · {activeCount} active · {pendingCount} pending
            </p>
          </div>
          <div className="bg-card p-4">
            <Kpi
              label="Scrap & wastage efficiency"
              value={`${scrapEfficiency.efficiency.toFixed(0)}`}
              unit="%"
              tone={scrapEfficiency.scrapPct > 10 ? "text-amber-400" : "text-emerald-400"}
              badge={{ text: `${scrapEfficiency.scrapPct.toFixed(0)}% scrap`, up: scrapEfficiency.scrapPct > 10 }}
            />
          </div>
        </div>
      </Panel>

      {/* ============ Pending clearance strip ============ */}
      {pendingCount > 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-800/50 bg-amber-950/20 p-4 text-sm text-amber-100">
          <AlertTriangle size={17} className="mt-0.5 flex-none text-amber-400" />
          <p className="m-0">
            <strong className="text-amber-300">{pendingCount}</strong> reconciled{" "}
            {pendingCount === 1 ? "batch is" : "batches are"} waiting for Owner sign-off. Approve clearance to unblock the
            operator's new material requests, or return it for re-reconciliation.
          </p>
        </div>
      ) : null}

      {/* ============ Operator clearance management ============ */}
      <Panel className="overflow-hidden">
        <PanelHeader
          kicker="OPERATOR CLEARANCE MANAGEMENT"
          title="የማሽን ኦፕሬተሮች ክሊራንስ አስተዳደር"
          subtitle="Issued vs completed output vs scrap · approve, reject, or inspect the audit trail per batch"
          icon={<Boxes size={17} />}
          action={
            pendingCount > 0 ? (
              <Badge variant="warning" glowDot>{pendingCount} awaiting clearance</Badge>
            ) : (
              <Badge variant="success" glowDot>All clear</Badge>
            )
          }
        />

        {groups.length === 0 ? (
          <EmptyHint
            message="No live floor stock in circulation — issued batches with usage and clearance actions appear here."
            icon={<Package size={20} />}
          />
        ) : (
          <div className="grid gap-3 border-t border-border/60 p-4 xl:grid-cols-2">
            {groups.map((group) => {
              const pendingItems = group.batches.filter((b) => b.status === "PENDING_CLEARANCE").length;
              const latestIssuedAt = Math.max(...group.batches.map((b) => b.issuedAt));
              return (
                <article
                  key={`${group.operatorName}|${group.machineName}`}
                  className={cn(
                    "rounded-xl border p-4",
                    group.topStatus === "PENDING_CLEARANCE"
                      ? "border-amber-800/60 bg-amber-950/15"
                      : "border-border/60 bg-secondary/30",
                  )}
                >
                  <header className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-cyan-800/50 bg-cyan-950/30 text-cyan-dark">
                      <UserRound size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm font-semibold text-foreground">{group.operatorName}</strong>
                      <span className="block truncate font-mono text-xs text-slate-400">
                        {group.machineCode} · {group.machineName}
                      </span>
                    </div>
                    <Badge variant="info">{group.machineType}</Badge>
                    <Badge
                      variant={
                        group.topStatus === "PENDING_CLEARANCE"
                          ? "warning"
                          : group.topStatus === "ACTIVE"
                            ? "neutral"
                            : "success"
                      }
                      glowDot={group.topStatus !== "CLEARED"}
                    >
                      {group.topStatus === "PENDING_CLEARANCE"
                        ? "Pending clearance"
                        : group.topStatus === "ACTIVE"
                          ? "Active"
                          : "Cleared"}
                    </Badge>
                  </header>

                  <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="min-w-0">
                      <span className="block font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Station / dept
                      </span>
                      <span className="block truncate text-[12px] font-semibold text-foreground">{group.machineName}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Pending items
                      </span>
                      <span
                        className={cn(
                          "block truncate font-mono text-[13px] font-bold tabular-nums",
                          pendingItems > 0 ? "text-amber-400" : "text-emerald-400",
                        )}
                      >
                        {pendingItems} / {group.batches.length}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="block font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Submitted
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">{shortDate(latestIssuedAt)}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Batches
                      </span>
                      <span className="block truncate font-mono text-[13px] font-bold tabular-nums text-foreground">
                        {group.batches.length}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {group.batches.map((batch) => {
                      const pending = batch.status === "PENDING_CLEARANCE";
                      const hasDiscrepancy = batch.lastDiscrepancy !== undefined && batch.lastDiscrepancy !== 0;
                      const used = Math.max(0, batch.issuedQuantity - batch.currentRemaining);
                      const scrap = batch.scrapQuantity;
                      const remaining = Math.max(0, batch.currentRemaining);
                      const usedPct = batch.issuedQuantity > 0 ? (used / batch.issuedQuantity) * 100 : 0;
                      const scrapPct = batch.issuedQuantity > 0 ? (scrap / batch.issuedQuantity) * 100 : 0;
                      const remainderPct = batch.issuedQuantity > 0 ? (remaining / batch.issuedQuantity) * 100 : 0;
                      const isExpanded = Boolean(expanded[batch.id]);
                      return (
                        <div
                          key={batch.id}
                          className={cn(
                            "rounded-lg border p-3",
                            pending
                              ? hasDiscrepancy
                                ? "border-rose-800/60 bg-rose-950/20"
                                : "border-amber-800/50 bg-amber-950/20"
                              : "border-border/50 bg-background/40",
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="text"
                              size="small"
                              className="gap-1 !px-0"
                              onClick={() => setExpanded((cur) => ({ ...cur, [batch.id]: !cur[batch.id] }))}
                              aria-expanded={isExpanded}
                              aria-controls={`audit-${batch.id}`}
                            >
                              <CheckCircle2
                                size={13}
                                className={cn("flex-none", isExpanded ? "text-cyan-dark" : "text-slate-400")}
                              />
                              <strong className="text-[13px] font-semibold text-foreground">{batch.materialName}</strong>
                            </Button>
                            {pending ? (
                              <Badge variant={hasDiscrepancy ? "danger" : "warning"} glowDot>
                                {hasDiscrepancy ? "Discrepancy found" : "Awaiting clearance"}
                              </Badge>
                            ) : (
                              <Badge variant="success">Cleared</Badge>
                            )}
                            <span className="ml-auto font-mono text-[10px] text-slate-400">{shortDate(batch.issuedAt)}</span>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
                            <div className="min-w-0">
                              <span className="block truncate font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                Issued
                              </span>
                              <strong className="block truncate font-mono text-[13px] font-bold tabular-nums text-foreground">
                                {formatQuantity(batch.issuedQuantity, batch.baseUnit as Unit)} {batch.baseUnit}
                              </strong>
                            </div>
                            <div className="min-w-0">
                              <span className="block truncate font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                Completed output
                              </span>
                              <strong className="block truncate font-mono text-[13px] font-bold tabular-nums text-emerald-400">
                                {formatQuantity(batch.producedOutput, batch.baseUnit as Unit)} {batch.baseUnit}
                              </strong>
                            </div>
                            <div className="min-w-0">
                              <span className="block truncate font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                Offcut / scrap
                              </span>
                              <strong
                                className={cn(
                                  "block truncate font-mono text-[13px] font-bold tabular-nums",
                                  batch.wastePercent > 10 ? "text-rose-300" : "text-amber-400",
                                )}
                              >
                                {formatQuantity(batch.scrapQuantity, batch.baseUnit as Unit)} · {batch.wastePercent}%
                              </strong>
                            </div>
                            <div className="min-w-0">
                              <span className="block truncate font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                Remaining
                              </span>
                              <strong className="block truncate font-mono text-[13px] font-bold tabular-nums text-cyan-dark">
                                {formatQuantity(batch.currentRemaining, batch.baseUnit as Unit)} {batch.baseUnit}
                              </strong>
                            </div>
                          </div>

                          {/* Material consumption efficiency bar */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                Usage efficiency
                              </span>
                              <span className="font-mono text-[10px] font-bold tabular-nums text-slate-300">
                                {batch.usagePercent}% consumed · {batch.wastePercent}% scrap
                              </span>
                            </div>
                            <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full border border-white/5 bg-[#0f172a]">
                              <span className="h-full bg-[#38B000]" style={{ width: `${usedPct}%` }} title={`Used ${usedPct.toFixed(1)}%`} />
                              <span className="h-full bg-[#f43f5e]" style={{ width: `${scrapPct}%` }} title={`Scrap ${scrapPct.toFixed(1)}%`} />
                              <span className="h-full bg-[#00B4D8]" style={{ width: `${Math.max(0, remainderPct)}%` }} title={`Remaining ${remainderPct.toFixed(1)}%`} />
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-3">
                              <Legend color="bg-[#38B000]" label={`Used ${usedPct.toFixed(0)}%`} />
                              <Legend color="bg-[#f43f5e]" label={`Scrap ${scrapPct.toFixed(0)}%`} />
                              <Legend color="bg-[#00B4D8]" label={`Remaining ${remainderPct.toFixed(0)}%`} />
                            </div>
                          </div>

                          {/* Inline audit trail expansion */}
                          {isExpanded ? (
                            <div id={`audit-${batch.id}`} className="mt-3 rounded-lg border border-border/60 bg-background/50 p-3">
                              <div className="mb-2 flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-dark">
                                <History size={11} /> Audit trail · {batch.machineCode}
                              </div>
                              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-3">
                                <AuditRowItem label="Issued" value={`${formatQuantity(batch.issuedQuantity, batch.baseUnit as Unit)} ${batch.baseUnit}`} />
                                <AuditRowItem label="Reported output" value={`${formatQuantity(batch.producedOutput, batch.baseUnit as Unit)} ${batch.baseUnit}`} tone="text-emerald-400" />
                                <AuditRowItem label="Scrap logged" value={`${formatQuantity(batch.scrapQuantity, batch.baseUnit as Unit)} ${batch.baseUnit}`} tone={batch.wastePercent > 10 ? "text-rose-300" : "text-amber-400"} />
                                <AuditRowItem label="Remaining" value={`${formatQuantity(batch.currentRemaining, batch.baseUnit as Unit)} ${batch.baseUnit}`} tone="text-cyan-dark" />
                                <AuditRowItem
                                  label="Physical count"
                                  value={
                                    batch.lastPhysicalCount !== undefined
                                      ? `${formatQuantity(batch.lastPhysicalCount, batch.baseUnit as Unit)} ${batch.baseUnit}`
                                      : "—"
                                  }
                                />
                                <AuditRowItem
                                  label="Discrepancy"
                                  value={
                                    batch.lastDiscrepancy !== undefined
                                      ? `${batch.lastDiscrepancy > 0 ? "+" : ""}${batch.lastDiscrepancy} ${batch.baseUnit}`
                                      : "—"
                                  }
                                  tone={batch.lastDiscrepancy !== undefined && batch.lastDiscrepancy < 0 ? "text-rose-300" : "text-muted-foreground"}
                                />
                              </dl>
                              {batch.reconciledAt ? (
                                <p className="mt-2 font-mono text-[10px] text-slate-400">
                                  Reconciled {shortDate(batch.reconciledAt)}
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          {pending ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                              {batch.lastPhysicalCount !== undefined ? (
                                <p className="m-0 mr-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <AlertTriangle size={12} className={hasDiscrepancy ? "text-rose-300" : "text-muted-foreground"} />
                                  Physical {formatQuantity(batch.lastPhysicalCount, batch.baseUnit as Unit)} {batch.baseUnit}
                                  {batch.lastDiscrepancy !== undefined ? (
                                    <>
                                      {" "}· discrepancy {batch.lastDiscrepancy > 0 ? "+" : ""}
                                      {batch.lastDiscrepancy} {batch.baseUnit}
                                    </>
                                  ) : null}
                                </p>
                              ) : (
                                <p className="m-0 mr-auto text-[11px] text-amber-400/90">
                                  No physical reconciliation count recorded for this batch.
                                </p>
                              )}
                              <Input
                                aria-label={`Clearance note for ${batch.materialName}`}
                                placeholder="Note (optional)"
                                value={notes[batch.id] ?? ""}
                                onChange={(event) =>
                                  setNotes((current) => ({ ...current, [batch.id]: event.target.value }))
                                }
                                className="w-40"
                              />
                              <div className="flex items-center gap-2">
                                <Button
                                  size="small"
                                  variant="ghost"
                                  pending={pendingId === `reject-${batch.id}`}
                                  disabled={pendingId !== null}
                                  onClick={() => runAction("reject", batch)}
                                >
                                  <XCircle size={13} />
                                  Reject
                                </Button>
                                <Button
                                  size="small"
                                  pending={pendingId === `approve-${batch.id}`}
                                  disabled={pendingId !== null}
                                  onClick={() => runAction("approve", batch)}
                                >
                                  <ShieldCheck size={13} />
                                  🔓 ክሊራንስ አጽድቅ
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      {/* ============ Inventory reconciliation & discrepancy log ============ */}
      <Panel className="overflow-hidden">
        <PanelHeader
          kicker="INVENTORY RECONCILIATION & DISCREPANCY LOG"
          title="የክምችት ማረጋገጫ እና ልዩነት መዝገብ"
          subtitle="System quantity vs physical count · variance and estimated loss per material"
          icon={<ClipboardCheck size={17} />}
          action={
            canSeeFinancial && summary ? (
              <span className="flex items-center gap-2 rounded-md border border-rose-800/40 bg-rose-950/30 px-2.5 py-1.5">
                <Coins size={12} className="text-amber-400" />
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Total audited loss
                </span>
                <strong className="font-mono text-[13px] font-extrabold tabular-nums text-rose-300">
                  {etb(summary.totalMonetaryLoss)}
                </strong>
              </span>
            ) : (
              <Badge variant="danger">{shortages.length} shortage(s)</Badge>
            )
          }
        />

        <div className="border-t border-border/60 p-5">
          {/* Filter tabs + search */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="inline-flex w-max items-center gap-1 rounded-lg border border-border/60 bg-secondary/40 p-1"
              role="tablist"
              aria-label="Discrepancy log filter"
            >
              {(
                [
                  { id: "all", label: "All" },
                  { id: "discrepancies", label: "Discrepancies" },
                  { id: "cleared", label: "Cleared" },
                  { id: "pending", label: "Pending review" },
                ] as { id: DiscrepancyFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={discFilter === tab.id}
                  onClick={() => setDiscFilter(tab.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] transition-colors",
                    discFilter === tab.id
                      ? "bg-cyan/20 text-cyan-dark"
                      : "text-slate-400 hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                aria-label="Search items by name or unit"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by item name or barcode…"
                className="w-full rounded-md border border-border/60 bg-background/50 py-1.5 pl-8 pr-3 text-[12px] text-foreground placeholder:text-slate-500 focus:border-cyan focus:outline-none"
              />
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <EmptyHint
              message={
                search || discFilter !== "all"
                  ? "No records match the current filter or search."
                  : "No physical counts recorded yet — the storekeeper performs counts from the reconciliation console."
              }
              icon={<ClipboardCheck size={20} />}
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/60">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 border-b border-border/60 bg-secondary/40 px-4 py-2 font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-slate-400">
                <span>Item · counter</span>
                <span className="text-right">System vs physical</span>
                <span className="text-right">Variance / loss</span>
                <span className="text-right">Status & action</span>
              </div>
              {filteredHistory.slice(0, 12).map((record) => {
                const openStatus = record.status === "Open";
                return (
                  <div
                    key={record.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center gap-3 border-b border-border/40 px-4 py-2.5 transition-colors last:border-b-0 hover:bg-secondary/30"
                  >
                    <div className="min-w-0">
                      <strong className="block truncate text-[13px] font-semibold text-foreground">
                        {record.materialName}
                      </strong>
                      <span className="block truncate font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        {record.countedByName} · {shortDate(record.createdAt)}
                      </span>
                    </div>
                    <div className="min-w-0 text-right">
                      <span className="block font-mono text-[12px] tabular-nums text-muted-foreground">
                        <span className="text-slate-400">{record.systemQuantity}</span>
                        <span className="mx-1 text-slate-600">/</span>
                        <span className="text-foreground">{record.countedQuantity}</span>
                        <span className="ml-1 text-[10px] text-slate-400">{record.materialUnit}</span>
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span
                        className={cn(
                          "font-mono text-[13px] font-bold tabular-nums",
                          record.variance < 0
                            ? "text-rose-300"
                            : record.variance > 0
                              ? "text-emerald-400"
                              : "text-muted-foreground",
                        )}
                      >
                        {record.variance > 0 ? "+" : ""}
                        {record.variance.toLocaleString("en-US", { maximumFractionDigits: 2 })} {record.materialUnit}
                      </span>
                      {canSeeFinancial && (record.monetaryLoss ?? 0) > 0 ? (
                        <span className="font-mono text-[11px] font-bold tabular-nums text-rose-300">
                          −{etb(record.monetaryLoss ?? 0)}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <StatusPill
                        variant={record.status === "Open" ? "warning" : record.status === "Reviewed" ? "info" : "success"}
                      >
                        {record.status}
                      </StatusPill>
                      {canReview && openStatus ? (
                        <Button size="tiny" variant="secondary" onClick={() => onReview(record.id, "Reviewed")}>
                          <ClipboardCheck size={11} />
                          Review
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[9px] font-semibold text-slate-400">
      <span className={cn("h-2 w-2 flex-none rounded-sm", color)} />
      {label}
    </span>
  );
}

function AuditRowItem({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</dt>
      <dd className={cn("mt-0.5 truncate font-mono text-[12px] font-bold tabular-nums text-foreground", tone)}>{value}</dd>
    </div>
  );
}
