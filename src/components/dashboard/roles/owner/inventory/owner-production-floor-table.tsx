"use client";

import { Factory, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Mirrors the shape returned by getOwnerFloorSummary.machines[] */
export interface FloorMachineRow {
  machineId: string;
  machineName: string;
  machineCode: string;
  machineType: string;
  machineStatus: string;
  operatorId: string;
  operatorName: string;
  dominantUnit: string;
  totalIssued: number;
  totalRemaining: number;
  totalConsumed: number;
  usagePercent: number;
  scrapCount: number;
  offcutCount: number;
  hasPendingClearance: boolean;
  activeJob: { title: string; code: string; client: string } | null;
  batches: unknown[];
  inkBatches: unknown[];
  stockSummary: Array<{
    materialName: string;
    kind: "raw_material" | "ink" | "solvent";
    unit: string;
    issued: number;
    remaining: number;
    consumed: number;
    usagePercent: number;
  }>;
  configuredMaterials: Array<{ name: string; kind: "raw_material" | "ink" | "solvent" }>;
  recentMovements: unknown[];
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const statusStyles: Record<
  string,
  { dot: string; badge: string; label: string }
> = {
  Running: {
    dot: "bg-success",
    badge: "border-success/30 bg-success/10 text-success",
    label: "Running",
  },
  Available: {
    dot: "bg-muted-foreground/50",
    badge: "border-border bg-muted/30 text-muted-foreground",
    label: "Available",
  },
  Maintenance: {
    dot: "bg-gold",
    badge: "border-gold/30 bg-gold/10 text-gold",
    label: "Maintenance",
  },
  Unavailable: {
    dot: "bg-danger",
    badge: "border-danger/30 bg-danger/10 text-danger",
    label: "Unavailable",
  },
};

function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? statusStyles.Unavailable;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wide",
        style.badge,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} aria-hidden="true" />
      {style.label}
    </span>
  );
}

// ─── Usage bar ────────────────────────────────────────────────────────────────

function UsageBar({ pct }: { pct: number }) {
  const color =
    pct >= 90
      ? "bg-danger"
      : pct >= 70
        ? "bg-gold"
        : "bg-success";

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-20 overflow-hidden rounded-full bg-muted/40"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% material used`}
      >
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span
        className={cn(
          "font-mono text-[11px] font-semibold tabular-nums",
          pct >= 90 ? "text-danger" : pct >= 70 ? "text-gold" : "text-success",
        )}
      >
        {pct}%
      </span>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-card">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-muted/30 text-muted-foreground">
        <Factory size={22} />
      </span>
      <p className="text-sm font-semibold text-foreground">No active production floor assignments</p>
      <p className="text-xs text-muted-foreground">
        Machine sub-stock batches will appear here once issued.
      </p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface OwnerProductionFloorTableProps {
  rows: FloorMachineRow[];
  onInspect: (row: FloorMachineRow) => void;
}

export function OwnerProductionFloorTable({
  rows,
  onInspect,
}: OwnerProductionFloorTableProps) {
  if (rows.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-custom">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-border/60 bg-muted/20">
            <tr>
              {[
                "Machine",
                "Operator",
                "Status",
                "Active Job",
                "Issued / Remaining",
                "Usage",
                "Scraps / Offcuts",
                "",
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-4 py-3 font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-border/40">
            {rows.map((row) => (
              <tr
                key={row.machineId}
                className={cn(
                  "group transition-colors hover:bg-muted/10",
                  row.hasPendingClearance && "bg-gold/5",
                )}
              >
                {/* Machine */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted/30 text-muted-foreground">
                      <Factory size={15} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">{row.machineName}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {row.machineCode} · {row.machineType}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Operator */}
                <td className="px-4 py-3">
                  <p className="text-[13px] text-foreground">{row.operatorName}</p>
                  {row.batches.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      {row.batches.length} batch{row.batches.length !== 1 ? "es" : ""}
                    </p>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    <StatusBadge status={row.machineStatus} />
                    {row.hasPendingClearance && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-[3px] text-[9px] font-bold uppercase tracking-wide text-gold">
                        <AlertTriangle size={9} aria-hidden="true" />
                        Clearance pending
                      </span>
                    )}
                  </div>
                </td>

                {/* Active Job */}
                <td className="px-4 py-3">
                  {row.activeJob ? (
                    <div>
                      <p
                        className="max-w-[160px] truncate text-[12px] font-medium text-foreground"
                        title={row.activeJob.title}
                      >
                        {row.activeJob.title}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {row.activeJob.code} · {row.activeJob.client}
                      </p>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/60 italic">
                      No active job
                    </span>
                  )}
                </td>

                {/* Issued / Remaining */}
                <td className="px-4 py-3">
                  {row.batches.length > 0 ? (
                    <div>
                      <p className="font-mono text-[11px] tabular-nums text-foreground">
                        {row.totalIssued.toLocaleString()} {row.dominantUnit}
                      </p>
                      <p className="font-mono text-[10px] tabular-nums text-muted-foreground">
                        {row.totalRemaining.toLocaleString()} remaining
                      </p>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/60 italic">
                      No stock issued
                    </span>
                  )}
                </td>

                {/* Usage % */}
                <td className="px-4 py-3">
                  {row.batches.length > 0 ? (
                    <UsageBar pct={row.usagePercent} />
                  ) : (
                    <span className="text-[11px] text-muted-foreground/60">—</span>
                  )}
                </td>

                {/* Scraps / Offcuts */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {row.scrapCount} scrap
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {row.offcutCount} offcut
                    </span>
                  </div>
                </td>

                {/* Inspect action */}
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onInspect(row)}
                    aria-label={`Inspect ${row.machineName}`}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card px-3 py-1.5",
                      "text-[11px] font-medium text-muted-foreground",
                      "transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                    )}
                  >
                    View detail
                    <ChevronRight size={13} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
        <p className="text-[11px] text-muted-foreground">
          {rows.filter((r) => r.batches.length > 0).length} of {rows.length}{" "}
          machines have active stock
        </p>
        {rows.some((r) => r.hasPendingClearance) && (
          <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[10px] font-semibold text-gold">
            <AlertTriangle size={10} aria-hidden="true" />
            {rows.filter((r) => r.hasPendingClearance).length} awaiting clearance
          </span>
        )}
      </div>
    </div>
  );
}
