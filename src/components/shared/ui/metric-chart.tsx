import { cn } from "@/lib/utils";
import { type HTMLAttributes, type ReactNode } from "react";
import { SectionLabel } from "./typography";

type MetricChartAccent = "cyan" | "emerald" | "amber" | "rose";

const ACCENT_LABEL_TONES: Record<MetricChartAccent, "cyan" | "amber" | "emerald" | "rose"> = {
  cyan: "cyan",
  emerald: "emerald",
  amber: "amber",
  rose: "rose",
};

export interface MetricChartProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value?: string | number;
  sublabel?: string;
  accent?: MetricChartAccent;
  live?: boolean;
  footer?: ReactNode;
  children?: ReactNode;
}

export function MetricChart({
  className,
  label,
  value,
  sublabel,
  accent = "cyan",
  live,
  footer,
  children,
  ...props
}: MetricChartProps) {
  return (
    <article
      className={cn(
        "flex flex-col gap-3 p-4 rounded-xl border border-[#1e293b] bg-[#0b1220] shadow-custom",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-3">
        <SectionLabel tone={ACCENT_LABEL_TONES[accent]}>{label}</SectionLabel>
        {live ? (
          <span className="inline-flex items-center gap-[5px]">
            <span className="inline-block w-[6px] h-[6px] rounded-full bg-[#38B000] shadow-[0_0_8px_rgba(56,176,0,0.9)] animate-pulse-dot" />
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-400">
              Live
            </span>
          </span>
        ) : null}
      </div>

      {value !== undefined ? (
        <strong className="font-mono text-[24px] font-extrabold leading-none tracking-[-0.03em] text-foreground tabular-nums">
          {value}
        </strong>
      ) : null}
      {sublabel ? (
        <p className="m-0 font-sans text-[10px] text-muted-foreground leading-[1.4]">{sublabel}</p>
      ) : null}

      {children ? <div className="w-full">{children}</div> : null}
      {footer ? (
        <div className="pt-1 mt-auto border-t border-[#1e293b] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </article>
  );
}
