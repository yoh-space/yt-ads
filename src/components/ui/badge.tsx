import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";
import { type HTMLAttributes } from "react";

export type BadgeVariant = "success" | "warning" | "neutral" | "danger" | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  glowDot?: boolean;
}

const BADGE_SURFACES: Record<BadgeVariant, string> = {
  success: "bg-emerald-950/40 text-emerald-400 border-emerald-800/60",
  warning: "bg-amber-950/40 text-amber-400 border-amber-800/60",
  danger: "bg-rose-950/40 text-rose-300 border-rose-800/60",
  neutral: "bg-slate-900/60 text-slate-300 border-slate-700/60",
  info: "bg-cyan-950/40 text-cyan-300 border-cyan-800/60",
};

const BADGE_DOTS: Record<BadgeVariant, string> = {
  success: "bg-[#38B000] shadow-[0_0_6px_rgba(56,176,0,0.85)]",
  warning: "bg-[#FFB703] shadow-[0_0_6px_rgba(255,183,3,0.85)] animate-pulse-dot",
  danger: "bg-[#f43f5e] shadow-[0_0_6px_rgba(244,63,94,0.85)]",
  neutral: "bg-slate-500",
  info: "bg-[#00B4D8] shadow-[0_0_6px_rgba(0,180,216,0.85)]",
};

export function Badge({ className, variant = "neutral", glowDot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-[5px] px-2 py-[3px] rounded-full border",
        "font-mono text-[8.5px] font-bold uppercase tracking-[0.1em] whitespace-nowrap",
        BADGE_SURFACES[variant],
        className
      )}
      {...props}
    >
      {variant === "danger" ? (
        <Zap size={9} strokeWidth={2.5} className="text-[#f43f5e] flex-none" fill="currentColor" />
      ) : glowDot ? (
        <span aria-hidden className={cn("inline-block w-[5px] h-[5px] rounded-full flex-none", BADGE_DOTS[variant])} />
      ) : null}
      {children}
    </span>
  );
}
