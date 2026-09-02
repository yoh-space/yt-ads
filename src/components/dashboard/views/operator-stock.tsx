"use client";

import { AlertTriangle, Package, RefreshCw, Trash2, ArrowLeftRight } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Button, Panel, PanelHeader, StatusPill } from "@/components/ui";
import { ModalShell } from "../modals/modal-shell";
import { useState } from "react";

function formatQuantity(n: number, unit: string) {
  return `${n.toFixed(2)} ${unit}`;
}

function formatPercentage(value: number) {
  return `${Math.round(value)}%`;
}

export function OperatorStockWidget({ machineId }: { machineId: string }) {
  const stock = useQuery(api.inventory.listOperatorMachineStock);
  const [exhaustingId, setExhaustingId] = useState<string | null>(null);
  const exhaustStock = useMutation(api.inventory.exhaustOperatorStock);

  const machineStock = stock?.filter((s) => s.machineId === machineId && s.status === "ACTIVE") || [];

  if (!stock) {
    return (
      <div className="flex items-center justify-center min-h-[120px] bg-white border border-line rounded-lg shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <RefreshCw size={16} className="animate-spin" /> Loading stock…
        </div>
      </div>
    );
  }

  return (
    <Panel>
      <PanelHeader
        title="Active Floor Stock"
        subtitle="Materials issued to this machine"
        kicker="FLOOR STOCK"
      />
      <div className="p-4 space-y-3">
        {machineStock.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-500">
            No active stock on this machine. Request material from storekeeper.
          </div>
        ) : (
          machineStock.map((batch) => {
            const usagePercent = batch.usagePercent;
            const isLow = usagePercent >= 85;
            return (
              <div
                key={batch._id}
                className="p-3 bg-white border border-line rounded-lg hover:border-cyan/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-semibold text-navy">{batch.materialName}</strong>
                      {isLow && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-coral/10 text-coral text-xs font-medium rounded-full">
                          <AlertTriangle size={11} /> Low
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>Issued: {formatQuantity(batch.issuedQuantity, batch.baseUnit)}</span>
                        <span>Remaining: {formatQuantity(batch.currentRemaining, batch.baseUnit)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-300",
                            isLow ? "bg-coral" : "bg-green"
                          )}
                          style={{ width: `${100 - usagePercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Used: {formatPercentage(usagePercent)}</span>
                        <span className={cn("font-medium", isLow ? "text-coral" : "text-green")}>
                          {formatPercentage(100 - usagePercent)} left
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="small"
                    variant="tertiary"
                    disabled={exhaustingId === batch._id}
                    onClick={() => {
                      setExhaustingId(batch._id);
                      exhaustStock({ stockId: batch._id }).then(() => setExhaustingId(null));
                    }}
                  >
                    <Trash2 size={13} />
                    {exhaustingId === batch._id ? "Exhausting…" : "Exhaust"}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
