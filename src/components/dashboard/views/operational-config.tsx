"use client";

import { SlidersHorizontal } from "lucide-react";
import { OperationalPanel } from "./settings";

/** Dedicated owner/admin workspace for valuation, conversion, production, and risk controls. */
export function OperationalConfigView() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-custom">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(480px_190px_at_110%_-40%,rgba(25,196,210,0.25),transparent_65%)]" />
            <div className="relative flex items-start gap-4 border-b border-border p-6">
              <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-cyan/15 text-cyan-dark shadow-[0_8px_20px_rgba(25,196,210,0.25)]">
                <SlidersHorizontal size={22} />
              </span>
              <div className="min-w-0">
                <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-dark">
                  Owner / admin control · operational configuration
                </span>
                <h2 className="mt-1 text-xl font-bold text-foreground">Operational Configuration</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Configure ETB valuation rates, unit conversion defaults, production rules, order expiry,
                  and risk & theft prevention controls. Changes apply transactionally on the next production record.
                </p>
              </div>
            </div>
            <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
              {[
                { label: "Valuation", value: "ETB rates" },
                { label: "Conversion", value: "Unit rules" },
                { label: "Production", value: "Waste & ink" },
                { label: "Risk", value: "Stock-out controls" },
              ].map((chip) => (
                <span key={chip.label} className="inline-flex items-center gap-1.5 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
                  <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{chip.label}</span>
                  <span className="text-foreground">{chip.value}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <OperationalPanel />
      </div>
    </div>
  );
}
