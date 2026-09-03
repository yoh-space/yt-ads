"use client";

import { AlertTriangle, CheckCircle2, ClipboardCheck, Scale } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Button, StatusPill } from "@/components/ui";
import { ModalShell } from "../modals/modal-shell";
import { useState } from "react";

function formatNumber(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

export function WeeklyReconciliationModal({ onClose }: { onClose: () => void }) {
  const stock = useQuery(api.inventory.listOperatorMachineStock);
  const reconcile = useMutation(api.inventory.performWeeklyReconciliation);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const activeStock = stock?.filter((s) => s.status === "ACTIVE") || [];

  const handleSubmit = async (stockId: string) => {
    const physical = physicalCounts[stockId];
    if (physical === undefined) return;
    
    setSubmittingId(stockId);
    try {
      await reconcile({
        operatorSubStockId: stockId as any,
        physicalActualRemaining: physical,
        notes: notes[stockId],
      });
      setPhysicalCounts((prev) => {
        const next = { ...prev };
        delete next[stockId];
        return next;
      });
      setNotes((prev) => {
        const next = { ...prev };
        delete next[stockId];
        return next;
      });
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <ModalShell
      title="Weekly Floor Stock Reconciliation"
      subtitle="Compare physical counts against system-calculated remaining stock"
      kicker="WEEKLY AUDIT"
      onClose={onClose}
      footer={
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="tertiary" onClick={onClose}>Close</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {activeStock.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            No active floor stock to reconcile.
          </div>
        ) : (
          activeStock.map((batch) => {
            const physical = physicalCounts[batch._id] ?? batch.currentRemaining;
            const discrepancy = Number((physical - batch.currentRemaining).toFixed(3));
            const hasDiscrepancy = Math.abs(discrepancy) > 0.001;
            const isShortage = discrepancy < 0;
            
            return (
              <div
                key={batch._id}
                className="p-4 bg-white border border-line rounded-lg space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <strong className="text-sm font-semibold text-navy">{batch.materialName}</strong>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{batch.machineName}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{batch.baseUnit}</span>
                    </div>
                  </div>
                  <StatusPill variant={batch.status === "ACTIVE" ? "success" : "warning"}>
                    {batch.status}
                  </StatusPill>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="block text-xs text-gray-500 mb-1">System Remaining</span>
                    <strong className="text-navy">{formatNumber(batch.currentRemaining)}</strong>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 mb-1">Physical Count</span>
                    <input
                      type="number"
                      step="0.001"
                      value={physical}
                      onChange={(e) => setPhysicalCounts((prev) => ({ ...prev, [batch._id]: Number(e.target.value) }))}
                      className={cn(
                        "w-full px-2 py-1 border border-line rounded text-sm text-ink outline-none focus:border-cyan",
                        hasDiscrepancy && "border-coral/50 bg-coral/5"
                      )}
                    />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 mb-1">Discrepancy</span>
                    <span className={cn("font-medium", isShortage ? "text-coral" : hasDiscrepancy ? "text-green" : "text-gray-600")}>
                      {isShortage ? "-" : hasDiscrepancy ? "+" : ""}{formatNumber(Math.abs(discrepancy))}
                    </span>
                  </div>
                </div>

                {hasDiscrepancy && (
                  <div className="flex items-start gap-2 p-2 bg-gold/10 border border-gold/20 rounded">
                    <AlertTriangle size={14} className="text-gold flex-none mt-0.5" />
                    <span className="text-xs text-gray-600">
                      {isShortage ? "Shortage detected" : "Surplus detected"}: {formatNumber(Math.abs(discrepancy))} {batch.baseUnit}
                    </span>
                  </div>
                )}

                <label className="block">
                  <span className="block text-xs text-gray-500 mb-1">Notes (optional)</span>
                  <textarea
                    value={notes[batch._id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [batch._id]: e.target.value }))}
                    placeholder="Reason for discrepancy, waste notes, etc."
                    className="w-full px-2 py-1 border border-line rounded text-sm text-ink outline-none focus:border-cyan resize-none"
                    rows={2}
                  />
                </label>

                <div className="flex justify-end">
                  <Button
                    size="small"
                    variant="primary"
                    disabled={submittingId === batch._id || physical === batch.currentRemaining}
                    onClick={() => handleSubmit(batch._id)}
                  >
                    {submittingId === batch._id ? "Submitting…" : "Submit Reconciliation"}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ModalShell>
  );
}
