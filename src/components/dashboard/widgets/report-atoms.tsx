import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Download, FileSpreadsheet, FileText, Table2 } from "lucide-react";

export type ExecutiveTone = "sky" | "red" | "amber" | "emerald";

const toneRing: Record<ExecutiveTone, string> = {
  sky: "border-sky-500/40",
  red: "border-red-500/40",
  amber: "border-amber-500/40",
  emerald: "border-emerald-500/40",
};

const toneGlow: Record<ExecutiveTone, string> = {
  sky: "bg-sky-500/15 text-sky-400 ring-sky-500/30",
  red: "bg-red-500/15 text-red-400 ring-red-500/30",
  amber: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  emerald: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
};

const toneText: Record<ExecutiveTone, string> = {
  sky: "text-sky-400",
  red: "text-red-400",
  amber: "text-amber-400",
  emerald: "text-emerald-400",
};

/* ═══════════ Dark Industrial Executive Report primitives ═══════════ */

export function HeaderTabs({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string; english: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-[#1E293B] bg-[#0B0F17] p-1">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-md px-3 py-1.5 font-mono text-[11px] transition-colors cursor-pointer",
              active
                ? "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-[#121824]",
            )}
          >
            <span className="font-bold">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ExportMenu({
  onExport,
}: {
  onExport: (format: "csv" | "pdf" | "xls") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const items: Array<{ id: "csv" | "pdf" | "xls"; label: string; icon: ReactNode }> = [
    { id: "csv", label: "CSV", icon: <Table2 size={13} className="text-emerald-400" /> },
    { id: "pdf", label: "PDF", icon: <FileText size={13} className="text-red-400" /> },
    { id: "xls", label: "EXCEL", icon: <FileSpreadsheet size={13} className="text-sky-400" /> },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 font-mono text-[11px] font-bold text-sky-300 transition-colors hover:bg-sky-500/20 cursor-pointer"
      >
        <Download size={13} />
        <span>ሪፖርት አውርድ</span>
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-40 overflow-hidden rounded-lg border border-[#1E293B] bg-[#121824] shadow-xl shadow-black/50">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setOpen(false);
                onExport(item.id);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs text-slate-300 transition-colors hover:bg-[#1B2433] cursor-pointer"
            >
              {item.icon}
               <span className="font-semibold">በ {item.label} አውርድ</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ExecutiveKPICard({
  tone,
  label,
  kicker,
  value,
  indicator,
  badge,
  footers,
  action,
}: {
  tone: ExecutiveTone;
  label: string;
  kicker?: string;
  value: ReactNode;
  indicator?: ReactNode;
  badge?: ReactNode;
  footers?: Array<{ label: string; value: ReactNode; tone?: "good" | "bad" | "neutral" }>;
  action?: ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex min-h-[140px] flex-col rounded-lg border bg-[#121824] p-4 shadow-lg shadow-black/30",
        toneRing[tone],
      )}
    >
      <div className="flex items-start justify-between gap-2 overflow-hidden">
        <div className="min-w-0 leading-relaxed">
          {kicker ? (
            <span className={cn("block font-mono text-[9px] font-bold leading-relaxed tracking-[0.16em]", toneText[tone])}>
              {kicker}
            </span>
          ) : null}
          <span className="mt-0.5 block text-sm font-semibold leading-relaxed text-slate-200">{label}</span>
        </div>
        {badge ? <div className="min-w-0 max-w-[52%] flex-none text-right">{badge}</div> : null}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="font-mono text-2xl font-black leading-none text-white">{value}</span>
        {indicator ? <span className="flex-none">{indicator}</span> : null}
      </div>

      {footers && footers.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[#1E293B] pt-3">
          {footers.map((footer) => (
            <div key={footer.label} className="min-w-0">
              <span className="block text-[9px] uppercase tracking-wider text-slate-500">{footer.label}</span>
              <span
                className={cn(
                  "mt-0.5 block font-mono text-xs font-bold",
                  footer.tone === "good"
                    ? "text-emerald-400"
                    : footer.tone === "bad"
                    ? "text-red-400"
                    : "text-slate-200",
                )}
              >
                {footer.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {action ? <div className="mt-3">{action}</div> : null}
    </article>
  );
}

export function KpiDelta({ children, tone = "good" }: { children: ReactNode; tone?: "good" | "bad" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
        tone === "good" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
      )}
    >
      {children}
    </span>
  );
}

export function StatusTag({ tone, children }: { tone: ExecutiveTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded px-2 py-0.5 text-center font-mono text-[10px] font-bold leading-relaxed ring-1",
        toneGlow[tone],
      )}
    >
      {children}
    </span>
  );
}

/** One row of the substrate material usage & waste table. */
export function MaterialYieldRow({
  sku,
  material,
  issued,
  output,
  scrap,
  variance,
  statusLabel,
  statusTone,
  action,
}: {
  sku: string;
  material: string;
  issued: string;
  output: string;
  scrap: string;
  variance: string;
  statusLabel: string;
  statusTone: ExecutiveTone;
  action?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-12 items-center gap-2 border-b border-[#151e2d] px-3 py-2.5 last:border-0">
      <div className="col-span-3 min-w-0">
        <span className="block truncate text-xs font-bold text-white">{material}</span>
        <span className="block font-mono text-[9px] text-slate-500">{sku}</span>
      </div>
      <div className="col-span-2 text-right font-mono text-[11px] text-slate-300">{issued}</div>
      <div className="col-span-2 text-right font-mono text-[11px] text-emerald-400">{output}</div>
      <div className="col-span-2 text-right font-mono text-[11px] text-amber-400">{scrap}</div>
      <div className="col-span-1 text-right font-mono text-[11px] text-red-400">{variance}</div>
      <div className="col-span-2 flex items-center justify-end gap-1.5">
        <StatusTag tone={statusTone}>{statusLabel}</StatusTag>
        {action ? action : null}
      </div>
    </div>
  );
}

/** One ranked operator entry in the operator yield ranking card. */
export function OperatorRankItem({
  rank,
  name,
  machine,
  yieldPct,
  metricLabel,
  badgeTone,
  badgeLabel,
  loss,
}: {
  rank: number;
  name: string;
  machine: string;
  yieldPct: number;
  metricLabel: string;
  badgeTone: "emerald" | "sky" | "amber" | "red";
  badgeLabel: string;
  loss?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[#151e2d] px-3 py-2.5 last:border-0">
      <span
        className={cn(
          "grid h-7 w-7 flex-none place-items-center rounded-md font-mono text-xs font-black",
          rank === 1 ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40" : "bg-[#1B2433] text-slate-400",
        )}
      >
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-bold text-white">{name}</span>
          <span className={cn("rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ring-1", toneGlow[badgeTone])}>
            {badgeLabel}
          </span>
        </div>
        <span className="block text-[10px] text-slate-500">{machine} · {metricLabel}</span>
      </div>
      <div className="flex flex-none flex-col items-end">
        <span className="font-mono text-sm font-black text-white">{yieldPct.toFixed(1)}%</span>
        {loss ? <span className="font-mono text-[9px] text-red-400">{loss}</span> : null}
      </div>
    </div>
  );
}

/** One high-value ceiling / floor audit ledger entry card. */
export function AuditLedgerCard({
  icon,
  time,
  title,
  subtitle,
  badgeTone,
  badgeLabel,
  impact,
}: {
  icon: ReactNode;
  time: string;
  title: string;
  subtitle: string;
  badgeTone: ExecutiveTone;
  badgeLabel: string;
  impact: { tone: "bad" | "neutral"; label: string };
}) {
  return (
    <article className="rounded-lg border border-[#1E293B] bg-[#0F1622] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={cn("grid h-8 w-8 flex-none place-items-center rounded-md ring-1", toneGlow[badgeTone])}>
            {icon}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-bold text-white">{title}</span>
              <StatusTag tone={badgeTone}>{badgeLabel}</StatusTag>
            </div>
            <span className="block text-[10px] text-slate-500">{subtitle}</span>
          </div>
        </div>
        <span className="font-mono text-[9px] text-slate-500">{time}</span>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-[#1E293B] pt-2">
        <span className="font-mono text-[10px] text-slate-400">የመዝገብ መለያ: YA-{Math.abs(title.length * 37) % 9000 + 1000}</span>
        <span
          className={cn(
            "font-mono text-[11px] font-bold",
            impact.tone === "bad" ? "text-red-400" : "text-slate-300",
          )}
        >
          {impact.label}
        </span>
      </div>
    </article>
  );
}
