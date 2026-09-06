"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { canAccessView, getNavItemHref, navItems } from "./nav-config";
import type { View } from "@/types/dashboard-types";
import type { Role } from "@/lib/operations-types";
import type { WorkspaceDefinition } from "./workspace-registry";
import { cn } from "@/lib/utils";

/**
 * Determines if a navigation view is active based on the current pathname.
 * Handles nested routes and workspace-prefixed paths correctly.
 */
function isViewActiveForPathname(view: View, pathname: string, href: string): boolean {
  // Exact match
  if (pathname === href) return true;
  
  // If href is just a view path (no workspace prefix), check if pathname contains it as a segment
  // e.g., href="/reconciliation", pathname="/dashboard/owner/reconciliation" -> true
  if (!href.startsWith("/dashboard/") && href !== "/dashboard") {
    const viewSegment = href.startsWith("/") ? href.slice(1) : href;
    const segments = pathname.split("/").filter(Boolean);
    return segments.includes(viewSegment);
  }
  
  // For dashboard-prefixed hrefs, check if pathname starts with href
  return pathname.startsWith(href);
}

export function Sidebar({
  activeView,
  onNavigate,
  mobileOpen,
  onClose,
  onToggleSidebar,
  collapsed,
  runningJobsCount,
  ordersCount,
  activeMachinesCount,
  companyName,
  role,
  workspace,
}: {
  activeView?: View;
  onNavigate?: (view: View) => void;
  mobileOpen: boolean;
  onClose: () => void;
  onToggleSidebar: () => void;
  collapsed: boolean;
  runningJobsCount?: number;
  ordersCount?: number;
  activeMachinesCount?: number;
  companyName?: string;
  logoUrl?: string;
  role: Role;
  workspace?: WorkspaceDefinition;
}) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter(item =>
    workspace ? workspace.navViews.includes(item.id) : canAccessView(role, item.id),
  );

  return (
    <aside
      className={cn(
        // Base sidebar shell
        "fixed z-20 top-0 left-0 h-full w-60 flex flex-col overflow-visible bg-[#0B132B]",
        "border-r border-slate-800/80 shadow-[0_20px_55px_rgba(2,6,23,0.35)]",
        "transition-all duration-300 ease-in-out",
        "max-md:-translate-x-full max-md:transition-transform",
        {
          "max-md:translate-x-0": mobileOpen,
          "w-16": collapsed,
        }
      )}
    >
      {/* ── Console header ─────────────────────────────────────── */}
      <div
        className={cn("relative flex items-center px-3 pt-3 pb-2", {
          "justify-center px-0": collapsed,
        })}
      >
        {!collapsed ? (
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
            YT Advertisement
          </span>
        ) : null}
        <button
          type="button"
          className={cn(
            "hidden md:grid place-items-center h-7 w-7 rounded-md text-slate-400 hover:bg-slate-800/70 hover:text-white",
            collapsed
              ? "absolute -right-3 top-5 bg-[#1E293B] border border-slate-700"
              : "ml-auto"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleSidebar}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>

        <button
          className={cn(
            "md:hidden grid place-items-center w-[34px] h-[34px] rounded-lg bg-white/5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white",
            { hidden: collapsed }
          )}
          aria-label="Close navigation"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Live workspace chip ───────────────────────────────── */}
      <div
        className={cn(
          "mx-4 mb-4 flex items-center gap-1.5 rounded-full border border-emerald-800/60 bg-emerald-950/60 px-2 py-1",
          { "mx-[18px] justify-center px-0": collapsed }
        )}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green" />
        </span>
        {!collapsed ? (
          <span className="truncate text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-400">
            Online
          </span>
        ) : null}
      </div>

      {/* ── Primary navigation ────────────────────────────────── */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto overscroll-contain px-3 pb-3",
          "[&::-webkit-scrollbar]:w-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-thumb]:hover:bg-cyan/70 [&::-webkit-scrollbar-track]:bg-transparent",
          "[scrollbar-width:thin] [scrollbar-color:rgba(51,65,85,0.8)_transparent]"
        )}
      >
        {(["OPERATIONS CORE", "SYSTEM GOVERNANCE"] as const).map(section => {
          const sectionItems = visibleNavItems.filter(item =>
            section === "OPERATIONS CORE"
              ? [
                  "overview",
                  "orders",
                  "jobs",
                  "machines",
                  "inventory",
                ].includes(item.id)
              : [
                  "offcuts",
                  "reports",
                  "reconciliation",
                  "audit",
                  "config",
                  "settings",
                ].includes(item.id)
          );
          if (sectionItems.length === 0) return null;
          return (
            <div key={section}>
              {!collapsed ? (
                <p className="mx-2 mb-2 mt-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  {section}
                </p>
              ) : null}
              {sectionItems.map(item => {
                const Icon = item.icon;
                const href = getNavItemHref(item.id, role);
                const isActive = activeView
                  ? activeView === item.id
                  : isViewActiveForPathname(item.id, pathname, href);

                return (
                  <Link
                    key={item.id}
                    href={href}
                    title={collapsed ? item.english : undefined}
                    aria-label={item.english}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50",
                      isActive
                        ? "border-l-2 border-[#00B4D8] bg-[#1E293B] text-white shadow-[0_0_18px_rgba(0,180,216,0.12)]"
                        : "border-l-2 border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-100",
                      { "justify-center px-0 py-2.5": collapsed }
                    )}
                    onClick={() => {
                      onNavigate?.(item.id);
                      onClose?.();
                    }}
                  >
                    {isActive ? (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-cyan shadow-[0_0_10px_rgba(25,196,210,0.8)]" />
                    ) : null}

                    <span
                      className={cn(
                        "flex-none grid place-items-center w-[32px] h-[32px] rounded-lg transition-colors duration-200",
                        isActive
                          ? "bg-cyan/15 text-cyan-dark"
                          : "bg-slate-800/40 text-slate-400 group-hover:bg-slate-700/60 group-hover:text-cyan-dark"
                      )}
                    >
                      <Icon size={17} />
                    </span>

                    {!collapsed ? (
                      <span className="flex-1 text-xs font-semibold leading-[1.2]">
                        {item.label}
                        <small
                          className={cn(
                            "mt-[3px] block text-[9px] font-normal",
                            isActive
                              ? "text-cyan-100/80"
                              : "text-gray-500 group-hover:text-gray-400"
                          )}
                        >
                          {item.english}
                        </small>
                      </span>
                    ) : null}

                    {!collapsed && item.id === "orders" && ordersCount !== undefined ? (
                      <b className="ml-auto rounded-full bg-slate-600 px-2 py-0.5 font-mono text-[12px] text-red-400">
                        {ordersCount}
                      </b>
                    ) : null}
                    {!collapsed && item.id === "machines" && activeMachinesCount !== undefined ? (
                      <b className="ml-auto rounded-full bg-cyan/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-dark">
                        {activeMachinesCount} Active
                      </b>
                    ) : null}
                    {item.id === "jobs" && runningJobsCount !== undefined && runningJobsCount > 0 ? (
                      <b
                        className={cn(
                          "grid place-items-center w-5 h-5 flex-none rounded-full bg-coral text-white text-[10px] font-bold font-mono",
                          { "absolute right-2 top-1.5": collapsed }
                        )}
                      >
                        {runningJobsCount}
                      </b>
                    ) : null}
                    {collapsed ? (
                      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-700 bg-[#1E293B] px-2.5 py-1.5 font-mono text-xs text-slate-200 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                        {item.english}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── Footer / workspace meta ───────────────────────────── */}
      <div className="mt-auto p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm",
            { "justify-center p-2.5": collapsed }
          )}
        >
          <div
            className={cn(
              "flex-none grid place-items-center w-8 h-8 rounded-lg bg-transparent shadow-[0_4px_12px_rgba(25,196,210,0.3)]",
              { "w-9 h-9 rounded-full": collapsed }
            )}
          >
            <Image
              src="./logo.webp"
              alt="Logo"
              width={30}
              height={30}
              loader={imageLoader}
            />
          </div>
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

const imageLoader = ({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) => {
  return `${src}?w=${width}&q=${quality || 75}`;
};
