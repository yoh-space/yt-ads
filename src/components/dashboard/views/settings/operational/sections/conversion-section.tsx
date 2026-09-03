"use client";

import { Plus, Scale, Trash2 } from "lucide-react";
import type { PurchaseUnit, Unit } from "@/lib/operations-types";
import { Button, Input, Select } from "@/components/ui";
import { FormSection } from "../../chrome/form";
import type { ConversionRuleRow } from "../state";

const PURCHASE_UNITS: PurchaseUnit[] = ["roll", "sheet", "pack", "liter", "piece"];
const BASE_UNITS: Unit[] = ["m²", "m", "pcs", "L"];

/** Owner-governed unit conversion rules that apply to new stock handovers.
 *  Historical ledger events retain their original conversion snapshot. */
export function ConversionSection({
  rules,
  setRules,
}: {
  rules: ConversionRuleRow[];
  setRules: React.Dispatch<React.SetStateAction<ConversionRuleRow[]>>;
}) {
  function updateRule(index: number, patch: Partial<ConversionRuleRow>) {
    setRules((current) =>
      current.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)),
    );
  }

  return (
    <FormSection
      icon={<Scale size={17} />}
      tone="cyan"
      title="Unit Conversion Defaults"
      note="Owner-governed rates apply to new stock handovers; historical ledger events keep their original rate."
    >
      <div className="space-y-3">
        {rules.map((rule, index) => (
          <div
            key={`${rule.materialName}-${index}`}
            className="grid gap-3 rounded-lg border border-line bg-gray-50/60 p-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]"
          >
            <Input
              value={rule.materialName}
              onChange={(event) => updateRule(index, { materialName: event.target.value })}
              placeholder="Material name"
            />
            <Select
              value={rule.purchaseUnit}
              onChange={(event) => updateRule(index, { purchaseUnit: event.target.value as PurchaseUnit })}
            >
              {PURCHASE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
            <Select
              value={rule.baseUnit}
              onChange={(event) => updateRule(index, { baseUnit: event.target.value as Unit })}
            >
              {BASE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={0}
              step="0.001"
              value={rule.conversionRatio}
              onChange={(event) => updateRule(index, { conversionRatio: Number(event.target.value) })}
              placeholder="Base units"
            />
            <Button
              type="button"
              variant="tertiary"
              onClick={() =>
                setRules((current) => current.filter((_, ruleIndex) => ruleIndex !== index))
              }
            >
              <Trash2 size={14} />
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setRules((current) => [
              ...current,
              { materialName: "", purchaseUnit: "roll", baseUnit: "m²", conversionRatio: 1 },
            ])
          }
        >
          <Plus size={15} />
          Add conversion rate
        </Button>
        <p className="text-[11px] text-gray-500">
          For example, configure 1.0 m Roll to 53.3 m² or 1.5 m Roll to 75.0 m². Existing ledger
          events retain their original conversion snapshot.
        </p>
      </div>
    </FormSection>
  );
}
