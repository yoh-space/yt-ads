"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Check, PackageSearch } from "lucide-react";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { Select } from "@/components/shared/ui/select";

type Material = {
  id: Id<"materials">;
  name: string;
  category: string;
  unit: string;
  reorderAt: number;
};

const LEVELS = [0, 5, 10, 25, 50, 100, 250, 500, 1000];

function optionsFor(value: number) {
  return [...new Set(value > 0 && !LEVELS.includes(value) ? [value, ...LEVELS] : LEVELS)];
}

export function RawMaterialReorderSection({ materials }: { materials: Material[] }) {
  const updateReorderLevel = useMutation(api.owner.materials.updateReorderLevel);
  const [saving, setSaving] = useState<Id<"materials"> | null>(null);
  const [saved, setSaved] = useState<Id<"materials"> | null>(null);
  const [error, setError] = useState("");

  async function update(materialId: Id<"materials">, reorderAt: number) {
    setSaving(materialId);
    setSaved(null);
    setError("");
    try {
      await updateReorderLevel({ materialId, reorderAt });
      setSaved(materialId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the reorder level.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Raw material reorder levels"
        subtitle="Choose when each material should be reordered."
        kicker="Inventory"
        icon={<PackageSearch size={16} />}
      />
      {materials.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No raw materials are available.</p>
      ) : (
        <div className="divide-y divide-border">
          {materials.map((material) => (
            <div key={material.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{material.name}</p>
                <p className="text-xs text-muted-foreground">{material.category} · measured in {material.unit}</p>
              </div>
              <div className="flex items-center gap-2 sm:min-w-56 sm:justify-end">
                <label htmlFor={`reorder-${material.id}`} className="text-xs text-muted-foreground">Reorder when below</label>
                <Select
                  id={`reorder-${material.id}`}
                  value={String(material.reorderAt)}
                  disabled={saving === material.id}
                  onChange={(event) => update(material.id, Number(event.target.value))}
                  className="w-28"
                >
                  {optionsFor(material.reorderAt).map((level) => (
                    <option key={level} value={level}>{level} {material.unit}</option>
                  ))}
                </Select>
                {saved === material.id ? <Check size={15} className="text-emerald-600" aria-label="Saved" /> : null}
              </div>
            </div>
          ))}
        </div>
      )}
      {error ? <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p> : null}
    </Panel>
  );
}
