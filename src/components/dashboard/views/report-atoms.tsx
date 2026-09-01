import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "violet" | "coral" | "gold" | "cyan" | "neutral";

const toneTile: Record<Tone, string> = {
  violet: "bg-violet/10 text-violet",
  coral: "bg-coral/10 text-coral",
  gold: "bg-gold/10 text-gold",
  cyan: "bg-cyan/10 text-cyan",
  neutral: "bg-gray-100 text-gray-600",
};

const kickerTone: Record<Tone, string> = {
  violet: "text-violet",
  coral: "text-coral",
  gold: "text-gold",
  cyan: "text-cyan-dark",
  neutral: "text-gray-500",
};

export function PanelHead({
  kicker,
  tone = "cyan",
  title,
  note,
  icon,
  action,
}: {
  kicker: string;
  tone?: Tone;
  title: string;
  note: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <span className={cn("block text-xs font-mono font-bold tracking-wider uppercase", kickerTone[tone])}>
          {kicker}
        </span>
        <h2 className="text-lg font-bold text-navy mt-1">{title}</h2>
        <p className="text-sm text-gray-600 mt-1">{note}</p>
      </div>
      <span className={cn("flex items-center justify-center w-9 h-9 rounded-lg flex-none", toneTile[tone])}>
        {icon}
      </span>
      {action ? <div className="flex-none">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  tone,
  icon,
  value,
  label,
  sub,
}: {
  tone: Tone;
  icon: ReactNode;
  value: ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <div className="bg-white border border-line rounded-lg p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <span className={cn("flex items-center justify-center w-9 h-9 rounded-lg flex-none", toneTile[tone])}>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-navy leading-tight">{value}</div>
          <div className="text-xs text-gray-600">{label}</div>
        </div>
      </div>
      <div className="text-xs text-gray-500">{sub}</div>
    </div>
  );
}

export function ReportList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line">{children}</div>;
}

export function ReportLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-sm text-gray-600">{label}</span>
      <strong className="text-sm text-navy text-right">{children}</strong>
    </div>
  );
}

export function DataTable({
  cols,
  rows,
  minWidth,
}: {
  cols: Array<{ label: ReactNode; className?: string }>;
  rows: Array<{ cells: ReactNode[]; key: string }>;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <div
        className={cn("w-full grid items-center gap-4 px-4 py-2.5 bg-gray-50 border border-line rounded-t-lg text-xs font-semibold text-gray-600 uppercase tracking-wider", minWidth)}
      >
        {cols.map((col, index) => (
          <span key={index} className={col.className}>{col.label}</span>
        ))}
      </div>
      <div className="divide-y divide-line border border-t-0 border-line rounded-b-lg">
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn("w-full grid items-center gap-4 px-4 py-3", minWidth)}
          >
            {row.cells.map((cell, index) => (
              <div key={index} className="min-w-0">{cell}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}