"use client";

import { use, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { WorkspaceModuleGate } from "@/components/dashboard/workspace-renderer";
import type { AccessContext } from "@/lib/access-policy";
import type { Machine } from "@/lib/operations-types";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map(({ _id, ...rest }) => ({ ...rest, id: _id }));
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

export default function OperatorReconciliationPage({
  params,
}: {
  params: Promise<{ machine: string }>;
}) {
  const { machine: machineParam } = use(params);
  const profile = useQuery(api.users.getCurrentProfile);
  const state = useQuery(api.dashboard.getState, profile?.active ? {} : "skip");
  const stock = useQuery(api.inventory.listOperatorMachineStock, profile?.active ? {} : "skip");
  const reconcile = useMutation(api.inventory.performWeeklyReconciliation);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  if (!profile || !state || stock === undefined) {
    return <div className="flex min-h-[400px] items-center justify-center"><InventoryLoader label="Loading Stock Reconciliation…" /></div>;
  }

  const machines = withIds(state.machines) as Machine[];
  const machine = machines.find((entry) => entry.type.toLowerCase().includes(machineParam.toLowerCase()) || entry.code.toLowerCase().includes(machineParam.toLowerCase()));
  const machineStock = stock.filter((entry) => entry.machineId === machine?.id && entry.status === "ACTIVE");
  const accessContext: AccessContext = {
    profile: { role: profile.role, active: profile.active },
    attributes: { machineId: machine?.id, machineType: machineParam as "laser" | "cnc" | "plotter" | "printer" },
  };

  async function submitCount(stockId: Id<"operatorSubStock">, systemRemaining: number, unit: string) {
    const physical = counts[stockId];
    if (physical === undefined || !Number.isFinite(physical) || physical < 0) {
      toast.error("Enter a valid physical remaining count.");
      return;
    }
    setSavingId(stockId);
    try {
      await reconcile({
        operatorSubStockId: stockId,
        physicalActualRemaining: physical,
        notes: notes[stockId]?.trim() || undefined,
      });
      toast.success(`Clearance submitted: ${formatNumber(physical)} ${unit} recorded.`);
      setCounts((current) => {
        const next = { ...current };
        delete next[stockId];
        return next;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit clearance.");
    } finally {
      setSavingId(null);
    }
    void systemRemaining;
  }

  return (
    <WorkspaceModuleGate context={accessContext} moduleId="reconciliation.operator">
      <div className="space-y-6">
        <header className="border-b border-border pb-5">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">MACHINE RECONCILIATION</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Request Stock Clearance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Count every active floor-stock batch before requesting new material. Owner or manager approval unlocks the next stock cycle.
          </p>
        </header>

        {machineStock.length === 0 ? (
          <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 text-emerald-500" size={20} />
              <div>
                <h2 className="font-semibold text-foreground">No active stock requires clearance</h2>
                <p className="mt-1 text-sm text-muted-foreground">You may request material for an active job when needed.</p>
              </div>
            </div>
          </section>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
              <AlertTriangle size={18} className="text-amber-500" />
              <span>New stock requests stay locked until these batches are counted and cleared.</span>
            </div>
            {machineStock.map((batch) => {
              const physical = counts[batch._id] ?? batch.currentRemaining;
              const discrepancy = physical - batch.currentRemaining;
              return (
                <section key={batch._id} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-foreground">{batch.materialName}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">{machine?.name ?? machineParam} · Issued {formatNumber(batch.issuedQuantity)} {batch.baseUnit}</p>
                    </div>
                    <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 font-mono text-[10px] font-bold text-amber-400">ACTIVE</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded border border-border bg-background p-3"><p className="text-xs text-muted-foreground">System remaining</p><strong className="font-mono text-lg text-foreground">{formatNumber(batch.currentRemaining)} {batch.baseUnit}</strong></div>
                    <label className="rounded border border-border bg-background p-3"><span className="block text-xs text-muted-foreground">Physical count</span><input type="number" min="0" step="0.001" value={physical} onChange={(event) => setCounts((current) => ({ ...current, [batch._id]: Number(event.target.value) }))} className="mt-1 w-full bg-transparent font-mono text-lg text-foreground outline-none" /></label>
                    <div className="rounded border border-border bg-background p-3"><p className="text-xs text-muted-foreground">Difference</p><strong className={discrepancy < 0 ? "font-mono text-lg text-destructive" : "font-mono text-lg text-emerald-500"}>{discrepancy > 0 ? "+" : ""}{formatNumber(discrepancy)} {batch.baseUnit}</strong></div>
                  </div>
                  <textarea value={notes[batch._id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [batch._id]: event.target.value }))} rows={2} placeholder="Add a note about waste, damage, or the physical count (optional)" className="mt-3 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                  <button type="button" disabled={savingId === batch._id} onClick={() => void submitCount(batch._id, batch.currentRemaining, batch.baseUnit)} className="mt-3 inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"><ClipboardCheck size={14} />{savingId === batch._id ? "Submitting…" : "Submit for Clearance"}</button>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </WorkspaceModuleGate>
  );
}
