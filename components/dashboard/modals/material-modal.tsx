"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { Accent, PurchaseUnit, Unit } from "@/lib/operations-types";
import { findMaterialSpecification } from "@/shared/material-specifications";
import { baseUnitOptions, materialDefinitionOptions, purchaseUnitOptions } from "../nav-config";
import { ModalShell } from "./modal-shell";

export type NewMaterialInput = {
  name: string;
  category: string;
  unit: Unit;
  baseUnit: Unit;
  purchaseUnit: PurchaseUnit;
  conversionRatio?: number;
  specification?: string;
  specificationValue?: string;
  specificationOptions?: string[];
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

const defaultRatios: Record<PurchaseUnit, number | undefined> = {
  roll: 160,
  sheet: 2.977,
  pack: 20,
  liter: 1,
  piece: 1,
};

const chooseValue = "__choose__";

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
  const [conversionRatio, setConversionRatio] = useState<number | undefined>(defaultRatios.roll);
  const [specificationValue, setSpecificationValue] = useState("");
  const [displayUnit, setDisplayUnit] = useState("ሮል");
  const [quantity, setQuantity] = useState(0);
  const [reorderAt, setReorderAt] = useState(0);
  const [storageLocation, setStorageLocation] = useState("");
  const [averageUse, setAverageUse] = useState("");
  const [reorderRule, setReorderRule] = useState("");
  const [scrapRule, setScrapRule] = useState("");
  const [accent, setAccent] = useState<Accent>("cyan");
  const [formError, setFormError] = useState("");

  const definition = findMaterialSpecification(name);
  const specificationOptions = definition?.specificationOptions ?? [];

  function selectMaterial(value: string) {
    if (value === chooseValue) return;
    if (value === "__custom__") {
      setName("");
      setCategory("Custom");
      setSpecificationValue("");
      setFormError("");
      return;
    }
    const selected = findMaterialSpecification(value);
    if (!selected) return;
    setName(selected.name);
    setCategory(selected.category);
    setBaseUnit(selected.baseUnit);
    setPurchaseUnit(selected.purchaseUnit);
    setConversionRatio(selected.conversionRatio);
    setDisplayUnit(selected.displayUnit);
    setSpecificationValue("");
    setStorageLocation(selected.storageLocation ?? "");
    setAverageUse(selected.averageUse ?? "");
    setFormError("");
  }

  function selectPurchaseUnit(value: PurchaseUnit) {
    setPurchaseUnit(value);
    setConversionRatio(defaultRatios[value]);
    setDisplayUnit(value === "roll" ? "ሮል" : value === "sheet" ? "ቁጥር" : value === "pack" ? "Pack" : value === "liter" ? "ሊትር" : "ቁጥር");
  }

  return (
    <ModalShell title="Add raw material" subtitle="Choose a standard material definition and record its exact type or size." onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (specificationOptions.length > 0 && !specificationValue) {
            setFormError(`Select a ${definition?.specification ?? "material specification"} option.`);
            return;
          }
          setFormError("");
          onSave({
            name: definition?.name ?? (name || "New material"),
            category: definition?.category ?? (category.trim() || "Custom"),
            unit: baseUnit,
            baseUnit,
            purchaseUnit,
            conversionRatio,
            specification: definition?.specification,
            specificationValue: specificationValue || undefined,
            specificationOptions: specificationOptions.length ? [...specificationOptions] : undefined,
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
        <label>Material definition
          <select value={definition?.name ?? (name ? "__custom__" : chooseValue)} onChange={(event) => selectMaterial(event.target.value)}>
            <option value={chooseValue} disabled>Select a standard material</option>
            {materialDefinitionOptions.map((materialName) => <option key={materialName} value={materialName}>{materialName}</option>)}
            <option value="__custom__">Custom material</option>
          </select>
        </label>
        <label>Material name<input autoFocus required placeholder="e.g. Banner" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="two-field">
          <label>Category<input value={definition?.category ?? category} readOnly={Boolean(definition)} onChange={(event) => setCategory(event.target.value)} /></label>
          <label>Purchase/display label<input placeholder="e.g. ሮል" value={displayUnit} readOnly={Boolean(definition)} onChange={(event) => setDisplayUnit(event.target.value)} /></label>
        </div>
        <div className="two-field">
          <label>Purchase unit<select value={purchaseUnit} disabled={Boolean(definition)} onChange={(event) => selectPurchaseUnit(event.target.value as PurchaseUnit)}>{purchaseUnitOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label>Base production unit<select value={baseUnit} disabled={Boolean(definition)} onChange={(event) => setBaseUnit(event.target.value as Unit)}>{baseUnitOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        </div>
        {definition?.specification ? (
          <label>{definition.specification}
            <select required value={specificationValue || chooseValue} onChange={(event) => setSpecificationValue(event.target.value === chooseValue ? "" : event.target.value)}>
              <option value={chooseValue} disabled>Select a standard option</option>
              {specificationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        ) : null}
        <div className="two-field">
          <label>Conversion ratio<input type="number" min="0.001" step="0.001" required={purchaseUnit !== "roll" || Boolean(definition?.conversionRatio)} value={conversionRatio ?? ""} placeholder={definition?.name === "PVC Film" ? "Pending physical confirmation" : undefined} onChange={(event) => setConversionRatio(event.target.value ? Number(event.target.value) : undefined)} /></label>
          <label>Opening base quantity<input type="number" min="0" step="0.01" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
        </div>
        <div className="conversion-box"><Sparkles size={17} /><span>1 {purchaseUnit} converts to</span><strong>{conversionRatio ? `${conversionRatio} ${baseUnit}` : "Pending confirmation"}</strong></div>
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
        {formError ? <p className="form-error">{formError}</p> : null}
        <button className="button primary full" type="submit">Add material <Plus size={16} /></button>
      </form>
    </ModalShell>
  );
}
