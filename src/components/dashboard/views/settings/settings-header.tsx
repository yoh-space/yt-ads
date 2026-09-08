"use client";

import type { ReactNode } from "react";
import type { SettingsCategoryEntry } from "./settings-sidebar";

/** Detail header shown above the active panel — mirrors the sidebar selection. */
export function SettingsHeader({ selected }: { selected: SettingsCategoryEntry }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-cyan/15 text-cyan-dark">
            {selected.icon}
          </span>
          <div>
            <span className="block text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-cyan-dark">
              Settings / {selected.title}
            </span>
            <h2 className="mt-1 text-xl font-bold text-foreground">{selected.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
          </div>
        </div>
        {selected.badge ? (
          <span className="flex-none rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
            {selected.badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}
