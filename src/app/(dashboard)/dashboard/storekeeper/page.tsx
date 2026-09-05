"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ArrowDownToLine, Download, Package, Plus, Search, Truck } from "lucide-react";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { MaterialRequestsPanel } from "@/components/dashboard/material-requests-panel";
import { useSafeMutation } from "@/components/dashboard/pending-store";
import { useDashboardModal } from "@/components/dashboard/modal-context";
import { StatusPill } from "@/components/ui/status-pill";
import type { MaterialRequest } from "@/lib/operations-types";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };
type PackagingTab = "ALL" | "ROLL" | "SHEET" | "LITER";

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map(({ _id, ...rest }) => ({ ...rest, id: _id }));
}

function unitLabel(unitType: string) {
  return unitType === "ROLL" ? "ROLLS" : unitType === "SHEET" ? "SHEETS" : "CANISTERS";
}

function physicalQuantity(quantity: number, unitType: string) {
  return `${Number(quantity.toFixed(1))} ${unitLabel(unitType)}`;
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function StorekeeperDashboardPage() {
  const router = useRouter();
  const profile = useQuery(api.users.getCurrentProfile);
  const isActive = profile?.active === true;
  const parentInventory = useQuery(api.inventory.listParentInventory, isActive ? {} : "skip");
  const materialRequests = useQuery(api.materialRequests.list, isActive ? {} : "skip");
  const systemConfig = useQuery(api.systemConfigs.getStorekeeperConfig, isActive ? {} : "skip");
  const { isPending, safeMutation } = useSafeMutation();
  const { openModal } = useDashboardModal();
  const issueMaterialRequest = useMutation(api.materialRequests.issue);
  const acknowledgeMaterialRequest = useMutation(api.materialRequests.acknowledge);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<PackagingTab>("ALL");

  const requests = withIds(materialRequests ?? []) as unknown as MaterialRequest[];
  const items = parentInventory ?? [];
  const pendingRequests = requests.filter((request) => request.status === "Requested" || request.status === "Partially Issued");

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesTab = activeTab === "ALL" || item.unitType === activeTab;
      const matchesSearch =
        !query ||
        [item.materialName, item.materialCategory, item.unitType, item.storageLocation]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchesTab && matchesSearch;
    });
  }, [activeTab, items, searchTerm]);

  const totals = useMemo(
    () => ({
      rolls: items.filter((item) => item.unitType === "ROLL").reduce((sum, item) => sum + item.totalStockQuantity, 0),
      sheets: items.filter((item) => item.unitType === "SHEET").reduce((sum, item) => sum + item.totalStockQuantity, 0),
      inks: items.filter((item) => item.unitType === "LITER").reduce((sum, item) => sum + item.totalStockQuantity, 0),
    }),
    [items],
  );

  const lowStockItems = items.filter((item) => {
    const threshold = item.conversionFactor ? item.reorderAt / item.conversionFactor : item.reorderAt;
    return threshold > 0 && item.totalStockQuantity <= threshold;
  });

  function exportCsv() {
    const header = ["MATERIAL SKU & SPEC", "PACKAGING UNIT", "PHYSICAL STOCK", "MIN THRESHOLD", "BAY LOCATION"];
    const rows = filteredItems.map((item) => [
      item.materialName,
      unitLabel(item.unitType),
      item.totalStockQuantity,
      item.conversionFactor ? Math.ceil(item.reorderAt / item.conversionFactor) : item.reorderAt,
      item.storageLocation,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "parent-physical-inventory.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!profile || parentInventory === undefined || materialRequests === undefined || systemConfig === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading Storekeeper Central Stock…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">CENTRAL STORE / LIVE LEDGER</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">የዋና ዕቃ ግምጃ ቤት ቁጥጥር</h1>
          <p className="mt-1 text-xs text-muted-foreground">Parent stock is controlled in discrete physical packaging units.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-foreground" onClick={() => router.push("/inventory/parent")}>
            የመንገዶች ዝውውር መዝገብ
          </button>
          <span className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-500">
            የዕቃ ወጪ ጥያቄዎች <b>{pendingRequests.length}</b>
          </span>
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90" onClick={() => openModal("stock")}>
            <Plus size={14} /> አዲስ እቃ ገቢ አድርግ
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "የሮል እቃዎች", value: totals.rolls, unit: "ROLLS", detail: "Starflex 500g · Stickers/Vinyl", tone: "text-primary" },
          { label: "የአክሪሊክ እና ፎም ሺቶች", value: totals.sheets, unit: "SHEETS", detail: "Acrylic 3mm · Forex PVC 5mm", tone: "text-emerald-500" },
          { label: "ቀለሞች እና ኬሚካሎች", value: totals.inks, unit: "CANISTERS", detail: "CMYK Balance: C, M, Y, K", tone: "text-purple-300" },
          { label: "ፈቃድ የሚጠብቁ ጥያቄዎች", value: pendingRequests.length, unit: "PENDING", detail: "Immediate floor handover", tone: "text-amber-500" },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-4 shadow-custom">
            <p className="text-xs font-semibold text-muted-foreground">{card.label}</p>
            <div className="mt-3 flex items-end justify-between gap-2">
              <strong className={`font-mono text-3xl tabular-nums ${card.tone}`}>{Number(card.value.toFixed(1))}</strong>
              <span className={`font-mono text-[10px] font-bold ${card.tone}`}>{card.unit}</span>
            </div>
            <p className="mt-3 truncate text-[11px] text-muted-foreground">{card.detail}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.85fr)_minmax(320px,1fr)]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-custom">
          <div className="flex flex-col gap-4 border-b border-border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">PARENT PHYSICAL STOCK</p>
                <h2 className="mt-1 text-lg font-bold text-foreground">የዋና ግምጃ ቤት ዕቃዎች ዝርዝር</h2>
                <p className="mt-1 text-xs text-muted-foreground">Showing {filteredItems.length} of {items.length} Items</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search SKU, sheet size, ink, bay…" className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
              </div>
            </div>
            <div className="flex gap-1 border-b border-border">
              {(["ALL", "ROLL", "SHEET", "LITER"] as PackagingTab[]).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`border-b-2 px-3 py-2 font-mono text-[10px] font-bold tracking-wider transition ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {tab === "LITER" ? "INKS" : `${tab}${tab === "ALL" ? "" : "S"}`}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-background/70 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Material SKU & Spec</th><th className="px-4 py-3">Packaging Unit</th><th className="px-4 py-3 text-right">Physical Stock</th><th className="px-4 py-3 text-right">Min Threshold</th><th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {filteredItems.length === 0 ? <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">No physical inventory matches this view.</td></tr> : filteredItems.map((item) => {
                  const threshold = item.conversionFactor ? Math.ceil(item.reorderAt / item.conversionFactor) : item.reorderAt;
                  const low = threshold > 0 && item.totalStockQuantity <= threshold;
                  return (
                    <tr key={item._id} className="transition hover:bg-muted/30">
                      <td className="px-5 py-3"><p className="font-semibold text-foreground">{item.materialName}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{item.materialCategory} · {item.storageLocation}</p></td>
                      <td className="px-4 py-3"><span className="rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">{unitLabel(item.unitType)}</span></td>
                      <td className={`px-4 py-3 text-right font-mono font-bold tabular-nums ${low ? "text-amber-500" : "text-foreground"}`}>{physicalQuantity(item.totalStockQuantity, item.unitType)}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{threshold || "—"}</td>
                      <td className="px-5 py-3 text-right"><button className="inline-flex items-center gap-1 rounded border border-primary/40 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/10" onClick={() => toast.info("Select an operator request to complete the handover.")}><Truck size={12} /> Hand Over</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-2"><Package size={13} /> Physical Store Ledger: Verified by Head Storekeeper{systemConfig.updatedAt ? " · Config synced" : ""}</span>
            <button onClick={exportCsv} className="inline-flex items-center gap-1 font-semibold text-primary hover:text-primary/80"><Download size={13} /> Export Discrete Inventory CSV →</button>
          </div>
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">FLOOR MATERIAL REQUISITIONS</p><h2 className="mt-1 text-lg font-bold text-foreground">የኦፕሬተሮች የዕቃ ጥያቄ መከታተያ</h2></div>
            <StatusPill variant="warning">PENDING</StatusPill>
          </div>
          <MaterialRequestsPanel requests={requests} role="storekeeper" onRequest={() => {}} onIssue={(requestId, quantity) => void safeMutation(`issue-${requestId}`, issueMaterialRequest({ requestId: requestId as Id<"materialRequests">, issuedQuantity: quantity }), () => toast.success("Material handed over to operator"))} onAcknowledge={(requestId) => void safeMutation(`ack-${requestId}`, acknowledgeMaterialRequest({ requestId: requestId as Id<"materialRequests"> }), () => toast.success("Material receipt acknowledged"))} isPending={isPending} />
        </section>
      </div>

      {lowStockItems.length > 0 ? (
        <aside className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><ArrowDownToLine className="mt-0.5 text-destructive" size={18} /><div><p className="font-semibold text-foreground">Critical reorder alert</p><p className="text-xs text-muted-foreground">{lowStockItems.map((item) => `${item.materialName}: ${physicalQuantity(item.totalStockQuantity, item.unitType)} vs ${item.reorderAt > 0 ? "minimum threshold" : "required threshold"}`).join(" · ")}</p></div></div>
          <button onClick={() => toast.success("Reorder request queued for manager review.")} className="shrink-0 rounded-md bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground hover:bg-destructive/90">Generate Reorder Request</button>
        </aside>
      ) : null}
    </div>
  );
}
