"use client";

import { useController } from "react-hook-form";

interface StepProps {
  control: any;
  watch: any;
  errors: any;
  onNext: () => void;
  onBack?: () => void;
}

export function CompanyTinStep({ control, watch, errors, onNext, onBack }: StepProps) {
  const { field: companyField } = useController({ control, name: "companyLegalName", defaultValue: "" });
  const { field: tinField } = useController({ control, name: "tinNumber", defaultValue: "" });

  const company = watch("companyLegalName");
  const tin = watch("tinNumber");

  const canProceed = company?.trim().length >= 2 && /^\d{10}$/.test(tin || "");

  return (
    <section className="p-4 space-y-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">ድርጅት መረጃ</h2>
        <p className="text-sm text-neutral-400 mt-1">የድርጅት ስም እና TIN ለመረጥ ነው።</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-neutral-300 block">የድርጅት ጽሑፍ ስም</label>
        <input
          {...companyField}
          placeholder="ሕጋዊ ድርጅት..."
          className="w-full h-12 px-4 rounded-sm bg-[#131418] text-white text-sm border border-white/[0.12] outline-none focus:border-[#E5C07B] transition-colors"
        />
        {errors.companyLegalName && <p className="text-xs text-rose-400">{errors.companyLegalName.message}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-neutral-300 block">TIN ቁጥር (10-digit)</label>
        <input
          {...tinField}
          inputMode="numeric"
          maxLength={10}
          placeholder="1234567890"
          className="w-full h-12 px-4 rounded-sm bg-[#131418] text-white font-mono text-sm border border-white/[0.12] outline-none focus:border-[#E5C07B] transition-colors"
          onChange={(e) => tinField.onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        />
        {errors.tinNumber && <p className="text-xs text-rose-400">{errors.tinNumber.message}</p>}
        <p className="text-[10px] text-neutral-500 mt-1">TIN ከ10 ደረጃዎች መሆን አለበት።</p>
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
          disabled={!canProceed}
          className="flex-1 h-11 bg-[#E5C07B] hover:bg-[#EED08F] text-[#0C0D10] font-mono font-semibold text-xs tracking-[0.1em] uppercase rounded-sm transition-colors disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </section>
  );
}
