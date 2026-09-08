"use client";

import { useState } from "react";
import { ArrowUpRight, Scissors } from "lucide-react";
import type { Material } from "@/lib/operations-types";
import { calculateOffcutArea } from "@/lib/units";
import { ModalShell } from "./modal-shell";
import { Button, NumericInput } from "@/components/ui";

export type NewOffcutInput = {
  materialId: string;
  width: number;
  length: number;
  location: string;
  operatorSubStockId?: string;
  machineId?: string;
};

export function OffcutModal({
  materials,
  onClose,
  onSave,
  operatorSubStockId,
  machineId,
}: {
  materials: Material[];
  onClose: () => void;
  onSave: (input: NewOffcutInput) => void;
  operatorSubStockId?: string;
  machineId?: string;
}) {
  const sheetMaterials = materials.filter((material) => material.unit === "m²");
  const [materialId, setMaterialId] = useState(sheetMaterials[0]?.id ?? "");
  const [width, setWidth] = useState("1");
  const [length, setLength] = useState("0.5");
  const [dimensionsValid, setDimensionsValid] = useState({ width: true, length: true });
  const [location, setLocation] = useState("Rack B · Slot 01");
  const area = calculateOffcutArea(Number(width) || 0, Number(length) || 0);
  const hasValidationError = !dimensionsValid.width || !dimensionsValid.length || !width.trim() || !length.trim();

  return (
    <ModalShell
      title="Log usable offcut"
      subtitle="Return a reusable sheet piece to active inventory and a physical rack location."
      onClose={onClose}
      footer={
          <Button type="submit" form="offcut-form" disabled={hasValidationError}>
          Return to active inventory
          <ArrowUpRight size={16} />
        </Button>
      }
    >
      <form
        id="offcut-form"
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
            if (!hasValidationError) {
              onSave({ materialId, width: Number(width), length: Number(length), location, operatorSubStockId, machineId });
            }
        }}
      >
        <div>
          <label className="block text-sm font-semibold text-navy mb-2">
            Sheet material
          </label>
          <select 
            value={materialId} 
            onChange={(event) => setMaterialId(event.target.value)}
            className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
          >
            {sheetMaterials.map((entry) => (
              <option value={entry.id} key={entry.id}>{entry.name}</option>
            ))}
          </select>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Width (m)
            </label>
            <NumericInput
              min={0.1}
              step="0.1"
              value={width}
              emptyValue={0.1}
              onChange={setWidth}
              onValidityChange={(isValid) => setDimensionsValid((current) => ({ ...current, width: isValid }))}
              className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Length (m)
            </label>
            <NumericInput
              min={0.1}
              step="0.1"
              value={length}
              emptyValue={0.1}
              onChange={setLength}
              onValidityChange={(isValid) => setDimensionsValid((current) => ({ ...current, length: isValid }))}
              className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-3 bg-green/10 rounded-lg border border-green/20">
          <Scissors size={17} className="text-green flex-none" />
          <span className="text-sm text-gray-600">Usable area returned</span>
          <span className="font-semibold text-navy ml-auto">{area} m²</span>
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-navy mb-2">
            Rack location
          </label>
          <input 
            value={location} 
            onChange={(event) => setLocation(event.target.value)}
            className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
          />
        </div>
      </form>
    </ModalShell>
  );
}


