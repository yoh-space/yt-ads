"use client";

import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

type TelemetryTone = "green" | "cyan" | "amber" | "rose" | "muted";

const VALUE_TONES: Record<TelemetryTone, string> = {
  green: "text-[#4ade80]",
  cyan: "text-[#22d3ee]",
  amber: "text-[#fbbf24]",
  rose: "text-[#fb7185]",
  muted: "text-slate-400",
};

interface TelemetryItem {
  label: string;
  value: string;
  tone?: TelemetryTone;
}

export interface TelemetryBarProps extends HTMLAttributes<HTMLDivElement> {
  items: TelemetryItem[];
  channel?: string;
  scroll?: boolean;
}

export function TelemetryBar({ className, items, channel = "የማሽኖች ወቅታዊ ሁኔታ", scroll = true, ...props }: TelemetryBarProps) {
  const group = (keyPrefix: string) => (
    <div key={keyPrefix} className="flex items-center flex-none" aria-hidden={keyPrefix !== "a"}>
      {items.map((item, index) => (
        <span
          key={`${keyPrefix}-${item.label}-${index}`}
          className="inline-flex items-center gap-[6px] px-[18px] font-mono text-[9px] font-medium uppercase tracking-[0.1em] whitespace-nowrap"
        >
          <span className="text-slate-500">{item.label}:</span>
          <span className={cn("font-bold tabular-nums", VALUE_TONES[item.tone ?? "cyan"])}>
            {item.value}
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div
      className={cn(
        "relative flex items-center h-7 overflow-hidden bg-[#020617] border-b border-[#1e293b]",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-[7px] flex-none h-full px-[14px] bg-[#020617] border-r border-[#1e293b] z-10">
        <span className="inline-block w-[6px] h-[6px] rounded-full bg-[#38B000] shadow-[0_0_8px_rgba(56,176,0,0.9)] animate-pulse-dot" />
        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.22em] text-cyan whitespace-nowrap">
          {channel}
        </span>
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div
          className={cn("flex w-max items-center", scroll && "animate-telemetry-scroll")}
        >
          {group("a")}
          {group("b")}
        </div>
      </div>
    </div>
  );
}
