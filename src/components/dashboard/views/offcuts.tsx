"use client";

import { Scissors, Store, Trash2 } from "lucide-react";
import type { Offcut, ScrapLog } from "@/lib/operations-types";
import { Button, StatusPill } from "@/components/ui";

export function OffcutsView({
  offcuts,
  scraps,
  canCreate,
  canScrap,
  onCreate,
  onScrap,
}: {
  offcuts: Offcut[];
  canCreate: boolean;
  canScrap: boolean;
  scraps: ScrapLog[];
  onCreate: () => void;
  onScrap: () => void;
}) {
  const scrapTotal = scraps.reduce((total, scrap) => total + scrap.quantity, 0);
  return (
    <div className="space-y-6">
      {/* Hero / actions */}
      <div className="bg-white border border-line rounded-lg p-6 shadow-sm flex flex-col sm:flex-row items-start gap-4 justify-between">
        <div className="flex items-start gap-4">
          <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-cyan/10 text-cyan flex-none">
            <Scissors size={25} />
          </span>
          <div>
            <span className="block text-xs font-mono font-bold tracking-wider text-cyan-dark uppercase">
              RECOVERY INVENTORY
            </span>
            <h2 className="text-lg font-bold text-navy mt-1">ሊጠቀሙበት የሚችሉ ቅሪት እቃዎች</h2>
            <p className="text-sm text-gray-600 mt-1">Reusable sheet pieces are returned to active store stock automatically.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-none">
          {canScrap ? (
            <Button variant="secondary" onClick={onScrap}>
              <Trash2 size={16} />Log scrap
            </Button>
          ) : null}
          {canCreate ? (
            <Button onClick={onCreate}>
              <Scissors size={16} />Log new offcut
            </Button>
          ) : null}
        </div>
      </div>

      {/* Offcut cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {offcuts.map((offcut) => (
          <article key={offcut.id} className="bg-white border border-line rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="relative h-36 bg-[linear-gradient(135deg,#f2f7f9_25%,transparent_25%,transparent_50%,#f2f7f9_50%,#f2f7f9_75%,transparent_75%,transparent)] bg-[length:16px_16px] bg-[#f9fbfc] border-b border-line flex items-center justify-center p-5">
              <i
                className="block bg-gradient-to-br from-cyan/30 to-cyan/10 border-2 border-cyan/50 rounded-sm shadow-sm"
                style={{ width: `${Math.min(100, offcut.width * 55)}%`, height: `${Math.min(100, offcut.length * 55)}%` }}
              />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <StatusPill variant="success">Available</StatusPill>
                <small className="text-xs text-gray-500">{offcut.createdAt}</small>
              </div>
              <h3 className="font-semibold text-navy">{offcut.label}</h3>
              <p className="mt-1 text-sm text-gray-600">
                {offcut.width}m × {offcut.length}m <b className="text-navy">{offcut.area} m²</b>
              </p>
              <footer className="mt-3 pt-3 border-t border-line flex items-center gap-1.5 text-xs text-gray-500">
                <Store size={14} className="text-cyan-dark" /> {offcut.location}
              </footer>
            </div>
          </article>
        ))}
        {offcuts.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 p-10 text-center text-sm text-gray-500 bg-white border border-dashed border-line rounded-lg">
            No reusable offcuts registered yet.
          </div>
        ) : null}
      </div>

      {/* Scrap register */}
      <article className="bg-white border border-line rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <span className="block text-xs font-mono font-bold tracking-wider text-coral uppercase">WASTE CONTROL</span>
            <h3 className="text-lg font-bold text-navy mt-1">Unusable scrap register</h3>
            <p className="text-sm text-gray-600 mt-1">
              Separate from reusable offcuts and included in the live wastage metric.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <strong className="block text-2xl font-bold text-coral">{scrapTotal.toFixed(1)}</strong>
              <small className="text-xs text-gray-500">logged units</small>
            </div>
            {canScrap ? (
              <Button variant="secondary" size="small" onClick={onScrap}>Record scrap</Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-line">
          {scraps.length ? (
            <ul className="space-y-2">
              {scraps.slice(0, 3).map((scrap) => (
                <li key={scrap.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-coral/10 text-coral flex-none">
                    <Trash2 size={13} />
                  </span>
                  <b className="text-navy">{scrap.label}</b> · {scrap.quantity} {scrap.unit} · {scrap.reason}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-500">No unusable scrap logged in this session.</div>
          )}
        </div>
      </article>
    </div>
  );
}