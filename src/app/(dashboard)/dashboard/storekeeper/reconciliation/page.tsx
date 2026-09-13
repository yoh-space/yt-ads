"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Search } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { WorkspaceModuleGate } from "@/components/dashboard/shell/workspace-renderer";
import { NumericInput } from "@/components/shared/ui";
import type { AccessContext } from "@/lib/access-policy";

function unitLabel(unitType: "ROLL" | "SHEET" | "LITER") {
  return unitType === "ROLL" ? "ROLLS" : unitType === "SHEET" ? "SHEETS" : "CANISTERS";
}

export default function StorekeeperReconciliationPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const overview = useQuery(api.reconciliation.storekeeperOverview, profile?.active ? {} : "skip");
  const countParentInventory = useMutation(api.reconciliation.countParentInventory);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [count, setCount] = useState("");
  const [countValid, setCountValid] = useState(true);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!profile || !overview) {
    return <div className="flex min-h-[400px] items-center justify-center"><InventoryLoader label="Loading Storekeeper Reconciliation…" /></div>;
  }

  const accessContext: AccessContext = { profile: { role: profile.role, active: profile.active } };
  const selected = overview.items.find((item) => item.id === selectedId);
  const filteredItems = overview.items.filter((item) => `${item.materialName} ${item.category} ${item.storageLocation}`.toLowerCase().includes(search.toLowerCase()));
  const lowStock = overview.items.filter((item) => item.stockQuantity <= item.minThreshold && item.minThreshold > 0);

  async function submitCount() {
    if (!selected || !count.trim()) {
      toast.error("Select a material and enter its physical package count.");
      return;
    }
    const countedPackages = Number(count);
    if (!Number.isFinite(countedPackages) || countedPackages < 0) {
      toast.error("Physical count must be zero or greater.");
      return;
    }
    setIsSaving(true);
    try {
      await countParentInventory({
        parentInventoryId: selected.id as Id<"parentInventory">,
        countedPackages,
        note: note.trim() || undefined,
      });
      toast.success(`${selected.materialName} physical count recorded.`);
      setCount("");
      setNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record physical count.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <WorkspaceModuleGate context={accessContext} moduleId="inventory.reconciliation">
      <div className="space-y-6">
        <header className="flex flex-col gap-2 border-b border-border pb-5">
          <span className="font-mono text-xs uppercase tracking-widest text-primary">Parent Store Control</span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">የዋና መጋዘን ቤት ቆጠራ</h1>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <Metric label="Open counts" value={overview.openCount} tone="text-amber-500" />
          <Metric label="Shortages" value={overview.shortageCount} tone="text-destructive" />
          <Metric label="Surpluses" value={overview.surplusCount} tone="text-emerald-500" />
        </section>

        {lowStock.length > 0 ? (
          <section className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
            <AlertTriangle className="mt-0.5 text-amber-500" size={18} />
            <div><strong className="block">Low physical stock requires attention</strong><span className="text-sm">{lowStock.length} parent-store item(s) are at or below their minimum threshold.</span></div>
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <div><h2 className="font-semibold">Parent physical stock</h2><p className="text-xs text-muted-foreground">{overview.items.length} tracked packaging items</p></div>
              <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"><Search size={15} className="text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search material or bay" className="w-44 bg-transparent outline-none placeholder:text-muted-foreground" /></label>
            </div>
            <div className="divide-y divide-border">
              {filteredItems.map((item) => (
                <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`grid w-full gap-2 p-4 text-left transition hover:bg-muted/50 sm:grid-cols-[1fr_auto_auto] ${selectedId === item.id ? "bg-primary/10" : ""}`}>
                  <span><strong className="block">{item.materialName}</strong><small className="text-muted-foreground">{item.category} · {item.storageLocation}</small></span>
                  <span className="font-mono text-sm">{item.stockQuantity} {unitLabel(item.unitType)}</span>
                  <span className={item.lastVariance && item.lastVariance < 0 ? "text-destructive" : "text-muted-foreground"}>{item.lastStatus ?? "Not counted"}</span>
                </button>
              ))}
              {filteredItems.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No parent-store items match this search.</div> : null}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-5 flex items-center gap-3"><ClipboardCheck className="text-primary" size={20} /><div><h2 className="font-semibold">Record physical count</h2><p className="text-xs text-muted-foreground">Whole packaging units only</p></div></div>
            <div className="space-y-4">
              <label className="block text-sm"><span className="mb-1 block text-muted-foreground">Material</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2"><option value="">Select parent item</option>{overview.items.map((item) => <option key={item.id} value={item.id}>{item.materialName} · {unitLabel(item.unitType)}</option>)}</select></label>
               <label className="block text-sm"><span className="mb-1 block text-muted-foreground">Physical count {selected ? `(${unitLabel(selected.unitType)})` : ""}</span><NumericInput min={0} step="1" value={count} emptyValue={0} onChange={setCount} onValidityChange={setCountValid} className="w-full rounded-md border border-border bg-background px-3 py-2" /></label>
              <label className="block text-sm"><span className="mb-1 block text-muted-foreground">Note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2" placeholder="Bay, seal, or count notes" /></label>
               <button type="button" disabled={isSaving || !count.trim() || !countValid} onClick={() => void submitCount()} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">{isSaving ? "Saving…" : <><CheckCircle2 size={16} /> Record count</>}</button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-4"><h2 className="font-semibold">Recent physical counts</h2></div>
          <div className="divide-y divide-border">
            {overview.recentCounts.slice(0, 12).map((record) => <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span><strong>{record.materialName}</strong><small className="ml-2 text-muted-foreground">{new Date(record.createdAt).toLocaleString()}</small></span><span className="font-mono">{record.countedQuantity} {record.unit}</span><span className={record.variance < 0 ? "text-destructive" : record.variance > 0 ? "text-emerald-500" : "text-muted-foreground"}>{record.variance > 0 ? "+" : ""}{record.variance} variance</span><span className="text-muted-foreground">{record.status}</span></div>)}
            {overview.recentCounts.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No physical counts recorded yet.</div> : null}
          </div>
        </section>
      </div>
    </WorkspaceModuleGate>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-lg border border-border bg-card p-4"><span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span><strong className={`mt-2 block text-2xl font-mono ${tone}`}>{value}</strong></div>;
}
