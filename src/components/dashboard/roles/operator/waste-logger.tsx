"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { AlertTriangle, Info, MapPin, RefreshCw, Scissors, Trash2 } from "lucide-react";
import { Button, Input, Panel, PanelHeader, Select } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import type { Id } from "@/convex/_generated/dataModel";

type WasteBatch = {
  _id: Id<"operatorSubStock">;
  materialId: Id<"materials">;
  materialName: string;
  currentRemaining: number;
  issuedQuantity: number;
  baseUnit: string;
  unitLabel: string;
  catalogFamily?: string;
  maxScrap?: number;
  minOffcutWidth?: number;
  minOffcutLength?: number;
  wasteLimitPolicy: "warn" | "block";
  totalScrapLogged: number;
};

type WasteEntry = {
  _id: string;
  materialName: string;
  createdAt: string;
};

function fmt(value: number | undefined): string {
  if (value === undefined) return "—";
  return Number(value.toFixed(3)).toString();
}

function formatQuantity(value: number | undefined, unit: string): string {
  return `${fmt(value)} ${unit}`;
}

function scrapPercent(batch: WasteBatch, extra = 0): number {
  if (batch.maxScrap === undefined) return 0;
  return Math.min(100, ((batch.totalScrapLogged + extra) / batch.maxScrap) * 100);
}

export function WasteLogger({ machineSlug }: { machineSlug: string }) {
  const data = useQuery(api.operator.offcuts.getWastePageData, { machineSlug });
  const logOffcut = useMutation(api.operator.offcuts.logOffcut);
  const logScrap = useMutation(api.operator.offcuts.logScrap);

  const [offcutBatchId, setOffcutBatchId] = useState<string>("");
  const [scrapBatchId, setScrapBatchId] = useState<string>("");
  const [width, setWidth] = useState("");
  const [length, setLength] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [offcutBusy, setOffcutBusy] = useState(false);
  const [scrapBusy, setScrapBusy] = useState(false);

  if (!data) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <InventoryLoader label="የብክነት መዝገብ በመጫን ላይ…" />
      </div>
    );
  }

  const floorStock = data.floorStock as WasteBatch[];
  const offcutBatches = floorStock.filter((batch) => batch.unitLabel === "m²");
  const effectiveOffcutId = offcutBatches.some((b) => b._id === offcutBatchId)
    ? offcutBatchId
    : offcutBatches[0]?._id ?? "";
  const effectiveScrapId = floorStock.some((b) => b._id === scrapBatchId)
    ? scrapBatchId
    : floorStock[0]?._id ?? "";
  const offcutBatch = floorStock.find((b) => b._id === effectiveOffcutId);
  const scrapBatch = floorStock.find((b) => b._id === effectiveScrapId);

  const area = (() => {
    const w = parseFloat(width);
    const l = parseFloat(length);
    return Number.isFinite(w) && Number.isFinite(l) && w > 0 && l > 0 ? w * l : null;
  })();

  async function handleLogOffcut(e: React.FormEvent) {
    e.preventDefault();
    if (!offcutBatch) {
      toast.error("Select a floor-stock material to return an offcut from.");
      return;
    }
    const w = parseFloat(width);
    const l = parseFloat(length);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(l) || l <= 0) {
      toast.error("Enter valid offcut dimensions greater than zero.");
      return;
    }
    if (!location.trim()) {
      toast.error("Offcut location is required.");
      return;
    }
    if (offcutBatch.minOffcutWidth !== undefined && offcutBatch.minOffcutLength !== undefined) {
      if (w < offcutBatch.minOffcutWidth || l < offcutBatch.minOffcutLength) {
        toast.error(
          `Offcut ${fmt(w)} × ${fmt(l)} m is below the ${fmt(offcutBatch.minOffcutWidth)} × ${fmt(offcutBatch.minOffcutLength)} m minimum — log it as scrap instead.`,
        );
        return;
      }
    }
    setOffcutBusy(true);
    try {
      await logOffcut({
        machineSlug,
        materialId: offcutBatch.materialId,
        width: w,
        length: l,
        location: location.trim(),
        operatorSubStockId: offcutBatch._id,
      });
      toast.success(`Usable offcut of ${fmt(w * l)} m² logged for ${offcutBatch.materialName}.`);
      setWidth("");
      setLength("");
      setLocation("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log the offcut.");
    } finally {
      setOffcutBusy(false);
    }
  }

  async function handleLogScrap(e: React.FormEvent) {
    e.preventDefault();
    if (!scrapBatch) {
      toast.error("Select a floor-stock material to log scrap against.");
      return;
    }
    const q = parseFloat(quantity);
    if (!Number.isFinite(q) || q <= 0) {
      toast.error("Enter a valid scrap quantity greater than zero.");
      return;
    }
    if (!reason.trim()) {
      toast.error("A scrap reason is required.");
      return;
    }
    setScrapBusy(true);
    try {
      await logScrap({
        machineSlug,
        materialId: scrapBatch.materialId,
        quantity: q,
        reason: reason.trim(),
        operatorSubStockId: scrapBatch._id,
      });
      toast.success(`Scrap of ${formatQuantity(q, scrapBatch.unitLabel)} logged for ${scrapBatch.materialName}.`);
      setQuantity("");
      setReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log the scrap.");
    } finally {
      setScrapBusy(false);
    }
  }

  const offcutBlocked =
    offcutBatch && offcutBatch.wasteLimitPolicy === "block"
      ? offcutBatch.unitLabel === "m²" &&
        (offcutBatch.minOffcutWidth === undefined || offcutBatch.minOffcutLength === undefined)
      : false;

  const activity: Array<WasteEntry & { kind: "offcut" | "scrap"; detail: string }> = [
    ...data.recentOffcuts.map((entry) => ({
      ...entry,
      kind: "offcut" as const,
      detail: `${fmt(entry.width)} × ${fmt(entry.length)} m · ${fmt(entry.area)} m²`,
    })),
    ...data.recentScraps.map((entry) => ({
      ...entry,
      kind: "scrap" as const,
      detail: formatQuantity(entry.quantity, entry.unit),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);

  return (
    <div className="space-y-6">
      {/* Unconfigured-limit banners */}
      {scrapBatch &&
        (scrapBatch.wasteLimitPolicy === "block" && scrapBatch.maxScrap === undefined ? (
          <aside className="flex items-center gap-3 rounded-md border border-danger/40 bg-danger/10 p-4 text-danger">
            <AlertTriangle size={18} className="shrink-0" />
            <div className="text-xs">
              <strong>Logging blocked for {scrapBatch.materialName}.</strong> The owner must configure the max scrap
              limit before scrap can be recorded.
            </div>
          </aside>
        ) : scrapBatch.wasteLimitPolicy === "warn" && scrapBatch.maxScrap === undefined ? (
          <aside className="flex items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300">
            <Info size={18} className="shrink-0" />
            <div className="text-xs">
              <strong>Limits not configured for {scrapBatch.materialName}.</strong> Scrap is logged freely for now —
              ask the owner to set a max scrap limit.
            </div>
          </aside>
        ) : null)}

      {offcutBatch && offcutBatch.unitLabel === "m²" && offcutBlocked && (
        <aside className="flex items-center gap-3 rounded-md border border-danger/40 bg-danger/10 p-4 text-danger">
          <AlertTriangle size={18} className="shrink-0" />
          <div className="text-xs">
            <strong>Offcut logging blocked for {offcutBatch.materialName}.</strong> The owner must configure the minimum
            offcut dimensions before offcuts can be returned.
          </div>
        </aside>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ── Offcut logging card ── */}
        <Panel>
          <PanelHeader
            kicker="Usable leftover · ቀሪ ዕቃ"
            title="Log an Offcut"
            subtitle="Return usable leftover material to the central stock."
            icon={<Scissors size={16} />}
          />
          <form onSubmit={handleLogOffcut} className="space-y-3 p-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Floor-stock material</label>
              <Select value={effectiveOffcutId} onChange={(e) => setOffcutBatchId(e.target.value)} className="w-full bg-background">
                {offcutBatches.length === 0 ? (
                  <option value="" disabled>
                    No area (m²) material on floor stock
                  </option>
                ) : (
                  offcutBatches.map((batch) => (
                    <option key={batch._id} value={batch._id}>
                      {batch.materialName} — {formatQuantity(batch.currentRemaining, batch.unitLabel)} remaining
                    </option>
                  ))
                )}
              </Select>
            </div>

            {offcutBatch && offcutBatch.minOffcutWidth !== undefined && offcutBatch.minOffcutLength !== undefined && (
              <p className="rounded-md bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground">
                Minimum usable offcut:{" "}
                <span className="font-semibold text-foreground">
                  {fmt(offcutBatch.minOffcutWidth)} × {fmt(offcutBatch.minOffcutLength)} m
                </span>{" "}
                — a smaller leftover must be logged as scrap instead.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Width (m)</label>
                <Input type="number" step="0.01" min="0" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="0.5" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Length (m)</label>
                <Input type="number" step="0.01" min="0" value={length} onChange={(e) => setLength(e.target.value)} placeholder="0.8" />
              </div>
            </div>

            {area !== null && (
              <p className="text-[11px] text-muted-foreground">
                Resulting offcut area: <span className="font-semibold text-foreground">{fmt(area)} m²</span>
              </p>
            )}

            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Storage location</label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Rack A, Bay 2"
                className="flex items-center gap-2"
              />
            </div>

            <Button variant="primary" type="submit" size="full" pending={offcutBusy} disabled={offcutBatches.length === 0}>
              <MapPin size={14} /> Log Offcut
            </Button>
          </form>
        </Panel>

        {/* ── Scrap logging card ── */}
        <Panel>
          <PanelHeader
            kicker="Waste & rejection · ብክነት"
            title="Log Scrap"
            subtitle="Record unusable leftover against the material's global scrap limit."
            icon={<Trash2 size={16} />}
          />
          <form onSubmit={handleLogScrap} className="space-y-3 p-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Floor-stock material</label>
              <Select value={effectiveScrapId} onChange={(e) => setScrapBatchId(e.target.value)} className="w-full bg-background">
                {floorStock.length === 0 ? (
                  <option value="" disabled>
                    No floor stock on this machine
                  </option>
                ) : (
                  floorStock.map((batch) => (
                    <option key={batch._id} value={batch._id}>
                      {batch.materialName} — {formatQuantity(batch.currentRemaining, batch.unitLabel)} remaining
                    </option>
                  ))
                )}
              </Select>
            </div>

            {scrapBatch && scrapBatch.maxScrap !== undefined && (
              <div>
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>
                    Globally logged{" "}
                    <span className="font-semibold text-foreground">
                      {formatQuantity(scrapBatch.totalScrapLogged, scrapBatch.unitLabel)}
                    </span>{" "}
                    of {formatQuantity(scrapBatch.maxScrap, scrapBatch.unitLabel)}
                  </span>
                  <span>{Math.round(scrapPercent(scrapBatch))}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      scrapPercent(scrapBatch) >= 100 ? "bg-danger" : scrapPercent(scrapBatch) >= 80 ? "bg-gold" : "bg-cyan"
                    )}
                    style={{ width: `${scrapPercent(scrapBatch)}%` }}
                  />
                </div>
                {quantity && scrapBatch.maxScrap - scrapBatch.totalScrapLogged > 0 && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    With this entry, <span className="font-semibold text-foreground">{formatQuantity(scrapBatch.totalScrapLogged + Number(quantity), scrapBatch.unitLabel)}</span> — {Math.round(scrapPercent(scrapBatch, Number(quantity)))}% of the limit.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Quantity ({scrapBatch?.unitLabel ?? ""})
                </label>
                <Input type="number" step="0.001" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0.5" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Reason</label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. misfeed, misprint" />
              </div>
            </div>

            <Button variant="secondary" type="submit" size="full" pending={scrapBusy} disabled={floorStock.length === 0}>
              <Trash2 size={14} /> Log Scrap
            </Button>
          </form>
        </Panel>
      </div>

      {/* ── Recent activity ── */}
      <Panel>
        <PanelHeader kicker="Activity log · የመዝገብ" title="Recent Offcuts & Scrap" subtitle="Latest entries recorded on this machine." />
        <div className="p-4">
          {activity.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No offcuts or scrap recorded yet on this machine.
            </div>
          ) : (
            <div className="space-y-2">
              {activity.map((entry) => (
                <div key={`${entry.kind}-${entry._id}`} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                        entry.kind === "offcut" ? "bg-cyan/10 text-cyan-dark" : "bg-danger/10 text-danger"
                      )}
                    >
                      {entry.kind}
                    </span>
                    <span className="truncate text-xs font-medium text-foreground">{entry.materialName}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{entry.detail}</span>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      {floorStock.length === 0 && (
        <div className="flex items-center justify-center gap-2 rounded-md border border-border bg-secondary/40 p-4 text-xs text-muted-foreground">
          <RefreshCw size={14} /> No floor stock is issued to this machine yet — request material first.
        </div>
      )}
    </div>
  );
}