"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Download, Package, Plus, Search, Truck } from "lucide-react";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { WorkspaceModuleGate } from "@/components/dashboard/shell/workspace-renderer";
import { RawMaterialStockInModal } from "@/components/dashboard/modals/raw-material-stock-in-modal";
import type { AccessContext } from "@/lib/access-policy";

type PackagingTab = "ALL" | "ROLL" | "SHEET" | "LITER";

function unitLabel(unitType: string) {
  return unitType === "ROLL" ? "ROLLS" : unitType === "SHEET" ? "SHEETS" : "CANISTERS";
}

function physicalQuantity(quantity: number, unitType: string) {
  return `${Number(quantity.toFixed(1))} ${unitLabel(unitType)}`;
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function StorekeeperInventoryPage() {
  const router = useRouter();
  const profile = useQuery(api.users.getCurrentProfile);
  const parentInventory = useQuery(api.storekeeper.parentInventory.list);
  const systemConfig = useQuery(api.systemConfigs.getStorekeeperConfig);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<PackagingTab>("ALL");
  const [stockInOpen, setStockInOpen] = useState(false);

  const items = parentInventory ?? [];
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

  if (!profile || parentInventory === undefined || systemConfig === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Storekeeper Central Stock…" />
      </div>
    );
  }

  const accessContext: AccessContext = {
    profile: { role: profile.role, active: profile.active },
  };

  function exportCsv() {
    const header = ["የእቃ ስም እና መግለጫ", "PACKAGE TYPE", "STOCK ON HAND", "MINIMUM LEVEL", "STORAGE BAY"];
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

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Main Store · የዋና ዕቃ መጋዘንስ"
        title="Inventory"
      />

      <WorkspaceModuleGate context={accessContext} moduleId="inventory.parent-stock">
        <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-custom">
          <div className="flex flex-col gap-4 border-b border-border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">የዋና መጋዘን እቃዎች</p>
                <h2 className="mt-1 text-lg font-bold text-foreground">የዋና መጋዘን ዕቃዎች ዝርዝር</h2>
                <p className="mt-1 text-xs text-muted-foreground">Showing {filteredItems.length} of {items.length} Items</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setStockInOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
                >
                  <Plus size={14} /> አዲስ እቃ ገቢ እና ወጭ አድርግ
                </button>
                <div className="relative w-full sm:w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search material name, sheet size, ink, or bay…"
                    className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-1 border-b border-border">
              {(["ALL", "ROLL", "SHEET", "LITER"] as PackagingTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`border-b-2 px-3 py-2 font-mono text-[10px] font-bold tracking-wider transition ${
                    activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "LITER" ? "INKS" : `${tab}${tab === "ALL" ? "" : "S"}`}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-background/70 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">የእቃ ስም እና መግለጫ</th>
                  <th className="px-4 py-3">Package Type</th>
                  <th className="px-4 py-3 text-right">Stock on Hand</th>
                  <th className="px-4 py-3 text-right">Minimum Level</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                      No physical inventory matches this view.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const threshold = item.conversionFactor ? Math.ceil(item.reorderAt / item.conversionFactor) : item.reorderAt;
                    const low = item.lowStock;
                    return (
                      <tr key={item._id} className="transition hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-foreground">{item.materialName}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{item.materialCategory} · {item.storageLocation}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded border border-border bg-muted px-2 py-1 font-mono text-[10px] font-bold text-black">
                            {unitLabel(item.unitType)}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-bold tabular-nums ${low ? "text-amber-500" : "text-foreground"}`}>
                          {physicalQuantity(item.totalStockQuantity, item.unitType)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">{threshold || "—"}</td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => router.push("/dashboard/storekeeper/requisitions")}
                            className="inline-flex items-center gap-1 rounded border border-primary/40 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/10"
                          >
                            <Truck size={12} /> Hand Over
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
            <button onClick={exportCsv} className="inline-flex items-center gap-1 font-semibold text-primary hover:text-primary/80">
              <Download size={13} /> Export Discrete Inventory CSV →
            </button>
          </div>
        </section>
      </WorkspaceModuleGate>

      {stockInOpen && (
        <RawMaterialStockInModal onClose={() => setStockInOpen(false)} />
      )}
    </div>
  );
}
