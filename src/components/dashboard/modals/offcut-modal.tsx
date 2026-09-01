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
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ materialId, width, length, location });
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
            <input 
              type="number" 
              min="0.1" 
              step="0.1" 
              value={width} 
              onChange={(event) => setWidth(Number(event.target.value))}
              className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Length (m)
            </label>
            <input 
              type="number" 
              min="0.1" 
              step="0.1" 
              value={length} 
              onChange={(event) => setLength(Number(event.target.value))}
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
        
        <button 
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg bg-navy text-white shadow-sm transition-colors hover:bg-navy-2 focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2"
          type="submit"
        >
          Return to active inventory 
          <ArrowUpRight size={16} />
        </button>
      </form>
    </ModalShell>
  );
}


