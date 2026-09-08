"use client";

import type { ReactNode } from "react";
import { ChevronRight, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SettingsCategoryEntry {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  badge?: string;
}

/**
 * Settings page sidebar: brand band + category list. Pure presentation — the
 * caller decides what counts as "active" and triggers the switch.
 */
export function SettingsSidebar({
  categories,
  activeId,
  onSelect,
}: {
  categories: SettingsCategoryEntry[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="relative bg-navy p-5">
          <div className="absolute inset-0 bg-[radial-gradient(420px_160px_at_110%_-40%,rgba(25,196,210,0.35),transparent_65%)]" />
          <div className="relative flex items-center gap-3">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-cyan text-navy shadow-[0_8px_20px_rgba(25,196,210,0.35)]">
              <Settings2 size={18} />
            </span>
            <div>
              <h3 className="text-[15px] font-bold text-white">Settings</h3>
              <p className="text-[11px] text-cyan-100/80">Manage account & workspace</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1 p-3">
          {categories.map((category) => {
            const isActive = activeId === category.id;
            return (
              <button
                key={category.id}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
                  isActive
                    ? "bg-navy text-white shadow-[0_10px_24px_rgba(0,46,75,0.28)]"
                    : "text-muted-foreground hover:bg-white/5",
                )}
                onClick={() => onSelect(category.id)}
              >
                {isActive ? (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-cyan shadow-[0_0_10px_rgba(25,196,210,0.8)]" />
                ) : null}

                <span
                  className={cn(
                    "grid h-9 w-9 flex-none place-items-center rounded-lg transition-colors duration-200",
                    isActive
                      ? "bg-cyan text-navy"
                      : "bg-white/5 text-muted-foreground group-hover:bg-cyan/10 group-hover:text-cyan-dark",
                  )}
                >
                  {category.icon}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold">{category.title}</span>
                    {category.badge ? (
                      <span
                        className={cn(
                          "flex-none rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                          isActive ? "bg-white/20 text-cyan" : "bg-white/10 text-muted-foreground",
                        )}
                      >
                        {category.badge}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block truncate text-[11px]",
                      isActive ? "text-cyan-100/80" : "text-muted-foreground/70",
                    )}
                  >
                    {category.description}
                  </span>
                </span>

                <ChevronRight
                  size={15}
                  className={cn("flex-none transition-colors", isActive ? "text-cyan" : "text-muted-foreground/50")}
                />
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
