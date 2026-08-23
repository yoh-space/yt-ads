"use client";

import { useState } from "react";
import { ArrowUpRight, Trash2 } from "lucide-react";
import type { Material, Unit } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { ModalShell } from "./modal-shell";

export type NewScrapInput = {
  materialId: string;
  quantity: number;
  reason: string;
};

export function ScrapModal({
  materials,
  onClose,
  onSave,
}: {
  materials: Material[];
  onClose: () => void;
  onSave: (input: NewScrapInput) => void;
}) {
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [quantity, setQuantity] = useState(0.2);
  const [reason, setReason] = useState("Misprint / trim loss");
  const material = materials.find((entry) => entry.id === materialId);

  return (
    <ModalShell title="Log unusable scrap" subtitle="Record non-recoverable waste separately so the wastage metric and discrepancy view remain accurate." onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!material) return;
          onSave({ materialId, quantity, reason });
        }}
      >
        <label>
          Material
          <select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
            {materials.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
          </select>
        </label>
        <label>Unusable quantity ({material?.unit})<input type="number" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
        <label>Waste reason<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <div className="conversion-box"><Trash2 size={17} /><span>Wastage register</span><strong>{formatQuantity(quantity, material?.unit ?? ("m²" as Unit))}</strong></div>
        <button className="button primary full" type="submit">Save scrap record <ArrowUpRight size={16} /></button>
      </form>
    </ModalShell>
  );
}
