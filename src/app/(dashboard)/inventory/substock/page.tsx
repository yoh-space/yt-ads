"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AlertTriangle, Boxes, Lock, Plus, RefreshCw, Trash2 } from "lucide-react";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { useDashboardModal } from "@/components/dashboard/modal-context";
import { StatusPill } from "@/components/ui/status-pill";
import { formatQuantity } from "@/lib/units";

export default function SubStockInventoryPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const unclearedStockQuery = useQuery(api.inventory.myUnclearedStock, profile?.active ? {} : "skip");
  const floorStockQuery = useQuery(api.inventory.listOperatorMachineStock, profile?.active ? {} : "skip");
  const exhaustStock = useMutation(api.inventory.exhaustOperatorStock);

  const { openModal } = useDashboardModal();
  const [exhaustingId, setExhaustingId] = useState<string | null>(null);

  if (!profile || unclearedStockQuery === undefined || floorStockQuery === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading Floor Sub-Stock…" />
      </div>
    );
  }

  // Clearance Gate Rule: If active sub-stock status is PENDING_CLEARANCE,
  // disable material request actions and display clearance alert banner
  const hasPendingClearance = (unclearedStockQuery ?? []).some(
    (b) => b.status === "PENDING_CLEARANCE"
  );

  return (
    <div className="space-y-6">
      {/* Clearance Gate Banner */}
      {hasPendingClearance ? (
        <div className="flex items-center gap-3 p-4 rounded-sm border border-amber-500/50 bg-amber-950/40 text-amber-200">
          <div className="flex-none p-2 rounded-sm bg-amber-500/20 text-amber-400">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <strong className="text-sm font-bold text-amber-300">
                CLEARANCE GATE: PENDING APPROVAL
              </strong>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                LOCKED
              </span>
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5">
              Weekly reconciliation clearance is currently pending manager or owner approval. Sub-stock material requests are locked until clearance is verified.
            </p>
          </div>
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-5">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[#00B4D8]">
            Tier 2 Production Floor
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
            Machine Sub-Stock Register
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Active material batches issued to operator workstations and machines.
          </p>
        </div>
        <button
          type="button"
          disabled={hasPendingClearance}
          onClick={() => openModal("request")}
          title={
            hasPendingClearance
              ? "Material requests locked: weekly reconciliation clearance pending"
              : "Submit material requisition"
          }
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm text-xs font-semibold transition-colors ${
            hasPendingClearance
              ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
              : "bg-[#00B4D8] text-[#0B132B] hover:bg-[#90E0EF]"
          }`}
        >
          {hasPendingClearance ? <Lock size={13} /> : <Plus size={13} />}
          {hasPendingClearance ? "Requisition Locked" : "Request Material"}
        </button>
      </div>

      {/* Sub-stock Batches Table */}
      <div className="border border-[#1E293B] rounded-sm bg-[#14161D]">
        <div className="p-4 border-b border-[#1E293B]">
          <h2 className="text-base font-bold text-white">Active Floor Batches</h2>
          <p className="text-xs text-slate-400">Current balances at each workstation</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1E293B] bg-[#0C0D10]/50 font-mono text-[10px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Assigned Workstation</th>
                <th className="px-4 py-3 text-right">Issued Quantity</th>
                <th className="px-4 py-3 text-right">Remaining Balance</th>
                <th className="px-4 py-3 text-center">Clearance Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B] text-slate-300 font-mono">
              {(floorStockQuery ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No active sub-stock batches issued to floor machines.
                  </td>
                </tr>
              ) : (
                (floorStockQuery ?? []).map((batch) => (
                  <tr key={batch._id} className="hover:bg-[#1E293B]/40 transition-colors">
                    <td className="px-4 py-3 font-sans font-semibold text-white">
                      {batch.materialName}
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-300">
                      {batch.machineName}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {formatQuantity(batch.issuedQuantity, batch.baseUnit)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">
                      {formatQuantity(batch.currentRemaining, batch.baseUnit)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusPill
                        variant={
                          batch.status === "ACTIVE"
                            ? "success"
                            : batch.status === "PENDING_CLEARANCE"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {batch.status}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {batch.status === "ACTIVE" ? (
                        <button
                          type="button"
                          disabled={exhaustingId === batch._id}
                          onClick={() => {
                            setExhaustingId(batch._id);
                            exhaustStock({ stockId: batch._id }).finally(() =>
                              setExhaustingId(null)
                            );
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-[#1E293B] bg-[#0C0D10] text-[10px] text-slate-400 hover:text-rose-400 hover:border-rose-500 transition-colors"
                        >
                          <Trash2 size={11} />
                          {exhaustingId === batch._id ? "Exhausting…" : "Mark Exhausted"}
                        </button>
                      ) : (
                        <span className="text-slate-600 text-[10px] font-sans">Locked</span>
                      )}
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
