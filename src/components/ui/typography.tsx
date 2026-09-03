import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

export interface SectionLabelProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "cyan" | "muted" | "amber" | "emerald" | "rose";
}

export function SectionLabel({ className, tone = "cyan", ...props }: SectionLabelProps) {
  return (
    <span
      className={cn(
        "font-mono text-[9px] font-semibold uppercase tracking-[0.18em] whitespace-nowrap",
        {
          "text-cyan": tone === "cyan",
          "text-muted-foreground": tone === "muted",
          "text-amber-400": tone === "amber",
          "text-emerald-400": tone === "emerald",
          "text-rose-300": tone === "rose",
        },
        className
      )}
      {...props}
    />
  );
}

export interface MetricValueProps extends HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md" | "lg";
  tone?: "default" | "cyan" | "positive" | "negative" | "muted";
}

export function MetricValue({ className, size = "md", tone = "default", ...props }: MetricValueProps) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 font-mono font-bold tabular-nums tracking-[-0.02em]",
        {
          "text-[13px] leading-none": size === "sm",
          "text-[19px] leading-none": size === "md",
          "text-[26px] leading-none": size === "lg",
        },
        {
          "text-foreground": tone === "default",
          "text-[#00B4D8]": tone === "cyan",
          "text-emerald-400": tone === "positive",
          "text-rose-400": tone === "negative",
          "text-muted-foreground": tone === "muted",
        },
        className
      )}
      {...props}
    />
  );
}

export interface TechCodeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "cyan" | "muted";
}

export function TechCode({ className, tone = "default", ...props }: TechCodeProps) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] font-bold uppercase tracking-[0.12em] whitespace-nowrap",
        {
          "text-foreground": tone === "default",
          "text-[#00B4D8]": tone === "cyan",
          "text-muted-foreground": tone === "muted",
        },
        className
      )}
      {...props}
    />
  );
}

export interface TimestampProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "muted" | "cyan";
}

export function Timestamp({ className, tone = "muted", ...props }: TimestampProps) {
  return (
    <span
      className={cn(
        "font-mono text-[9px] font-medium tabular-nums tracking-[0.1em] whitespace-nowrap",
        {
          "text-muted-foreground": tone === "muted",
          "text-cyan": tone === "cyan",
        },
        className
      )}
      {...props}
    />
  );
}
