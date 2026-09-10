"use client";

import { Building2, User, Users, AlertCircle } from "lucide-react";
import { useController } from "react-hook-form";

interface StepProps {
  control: any;
  watch: any;
  errors: any;
  onNext: () => void;
  onBack?: () => void;
}

const ACCOUNT_TYPES = [
  { value: "individual", label: "Individual", sub: "Personal order", Icon: User },
  { value: "corporate", label: "Corporate", sub: "Company with TIN", Icon: Building2 },
  { value: "government", label: "Government", sub: "Public institution", Icon: Users },
] as const;

export function AccountTypeStep({ control, watch, errors, onNext, onBack }: StepProps) {
  const { field } = useController({ control, name: "accountType", defaultValue: "individual" });
  const selected = watch("accountType");

  const canProceed = Boolean(selected);

  return (
    <section className="p-4 space-y-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">መለያ ዓይነት</h2>
        <p className="text-sm text-neutral-400 mt-1">የትዕዛዝ መንግስትና ምርጫዎት.</p>
      </div>

      <div className="space-y-2">
        {ACCOUNT_TYPES.map(({ value, label, sub, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => field.onChange(value)}
            className={`w-full p-3 rounded-sm border transition-colors text-left ${
              selected === value
                ? "border-[#E5C07B] bg-[#22232A] text-white"
                : "border-white/[0.08] bg-[#131418] text-neutral-300 hover:border-white/[0.15]"
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon size={18} className={selected === value ? "text-[#E5C07B]" : "text-neutral-500"} />
              <div>
                <span className="font-semibold text-sm block">{label}</span>
                <span className="text-xs text-neutral-500">{sub}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected === "corporate" || selected === "government" ? (
        <div className="flex items-start gap-2 p-3 rounded-sm bg-cyan-500/10 border border-cyan-500/30">
          <AlertCircle size={16} className="text-cyan-400 flex-none mt-0.5" />
          <p className="text-xs text-cyan-300">
            {selected === "corporate"
              ? "የድርጅት ስም እና TIN ማስገባት አለብዎ"
              : "የመንግስት ድርጅት ስም እና TIN ማስገባት አለብዎ"}
          </p>
        </div>
      ) : null}

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
