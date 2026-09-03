"use client";

import { useMemo, useState } from "react";
import { Cog, Plus, Trash2 } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { FieldLabel, FormSection } from "../../chrome/form";
import { NumericField } from "../../chrome/numeric-field";
import type { OverrideRow } from "../state";

export interface MaterialOption {
  id: string;
  name: string;
  baseUnit?: string;
  unit: string;
}

/** Per-material ETB valuation overrides for high-value materials. */
export function OverrideSection({
  overrides,
  setOverrides,
  materials,
  onMessage,
}: {
  overrides: OverrideRow[];
  setOverrides: React.Dispatch<React.SetStateAction<OverrideRow[]>>;
  materials: MaterialOption[];
  onMessage: (text: string) => void;
}) {
  const [newOverrideName, setNewOverrideName] = useState("");
  const [customName, setCustomName] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [newOverridePrice, setNewOverridePrice] = useState(0);

  const remainingMaterialOptions = useMemo(() => {
    const overrideNames = new Set(overrides.map((row) => row.materialName.toLowerCase()));
    return materials.filter((material) => !overrideNames.has(material.name.toLowerCase()));
  }, [materials, overrides]);

  function addOverride() {
    const name = customMode ? customName.trim() : newOverrideName;
    if (!name) {
      onMessage("Select or enter a material name to add a custom price override.");
      return;
    }
    if (!Number.isFinite(newOverridePrice) || newOverridePrice <= 0) {
      onMessage("Override price must be greater than zero.");
      return;
    }
    if (overrides.some((row) => row.materialName.toLowerCase() === name.toLowerCase())) {
      onMessage("That material already has a custom override.");
      return;
    }
    setOverrides([...overrides, { materialName: name, etbValue: newOverridePrice }]);
    setNewOverrideName("");
    setCustomName("");
    setCustomMode(false);
    setNewOverridePrice(0);
    onMessage("");
  }

  function removeOverride(materialName: string) {
    setOverrides((current) => current.filter((row) => row.materialName !== materialName));
  }

  return (
    <FormSection
      icon={<Cog size={17} />}
      tone="cyan"
      title="Individual Material Custom Price Overrides"
      note="Override the unit rate for high-value materials."
    >
      {overrides.length > 0 ? (
        <div className="space-y-2">
          {overrides.map((row) => (
            <div
              key={row.materialName}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-gray-50/60 px-4 py-3"
            >
              <div className="min-w-0">
                <strong className="block truncate text-sm font-semibold text-navy">{row.materialName}</strong>
                <small className="block text-[11px] text-gray-500">Custom valuation rate</small>
              </div>
              <div className="flex flex-none items-center gap-3">
                <b className="font-mono text-sm font-semibold text-navy">
                  {row.etbValue.toLocaleString("en-US")} ETB
                </b>
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-md border border-line text-gray-400 transition-colors hover:border-coral/30 hover:bg-coral/10 hover:text-coral"
                  onClick={() => removeOverride(row.materialName)}
                  aria-label={`Remove override for ${row.materialName}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-line bg-gray-50/50 px-4 py-6 text-center text-xs text-gray-500">
          No custom overrides configured.
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <FieldLabel>Material</FieldLabel>
          <Select
            value={newOverrideName}
            onChange={(event) => {
              const next = event.target.value;
              if (next === "__custom__") {
                setCustomMode(true);
                setNewOverrideName("__custom__");
              } else {
                setCustomMode(false);
                setNewOverrideName(next);
              }
            }}
          >
            <option value="">Choose a material…</option>
            {remainingMaterialOptions.map((material) => (
              <option key={material.id} value={material.name}>
                {material.name} · {material.baseUnit ?? material.unit}
              </option>
            ))}
            <option value="__custom__">Custom material name…</option>
          </Select>
        </div>
        {customMode ? (
          <div>
            <FieldLabel>Custom material name</FieldLabel>
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Acrylic Premium"
            />
          </div>
        ) : null}
        <NumericField
          label="Override price (ETB per unit)"
          value={newOverridePrice}
          onChange={setNewOverridePrice}
          suffix="ETB"
          min={0}
          step="0.01"
        />
        <div className="flex items-end">
          <Button type="button" variant="secondary" className="w-full" onClick={addOverride}>
            <Plus size={15} />
            Add override
          </Button>
        </div>
      </div>
    </FormSection>
  );
}
