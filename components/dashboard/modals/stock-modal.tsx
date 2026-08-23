"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
import type { Material, Unit } from "@/lib/operations-types";
import { convertToBase, formatQuantity } from "@/lib/units";
import { ModalShell } from "./modal-shell";

export function StockModal({
  materials,
  onClose,
  onSave,
}: {
  materials: Material[];
  onClose: () => void;
  onSave: (materialId: string, direction: "in" | "out", quantity: number, inputUnit: "roll" | "sheet" | Unit, note: string) => void;
}) {
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState(1);
  const [inputUnit, setInputUnit] = useState<"roll" | "sheet" | Unit>(materials[0]?.rollEquivalent ? "roll" : materials[0]?.sheetEquivalent ? "sheet" : (materials[0]?.unit ?? "m²"));
  const [note, setNote] = useState("");
  const material = materials.find((entry) => entry.id === materialId);
  const canRoll = Boolean(material?.rollEquivalent);
  const canSheet = Boolean(material?.sheetEquivalent);
  const converted = material
    ? (() => {
        try {
          return convertToBase(quantity, inputUnit, material.unit, material.rollEquivalent, material.sheetEquivalent);
        } catch {
          return 0;
        }
      })()
    : 0;

  return (
    <ModalShell
      title="Stock movement"
      subtitle="Record stock in or out with roll and sheet conversions into the tracked base unit."
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(materialId, direction, quantity, inputUnit, note);
        }}
      >
        <div className="choice-row">
          <button type="button" className={direction === "in" ? "selected in" : ""} onClick={() => setDirection("in")}><ArrowDownRight size={18} />Stock In</button>
          <button type="button" className={direction === "out" ? "selected out" : ""} onClick={() => setDirection("out")}><ArrowUpRight size={18} />Stock Out</button>
        </div>
        <label>
          Material
          <select
            value={materialId}
            onChange={(event) => {
              const next = materials.find((entry) => entry.id === event.target.value);
              setMaterialId(event.target.value);
              setInputUnit(next?.rollEquivalent ? "roll" : next?.sheetEquivalent ? "sheet" : (next?.unit ?? "m²"));
            }}
          >
            {materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </label>
        <div className="two-field">
          <label>Quantity<input type="number" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
          <label>
            Entry unit
            <select value={inputUnit} onChange={(event) => setInputUnit(event.target.value as "roll" | "sheet" | Unit)}>
              {canRoll ? <option value="roll">Roll</option> : null}
              {canSheet ? <option value="sheet">Sheet</option> : null}
              <option value={material?.unit}>{material?.unit}</option>
            </select>
          </label>
        </div>
        <div className="conversion-box">
          <Sparkles size={17} />
          <span>Auto conversion</span>
          <strong>{formatQuantity(converted, material?.unit ?? "m²")}</strong>
        </div>
        <label>Reference note<input placeholder="Supplier, job card, or issue reason" value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <button className="button primary full" type="submit">Save stock movement <ArrowUpRight size={16} /></button>
      </form>
    </ModalShell>
  );
}
