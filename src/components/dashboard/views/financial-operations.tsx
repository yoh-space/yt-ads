"use client";

import { CircleDollarSign } from "lucide-react";
import { OperationalPanel } from "./settings";

/** Dedicated owner workspace for valuation, production, and risk controls. */
export function FinancialOperationsView() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-custom">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-gold/15 text-gold">
              <CircleDollarSign size={20} />
            </span>
            <div>
              <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Owner control / financial operations</span>
              <h2 className="mt-1 text-xl font-bold text-foreground">Financial Operations</h2>
              <p className="mt-1 text-sm text-muted-foreground">Configure valuation rates, production rules, order expiry, and risk controls.</p>
            </div>
            <span className="ml-auto rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-gold">Owner</span>
          </div>
        </div>
        <OperationalPanel />
      </div>
    </div>
  );
}
