"use client";

import { useState } from "react";
import { AlertTriangle, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

interface StockoutAlertWidgetProps {
  onNavigateToInventory?: () => void;
  canViewFinancial?: boolean;
}

export function StockoutAlertWidget({ onNavigateToInventory, canViewFinancial = false }: StockoutAlertWidgetProps) {
  const forecast = useQuery(api.dashboard.getStockoutForecast, {});
  const [filter, setFilter] = useState<"AT_RISK" | "CRITICAL" | "ALL">("AT_RISK");

  if (!forecast) {
    return (
      <div className="p-4 rounded-sm bg-[#131418] border border-white/[0.08] animate-pulse">
        <div className="h-4 w-40 bg-white/[0.05] rounded-sm mb-2.5" />
        <div className="h-12 w-full bg-white/[0.03] rounded-sm" />
      </div>
    );
  }

  const { criticalCount, warningCount, items } = forecast;
  const totalAtRisk = criticalCount + warningCount;

  const filteredItems = items.filter((item) => {
    if (filter === "CRITICAL") return item.urgency === "CRITICAL";
    if (filter === "AT_RISK") return item.urgency === "CRITICAL" || item.urgency === "WARNING";
    return true;
  });

  return (
    <div className="rounded-sm bg-[#131418] border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-7 h-7 rounded-sm grid place-items-center font-mono text-xs font-bold",
            criticalCount > 0
              ? "bg-rose-950/60 text-rose-300 border border-rose-500/40"
              : warningCount > 0
              ? "bg-amber-950/60 text-amber-300 border border-amber-500/40"
              : "bg-[#12201D] text-[#5BBBB4] border border-[#3E9B95]/40"
          )}>
            {criticalCount > 0 ? <AlertTriangle size={14} /> : warningCount > 0 ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-neutral-100 leading-none">
                የዕቃዎች ክምችት ማስጠንቀቂያ (STOCKOUT RADAR)
              </h3>
              {totalAtRisk > 0 ? (
                <span className="px-1.5 py-0.5 rounded-sm bg-rose-950/80 text-rose-300 border border-rose-600/40 text-[10px] font-mono">
                  {totalAtRisk} AT RISK
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-sm bg-[#12201D] text-[#5BBBB4] border border-[#3E9B95]/40 text-[10px] font-mono">
                  ALL HEALTHY
                </span>
              )}
            </div>
            <p className="font-mono text-[10px] text-neutral-400 mt-0.5">
              Runway projection based on 30-day consumption velocity
            </p>
          </div>
        </div>

        {/* Minimal Segmented Rail */}
        <div className="flex items-center gap-1 bg-[#0C0D10] p-0.5 rounded-sm border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setFilter("AT_RISK")}
            className={cn(
              "px-2.5 py-1 rounded-sm font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer",
              filter === "AT_RISK"
                ? "bg-[#1E2026] text-white border border-white/[0.12] font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            )}
          >
            AT RISK ({totalAtRisk})
          </button>
          <button
            type="button"
            onClick={() => setFilter("CRITICAL")}
            className={cn(
              "px-2.5 py-1 rounded-sm font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer",
              filter === "CRITICAL"
                ? "bg-rose-950/60 text-rose-300 border border-rose-500/40 font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            )}
          >
            CRITICAL ({criticalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={cn(
              "px-2.5 py-1 rounded-sm font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer",
              filter === "ALL"
                ? "bg-[#1E2026] text-white border border-white/[0.12] font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            )}
          >
            ALL ({items.length})
          </button>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="p-6 text-center text-xs font-mono text-neutral-400">
            <CheckCircle2 size={20} className="mx-auto text-[#48B0A8] mb-1.5" />
            All inventory levels healthy. No immediate stockout risk.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isCritical = item.urgency === "CRITICAL";
            const isWarning = item.urgency === "WARNING";

            return (
              <div
                key={item.materialId}
                className={cn(
                  "p-3 flex flex-wrap items-center justify-between gap-3 transition-colors hover:bg-white/[0.02]",
                  isCritical && "bg-rose-950/10"
                )}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-100">{item.materialName}</span>
                    <span className="text-[10px] font-mono text-neutral-400 px-1 py-0.2 rounded-sm bg-white/[0.04]">
                      {item.category ?? "Material"}
                    </span>
                    {isCritical ? (
                      <span className="px-1.5 py-0.2 rounded-sm bg-rose-950/60 text-rose-300 border border-rose-500/30 text-[10px] font-mono">
                        {item.runwayDays === 0 ? "DEPLETED" : `${item.runwayDays}d runway`}
                      </span>
                    ) : isWarning ? (
                      <span className="px-1.5 py-0.2 rounded-sm bg-amber-950/60 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
                        {item.runwayDays}d runway
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded-sm bg-[#12201D] text-[#5BBBB4] border border-[#3E9B95]/30 text-[10px] font-mono">
                        {item.runwayDays ? `${item.runwayDays}d` : "Safe"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 text-[11px] text-neutral-400 font-mono">
                    <span>
                      Stock: <strong className="text-neutral-200">{item.currentStock} {item.baseUnit}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Floor: {item.reorderAt} {item.baseUnit}
                    </span>
                    <span>·</span>
                    <span>
                      Burn: {item.dailyRate} {item.baseUnit}/day
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block">REORDER SUGGESTION</span>
                    <span className="text-xs font-mono font-bold text-[#E5C07B]">
                      +{item.suggestedReorder} {item.baseUnit}
                    </span>
                    {canViewFinancial && item.estimatedCostEtb !== undefined ? (
                      <span className="text-[10px] text-neutral-400 block font-mono">
                        ≈ {item.estimatedCostEtb.toLocaleString()} ETB
                      </span>
                    ) : null}
                  </div>

                  {onNavigateToInventory ? (
                    <button
                      type="button"
                      onClick={onNavigateToInventory}
                      className="p-1.5 rounded-sm bg-[#17181D] hover:bg-[#22242B] text-neutral-300 border border-white/[0.08] transition-colors cursor-pointer"
                      title="Open Inventory"
                    >
                      <ArrowRight size={13} />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
