"use client";

import { AlertTriangle, Droplets, FlaskConical, Plus, RefreshCw, Scale, Trash2, Waves } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Button, Panel, PanelHeader } from "@/components/shared/ui";
import { useState } from "react";
import type { OperatorStockEntry } from "@/types/dashboard-types";

function formatQuantity(value: number, unit: string) { return `${value.toFixed(2)} ${unit}`; }
function isLowStock(batch: OperatorStockEntry) { return batch.lowStockThreshold !== undefined && batch.lowStockThreshold > 0 && batch.currentRemaining <= batch.lowStockThreshold; }
function categoryOf(batch: OperatorStockEntry): "INK" | "SOLVENT" | "RAW_MATERIAL" { return batch.materialFamily === "SOLVENT" || batch.isSolvent ? "SOLVENT" : batch.materialFamily === "INK" || batch.baseUnit === "L" || batch.baseUnit === "ml" ? "INK" : "RAW_MATERIAL"; }
const sections = [
  { key: "INK" as const, title: "Ink & Fluids", subtitle: "Ink channels and consumable liquids", icon: Droplets, tone: "cyan", empty: "No ink or fluid has been loaded." },
  { key: "SOLVENT" as const, title: "Cleaning Supplies", subtitle: "Solvent, flush fluid, and machine care", icon: FlaskConical, tone: "amber", empty: "No cleaning supplies have been loaded." },
  { key: "RAW_MATERIAL" as const, title: "Materials for Work", subtitle: "Banner, vinyl, mesh, sheets, and other media", icon: Waves, tone: "green", empty: "No material has been loaded." },
];

export function OperatorStockWidget({ machineId, machineSlug, stock: providedStock }: { machineId: string; machineSlug?: string; stock?: OperatorStockEntry[] }) {
  const router = useRouter();
  const queriedStock = useQuery(api.inventory.listOperatorMachineStock, providedStock === undefined ? {} : "skip");
  const stock = providedStock ?? queriedStock;
  const [exhaustingId, setExhaustingId] = useState<string | null>(null);
  const exhaustStock = useMutation(api.inventory.exhaustOperatorStock);
  const machineStock = stock?.filter((item) => item.machineId === machineId && item.status === "ACTIVE") ?? [];
  const reconciliationHref = machineSlug ? `/dashboard/operator/${machineSlug}/reconciliation` : undefined;
  if (!stock) return <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground"><RefreshCw size={16} className="mr-2 animate-spin" />Loading stock…</div>;
  return <div className="space-y-5">
    {sections.map(({ key, title, subtitle, icon: Icon, tone, empty }) => {
      const rows = machineStock.filter((item) => categoryOf(item) === key);
      return <Panel key={key}><PanelHeader title={title} subtitle={subtitle} kicker="Stock on this machine" icon={<Icon size={16} />} action={reconciliationHref && key === "RAW_MATERIAL" ? <Button size="small" variant="tertiary" onClick={() => router.push(reconciliationHref)}><Scale size={13} /> Check and record</Button> : undefined} />
        <div className="space-y-3 p-4">{rows.length === 0 ? <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{empty}</div> : rows.map((batch) => { const low = isLowStock(batch); const remainingPercent = batch.issuedQuantity > 0 ? Math.max(0, Math.min(100, (batch.currentRemaining / batch.issuedQuantity) * 100)) : 0; return <div key={batch._id} className="rounded-lg border border-border bg-background/40 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm font-semibold text-foreground">{batch.materialName}</strong>{batch.inkColor ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{batch.inkColor}</span> : null}{low ? <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger"><AlertTriangle size={11} /> Low stock</span> : null}</div><p className="mt-1 text-[10px] text-muted-foreground">{formatQuantity(batch.currentRemaining, batch.baseUnit)} remaining of {formatQuantity(batch.issuedQuantity, batch.baseUnit)}</p></div>{low ? <Button size="tiny" variant="secondary" onClick={() => router.push(`/dashboard/operator/${machineSlug ?? ""}/requests?material=${batch.materialName}`)}><Plus size={12} /> Add stock</Button> : null}</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-all", low ? "bg-danger" : remainingPercent <= 35 ? "bg-gold" : `bg-${tone}`)} style={{ width: `${remainingPercent}%` }} /></div><div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>{Math.round(remainingPercent)}% remaining</span><span>{formatQuantity(batch.consumed ?? batch.issuedQuantity - batch.currentRemaining, batch.baseUnit)} used</span></div><div className="mt-3 flex justify-end"><Button size="tiny" variant="tertiary" disabled={exhaustingId === batch._id} onClick={() => { setExhaustingId(batch._id); exhaustStock({ stockId: batch._id }).finally(() => setExhaustingId(null)); }}><Trash2 size={12} />{exhaustingId === batch._id ? "Closing…" : "Mark as used up"}</Button></div></div>; })}</div>
      </Panel>;
    })}
  </div>;
}
