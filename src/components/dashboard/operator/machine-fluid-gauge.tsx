"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Droplet, AlertTriangle, CheckCircle, ShieldCheck } from "lucide-react";

interface MachineFluidGaugeProps {
  machineId: Id<"machines">;
  activeJobRequiredMl?: number;
}

const INK_COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  cyan: { bg: "bg-cyan-500/20", border: "border-cyan-500/40", text: "text-cyan-400" },
  magenta: { bg: "bg-fuchsia-500/20", border: "border-fuchsia-500/40", text: "text-fuchsia-400" },
  yellow: { bg: "bg-amber-400/20", border: "border-amber-400/40", text: "text-amber-300" },
  black: { bg: "bg-slate-700/40", border: "border-slate-600/60", text: "text-slate-200" },
  white: { bg: "bg-slate-200/20", border: "border-slate-300/40", text: "text-slate-100" },
};

export function MachineFluidGauge({ machineId, activeJobRequiredMl }: MachineFluidGaugeProps) {
  const inkStock = useQuery(api.inventory.listMachineInkStock, { machineId });

  if (inkStock === undefined) {
    return (
      <div className="rounded-xl border border-border-token bg-surface p-4 text-xs text-text-secondary">
        Loading machine fluid gauges…
      </div>
    );
  }

  if (inkStock.length === 0) {
    return null; // Machine has no fluid/ink requirements or no floor batches issued
  }

  const inks = inkStock.filter((s) => s.materialFamily === "INK" || !s.isSolvent);
  const solvents = inkStock.filter((s) => s.materialFamily === "SOLVENT" || s.isSolvent);

  return (
    <div className="space-y-4 rounded-xl border border-border-token bg-surface p-4">
      <div className="flex items-center justify-between border-b border-border-token pb-2">
        <div className="flex items-center gap-2">
          <Droplet size={15} className="text-brand-primary-light" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
            የማሽን ቀለም እና ፍሳሽ መጠን (Machine Fluid Levels)
          </h3>
        </div>
        <span className="text-[10px] font-medium text-text-secondary">
          {inks.length} Inks · {solvents.length} Solvents
        </span>
      </div>

      {/* Per-Color Inks */}
      {inks.length > 0 && (
        <div className="space-y-2.5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">
            የማሽን ቀለሞች (Active Ink Bottles)
          </span>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {inks.map((ink) => {
              const colorKey = (ink.inkColor ?? ink.materialName).toLowerCase();
              const matchedStyle = Object.entries(INK_COLOR_MAP).find(([key]) =>
                colorKey.includes(key)
              )?.[1] ?? {
                bg: "bg-brand-primary-bg",
                border: "border-brand-primary/30",
                text: "text-brand-primary-light",
              };

              const isLow = ink.remainingMillilitres < (activeJobRequiredMl ?? 100);

              return (
                <div
                  key={ink._id}
                  className={`rounded-lg border p-2.5 transition ${matchedStyle.border} ${matchedStyle.bg}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          colorKey.includes("yellow")
                            ? "bg-amber-400"
                            : colorKey.includes("cyan")
                              ? "bg-cyan-400"
                              : colorKey.includes("magenta")
                                ? "bg-fuchsia-500"
                                : colorKey.includes("black")
                                  ? "bg-slate-900 border border-slate-600"
                                  : "bg-brand-primary-light"
                        }`}
                      />
                      <strong className={`text-xs font-bold ${matchedStyle.text}`}>
                        {ink.inkColor ?? ink.materialName}
                      </strong>
                    </div>
                    {isLow ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                        <AlertTriangle size={11} /> ዝቅተኛ (Low)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                        <CheckCircle size={11} /> በቂ (OK)
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between font-mono text-xs">
                    <span className="text-text-secondary text-[11px]">ቀሪ መጠን:</span>
                    <span className="font-bold text-text-primary">
                      {ink.remainingMillilitres} mL ({ink.remainingLitres} L)
                    </span>
                  </div>
                  {/* Visual gauge bar */}
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface/50">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isLow ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(5, (ink.remainingMillilitres / 1000) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Solvents & Maintenance Fluids */}
      {solvents.length > 0 && (
        <div className="space-y-2 border-t border-border-token pt-2.5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">
            ማጽጃ እና ፈሳሽ (Solvent & Cleaning Fluid)
          </span>
          <div className="grid gap-2 sm:grid-cols-2">
            {solvents.map((solv) => (
              <div
                key={solv._id}
                className="flex items-center justify-between rounded-lg border border-border-token bg-surface-elevated px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-brand-primary-light" />
                  <span className="font-medium text-text-primary">{solv.materialName}</span>
                </div>
                <span className="font-mono font-bold text-text-primary">
                  {solv.remainingLitres} L ({solv.remainingMillilitres} mL)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
