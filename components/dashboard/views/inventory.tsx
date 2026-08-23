"use client";

import { AlertTriangle, ArrowUpRight, Box, MoreHorizontal, PackagePlus } from "lucide-react";
import type { Material } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";

export function InventoryView({
  materials,
  lowStock,
  onStock,
  onAdd,
}: {
  materials: Material[];
  lowStock: Material[];
  onStock: () => void;
  onAdd: () => void;
}) {
  return (
    <section className="panel inventory-panel">
      <div className="inventory-callout">
        <div>
          <span className="panel-kicker">STOREKEEPER CONSOLE</span>
          <h2>የመጋዘን መዝገብ</h2>
          <p>Stock is recorded in base units. Roll conversions are applied automatically on entry.</p>
        </div>
        <div>
          <button className="button secondary" onClick={onStock}><ArrowUpRight size={16} />Stock In / Out</button>
          <button className="button primary" onClick={onAdd}><PackagePlus size={16} />New material</button>
        </div>
      </div>
      {lowStock.length ? (
        <div className="low-stock-banner">
          <AlertTriangle size={18} />
          <span>
            <b>{lowStock.length} reorder alert{lowStock.length > 1 ? "s" : ""}</b> require storekeeper attention before the next production cycle.
          </span>
        </div>
      ) : null}
      <div className="inventory-table">
        <div className="table-header"><span>MATERIAL</span><span>CATEGORY</span><span>AVAILABLE</span><span>REORDER LEVEL</span><span>STATE</span><span /></div>
        {materials.map((material) => {
          const low = material.quantity <= material.reorderAt;
          return (
            <div className="table-row material-row" key={material.id}>
              <div className="material-name">
                <span className={`material-swatch ${material.accent}`}><Box size={16} /></span>
                <p>
                  <b>{material.name}</b>
                  <small>Base unit: {material.unit}{material.rollEquivalent ? ` · 1 roll = ${material.rollEquivalent} ${material.unit}` : ""}</small>
                </p>
              </div>
              <span>{material.category}</span>
              <strong>{formatQuantity(material.quantity, material.unit)}</strong>
              <span>{formatQuantity(material.reorderAt, material.unit)}</span>
              <span className={`status-pill ${low ? "warning" : "success"}`}>{low ? "Reorder" : "Healthy"}</span>
              <button className="icon-button subtle" onClick={onStock}><MoreHorizontal size={18} /></button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
