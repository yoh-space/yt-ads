"use client";

export function InventoryLoader({ label }: { label?: string } = {}) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0F172A] px-6 text-slate-50"
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading YT Advertisement printing workspace"}
    >
      <div className="stitch-loader" aria-hidden="true">
        <div className="stitch-loader__orbit stitch-loader__orbit--outer" />
        <div className="stitch-loader__orbit stitch-loader__orbit--middle" />
        <div className="stitch-loader__orbit stitch-loader__orbit--inner" />
        <div className="stitch-loader__core">
          <span />
        </div>
      </div>

      <div className="mt-4 w-full max-w-sm overflow-hidden border-y border-cyan-400/20 py-2">
        <div className="stitch-loader__marquee whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-300">
          <span>YT Advertisement · Printing · YT Advertisement · Printing ·&nbsp;</span>
          <span aria-hidden="true">YT Advertisement · Printing · YT Advertisement · Printing ·&nbsp;</span>
        </div>
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
        {label ?? "Initializing workspace"}
      </p>
    </div>
  );
}
