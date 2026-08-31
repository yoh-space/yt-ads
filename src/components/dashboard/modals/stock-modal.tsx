"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
import type { InputUnit } from "@/lib/units";
import type { Material } from "@/lib/operations-types";
import { convertToBase, formatQuantity } from "@/lib/units";
import { ModalShell } from "./modal-shell";

function inputUnitsFor(material?: Material): InputUnit[] {
  if (!material) return [];
  return Array.from(new Set<InputUnit>([
    ...(material.purchaseUnit ? [material.purchaseUnit] : []),
    material.unit,
  ]));
}

export function StockModal({
  materials,
  onClose,
  onSave,
}: {
  materials: Material[];
  onClose: () => void;
  onSave: (materialId: string, direction: "in" | "out", quantity: number, inputUnit: InputUnit, note: string) => void;
}) {
  const firstMaterial = materials[0];
  const [materialId, setMaterialId] = useState(firstMaterial?.id ?? "");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState(1);
  const [inputUnit, setInputUnit] = useState<InputUnit>(firstMaterial?.purchaseUnit ?? firstMaterial?.unit ?? "m²");
  const [note, setNote] = useState("");
  const material = materials.find((entry) => entry.id === materialId);
  const inputUnits = inputUnitsFor(material);
  const converted = material
    ? (() => {
        try {
          return convertToBase(
            quantity,
            inputUnit,
            material.baseUnit ?? material.unit,
            material.conversionRatio,
            material.rollEquivalent,
            material.sheetEquivalent,
          );
        } catch {
          return 0;
        }
      })()
    : 0;

  return (
    <ModalShell
      title="Stock movement"
      subtitle="Record a purchase-unit movement and convert it into the tracked base unit."
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
              setInputUnit(next?.purchaseUnit ?? next?.unit ?? "m²");
            }}
          >
            {materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
          {material?.specification ? <small className="settings-help">{material.specification}{material.specificationValue ? `: ${material.specificationValue}` : " — choose the configured variant in master data"}</small> : null}
        </label>
        <div className="two-field">
          <label>Purchase quantity<input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
          <label>
            Entry unit
            <select value={inputUnit} onChange={(event) => setInputUnit(event.target.value as InputUnit)}>
              {inputUnits.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <div className="conversion-box">
          <Sparkles size={17} />
          <span>Normalized base quantity</span>
          <strong>{formatQuantity(converted, material?.baseUnit ?? material?.unit ?? "m²")}</strong>
        </div>
        {material?.conversionRatio ? <small className="settings-help">1 {material.purchaseUnit ?? "purchase unit"} = {material.conversionRatio} {material.baseUnit ?? material.unit}</small> : <small className="settings-help">No conversion ratio is configured for this material. Confirm it before receiving roll or sheet stock.</small>}
        <label>Reference note<input placeholder="Supplier, job card, or issue reason" value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <button className="button primary full" type="submit">Save stock movement <ArrowUpRight size={16} /></button>
      </form>
    </ModalShell>
  );
}
