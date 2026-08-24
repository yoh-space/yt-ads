"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { Accent, Unit } from "@/lib/operations-types";
import { unitOptions } from "../nav-config";
import { ModalShell } from "./modal-shell";

export type NewMaterialInput = {
  name: string;
  category: string;
  unit: Unit;
  quantity: number;
  reorderAt: number;
  rollEquivalent?: number;
  sheetEquivalent?: number;
  storageLocation?: string;
  averageUse?: string;
  reorderRule?: string;
  scrapRule?: string;
  accent: Accent;
};

export function MaterialModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: NewMaterialInput) => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("m²");
  const [quantity, setQuantity] = useState(0);
  const [reorderAt, setReorderAt] = useState(0);
  const [storageLocation, setStorageLocation] = useState("");
  const [averageUse, setAverageUse] = useState("");
  const [reorderRule, setReorderRule] = useState("");
  const [scrapRule, setScrapRule] = useState("");
  const [rollEquivalent, setRollEquivalent] = useState(160);
  const [sheetEquivalent, setSheetEquivalent] = useState(2.98);
  const [accent, setAccent] = useState<Accent>("cyan");

  return (
    <ModalShell title="Add raw material" subtitle="Create a new trackable material with roll and sheet-to-base conversion rules." onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            name: name || "New material",
            category: "Custom",
            unit,
            quantity,
            reorderAt,
            rollEquivalent: unit === "m²" || unit === "m" ? rollEquivalent : undefined,
            sheetEquivalent: unit === "m²" ? sheetEquivalent : undefined,
            storageLocation: storageLocation || undefined,
            averageUse: averageUse || undefined,
            reorderRule: reorderRule || undefined,
            scrapRule: scrapRule || undefined,
            accent,
          });
        }}
      >
        <label>Material name<input autoFocus required placeholder="e.g. Dibond 3mm" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="two-field">
          <label>Base unit<select value={unit} onChange={(event) => setUnit(event.target.value as Unit)}>{unitOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label>Opening quantity<input type="number" min="0" step="0.1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
        </div>
        <div className="two-field">
          <label>Reorder level<input type="number" min="0" step="0.1" value={reorderAt} onChange={(event) => setReorderAt(Number(event.target.value))} /></label>
          {unit === "m²" || unit === "m" ? (
            <label>1 roll converts to<input type="number" min="0" step="0.1" value={rollEquivalent} onChange={(event) => setRollEquivalent(Number(event.target.value))} /></label>
          ) : (
            <span />
          )}
        </div>
        {unit === "m²" ? <label>1 standard sheet converts to (m²)<input type="number" min="0" step="0.01" value={sheetEquivalent} onChange={(event) => setSheetEquivalent(Number(event.target.value))} /></label> : null}
        <div className="two-field">
          <label>Storage location<input placeholder="e.g. Store / Rack A" value={storageLocation} onChange={(event) => setStorageLocation(event.target.value)} /></label>
          <label>Average use<input placeholder="e.g. Based on customer requirement" value={averageUse} onChange={(event) => setAverageUse(event.target.value)} /></label>
        </div>
        <div className="two-field">
          <label>Reorder rule<input placeholder="Optional rule" value={reorderRule} onChange={(event) => setReorderRule(event.target.value)} /></label>
          <label>Scrap rule<input placeholder="Optional rule" value={scrapRule} onChange={(event) => setScrapRule(event.target.value)} /></label>
        </div>
        <div className="conversion-box"><Sparkles size={17} /><span>Accent colour</span><select value={accent} onChange={(event) => setAccent(event.target.value as Accent)} style={{ border: 0, background: "transparent", fontWeight: 700, color: "inherit" }}><option value="cyan">Cyan</option><option value="gold">Gold</option><option value="violet">Violet</option><option value="blue">Blue</option><option value="green">Green</option></select></div>
        <button className="button primary full" type="submit">Add material <Plus size={16} /></button>
      </form>
    </ModalShell>
  );
}
