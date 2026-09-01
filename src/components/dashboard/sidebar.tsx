"use client";

import { Sparkles, X } from "lucide-react";
import { canAccessView, navItems, type View } from "./nav-config";
import type { Role } from "@/lib/operations-types";
import { cn } from "@/lib/utils";

export function Sidebar({
  activeView,
  onNavigate,
  mobileOpen,
  onClose,
  collapsed,
  runningJobsCount,
  companyName,
  role,
}: {
  activeView: View;
  onNavigate: (view: View) => void;
  mobileOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  runningJobsCount: number;
  companyName?: string;
  logoUrl?: string;
  role: Role;
}) {
  const visibleNavItems = navItems.filter((item) => canAccessView(role, item.id));

  return (
    <aside className={cn(
      // Base sidebar shell
      "fixed z-20 top-0 left-0 h-full w-[284px] flex flex-col",
      "bg-[radial-gradient(1100px_380px_at_-15%_-12%,rgba(25,196,210,0.16),transparent_62%),radial-gradient(900px_480px_at_118%_115%,rgba(136,116,220,0.14),transparent_55%)] bg-navy",
      "border-r border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_20px_55px_rgba(5,34,54,0.35)]",
      "transition-all duration-300 ease-out",
      "max-md:-translate-x-full max-md:transition-transform",
      {
        "max-md:translate-x-0": mobileOpen,
        "w-[78px]": collapsed,
      }
    )}>
      {/* ── Brand ─────────────────────────────────────────────── */}
      <div className={cn(
        "flex items-center gap-3.5 px-5 pt-5 pb-6",
        { "justify-center px-0": collapsed }
      )}>
        <div className={cn(
          "relative w-[46px] h-[46px] flex-none rounded-xl overflow-hidden",
          "ring-2 ring-cyan/30 shadow-[0_8px_22px_rgba(25,196,210,0.28)]",
          { "w-[42px] h-[42px] rounded-full ring-cyan/25": collapsed }
        )}>
          <img
            src="/logo.webp"
            alt="Company logo"
            className="w-full h-full object-cover"
            draggable={false}
          />
          <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
        </div>

        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[15px] font-bold leading-snug tracking-[-0.3px] text-white">
              {companyName ?? "YT Advertising"}
            </strong>
            <span className="mt-1 block truncate text-[9px] font-mono uppercase tracking-[0.18em] text-cyan/70">
              Operations Control
            </span>
          </div>
        ) : null}

        <button
          className={cn(
            "md:hidden grid place-items-center w-[34px] h-[34px] rounded-lg bg-white/5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white",
            { "hidden": collapsed }
          )}
          aria-label="Close navigation"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Live workspace chip ───────────────────────────────── */}
      <div className={cn(
        "mx-4 mb-5 flex items-center gap-2.5 rounded-full border border-green/25 bg-green/10 px-3.5 py-2",
        { "mx-[14px] justify-center px-0": collapsed }
      )}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green" />
        </span>
        {!collapsed ? (
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-green">
            Live workspace
          </span>
        ) : null}
      </div>

      {/* ── Primary navigation ────────────────────────────────── */}
      <p className={cn(
        "mx-5 mb-2.5 text-[9px] font-mono tracking-[0.2em] uppercase text-gray-500",
        { "hidden": collapsed }
      )}>
        Workspace <span className="float-right text-[8px] text-gray-600">MAIN MENU</span>
      </p>

      <nav className={cn(
        "flex-1 overflow-y-auto overscroll-contain px-3 pb-3",
        "[&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent",
        "[scrollbar-width:thin]"
      )}>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              title={collapsed ? item.english : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50",
                isActive
                  ? "bg-gradient-to-r from-cyan/25 via-cyan/10 to-transparent text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                  : "text-gray-400 hover:bg-white/5 hover:text-white",
                { "justify-center px-0 py-2.5": collapsed }
              )}
              onClick={() => onNavigate(item.id)}
            >
              {isActive ? (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-cyan shadow-[0_0_10px_rgba(25,196,210,0.8)]" />
              ) : null}

              <span className={cn(
                "flex-none grid place-items-center w-[32px] h-[32px] rounded-lg transition-colors duration-200",
                isActive
                  ? "bg-cyan/20 text-cyan"
                  : "bg-white/5 text-gray-400 group-hover:bg-white/10 group-hover:text-cyan-100"
              )}>
                <Icon size={17} />
              </span>

              {!collapsed ? (
                <span className="flex-1 text-xs font-semibold leading-[1.2]">
                  {item.label}
                  <small className={cn(
                    "mt-[3px] block text-[9px] font-normal",
                    isActive ? "text-cyan-100/80" : "text-gray-500 group-hover:text-gray-400"
                  )}>
                    {item.english}
                  </small>
                </span>
              ) : null}

              {item.id === "jobs" && runningJobsCount > 0 ? (
                <b className={cn(
                  "grid place-items-center w-5 h-5 flex-none rounded-full bg-coral text-white text-[10px] font-bold font-mono",
                  { "absolute right-2 top-1.5": collapsed }
                )}>
                  {runningJobsCount}
                </b>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* ── Footer / workspace meta ───────────────────────────── */}
      <div className="mt-auto p-3">
        <div className={cn(
          "flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm",
          { "justify-center p-2.5": collapsed }
        )}>
          <span className={cn(
            "flex-none grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-dark to-cyan text-white shadow-[0_4px_12px_rgba(25,196,210,0.3)]",
            { "w-9 h-9 rounded-full": collapsed }
          )}>
            <Sparkles size={15} />
          </span>
          {!collapsed ? (
            <div className="min-w-0">
              <strong className="block truncate text-[11px] font-semibold text-white">
                {companyName ?? "YoTech Digitals"}
              </strong>
              <span className="block truncate text-[9px] text-gray-400">
                Enterprise workflow · v1.0
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}