"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { Accent, PurchaseUnit, Unit } from "@/lib/operations-types";
import { baseUnitOptions, purchaseUnitOptions } from "../nav-config";
import { ModalShell } from "./modal-shell";

export type NewMaterialInput = {
  name: string;
  category: string;
  unit: Unit;
  baseUnit: Unit;
  purchaseUnit: PurchaseUnit;
  conversionRatio: number;
  displayUnit?: string;
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

const defaultRatios: Record<PurchaseUnit, number> = {
  roll: 160,
  sheet: 2.977,
  pack: 20,
  liter: 1,
  piece: 1,
};

export function MaterialModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: NewMaterialInput) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Custom");
  const [baseUnit, setBaseUnit] = useState<Unit>("m²");
  const [purchaseUnit, setPurchaseUnit] = useState<PurchaseUnit>("roll");
  const [conversionRatio, setConversionRatio] = useState(defaultRatios.roll);
  const [displayUnit, setDisplayUnit] = useState("ሮል");
  const [quantity, setQuantity] = useState(0);
  const [reorderAt, setReorderAt] = useState(0);
  const [storageLocation, setStorageLocation] = useState("");
  const [averageUse, setAverageUse] = useState("");
  const [reorderRule, setReorderRule] = useState("");
  const [scrapRule, setScrapRule] = useState("");
  const [accent, setAccent] = useState<Accent>("cyan");

  function selectPurchaseUnit(value: PurchaseUnit) {
    setPurchaseUnit(value);
    setConversionRatio(defaultRatios[value]);
    setDisplayUnit(value === "roll" ? "ሮል" : value === "sheet" ? "ቁጥር" : value === "pack" ? "Pack" : value === "liter" ? "ሊትር" : "ቁጥር");
  }

  return (
    <ModalShell title="Add raw material" subtitle="Define how purchasing units become normalized production units." onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            name: name || "New material",
            category: category.trim() || "Custom",
            unit: baseUnit,
            baseUnit,
            purchaseUnit,
            conversionRatio,
            displayUnit: displayUnit.trim() || undefined,
            quantity,
            reorderAt,
            rollEquivalent: purchaseUnit === "roll" ? conversionRatio : undefined,
            sheetEquivalent: purchaseUnit === "sheet" ? conversionRatio : undefined,
            storageLocation: storageLocation || undefined,
            averageUse: averageUse || undefined,
            reorderRule: reorderRule || undefined,
            scrapRule: scrapRule || undefined,
            accent,
          });
        }}
      >
        <label>Material name<input autoFocus required placeholder="e.g. Banner" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="two-field">
          <label>Category<input value={category} onChange={(event) => setCategory(event.target.value)} /></label>
          <label>Purchase/display label<input placeholder="e.g. ሮል" value={displayUnit} onChange={(event) => setDisplayUnit(event.target.value)} /></label>
        </div>
        <div className="two-field">
          <label>Purchase unit<select value={purchaseUnit} onChange={(event) => selectPurchaseUnit(event.target.value as PurchaseUnit)}>{purchaseUnitOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label>Base production unit<select value={baseUnit} onChange={(event) => setBaseUnit(event.target.value as Unit)}>{baseUnitOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        </div>
        <div className="two-field">
          <label>Conversion ratio<input type="number" min="0.001" step="0.001" required value={conversionRatio} onChange={(event) => setConversionRatio(Number(event.target.value))} /></label>
          <label>Opening base quantity<input type="number" min="0" step="0.01" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
        </div>
        <div className="conversion-box"><Sparkles size={17} /><span>1 {purchaseUnit} converts to</span><strong>{conversionRatio} {baseUnit}</strong></div>
        <label>Reorder base quantity<input type="number" min="0" step="0.01" value={reorderAt} onChange={(event) => setReorderAt(Number(event.target.value))} /></label>
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
