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
                  የባለቤት / አድሚን ቁጥጥር
                </span>
                <h2 className="mt-1 text-xl font-bold text-foreground">የስራ ማስተካከያ ህጎች</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  የዕቃ ዋጋ፣ የምርት ህግ፣ የትዕዛዝ አስተዳደር እና የደህንነት ቁጥጥር ማስተካከያ።
                  ለውጦች በቀጣዩ የምርት መዝገብ ላይ በራስ-ሰር ሁኔታ ይተግብራሉ።
                </p>
              </div>
            </div>
          </div>
        </div>
        <OperationalPanel />
      </div>
    </div>
  );
}
