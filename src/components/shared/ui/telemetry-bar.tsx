"use client";

import { cn } from "@/lib/utils";
import { Activity, Radio } from "lucide-react";
import { type HTMLAttributes, useMemo } from "react";

export interface TelemetryBarProps extends HTMLAttributes<HTMLDivElement> {
  machinesActive?: number;
  jobsInProduction?: number;
  floorJobs?: number;
  className?: string;
}

export function TelemetryBar({
  machinesActive = 0,
  jobsInProduction = 0,
  floorJobs = 0,
  className,
  ...props
}: TelemetryBarProps) {
  const items = useMemo(
    () => [
      { label: "Machines Online", value: machinesActive, tone: "status-success" as const },
      { label: "In Production", value: jobsInProduction, tone: "brand-primary-light" as const },
      { label: "Floor Jobs", value: floorJobs, tone: "text-secondary" as const },
    ],
    [machinesActive, jobsInProduction, floorJobs],
  );

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border border-border-token bg-surface-elevated px-4 py-2 font-mono text-[11px]",
        className,
      )}
      {...props}
    >
      <span className="inline-flex items-center gap-1.5 text-brand-primary font-bold">
        <Radio size={12} className="animate-pulse text-brand-primary-light" /> LIVE
      </span>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-text-secondary">
          <Activity size={10} className={cn("text-[var(--", item.tone, ")]")} />
          <span className="text-text-primary font-bold">{item.value}</span>{" "}
          <span className="text-[9px] uppercase tracking-wider">{item.label}</span>
        </span>
      ))}
    </div>
  );
}
