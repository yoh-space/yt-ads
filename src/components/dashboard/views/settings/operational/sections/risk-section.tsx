"use client";

import { ShieldAlert } from "lucide-react";
import { FormSection } from "../../chrome/form";
import { NumericField } from "../../chrome/numeric-field";

/** Risk & theft-prevention controls for direct exception stock-outs. */
export function RiskSection({
  requireAdminPinForExceptions,
  setRequireAdminPinForExceptions,
  maxDirectStockOutEtb,
  setMaxDirectStockOutEtb,
}: {
  requireAdminPinForExceptions: boolean;
  setRequireAdminPinForExceptions: (v: boolean) => void;
  maxDirectStockOutEtb: number;
  setMaxDirectStockOutEtb: (n: number) => void;
}) {
  return (
    <FormSection
      icon={<ShieldAlert size={17} />}
      tone="coral"
      title="Risk & Theft Prevention Controls"
      note="Direct exception stock-outs are the largest leakage vector — tighten as needed."
    >
      <div className="space-y-4">
        <label className="flex items-center justify-between gap-4 rounded-lg border border-border bg-navy/20 px-4 py-3.5">
          <span className="min-w-0">
            <strong className="block text-sm font-semibold text-foreground">
              Require admin PIN reference for direct exception stock-outs
            </strong>
            <small className="mt-0.5 block text-xs text-muted-foreground">
              Forces the operator to record an authorization note on every direct stock-out.
            </small>
          </span>
          <input
            type="checkbox"
            className="peer sr-only"
            checked={requireAdminPinForExceptions}
            onChange={(event) => setRequireAdminPinForExceptions(event.target.checked)}
          />
          <span className="relative h-6 w-11 flex-none cursor-pointer rounded-full bg-secondary transition-colors peer-checked:bg-cyan after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
        </label>
        <NumericField
          label="Max ETB Limit for direct stock-outs without approval"
          value={maxDirectStockOutEtb}
          onChange={setMaxDirectStockOutEtb}
          suffix="ETB"
          min={0}
          step="1"
          hint="Above this ETB value, direct stock-outs must be approved before they can be recorded."
        />
      </div>
    </FormSection>
  );
}
