"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertTriangle,
  BadgeCheck,
  Boxes,
  ClipboardCheck,
  Coins,
  Droplets,
  Gauge,
  History,
  LayoutGrid,
  Package,
  Receipt,
  ShieldCheck,
  Square,
  UserRound,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import type { Unit } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { Panel, PanelHeader, Button, Badge, Input, StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";

type AuditRow = NonNullable<ReturnType<typeof useQuery<typeof api.inventory.operatorClearanceAudit>>>[number];

const PACKAGE_UNIT_LABEL: Record<string, string> = {
  ROLL: "rolls",
  SHEET: "sheets",
  LITER: "liters",
};

const PACKAGE_TONE: Record<string, { tile: string; badge: "info" | "neutral" | "warning"; icon: typeof Package }> = {
  ROLL: { tile: "border-cyan-800/50 bg-cyan-950/30 text-cyan-dark", badge: "info", icon: Package },
  SHEET: { tile: "border-violet/40 bg-violet/10 text-violet", badge: "neutral", icon: Square },
  LITER: { tile: "border-amber-800/50 bg-amber-950/30 text-amber-400", badge: "warning", icon: Droplets },
};

function etb(amount: number): string {
  return `ETB ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <span className="block truncate font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </span>
      <strong
        className={cn(
          "block truncate font-mono text-[15px] font-extrabold text-foreground leading-tight tabular-nums",
          tone,
        )}
      >
        {value}
      </strong>
    </div>
  );
}

function SectionHeading({ amharic, english }: { amharic: string; english: string }) {
  return (
    <div className="mb-3 mt-1">
      <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-dark">
        {english}
      </span>
      <h3 className="mt-0.5 m-0 text-[15px] font-bold text-foreground">{amharic}</h3>
    </div>
  );
}

export function OwnerInventoryOversight({
  canReview,
  showFinancial,
}: {
  canReview: boolean;
  showFinancial: boolean;
}) {
  const audit = useQuery(api.inventory.operatorClearanceAudit);
  const parentItems = useQuery(api.inventory.listParentInventory);
  const summary = useQuery(api.reconciliation.summary);
  const history = useQuery(api.reconciliation.list);
  const approve = useMutation(api.inventory.approveOperatorClearance);
  const review = useMutation(api.reconciliation.review);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const rows = useMemo<AuditRow[]>(() => audit ?? [], [audit]);
  const pendingCount = rows.filter((row) => row.status === "PENDING_CLEARANCE").length;

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
  const parentList = parentItems ?? [];
  const historyList = history ?? [];

  function approveClearance(subStockId: string, note?: string) {
    setApprovingId(subStockId);
    void approve({ subStockId: subStockId as Id<"operatorSubStock">, note })
      .then(() => toast.success("Owner clearance granted — operator can request new stock"))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unable to approve clearance.";
        toast.error(message);
      })
      .finally(() => setApprovingId(null));
  }

  function reviewRecord(reconciliationId: string, status: "Reviewed" | "Resolved") {
    setReviewingId(`${reconciliationId}-${status}`);
    void review({ reconciliationId: reconciliationId as Id<"reconciliations">, status })
      .then(() => toast.success(`Reconciliation marked ${status.toLowerCase()}`))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unable to review reconciliation.";
        toast.error(message);
      })
      .finally(() => setReviewingId(null));
  }

  return (
    <div className="grid gap-8">
      {/* ============ Section A · Operator Floor Stock Monitor ============ */}
      <Panel className="overflow-hidden">
        <PanelHeader
          kicker="OPERATOR FLOOR STOCK MONITOR"
          title="የማሽን ኦፕሬተሮች የክምችት ቁጥጥር"
          subtitle="Live allocation per operator & machine · approve reconciled batches to unlock new material requests"
          icon={<Gauge size={17} />}
          action={
            pendingCount > 0 ? (
              <Badge variant="warning" glowDot>{pendingCount} awaiting clearance</Badge>
            ) : (
              <Badge variant="success" glowDot>All clear</Badge>
            )
          }
        />

        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl border border-emerald-800/50 bg-emerald-950/30 text-emerald-400">
              <BadgeCheck size={20} />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">No live floor stock in circulation</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Issued batches appear here grouped by operator and machine, with usage and clearance actions.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 border-t border-border/60 p-4 xl:grid-cols-2">
            {groups.map((group) => (
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

                <div className="grid gap-2.5">
                  {group.batches.map((batch) => {
                    const pending = batch.status === "PENDING_CLEARANCE";
                    const hasDiscrepancy =
                      batch.lastDiscrepancy !== undefined && batch.lastDiscrepancy !== 0;
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
                          <Boxes size={13} className="flex-none text-cyan-dark" />
                          <strong className="text-[13px] font-semibold text-foreground">
                            {batch.materialName}
                          </strong>
                          {pending ? (
                            <Badge variant={hasDiscrepancy ? "danger" : "warning"} glowDot>
                              {hasDiscrepancy ? "Discrepancy found" : "Awaiting clearance"}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
                          <Metric
                            label="Remaining"
                            value={`${formatQuantity(batch.currentRemaining, batch.baseUnit as Unit)} ${batch.baseUnit}`}
                            tone="text-cyan-dark"
                          />
                          <Metric
                            label="Issued"
                            value={`${formatQuantity(batch.issuedQuantity, batch.baseUnit as Unit)} ${batch.baseUnit}`}
                          />
                          <Metric
                            label="Output used"
                            value={`${formatQuantity(batch.producedOutput, batch.baseUnit as Unit)} ${batch.baseUnit}`}
                            tone="text-emerald-400"
                          />
                          <Metric
                            label="Scrap"
                            value={`${formatQuantity(batch.scrapQuantity, batch.baseUnit as Unit)} · ${batch.wastePercent}%`}
                            tone={batch.wastePercent > 10 ? "text-rose-300" : "text-amber-400"}
                          />
                        </div>

                        {pending ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                            {batch.lastPhysicalCount !== undefined ? (
                              <p className="m-0 mr-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <AlertTriangle
                                  size={12}
                                  className={hasDiscrepancy ? "text-rose-300" : "text-muted-foreground"}
                                />
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
                              placeholder="Clearance note (optional)"
                              value={notes[batch.id] ?? ""}
                              onChange={(event) =>
                                setNotes((current) => ({ ...current, [batch.id]: event.target.value }))
                              }
                              className="w-44"
                            />
                            <Button
                              size="small"
                              pending={approvingId === batch.id}
                              disabled={approvingId === batch.id}
                              onClick={() => approveClearance(batch.id, notes[batch.id]?.trim() || undefined)}
                            >
                              <ShieldCheck size={13} />
                              {approvingId === batch.id ? "Approving..." : "Approve Clearance"}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>

      {/* ============ Section B · Central Parent Inventory Oversight ============ */}
      <div className="grid gap-6">
        {/* B.1 · Parent inventory grid */}
        <Panel className="overflow-hidden">
          <PanelHeader
            kicker="PARENT INVENTORY GRID"
            title="የ Storekeeper የክምችት አስተዳደር"
            subtitle="Whole packaging units (rolls, sheets, liters) under storekeeper custody · base-unit conversion for production"
            icon={<LayoutGrid size={17} />}
            action={<Badge variant="info">{parentList.length} items</Badge>}
          />
          <div className="border-t border-border/60 p-5">
            {parentList.length === 0 ? (
              <EmptyHint message="No packaging units registered in the central store yet." icon={<Warehouse size={20} />} />
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {parentList.map((item) => {
                  const tone = PACKAGE_TONE[item.unitType] ?? PACKAGE_TONE.ROLL;
                  const Icon = tone.icon;
                  return (
                    <div
                      key={item._id}
                      className="group relative overflow-hidden rounded-lg border border-border/60 bg-secondary/40 p-3.5 transition-colors hover:border-cyan/50 hover:bg-secondary/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-border/60 bg-background/60 text-cyan-dark">
                          <Icon size={16} />
                        </span>
                        <Badge variant={tone.badge}>{item.unitType}</Badge>
                      </div>
                      <strong className="mt-3 block truncate text-sm font-semibold text-foreground">
                        {item.materialName}
                      </strong>
                      <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Package stock
                      </div>
                      <div className="mt-0.5 flex items-baseline gap-1.5 font-mono tabular-nums text-foreground">
                        <strong className="text-[26px] font-extrabold leading-none">
                          {item.totalStockQuantity.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                        </strong>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {PACKAGE_UNIT_LABEL[item.unitType] ?? "units"}
                        </span>
                      </div>
                      {item.baseUnitsInStock !== undefined ? (
                        <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-cyan-800/40 bg-cyan-950/25 px-2.5 py-1.5">
                          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                            Base units
                          </span>
                          <strong className="font-mono text-[13px] font-extrabold tabular-nums text-cyan-dark">
                            ≈ {formatQuantity(item.baseUnitsInStock, item.baseUnit as Unit)} {item.baseUnit}
                          </strong>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>

        {/* B.2 · Leakage & variance alerts */}
        <Panel className="overflow-hidden">
          <PanelHeader
            kicker="LEAKAGE & VARIANCE ALERTS"
            title="የክምችት ጥፋት እና ልዩነት ማስጠንቀቂያ"
            subtitle="Ranked shortages across the latest count per material · monetary loss surfaced for the Owner"
            icon={<Receipt size={17} />}
            action={
              showFinancial && summary ? (
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
            {shortages.length === 0 ? (
              <EmptyHint
                message="No ranked shortages — latest counts show no negative variance."
                icon={<BadgeCheck size={20} />}
                tone="success"
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border/60">
                <div className="grid grid-cols-[20px_2fr_1fr_1.1fr] gap-3 border-b border-border/60 bg-secondary/40 px-4 py-2 font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  <span>#</span>
                  <span>Material</span>
                  <span className="text-right">Variance</span>
                  <span className="text-right">{showFinancial ? "Monetary loss" : "State"}</span>
                </div>
                {shortages.map((item, index) => (
                  <div
                    key={item.materialId}
                    className="grid grid-cols-[20px_2fr_1fr_1.1fr] items-center gap-3 border-b border-border/40 px-4 py-2.5 transition-colors last:border-b-0 hover:bg-secondary/30"
                  >
                    <span className="font-mono text-[11px] font-bold tabular-nums text-slate-400">
                      {(index + 1).toString().padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <strong className="block truncate text-[13px] font-semibold text-foreground">
                        {item.materialName}
                      </strong>
                      <span className="block truncate font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Last count: {shortDate(item.countDate)}
                      </span>
                    </div>
                    <span className="text-right font-mono text-[13px] font-bold tabular-nums text-rose-300">
                      {item.variance.toLocaleString("en-US", { maximumFractionDigits: 2 })} {item.unit}
                    </span>
                    {showFinancial ? (
                      <span className="flex items-center justify-end gap-1.5 font-mono text-[14px] font-extrabold tabular-nums text-rose-300">
                        <Coins size={12} className="text-amber-400" />
                        {etb(item.monetaryLoss)}
                      </span>
                    ) : (
                      <span className="flex justify-end">
                        <Badge variant="danger">Shortage</Badge>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>

        {/* B.3 · Physical count & reconciliation history */}
        <Panel className="overflow-hidden">
          <PanelHeader
            kicker="COUNT & RECONCILIATION HISTORY"
            title="የአካላዊ ቆጠራ ታሪክ"
            subtitle="Live audit trail of physical counts · Owner-only review & resolve actions"
            icon={<History size={17} />}
            action={
              canReview ? (
                <Badge variant="info" glowDot>
                  Owner review access
                </Badge>
              ) : (
                <Badge variant="neutral">{historyList.length} records</Badge>
              )
            }
          />
          <div className="border-t border-border/60 p-5">
            {historyList.length === 0 ? (
              <EmptyHint
                message="No physical counts recorded yet — the storekeeper performs counts from the reconciliation console."
                icon={<ClipboardCheck size={20} />}
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border/60">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 border-b border-border/60 bg-secondary/40 px-4 py-2 font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  <span>Material · counter</span>
                  <span className="text-right">Counted</span>
                  <span className="text-right">Variance / loss</span>
                  <span className="text-right">Status & action</span>
                </div>
                {historyList.slice(0, 10).map((record) => {
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
                      <span className="text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                        {formatQuantity(record.countedQuantity, record.materialUnit as Unit)}
                        <span className="ml-1 text-[10px] text-slate-400">{record.materialUnit}</span>
                      </span>
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
                        {showFinancial && (record.monetaryLoss ?? 0) > 0 ? (
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
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="tiny"
                              variant="secondary"
                              pending={reviewingId === `${record.id}-Reviewed`}
                              disabled={reviewingId !== null}
                              onClick={() => reviewRecord(record.id, "Reviewed")}
                            >
                              <ClipboardCheck size={11} />
                              Review
                            </Button>
                            <Button
                              size="tiny"
                              variant="secondary"
                              pending={reviewingId === `${record.id}-Resolved`}
                              disabled={reviewingId !== null}
                              onClick={() => reviewRecord(record.id, "Resolved")}
                            >
                              <BadgeCheck size={11} />
                              Resolve
                            </Button>
                          </div>
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
