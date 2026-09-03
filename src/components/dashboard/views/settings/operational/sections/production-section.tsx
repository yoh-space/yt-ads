"use client";

import { Settings2 } from "lucide-react";
import { FormSection } from "../../chrome/form";
import { NumericField } from "../../chrome/numeric-field";

/** Production-engine rules that drive ink deduction + waste/offcut thresholds. */
export function ProductionSection({
  inkMlPerSquareMetre,
  setInkMlPerSquareMetre,
  maxAllowedWastePercent,
  setMaxAllowedWastePercent,
  minOffcutAreaSquareMetre,
  setMinOffcutAreaSquareMetre,
}: {
  inkMlPerSquareMetre: number;
  setInkMlPerSquareMetre: (n: number) => void;
  maxAllowedWastePercent: number;
  setMaxAllowedWastePercent: (n: number) => void;
  minOffcutAreaSquareMetre: number;
  setMinOffcutAreaSquareMetre: (n: number) => void;
}) {
  return (
    <FormSection
      icon={<Settings2 size={17} />}
      tone="blue"
      title="Production Engine Rules"
      note="Drives automatic ink deduction and waste/offcut thresholds."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NumericField
          label="Ink Consumption Rate"
          value={inkMlPerSquareMetre}
          onChange={setInkMlPerSquareMetre}
          suffix="mL / m²"
          min={0}
          step="0.1"
          hint="Applied per square metre of printed area."
        />
        <NumericField
          label="Max Allowed Waste Rate"
          value={maxAllowedWastePercent}
          onChange={setMaxAllowedWastePercent}
          suffix="%"
          min={0}
          max={100}
          step="0.1"
          hint="Operator reports above this level flag for review."
        />
        <NumericField
          label="Minimum Offcut Registration Size"
          value={minOffcutAreaSquareMetre}
          onChange={setMinOffcutAreaSquareMetre}
          suffix="m²"
          min={0}
          step="0.01"
          hint="Offcuts smaller than this are not tracked."
        />
      </div>
    </FormSection>
  );
}
