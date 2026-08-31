"use client";

import { useMemo, useState } from "react";
import { PackagePlus, Scale } from "lucide-react";
import type { Material } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { ModalShell } from "./modal-shell";

export type NewReconciliationInput = {
  materialId: string;
  countedQuantity: number;
  note?: string;
};

export function ReconciliationModal({
  materials,
  onClose,
  onSave,
}: {
  materials: Material[];
  onClose: () => void;
  onSave: (input: NewReconciliationInput) => void;
}) {
  const first = materials[0];
  const [materialId, setMaterialId] = useState(first?.id ?? "");
  const [countedQuantity, setCountedQuantity] = useState(0);
  const [note, setNote] = useState("");

  const material = materials.find((entry) => entry.id === materialId);
  const unit = material?.baseUnit ?? material?.unit ?? "m²";
  const systemQuantity = material?.quantity ?? 0;
  const variance = useMemo(() => Number((countedQuantity - systemQuantity).toFixed(3)), [countedQuantity, systemQuantity]);
  const shortage = variance < 0;
  const estimatedLoss = shortage ? (material?.etbValue ?? 0) * -variance : 0;

  return (
    <ModalShell title="Physical stock count" subtitle="Record the physically counted quantity for a material. The system balance and variance are computed automatically." onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (materialId && countedQuantity >= 0) {
            onSave({ materialId, countedQuantity, note: note.trim() || undefined });
          }
        }}
      >
        <label>
          Material
          <select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
            {materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {formatQuantity(entry.quantity, entry.baseUnit ?? entry.unit)}</option>)}
          </select>
        </label>
        <div className="conversion-box">
          <Scale size={17} />
          <span>System expected balance</span>
          <strong>{formatQuantity(systemQuantity, unit)}</strong>
        </div>
        <label>
          Physical counted quantity ({unit})
          <input type="number" min="0" step="0.01" value={countedQuantity} onChange={(event) => setCountedQuantity(Number(event.target.value))} />
        </label>
        <div className={`conversion-box ${shortage ? "shortage-box" : variance > 0 ? "surplus-box" : ""}`}>
          <Scale size={17} />
          <span>Variance (counted − system)</span>
          <strong className={shortage ? "warning-text" : variance > 0 ? "success-text" : ""}>
            {shortage ? "-" : variance > 0 ? "+" : ""}{variance.toLocaleString("en-US", { maximumFractionDigits: 3 })} {unit}
          </strong>
        </div>
        {shortage ? (
          <div className="conversion-box shortage-box">
            <span>Estimated monetary loss (ETB)</span>
            <strong className="warning-text">ETB {estimatedLoss.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong>
          </div>
        ) : null}
        <label>
          Note <span className="field-hint">Count source, order/cycle, or observations</span>
          <input placeholder="e.g. End-of-week shelf count, Rack B" value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" className="button tertiary" onClick={onClose}>Cancel</button>
          <button type="submit" className="button primary"><PackagePlus size={16} />Record count</button>
        </div>
      </form>
    </ModalShell>
  );
}
