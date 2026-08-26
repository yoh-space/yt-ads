"use client";

import { Scissors, Store, Trash2 } from "lucide-react";
import type { Offcut, ScrapLog } from "@/lib/operations-types";

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
    <section className="offcut-layout">
      <div className="offcut-hero">
        <div className="offcut-icon"><Scissors size={25} /></div>
        <div>
          <span className="panel-kicker">RECOVERY INVENTORY</span>
          <h2>ሊጠቀሙበት የሚችሉ ቅሪት እቃዎች</h2>
          <p>Reusable sheet pieces are returned to active store stock automatically.</p>
        </div>
        <div className="recovery-actions">
          {canScrap ? <button className="button secondary" onClick={onScrap}><Trash2 size={16} />Log scrap</button> : null}
          {canCreate ? <button className="button primary" onClick={onCreate}><Scissors size={16} />Log new offcut</button> : null}
        </div>
      </div>
      <div className="offcut-grid">
        {offcuts.map((offcut) => (
          <article className="offcut-card" key={offcut.id}>
            <div className="offcut-preview">
              <i style={{ width: `${Math.min(100, offcut.width * 55)}%`, height: `${Math.min(100, offcut.length * 55)}%` }} />
            </div>
            <div className="offcut-data">
              <div>
                <span className="status-pill success">Available</span>
                <small>{offcut.createdAt}</small>
              </div>
              <h3>{offcut.label}</h3>
              <p>{offcut.width}m × {offcut.length}m <b>{offcut.area} m²</b></p>
              <footer>
                <span><Store size={14} />{offcut.location}</span>

              </footer>
            </div>
          </article>
        ))}
      </div>
      <article className="scrap-panel">
        <div>
          <span className="panel-kicker coral">WASTE CONTROL</span>
          <h3>Unusable scrap register</h3>
          <p>Separate from reusable offcuts and included in the live wastage metric.</p>
        </div>
        <strong>{scrapTotal.toFixed(1)} <small>logged units</small></strong>
        {canScrap ? <button className="button secondary small" onClick={onScrap}>Record scrap</button> : null}
        {scraps.length ? (
          <div className="scrap-list">
            {scraps.slice(0, 3).map((scrap) => (
              <span key={scrap.id}><Trash2 size={13} /><b>{scrap.label}</b> · {scrap.quantity} {scrap.unit} · {scrap.reason}</span>
            ))}
          </div>
        ) : (
          <div className="scrap-list empty">No unusable scrap logged in this session.</div>
        )}
      </article>
    </section>
  );
}
