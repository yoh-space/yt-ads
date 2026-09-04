"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Plus, Search } from "lucide-react";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { MaterialRequestsPanel } from "@/components/dashboard/material-requests-panel";
import { useSafeMutation } from "@/components/dashboard/pending-store";
import { useDashboardModal } from "@/components/dashboard/modal-context";
import { StatusPill } from "@/components/ui/status-pill";
import type { MaterialRequest } from "@/lib/operations-types";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  });
}

export default function StorekeeperDashboardPage() {
  const router = useRouter();
  const profile = useQuery(api.users.getCurrentProfile);
  const parentInventory = useQuery(api.inventory.listParentInventory, profile?.active ? {} : "skip");
  const materialRequests = useQuery(api.materialRequests.list, profile?.active ? {} : "skip");
  const { isPending, safeMutation } = useSafeMutation();
  const { openModal } = useDashboardModal();

  const issueMaterialRequest = useMutation(api.materialRequests.issue);
  const acknowledgeMaterialRequest = useMutation(api.materialRequests.acknowledge);
  const [searchTerm, setSearchTerm] = useState("");

  if (!profile || parentInventory === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading Storekeeper Central Stock…" />
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
        return `${formattedNum} CANISTERS (1L/5L)`;
      default:
        return `${formattedNum} UNITS`;
    }
  }

  const requests = withIds(materialRequests ?? []) as unknown as MaterialRequest[];

  const filteredItems = (parentInventory ?? []).filter((item) => {
    const query = searchTerm.toLowerCase();
    return (
      item.materialName.toLowerCase().includes(query) ||
      item.materialCategory.toLowerCase().includes(query) ||
      item.unitType.toLowerCase().includes(query)
    );
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
            Central Store Station
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
            Storekeeper Packaging Inventory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Parent inventory tracked strictly in physical packaging units (Rolls, Sheets, Canisters).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/inventory/parent")}
            className="px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-semibold text-slate-300 hover:text-white hover:border-[#00B4D8] transition-colors"
          >
            Full Packaging Ledger
          </button>
          <button
            onClick={() => openModal("stock")}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-[#00B4D8] text-xs font-semibold text-[#0B132B] hover:bg-[#90E0EF] transition-colors"
          >
            <Plus size={14} /> Receive Packaging Stock
          </button>
        </div>
      </div>

      {/* Packaging Units Metric Cards — STRICTLY PHYSICAL UNITS (Zero m² Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-sm border border-[#1E293B] bg-[#14161D]">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Total Rolls in Stock
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
            Total Sheets in Stock
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
            Total Canisters in Stock
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-white tabular-nums">
              {Number(totalCanisters.toFixed(1))}
            </span>
            <span className="font-mono text-xs font-semibold text-[#FFB703]">1L/5L CANISTERS</span>
          </div>
        </div>
      </div>

      {/* Pending Material Requests from Operators */}
      <div className="border border-[#1E293B] rounded-sm bg-[#14161D] p-5">
        <div className="mb-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#00B4D8]">
            Operator Requests
          </span>
          <h2 className="text-base font-bold text-white mt-0.5">Floor Material Requisitions</h2>
        </div>
        <MaterialRequestsPanel
          requests={requests}
          role="storekeeper"
          onRequest={() => {}}
          onIssue={(requestId, qty) => {
            void safeMutation(
              `issue-${requestId}`,
              issueMaterialRequest({
                requestId: requestId as Id<"materialRequests">,
                issuedQuantity: qty,
              }),
              () => toast.success("Material issued to operator")
            );
          }}
          onAcknowledge={(requestId) => {
            void safeMutation(
              `ack-${requestId}`,
              acknowledgeMaterialRequest({
                requestId: requestId as Id<"materialRequests">,
              }),
              () => toast.success("Material receipt acknowledged")
            );
          }}
          isPending={isPending}
        />
      </div>

      {/* Parent Packaging Inventory Table — ZERO m² metrics */}
      <div className="border border-[#1E293B] rounded-sm bg-[#14161D]">
        <div className="p-4 border-b border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Central Store Parent Inventory</h2>
            <p className="text-xs text-slate-400">Tracked exclusively by physical package unit</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search packaging stock…"
              className="w-full pl-8 pr-3 py-1.5 rounded-sm border border-[#1E293B] bg-[#0C0D10] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00B4D8]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1E293B] bg-[#0C0D10]/50 font-mono text-[10px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Packaging Type</th>
                <th className="px-4 py-3 text-right">Available Packaging Stock</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B] text-slate-300 font-mono">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No packaging inventory items found.
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
                            : "1L/5L CANISTER"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">
                      {formatPackagingUnit(item.totalStockQuantity, item.unitType)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusPill variant={item.totalStockQuantity > 0 ? "success" : "danger"}>
                        {item.totalStockQuantity > 0 ? "IN STOCK" : "DEPLETED"}
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
