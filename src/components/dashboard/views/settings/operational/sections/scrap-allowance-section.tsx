"use client";

import { useMemo, useState } from "react";
import { Plus, Recycle, Trash2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Select } from "@/components/shared/ui";
import { FieldLabel, FormSection } from "../../chrome/form";
import { NumericField } from "../../chrome/numeric-field";
import type { ScrapAllowanceRow } from "../state";

/**
 * Per-source scrap allowance rules.
 * The default applies to any material without an explicit row; a value of 0
 * means "inherit the global Max Allowed Waste Rate" from the production rules.
 */
export function ScrapAllowanceSection({
  defaultScrapAllowancePercent,
  setDefaultScrapAllowancePercent,
  defaultMarginSquareMetres,
  setDefaultMarginSquareMetres,
  scrapAllowances,
  setScrapAllowances,
  materials,
  onMessage,
}: {
  defaultScrapAllowancePercent: number;
  setDefaultScrapAllowancePercent: (n: number) => void;
  defaultMarginSquareMetres: number;
  setDefaultMarginSquareMetres: (n: number) => void;
  scrapAllowances: ScrapAllowanceRow[];
  setScrapAllowances: React.Dispatch<React.SetStateAction<ScrapAllowanceRow[]>>;
  materials: { id: string; name: string; baseUnit?: string; unit: string }[];
  onMessage: (text: string) => void;
}) {
  const [newMaterialId, setNewMaterialId] = useState("");
  const [newAllowance, setNewAllowance] = useState(0);

  const remainingMaterials = useMemo(() => {
    const picked = new Set(scrapAllowances.map((row) => String(row.materialId)));
    return materials.filter((material) => !picked.has(material.id));
  }, [materials, scrapAllowances]);

  const materialById = useMemo(() => {
    return new Map(materials.map((material) => [material.id, material]));
  }, [materials]);

  function addAllowance() {
    if (!newMaterialId) {
      onMessage("Choose a material to assign a scrap allowance.");
      return;
    }
    if (!Number.isFinite(newAllowance) || newAllowance < 0 || newAllowance > 100) {
      onMessage("Scrap allowance must be between 0 and 100%.");
      return;
    }
    if (scrapAllowances.some((row) => row.materialId === newMaterialId)) {
      onMessage("That material already has a scrap allowance row.");
      return;
    }
    setScrapAllowances([...scrapAllowances, { materialId: newMaterialId as Id<"materials">, allowancePercent: newAllowance }]);
    setNewMaterialId("");
    setNewAllowance(0);
    onMessage("");
  }

  function removeAllowance(materialId: string) {
    setScrapAllowances((current) => current.filter((row) => row.materialId !== materialId));
  }

  return (
    <FormSection
      icon={<Recycle size={17} />}
      tone="violet"
      title="የብክነት ህግ"
      note="በእያንዳንዱ ዕቃ ምንጭ የሚቀበሉ የብክነት መጠን ማስተካከያ።"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NumericField
          label="Default Scrap Allowance"
          value={defaultScrapAllowancePercent}
          onChange={setDefaultScrapAllowancePercent}
          suffix="%"
          min={0}
          max={100}
          step="0.1"
          hint="0 inherits the global Max Allowed Waste Rate."
        />
        <NumericField
          label="Default Bleed / Margin"
          value={defaultMarginSquareMetres}
          onChange={setDefaultMarginSquareMetres}
          suffix="m²"
          min={0}
          step="0.01"
          hint="Added before scrap percentage during automatic deduction."
        />
      </div>

      {scrapAllowances.length > 0 ? (
        <div className="mt-4 space-y-2">
          {scrapAllowances.map((row) => {
            const material = materialById.get(row.materialId);
            return (
              <div
                key={row.materialId}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-navy/20 px-4 py-3"
              >
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-semibold text-foreground">
                    {material?.name ?? "Unknown material"}
                  </strong>
                  <small className="block text-[11px] text-muted-foreground">
                    {material?.baseUnit ?? material?.unit ?? "—"} · per-material allowance
                  </small>
                </div>
                <div className="flex flex-none items-center gap-3">
                  <div className="flex items-center gap-2">
                    <NumericField
                      label="Allowance"
                      value={row.allowancePercent}
                      onChange={(next) =>
                        setScrapAllowances((current) =>
                          current.map((entry) =>
                            entry.materialId === row.materialId
                              ? { ...entry, allowancePercent: Math.max(0, Math.min(100, next)) }
                              : entry,
                          ),
                        )
                      }
                      suffix="%"
                      min={0}
                      max={100}
                      step="0.1"
                    />
                  </div>
                  <button
                    type="button"
                    className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-coral/30 hover:bg-coral/10 hover:text-coral"
                    onClick={() => removeAllowance(row.materialId)}
                    aria-label={`Remove scrap allowance for ${material?.name ?? "material"}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-border bg-white/[0.02] px-4 py-6 text-center text-xs text-muted-foreground">
          No per-material scrap allowances configured. The default applies to every material.
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <FieldLabel>Material</FieldLabel>
          <Select value={newMaterialId} onChange={(event) => setNewMaterialId(event.target.value)}>
            <option value="">Choose a material…</option>
            {remainingMaterials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name} · {material.baseUnit ?? material.unit}
              </option>
            ))}
          </Select>
        </div>
        <NumericField
          label="Scrap allowance"
          value={newAllowance}
          onChange={setNewAllowance}
          suffix="%"
          min={0}
          max={100}
          step="0.1"
        />
        <div className="flex items-end">
          <Button type="button" variant="secondary" className="w-full" onClick={addAllowance}>
            <Plus size={15} />
            Add allowance
          </Button>
        </div>
      </div>
    </FormSection>
  );
}
