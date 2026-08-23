"use client";

import { useState } from "react";
import { ArrowUpRight, Scissors } from "lucide-react";
import type { Material } from "@/lib/operations-types";
import { calculateOffcutArea } from "@/lib/units";
import { ModalShell } from "./modal-shell";

export type NewOffcutInput = {
  materialId: string;
  width: number;
  length: number;
  location: string;
};

export function OffcutModal({
  materials,
  onClose,
  onSave,
}: {
  materials: Material[];
  onClose: () => void;
  onSave: (input: NewOffcutInput) => void;
}) {
  const sheetMaterials = materials.filter((material) => material.unit === "m²");
  const [materialId, setMaterialId] = useState(sheetMaterials[0]?.id ?? "");
  const [width, setWidth] = useState(1);
  const [length, setLength] = useState(0.5);
  const [location, setLocation] = useState("Rack B · Slot 01");
  const area = calculateOffcutArea(width, length);

  return (
    <ModalShell
      title="Log usable offcut"
      subtitle="Return a reusable sheet piece to active inventory and a physical rack location."
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ materialId, width, length, location });
        }}
      >
        <label>
          Sheet material
          <select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
            {sheetMaterials.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
          </select>
        </label>
        <div className="two-field">
          <label>Width (m)<input type="number" min="0.1" step="0.1" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label>
          <label>Length (m)<input type="number" min="0.1" step="0.1" value={length} onChange={(event) => setLength(Number(event.target.value))} /></label>
        </div>
        <div className="conversion-box"><Scissors size={17} /><span>Usable area returned</span><strong>{area} m²</strong></div>
        <label>Rack location<input value={location} onChange={(event) => setLocation(event.target.value)} /></label>
        <button className="button primary full" type="submit">Return to active inventory <ArrowUpRight size={16} /></button>
      </form>
    </ModalShell>
  );
}


