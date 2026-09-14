"use client";

import { useController } from "react-hook-form";

export interface SpecificationField {
  key: string;
  label: string;
  labelEn?: string;
  labelAm?: string;
  options: readonly string[];
  required?: boolean;
}

interface StepProps {
  control: any;
  watch: any;
  setValue: any;
  errors: any;
  serviceFields: SpecificationField[];
  onNext: () => void;
  onBack?: () => void;
}

export function SpecificationsStep({ control, watch, setValue, errors, serviceFields, onNext, onBack }: StepProps) {
  // Register all spec fields at the top level (hooks must not be in loops)
  if (serviceFields.length > 0) {
    useSpecControllers(control, serviceFields);
  }

  const specifications = watch("specifications") as Record<string, string> | undefined;

  if (serviceFields.length === 0) {
    return (
      <section className="p-4 space-y-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Specifications</h2>
          <p className="text-sm text-neutral-400 mt-1">No specifications required for this service.</p>
        </div>
        <div className="pt-2 flex gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex-1 h-11 rounded-sm border border-white/[0.1] bg-transparent text-neutral-300 font-mono text-xs hover:bg-white/[0.05] transition-colors"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={onNext}
            className="flex-1 h-11 bg-[#E5C07B] hover:bg-[#EED08F] text-[#0C0D10] font-mono font-semibold text-xs tracking-[0.1em] uppercase rounded-sm transition-colors"
          >
            Next
          </button>
        </div>
      </section>
    );
  }

  const allSelected = serviceFields.every(
    (f) => f.required === false || (specifications?.[f.key] && f.options.includes(specifications[f.key])),
  );

  return (
    <section className="p-4 space-y-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">የቦታ መጠመኛ መረጃ</h2>
        <p className="text-sm text-neutral-400 mt-1">የመረጘውን የቦታ መጠመኛ መረጃ ይምረጡ.</p>
      </div>

      <div className="space-y-4">
        {serviceFields.map((field) => {
          const currentValue = specifications?.[field.key] ?? "";
          const displayLabel = field.labelAm || field.labelEn || field.label;
          return (
            <div key={field.key} className="space-y-1">
              <label className="text-xs font-semibold text-neutral-300 block">
                {displayLabel}
                {field.required !== false && <span className="text-[#E5C07B] ml-1">*</span>}
              </label>
              <select
                value={currentValue}
                onChange={(e) => {
                  const nextSpecs = { ...(specifications || {}) };
                  if (e.target.value) {
                    nextSpecs[field.key] = e.target.value;
                  } else {
                    delete nextSpecs[field.key];
                  }
                  setValue("specifications", nextSpecs, { shouldValidate: true });
                }}
                className="w-full h-12 px-4 rounded-sm bg-[#131418] text-white text-sm border border-white/[0.12] outline-none focus:border-[#E5C07B] transition-colors appearance-none"
              >
                <option value="" disabled={field.required !== false}>
                  {field.required === false ? "None (Optional)" : "Choose an option..."}
                </option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {field.required !== false && !currentValue && (
                <p className="text-xs text-rose-400">{displayLabel} is required.</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-2 flex gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex-1 h-11 rounded-sm border border-white/[0.1] bg-transparent text-neutral-300 font-mono text-xs hover:bg-white/[0.05] transition-colors"
          >
            Back
          </button>
        ) : null}
        <button
          type="button"
          onClick={onNext}
          disabled={!allSelected}
          className="flex-1 h-11 bg-[#E5C07B] hover:bg-[#EED08F] text-[#0C0D10] font-mono font-semibold text-xs tracking-[0.1em] uppercase rounded-sm transition-colors disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </section>
  );
}

// Use a fixed number of controllers to satisfy hooks rules
function useSpecControllers(control: any, fields: SpecificationField[]) {
  for (let i = 0; i < 12; i++) {
    const field = fields[i];
    if (field) {
      useController({
        control,
        name: `specifications.${field.key}` as const,
        defaultValue: "",
        shouldUnregister: false,
      });
    } else {
      // Placeholder hook call to keep the count stable
      useController({ control, name: `_empty_${i}` as const, defaultValue: "", shouldUnregister: false });
    }
  }
}
