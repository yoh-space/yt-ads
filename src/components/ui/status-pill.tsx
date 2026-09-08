import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";
import { type HTMLAttributes } from "react";

type StatusPillVariant = "success" | "warning" | "neutral" | "danger" | "info";

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: StatusPillVariant;
  children: React.ReactNode;
}

const PILL_SURFACES: Record<StatusPillVariant, string> = {
  success: "bg-status-success-bg text-status-success border-status-success/40",
  warning: "bg-status-warning-bg text-status-warning border-status-warning/40",
  danger: "bg-[var(--danger-bg)] text-[var(--danger)] border-[var(--danger)]/40",
  neutral: "bg-surface-elevated text-text-secondary border-border-token",
  info: "bg-brand-primary-bg text-brand-primary-light border-brand-primary/40",
};

const DOT_TONES: Record<StatusPillVariant, string> = {
  success: "bg-status-success shadow-[0_0_6px_var(--status-success)]",
  warning: "bg-status-warning shadow-[0_0_6px_var(--status-warning)] animate-pulse-dot",
  danger: "bg-[var(--danger)] shadow-[0_0_6px_var(--danger)]",
  neutral: "bg-text-dim",
  info: "bg-brand-primary-light shadow-[0_0_6px_var(--brand-primary)]",
};

export function StatusPill({ className, variant = "neutral", children, ...props }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-max gap-[5px] px-2 py-[3px] rounded-full border",
        "font-mono text-[8.5px] font-bold uppercase tracking-[0.1em] whitespace-nowrap",
        PILL_SURFACES[variant],
        className
      )}
      {...props}
    >
      {variant === "danger" ? (
        <Zap size={9} strokeWidth={2.5} className="text-[var(--danger)] flex-none" fill="currentColor" />
      ) : (
        <span aria-hidden className={cn("inline-block w-[5px] h-[5px] rounded-full flex-none", DOT_TONES[variant])} />
      )}
      {children}
    </span>
  );
}
