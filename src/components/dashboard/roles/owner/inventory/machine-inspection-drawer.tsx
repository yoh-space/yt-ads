"use client";

import { useEffect } from "react";
import {
  X,
  Factory,
  Droplets,
  Briefcase,
  Scissors,
  Activity,
  AlertTriangle,
  CheckCircle,
  Eye,
  Clock,
  Beaker,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FloorMachineRow } from "./owner-production-floor-table";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(ts: number) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtQty(value: number, unit: string) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${unit}`;
}

// ─── Allowance status badge ───────────────────────────────────────────────────

const allowanceStyle: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  NORMAL: {
    label: "Normal",
    className: "border-success/30 bg-success/10 text-success",
    icon: <CheckCircle size={10} aria-hidden="true" />,
  },
  WATCH: {
    label: "Watch",
    className: "border-gold/30 bg-gold/10 text-gold",
    icon: <Eye size={10} aria-hidden="true" />,
  },
  CRITICAL: {
    label: "Critical",
    className: "border-danger/40 bg-danger/10 text-danger",
    icon: <AlertTriangle size={10} aria-hidden="true" />,
  },
  EXCEEDED: {
    label: "Exceeded",
    className: "border-danger bg-danger/20 text-danger font-bold",
    icon: <AlertTriangle size={10} aria-hidden="true" />,
  },
};

function AllowanceBadge({ status }: { status: string }) {
  const style = allowanceStyle[status] ?? allowanceStyle.NORMAL;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-[2px] text-[9px] uppercase tracking-wide",
        style.className,
      )}
    >
      {style.icon}
      {style.label}
    </span>
  );
}

// ─── Event type chip ──────────────────────────────────────────────────────────

const eventStyle: Record<string, string> = {
  STOCK_IN: "bg-success/10 text-success border-success/20",
  STORE_TO_OPERATOR_TRANSFER: "bg-cyan/10 text-cyan-dark border-cyan/20",
  PRODUCTION_CONSUMPTION: "bg-blue/10 text-blue border-blue/20",
  OFFCUT_RETURN: "bg-violet/10 text-violet border-violet/20",
  SCRAP_LOG: "bg-gold/10 text-gold border-gold/20",
  RECONCILIATION_ADJUSTMENT: "bg-muted/40 text-muted-foreground border-border",
  EXCEPTION_STOCK_OUT: "bg-danger/10 text-danger border-danger/20",
};

const eventLabel: Record<string, string> = {
  STOCK_IN: "Stock In",
  STORE_TO_OPERATOR_TRANSFER: "Issued",
  PRODUCTION_CONSUMPTION: "Consumed",
  OFFCUT_RETURN: "Offcut Return",
  SCRAP_LOG: "Scrap",
  RECONCILIATION_ADJUSTMENT: "Adjustment",
  EXCEPTION_STOCK_OUT: "Exception Out",
};

function EventChip({ type }: { type: string }) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded border px-1.5 py-[2px] text-[9px] font-semibold uppercase tracking-wide",
        eventStyle[type] ?? "bg-muted/40 text-muted-foreground border-border",
      )}
    >
      {eventLabel[type] ?? type}
    </span>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-2 pt-1">
      <span className="text-muted-foreground/70">{icon}</span>
      <h3 className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h3>
    </div>
  );
}

// ─── Ink level bar ────────────────────────────────────────────────────────────

interface InkBatch {
  id: string;
  materialName: string;
  issuedMillilitres?: number;
  remainingMillilitres?: number;
  consumedMillilitres?: number;
  issuedQuantity: number;
  currentRemaining: number;
  baseUnit: string;
  status: string;
}

function InkLevelBar({ batch }: { batch: InkBatch }) {
  const issuedMl = batch.issuedMillilitres ?? batch.issuedQuantity * 1000;
  const remainingMl = batch.remainingMillilitres ?? batch.currentRemaining * 1000;
  const pct = issuedMl > 0 ? Math.round((remainingMl / issuedMl) * 100) : 0;
  const color =
    pct <= 10 ? "bg-danger" : pct <= 30 ? "bg-gold" : "bg-success";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-foreground">{batch.materialName}</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {(remainingMl / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })} L remaining
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted/40"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${batch.materialName} ink level ${pct}%`}
      >
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
        <span>0 mL</span>
        <span className={cn("font-semibold", pct <= 10 ? "text-danger" : pct <= 30 ? "text-gold" : "text-success")}>
          {pct}%
        </span>
        <span>{issuedMl.toLocaleString()} mL issued</span>
      </div>
    </div>
  );
}

// ─── Types narrowed for this drawer ──────────────────────────────────────────

interface BatchRow {
  id: string;
  materialName: string;
  materialCategory: string;
  baseUnit: string;
  issuedQuantity: number;
  currentRemaining: number;
  consumedQuantity: number;
  usagePercent: number;
  status: string;
  usageAllowanceStatus: string;
  issuedMillilitres?: number;
  consumedMillilitres?: number;
  remainingMillilitres?: number;
  issuedAt: number;
}

interface RecentMovement {
  eventType: string;
  materialName: string;
  quantity: number;
  baseUnit: string;
  note: string;
  createdAt: number;
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface MachineInspectionDrawerProps {
  row: FloorMachineRow | null;
  onClose: () => void;
}

interface AtomicStock {
  materialName: string;
  kind: "raw_material" | "ink" | "solvent";
  unit: string;
  issued: number;
  remaining: number;
  consumed: number;
  usagePercent: number;
}

export function MachineInspectionDrawer({
  row,
  onClose,
}: MachineInspectionDrawerProps) {
  // Close on Escape
  useEffect(() => {
    if (!row) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [row, onClose]);

  if (!row) return null;

  const batches = (row.batches as BatchRow[]) ?? [];
  const inkBatches = (row.inkBatches as InkBatch[]) ?? [];
  const movements = (row.recentMovements as RecentMovement[]) ?? [];
  const stockSummary = (row.stockSummary as AtomicStock[]) ?? [];
  const configuredMaterials = row.configuredMaterials ?? [];
  const stockGroups = [
    { key: "raw_material", label: "Raw materials", icon: <Layers size={13} />, tone: "cyan" },
    { key: "ink", label: "Ink", icon: <Droplets size={13} />, tone: "violet" },
    { key: "solvent", label: "Cleaning solvent", icon: <Beaker size={13} />, tone: "gold" },
  ] as const;

  const statusStyles: Record<string, string> = {
    Running: "border-success/30 bg-success/10 text-success",
    Available: "border-border bg-muted/30 text-muted-foreground",
    Maintenance: "border-gold/30 bg-gold/10 text-gold",
    Unavailable: "border-danger/30 bg-danger/10 text-danger",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`${row.machineName} inspection`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="animate-slide-in-right absolute inset-y-0 right-0 flex h-full w-full max-w-lg flex-col bg-card shadow-2xl border-l border-border">
        {/* ── Fixed header ── */}
        <header className="flex shrink-0 flex-col gap-3 border-b border-border/60 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Factory size={17} />
              </span>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">
                  Machine Inspection
                </p>
                <h2 className="mt-0.5 text-base font-bold text-foreground">
                  {row.machineName}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {row.machineCode} · {row.machineType}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspection panel"
              className="grid place-items-center h-8 w-8 rounded-lg border border-border/60 bg-background/40 text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
            >
              <X size={15} />
            </button>
          </div>

          {/* Machine meta pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wide",
                statusStyles[row.machineStatus] ?? statusStyles.Unavailable,
              )}
            >
              {row.machineStatus}
            </span>
            {row.hasPendingClearance && (
              <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-[3px] text-[9px] font-bold uppercase tracking-wide text-gold">
                <AlertTriangle size={9} />
                Clearance Pending
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              Assigned operator: <strong className="text-foreground">{row.operatorName}</strong>
            </span>
          </div>
        </header>

        {/* ── Scrollable body ── */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4 space-y-5
            [scrollbar-width:thin]
            [&::-webkit-scrollbar]:w-1.5
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb]:bg-border
            [&::-webkit-scrollbar-track]:bg-transparent"
        >

          {/* ── Section 1: Atomic stock overview ── */}
          <section aria-labelledby="atomic-stock-heading">
            <SectionHeading icon={<Activity size={13} />} title="Live stock on this machine" />
            <h4 id="atomic-stock-heading" className="sr-only">Live stock on this machine</h4>
            <div className="space-y-3">
              {stockGroups.map((group) => {
                const items = stockSummary.filter((item) => item.kind === group.key);
                const configured = configuredMaterials.filter((item) => item.kind === group.key);
                return (
                  <div key={group.key} className="rounded-lg border border-border/50 bg-background/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground">
                        <span className={cn("text-muted-foreground", group.tone === "cyan" && "text-cyan-dark", group.tone === "violet" && "text-violet", group.tone === "gold" && "text-gold")}>{group.icon}</span>
                        {group.label}
                      </div>
                      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Live balance</span>
                    </div>
                    {items.length > 0 ? (
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div key={`${item.materialName}-${item.unit}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border/40 px-2.5 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-medium text-foreground">{item.materialName}</p>
                              <p className="text-[9px] text-muted-foreground">Used {fmtQty(item.consumed, item.unit)} · {item.usagePercent}% consumed</p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-[12px] font-bold tabular-nums text-foreground">{fmtQty(item.remaining, item.unit)}</p>
                              <p className="text-[9px] text-muted-foreground">remaining</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] italic text-muted-foreground">No live stock issued.</p>
                    )}
                    {configured.length > 0 && items.length === 0 ? (
                      <p className="mt-2 text-[10px] text-muted-foreground">Configured: {configured.map((item) => item.name).join(", ")}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Section 2: Material Batches ── */}
          <section aria-labelledby="batches-heading">
            <SectionHeading
              icon={<Activity size={13} />}
              title="Material Batches"
            />
            <h4 id="batches-heading" className="sr-only">Material Batches</h4>

            {batches.length === 0 ? (
              <p className="py-3 text-[12px] text-muted-foreground italic">
                No stock batches issued to this machine.
              </p>
            ) : (
              <div className="divide-y divide-border/40 rounded-lg border border-border/50 bg-background/30">
                {batches.map((batch) => (
                  <div key={batch.id} className="flex items-start justify-between gap-3 px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-foreground">
                        {batch.materialName}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {fmtQty(batch.issuedQuantity, batch.baseUnit)} issued ·{" "}
                        <span
                          className={cn(
                            "font-semibold",
                            batch.currentRemaining <= 0
                              ? "text-danger"
                              : "text-foreground",
                          )}
                        >
                          {fmtQty(batch.currentRemaining, batch.baseUnit)} remaining
                        </span>
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {fmtQty(batch.consumedQuantity, batch.baseUnit)} consumed · {batch.usagePercent}% used
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span
                        className={cn(
                          "rounded-full border px-1.5 py-[2px] text-[9px] font-semibold uppercase",
                          batch.status === "PENDING_CLEARANCE"
                            ? "border-gold/30 bg-gold/10 text-gold"
                            : "border-success/30 bg-success/10 text-success",
                        )}
                      >
                        {batch.status === "PENDING_CLEARANCE" ? "Pending" : "Active"}
                      </span>
                      <AllowanceBadge status={batch.usageAllowanceStatus} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Section 2: Ink Levels ── */}
          {inkBatches.length > 0 && (
            <section aria-labelledby="ink-heading">
              <SectionHeading
                icon={<Droplets size={13} />}
                title="Ink Levels"
              />
              <h4 id="ink-heading" className="sr-only">Ink Levels</h4>
              <div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-3">
                {inkBatches.map((batch) => (
                  <InkLevelBar key={batch.id} batch={batch} />
                ))}
              </div>
            </section>
          )}

          {/* ── Section 3: Active Job ── */}
          <section aria-labelledby="job-heading">
            <SectionHeading
              icon={<Briefcase size={13} />}
              title="Active Job"
            />
            <h4 id="job-heading" className="sr-only">Active Job</h4>
            {row.activeJob ? (
              <div className="rounded-lg border border-border/50 bg-background/30 px-3 py-3">
                <p className="text-[13px] font-semibold text-foreground">
                  {row.activeJob.title}
                </p>
                <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                  <span>{row.activeJob.code}</span>
                  <span>·</span>
                  <span>{row.activeJob.client}</span>
                </div>
              </div>
            ) : (
              <p className="py-2 text-[12px] text-muted-foreground italic">
                No active job assigned to this machine.
              </p>
            )}
          </section>

          {/* ── Section 4: Scraps & Offcuts ── */}
          <section aria-labelledby="scrap-heading">
            <SectionHeading
              icon={<Scissors size={13} />}
              title="Scraps & Offcuts"
            />
            <h4 id="scrap-heading" className="sr-only">Scraps and Offcuts</h4>
            <div className="flex gap-4 rounded-lg border border-border/50 bg-background/30 px-4 py-3">
              <div className="text-center">
                <p className="font-mono text-2xl font-extrabold text-foreground">
                  {row.scrapCount}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  Scrap logs
                </p>
              </div>
              <div className="w-px bg-border/60" />
              <div className="text-center">
                <p className="font-mono text-2xl font-extrabold text-foreground">
                  {row.offcutCount}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  Offcuts available
                </p>
              </div>
              {row.scrapCount === 0 && row.offcutCount === 0 && (
                <p className="ml-2 self-center text-[11px] text-muted-foreground italic">
                  No waste recorded yet
                </p>
              )}
            </div>
          </section>

          {/* ── Section 5: Recent Activity ── */}
          <section aria-labelledby="activity-heading">
            <SectionHeading
              icon={<Clock size={13} />}
              title="Recent Activity"
            />
            <h4 id="activity-heading" className="sr-only">Recent Activity</h4>
            {movements.length === 0 ? (
              <p className="py-2 text-[12px] text-muted-foreground italic">
                No stock movements recorded for this machine yet.
              </p>
            ) : (
              <div className="space-y-2">
                {movements.map((mv, idx) => (
                  // movements have no stable id so index is acceptable here
                  // eslint-disable-next-line react/no-array-index-key
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-lg border border-border/40 bg-background/30 px-3 py-2.5"
                  >
                    <EventChip type={mv.eventType} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-foreground">
                        {mv.materialName}
                        {" · "}
                        <span className="font-mono tabular-nums">
                          {fmtQty(mv.quantity, mv.baseUnit)}
                        </span>
                      </p>
                      {mv.note && (
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          {mv.note}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-[9px] text-muted-foreground/70">
                      {fmt(mv.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Footer — read-only notice ── */}
        <footer className="shrink-0 border-t border-border/60 px-5 py-3">
          <p className="text-center font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/60">
            Read-only oversight view · No changes can be made here
          </p>
        </footer>
      </div>
    </div>
  );
}
