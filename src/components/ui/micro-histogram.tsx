import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

interface HistogramSegment {
  label: string;
  value: number;
  unit?: string;
  active?: boolean;
}

export interface MicroHistogramProps extends HTMLAttributes<HTMLDivElement> {
  data: HistogramSegment[];
  height?: number;
  showValues?: boolean;
}

export function MicroHistogram({
  className,
  data,
  height = 72,
  showValues = true,
  ...props
}: MicroHistogramProps) {
  const max = Math.max(1, ...data.map((segment) => segment.value));
  return (
    <div className={cn("flex items-end gap-2 w-full", className)} {...props}>
      {data.map((segment) => {
        const pct = Math.round((segment.value / max) * 100);
        return (
          <div key={segment.label} className="flex-1 flex flex-col items-center gap-[6px] min-w-0">
            {showValues ? (
              <span
                className={cn(
                  "font-mono text-[10px] font-bold tabular-nums leading-none",
                  segment.active ? "text-[#00B4D8]" : "text-muted-foreground"
                )}
              >
                {segment.value}
                {segment.unit ? <span className="text-[8px] font-medium ml-[2px]">{segment.unit}</span> : null}
              </span>
            ) : null}
            <div className="w-full flex items-end" style={{ height }}>
              <div
                className={cn(
                  "w-full rounded-t-[3px] transition-[height] duration-500 ease-out",
                  segment.active
                    ? "bg-[#00B4D8] shadow-[0_0_14px_rgba(0,180,216,0.65)]"
                    : "bg-[#334155]"
                )}
                style={{ height: `${Math.max(4, pct)}%` }}
              />
            </div>
            <span
              className={cn(
                "font-mono text-[8px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap",
                segment.active ? "text-cyan" : "text-muted-foreground"
              )}
            >
              {segment.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
