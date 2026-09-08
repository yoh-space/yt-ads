import { cn } from "@/lib/utils";
import { type CSSProperties, type HTMLAttributes } from "react";

type ProgressTone = "cyan" | "emerald" | "amber" | "rose" | "muted";

const FILL_TONES: Record<ProgressTone, string> = {
  cyan: "bg-[#00B4D8] shadow-[0_0_10px_rgba(0,180,216,0.55)]",
  emerald: "bg-[#38B000] shadow-[0_0_10px_rgba(56,176,0,0.45)]",
  amber: "bg-[#FFB703] shadow-[0_0_10px_rgba(255,183,3,0.45)]",
  rose: "bg-[#f43f5e] shadow-[0_0_10px_rgba(244,63,94,0.45)]",
  muted: "bg-slate-500",
};

export interface SegmentedProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  segments?: number;
  tone?: ProgressTone;
  height?: "thin" | "default";
}

export function SegmentedProgress({
  className,
  value,
  max = 100,
  segments = 16,
  tone = "cyan",
  height = "default",
  ...props
}: SegmentedProgressProps) {
  const clamped = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(clamped)}
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-[#0f172a] border border-white/5",
        {
          "h-2": height === "default",
          "h-[5px]": height === "thin",
        },
        className
      )}
      {...props}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", FILL_TONES[tone])}
        style={{ width: `${clamped}%` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={
          {
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0, transparent calc(100% / var(--seg-count) - 2px), #0b1220 calc(100% / var(--seg-count) - 2px), #0b1220 calc(100% / var(--seg-count)))",
            "--seg-count": segments,
          } as CSSProperties
        }
      />
    </div>
  );
}

export interface StatusNodeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "active" | "idle" | "warning" | "down";
  pulse?: boolean;
}

const NODE_TONES: Record<StatusNodeProps["tone"] & string, string> = {
  active: "bg-[#38B000] shadow-[0_0_8px_rgba(56,176,0,0.85)]",
  idle: "bg-slate-500",
  warning: "bg-[#FFB703] shadow-[0_0_8px_rgba(255,183,3,0.85)]",
  down: "bg-[#f43f5e] shadow-[0_0_8px_rgba(244,63,94,0.85)]",
};

export function StatusNode({ className, tone = "idle", pulse, ...props }: StatusNodeProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block w-[7px] h-[7px] rounded-full flex-none",
        NODE_TONES[tone],
        pulse && "animate-pulse-dot",
        className
      )}
      {...props}
    />
  );
}
