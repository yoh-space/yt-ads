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
  logoUrl,
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
  return (
    <aside className={cn(
      // Base sidebar styles
      "fixed z-20 top-0 left-0 h-full w-[280px] flex flex-col",
      "bg-gradient-to-b from-navy to-navy-2 text-white",
      "border-r border-white/10",
      "shadow-custom overflow-hidden",
      "transition-all duration-300 ease-out",
      
      // Mobile states
      "max-md:-translate-x-full max-md:transition-transform",
      {
        "max-md:translate-x-0": mobileOpen,
      },
      
      // Collapsed state
      {
        "w-[74px]": collapsed,
      }
    )}>
      {/* Brand Block */}
      <div className={cn(
        "flex items-center gap-[10px] p-[1px_9px_21px]",
        {
          "justify-center p-[1px_0_21px]": collapsed,
        }
      )}>
        <div className={cn(
          "relative w-[33px] h-[33px] grid place-items-center rounded-lg overflow-hidden",
          "border border-cyan bg-gradient-to-br from-cyan-dark to-cyan",
          "text-white text-lg font-extrabold"
        )}>
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <>
              <span>Y</span>
              <i className="absolute w-[11px] h-[11px] -right-[3px] -bottom-[3px] bg-gold rotate-45" />
            </>
          )}
        </div>
        
        <div className={cn("flex-1", { "hidden": collapsed })}>
          <strong className="block text-sm text-white font-semibold tracking-[-0.3px]">
            {companyName ?? "YT Advertising"}
          </strong>
          <small className="block mt-[2px] text-[10px] leading-[1.2] font-mono tracking-[0.8px] text-cyan/70">
            Operations Control
          </small>
        </div>

        <button 
          className="md:hidden grid place-items-center w-[34px] h-[34px] rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 hover:text-navy"
          aria-label="Close navigation" 
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      {/* Live Workspace Chip */}
      <div className={cn(
        "mx-[5px] mb-[23px] p-2 flex items-center gap-[7px]",
        "border border-cyan/20 rounded-lg",
        "bg-cyan/10 text-[11px] text-cyan",
        {
          "mx-[9px] justify-center": collapsed,
        }
      )}>
        <span className="block w-[6px] h-[6px] rounded-full bg-green shadow-[0_0_0_3px_rgba(72,173,138,0.12)]" />
        <span className={cn({ "hidden": collapsed })}>Live</span>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-[5px]">
        <p className={cn(
          "mx-[5px] mb-[9px] text-[9px] font-mono tracking-[1px] uppercase text-muted-foreground",
          {
            "hidden": collapsed,
          }
        )}>
          የሥራ ማውጫ <span className="float-right text-[8px] opacity-60">WORKSPACE</span>
        </p>
        
        {navItems.filter((item) => canAccessView(role, item.id)).map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <button
              key={item.id}
              className={cn(
                "w-full flex items-center gap-[11px] p-[9px_10px] mb-1 rounded-lg text-left transition-all duration-200",
                "text-gray-400 hover:bg-white/6 hover:text-white",
                {
                  "bg-gradient-to-r from-cyan/20 to-cyan/7 text-white shadow-[inset_2px_0_var(--cyan)]": isActive,
                  "justify-center p-[11px_0]": collapsed,
                }
              )}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={18} className="flex-none" />
              
              <span className={cn(
                "flex-1 text-xs leading-[1.16]",
                {
                  "hidden": collapsed,
                }
              )}>
                {item.label}
                <small className="block mt-[2px] text-[9px] text-cyan/70">
                  {item.english}
                </small>
              </span>
              
              {item.id === "jobs" && runningJobsCount > 0 ? (
                <b className={cn(
                  "grid place-items-center w-5 h-5 rounded-full bg-coral text-white text-[10px] font-bold font-mono",
                  {
                    "hidden": collapsed,
                  }
                )}>
                  {runningJobsCount}
                </b>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto">
        <div className={cn(
          "m-[15px_5px_11px] p-[11px] flex gap-[9px] rounded-lg",
          "border border-white/8 bg-white/5 text-cyan",
          {
            "justify-center p-[11px_0]": collapsed,
          }
        )}>
          <Sparkles size={17} className="flex-none" />
          <p className={cn(
            "text-[10px] leading-[1.45] text-green m-0",
            {
              "hidden": collapsed,
            }
          )}>
            <strong className="text-cyan">YoTech Digitals</strong><br />
            Enterprise workflow system
          </p>
        </div>
      </div>
    </aside>
  );
}
