"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Boxes, PackagePlus, Plus, Search } from "lucide-react";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { useDashboardModal } from "@/components/dashboard/modal-context";
import { StatusPill } from "@/components/ui/status-pill";

export default function ParentInventoryPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const parentInventory = useQuery(api.inventory.listParentInventory, profile?.active ? {} : "skip");
  const { openModal } = useDashboardModal();

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  if (!profile || parentInventory === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading Central Packaging Inventory…" />
      </div>
    );
  }

  function formatPackagingUnit(quantity: number, unitType: "ROLL" | "SHEET" | "LITER" | string): string {
    const formattedNum = Number(quantity.toFixed(1));
    switch (unitType) {
      case "ROLL":
        return `${formattedNum} ROLLS`;
      case "SHEET":
        return `${formattedNum} SHEETS`;
      case "LITER":
        return `${formattedNum} CANISTERS (1L)`;
      default:
        return `${formattedNum} UNITS`;
    }
  }

  const filteredItems = (parentInventory ?? []).filter((item) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch =
      item.materialName.toLowerCase().includes(query) ||
      item.materialCategory.toLowerCase().includes(query) ||
      item.unitType.toLowerCase().includes(query);

    const matchesCategory =
      categoryFilter === "ALL" ||
      (categoryFilter === "ROLL" && item.unitType === "ROLL") ||
      (categoryFilter === "SHEET" && item.unitType === "SHEET") ||
      (categoryFilter === "LITER" && item.unitType === "LITER");

    return matchesSearch && matchesCategory;
  });

  const totalRolls = (parentInventory ?? [])
    .filter((i) => i.unitType === "ROLL")
    .reduce((sum, i) => sum + i.totalStockQuantity, 0);

  const totalSheets = (parentInventory ?? [])
    .filter((i) => i.unitType === "SHEET")
    .reduce((sum, i) => sum + i.totalStockQuantity, 0);

  const totalCanisters = (parentInventory ?? [])
    .filter((i) => i.unitType === "LITER")
    .reduce((sum, i) => sum + i.totalStockQuantity, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-5">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[#00B4D8]">
            Tier 1 Central Store
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
            Parent Packaging Stock Register
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Raw materials stored and counted exclusively by physical package unit (Rolls, Sheets, Canisters). Zero square meter (m²) metrics displayed.
          </p>
        </div>
        <button
          onClick={() => openModal("stock")}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-[#00B4D8] text-xs font-semibold text-[#0B132B] hover:bg-[#90E0EF] transition-colors"
        >
          <Plus size={14} /> Intake Packaging Stock
        </button>
      </div>

      {/* Physical Units Metric Cards — Strictly NO m² */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-sm border border-[#1E293B] bg-[#14161D]">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Total Rolls in Central Store
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-white tabular-nums">
              {Number(totalRolls.toFixed(1))}
            </span>
            <span className="font-mono text-xs font-semibold text-[#00B4D8]">ROLLS</span>
          </div>
        </div>

        <div className="p-4 rounded-sm border border-[#1E293B] bg-[#14161D]">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Total Sheets in Central Store
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-white tabular-nums">
              {Number(totalSheets.toFixed(1))}
            </span>
            <span className="font-mono text-xs font-semibold text-[#38B000]">SHEETS</span>
          </div>
        </div>

        <div className="p-4 rounded-sm border border-[#1E293B] bg-[#14161D]">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Total Canisters in Central Store
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-white tabular-nums">
              {Number(totalCanisters.toFixed(1))}
            </span>
            <span className="font-mono text-xs font-semibold text-[#FFB703]">1L/5L CANISTERS</span>
          </div>
        </div>
      </div>

      {/* Parent Packaging Inventory Table */}
      <div className="border border-[#1E293B] rounded-sm bg-[#14161D]">
        <div className="p-4 border-b border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {["ALL", "ROLL", "SHEET", "LITER"].map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-2.5 py-1 rounded-sm text-[11px] font-semibold transition-colors ${
                  categoryFilter === c
                    ? "bg-[#00B4D8] text-[#0B132B]"
                    : "bg-[#0C0D10] text-slate-400 hover:text-white"
                }`}
              >
                {c === "ALL" ? "All Units" : c === "LITER" ? "Canisters" : `${c}s`}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search packaging item…"
              className="w-full pl-8 pr-3 py-1.5 rounded-sm border border-[#1E293B] bg-[#0C0D10] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00B4D8]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1E293B] bg-[#0C0D10]/50 font-mono text-[10px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Material Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Unit Packaging Form</th>
                <th className="px-4 py-3 text-right">Central Stock Quantity</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B] text-slate-300 font-mono">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No packaging inventory matches your search.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item._id} className="hover:bg-[#1E293B]/40 transition-colors">
                    <td className="px-4 py-3 font-sans font-semibold text-white">
                      {item.materialName}
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-sans">
                      {item.materialCategory}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-sm bg-[#1E293B] text-[10px] text-slate-300">
                        {item.unitType === "ROLL"
                          ? "ROLL"
                          : item.unitType === "SHEET"
                            ? "SHEET"
                            : "1L CANISTER"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">
                      {formatPackagingUnit(item.totalStockQuantity, item.unitType)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusPill variant={item.totalStockQuantity > 0 ? "success" : "danger"}>
                        {item.totalStockQuantity > 0 ? "AVAILABLE" : "OUT OF STOCK"}
                      </StatusPill>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
