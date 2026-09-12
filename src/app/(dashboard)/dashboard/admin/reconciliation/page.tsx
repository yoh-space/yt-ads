"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/shared/ui/table";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { Scale, Hourglass, TrendingDown, TrendingUp, Search, X, Check, Factory, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type StatusFilter = "All" | "Open" | "Reviewed" | "Accepted" | "Resolved";

type ReconciliationRow = {
  id: string;
  materialName: string;
  status: "Open" | "Reviewed" | "Accepted" | "Resolved";
  systemQuantity: number;
  countedQuantity: number;
  variance: number;
  etbValue: number;
  monetaryLoss: number;
  countedBy: string;
  note?: string;
  createdAt: number;
};

function makeTime(timestamp: number) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function makeDateTime(timestamp: number) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

const STATUS_FILTERS: StatusFilter[] = ["All", "Open", "Reviewed", "Accepted", "Resolved"];

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-[11px] text-foreground text-right">{children}</span>
    </div>
  );
}

function statusBadgeClass(status: ReconciliationRow["status"]) {
  switch (status) {
    case "Open":
      return "border-slate-500/40 bg-slate-500/10 text-slate-400";
    case "Reviewed":
      return "border-amber-500/40 bg-amber-500/10 text-amber-500";
    case "Accepted":
      return "border-sky-500/40 bg-sky-500/10 text-sky-400";
    default:
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-500";
  }
}

export default function AdminReconciliationPage() {
  const summary = useQuery(api.admin.reconciliation.getReconciliationSummary);
  const review = useMutation(api.reconciliation.review);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [selected, setSelected] = useState<ReconciliationRow | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelected(null);
        setResolveNote("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  const filtered = useMemo(() => {
    if (!summary) return [];
    let rows = summary.allReconciliations;
    if (statusFilter !== "All") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.materialName.toLowerCase().includes(q) || r.countedBy.toLowerCase().includes(q));
    }
    return rows;
  }, [summary, statusFilter, search]);

  async function handleAccept() {
    if (!selected) return;
    setResolving(true);
    try {
      await review({ reconciliationId: selected.id as any, status: "Accepted" });
      toast.success("Reconciliation accepted.");
      setSelected(null);
      setResolveNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to accept.");
    } finally {
      setResolving(false);
    }
  }

  async function handleResolve() {
    if (!selected || !resolveNote.trim()) return;
    setResolving(true);
    try {
      await review({ reconciliationId: selected.id as any, status: "Resolved", note: resolveNote.trim() });
      toast.success("Reconciliation resolved.");
      setSelected(null);
      setResolveNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resolve.");
    } finally {
      setResolving(false);
    }
  }

  if (summary === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Clearances…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Reconciliation · ክምችት ማረጋገጫ"
        title="Reconciliation"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Hourglass size={16} />}
          label="Pending Clearance"
          subtitle="በጥበቃ ላይ"
          value={summary.pendingCount}
          description="Batches awaiting review."
          variant="cost"
          isAlert={summary.pendingCount > 0}
        />
        <StatCard
          icon={<TrendingDown size={16} />}
          label="Shortages Found"
          subtitle="የተገኘ ጉድለት"
          value={summary.shortagesCount}
          variant="alert"
          isAlert={summary.shortagesCount > 0}
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Surpluses Found"
          subtitle="የተገኘ ትርፍ"
          value={summary.surplusesCount}
          variant="profit"
        />
        <StatCard
          icon={<Scale size={16} />}
          label="Total Reconciliations"
          subtitle="መላ የማረጋገጫዎች"
          value={summary.totalReconciliations}
          variant="default"
        />
      </div>

      <Panel>
        <PanelHeader
          title="Awaiting Clearance"
          subtitle="ማጽደቂያ በመጠባበቅ ላይ"
          kicker="Pending"
          icon={<Factory size={16} />}
        />
        {summary.pendingClearances.length === 0 ? (
          <p className="p-[17px] text-[12px] text-muted-foreground">
            Nothing waiting on review — the floor is fully cleared.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Machine</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.pendingClearances.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell muted>{batch.machineName}</TableCell>
                    <TableCell muted>{batch.operatorName}</TableCell>
                    <TableCell mono>{batch.issued}</TableCell>
                    <TableCell mono>{batch.remaining}</TableCell>
                    <TableCell muted>{batch.unit}</TableCell>
                    <TableCell mono muted>{makeTime(batch.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="All Reconciliations"
          subtitle="All reconciliation records"
          kicker="History"
          icon={<Package size={16} />}
        />

        <div className="flex flex-wrap items-center gap-3 px-[17px] pb-4">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search material or counted by..."
              className="w-full rounded-lg border border-border/60 bg-background/40 py-2 pl-9 pr-3 text-[11px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[10px] font-semibold transition-colors",
                  statusFilter === s
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/20 hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="px-[17px] pb-4 text-[12px] text-muted-foreground">
            {summary.allReconciliations.length === 0
              ? "No reconciliation records yet."
              : "No records match your filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>System</TableHead>
                  <TableHead>Counted</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Value (ETB)</TableHead>
                  <TableHead>Loss</TableHead>
                  <TableHead>Counted by</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow
                    key={row.id}
                    interactive
                    onClick={() => { setSelected(row); setResolveNote(""); }}
                    className={cn(selected?.id === row.id && "bg-muted/30")}
                  >
                    <TableCell className="font-medium text-foreground">{row.materialName}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                          statusBadgeClass(row.status),
                        )}
                      >
                        {row.status}
                      </span>
                    </TableCell>
                    <TableCell mono>{row.systemQuantity}</TableCell>
                    <TableCell mono>{row.countedQuantity}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "font-mono text-[11px] tabular-nums",
                          row.variance < 0 ? "text-danger" : row.variance > 0 ? "text-profit" : "text-muted-foreground",
                        )}
                      >
                        {row.variance > 0 ? "+" : ""}{row.variance}
                      </span>
                    </TableCell>
                    <TableCell mono>{row.etbValue.toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={cn("font-mono text-[11px] tabular-nums", row.monetaryLoss > 0 ? "text-danger" : "text-muted-foreground")}>
                        {row.monetaryLoss > 0 ? row.monetaryLoss.toLocaleString() : "—"}
                      </span>
                    </TableCell>
                    <TableCell muted>{row.countedBy}</TableCell>
                    <TableCell mono muted>{makeTime(row.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setSelected(null); setResolveNote(""); } }}
        >
          <div className="flex flex-col w-full max-w-md h-full bg-card border-l border-border shadow-2xl animate-slide-in-right">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-primary">Reconciliation Detail</p>
                <h2 className="text-base font-bold text-foreground mt-0.5">{selected.materialName}</h2>
              </div>
              <button
                type="button"
                onClick={() => { setSelected(null); setResolveNote(""); }}
                className="grid place-items-center w-8 h-8 rounded-lg bg-secondary text-muted-foreground hover:bg-border hover:text-foreground transition-colors"
                aria-label="Close detail panel"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
              <div className="mb-4">
                <span
                  className={cn(
                    "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                    statusBadgeClass(selected.status),
                  )}
                >
                  {selected.status}
                </span>
              </div>

              <DetailRow label="Material">{selected.materialName}</DetailRow>
              <DetailRow label="System quantity">{selected.systemQuantity}</DetailRow>
              <DetailRow label="Counted quantity">{selected.countedQuantity}</DetailRow>
              <DetailRow label="Variance">
                <span className={cn(
                  "font-mono tabular-nums",
                  selected.variance < 0 ? "text-danger" : selected.variance > 0 ? "text-profit" : "",
                )}>
                  {selected.variance > 0 ? "+" : ""}{selected.variance}
                </span>
              </DetailRow>
              <DetailRow label="ETB value">ETB {selected.etbValue.toLocaleString()}</DetailRow>
              <DetailRow label="Monetary loss">
                <span className={cn("font-mono tabular-nums", selected.monetaryLoss > 0 ? "text-danger" : "")}>
                  {selected.monetaryLoss > 0 ? `ETB ${selected.monetaryLoss.toLocaleString()}` : "—"}
                </span>
              </DetailRow>
              <DetailRow label="Counted by">{selected.countedBy}</DetailRow>
              <DetailRow label="Date">{makeDateTime(selected.createdAt)}</DetailRow>
              {selected.note && (
                <DetailRow label="Note">{selected.note}</DetailRow>
              )}

              {selected.status === "Reviewed" && selected.variance < 0 && (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                  <p className="text-[10px] text-amber-400">
                    Shortage detected — resolving this record blocks further inventory movement for this material until cleared.
                  </p>
                </div>
              )}

              {selected.status === "Open" && selected.variance < 0 && (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                  <p className="text-[10px] text-amber-400">
                    Shortage detected — this record must be resolved before new stock-in or transfers for this material.
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-border/60 space-y-3">
              {selected.status !== "Accepted" && selected.status !== "Resolved" ? (
                selected.variance < 0 ? (
                  <>
                    <textarea
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      placeholder="Reason for resolving this shortage..."
                      rows={3}
                      className="w-full rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none"
                    />
                    <button
                      type="button"
                      disabled={!resolveNote.trim() || resolving}
                      onClick={() => void handleResolve()}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50 transition-colors hover:bg-emerald-700"
                    >
                      <Check size={14} />
                      {resolving ? "Resolving..." : "Resolve Shortage"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={resolving}
                    onClick={() => void handleAccept()}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50 transition-colors hover:bg-emerald-700"
                  >
                    <Check size={14} />
                    {resolving ? "Accepting..." : "Accept"}
                  </button>
                )
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Click outside or press Esc to close
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}