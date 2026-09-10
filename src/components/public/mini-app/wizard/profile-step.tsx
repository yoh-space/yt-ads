"use client";

import { Phone, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { normalizePhone } from "@/shared/phone-normalization";
import { useController } from "react-hook-form";

interface StepProps {
  control: any;
  watch: any;
  setValue: any;
  errors: any;
  phoneReady: boolean;
  verifiedPhone: string | null;
  onNext: () => void;
  onBack?: () => void;
}

export function ProfileStep({ control, watch, setValue, errors, phoneReady, verifiedPhone, onNext, onBack }: StepProps) {
  const { field: nameField } = useController({ control, name: "customerName", defaultValue: "" });
  const { field: phoneField } = useController({ control, name: "phone", defaultValue: "" });

  const customerName = watch("customerName");
  const phone = watch("phone");

  const canProceed = phoneReady && customerName?.trim().length >= 2;

  return (
    <section className="p-4 space-y-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">ስም እና ስልክ</h2>
        <p className="text-sm text-neutral-400 mt-1">የትዕዛዝ መረጃዊ ለመመርጥ ስምዎና ስልክ አվաምლ.</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-neutral-300 block">ስም</label>
        <input
          {...nameField}
          placeholder="ስምህ ምክር..."
          className="w-full h-12 px-4 rounded-sm bg-[#131418] text-white text-sm border border-white/[0.12] outline-none focus:border-[#E5C07B] transition-colors"
        />
        {errors.customerName && <p className="text-xs text-rose-400">{errors.customerName.message}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-neutral-300 block">ስልክ</label>
        <input
          {...phoneField}
          type="tel"
          inputMode="tel"
          placeholder="+251..."
          className="w-full h-12 px-4 rounded-sm bg-[#131418] text-white font-mono text-sm border border-white/[0.12] outline-none focus:border-[#E5C07B] transition-colors"
        />
        {errors.phone && <p className="text-xs text-rose-400">{errors.phone.message}</p>}
      </div>

      {phone && !phoneReady && normalizePhone(phone) === null && (
        <div className="flex items-center gap-2 p-3 rounded-sm bg-rose-500/10 border border-rose-500/30">
          <AlertCircle size={16} className="text-rose-400 flex-none" />
          <span className="text-xs text-rose-300">እባክዎ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (+251 9ወይ 09...).</span>
        </div>
      )}

      {verifiedPhone && (
        <div className="flex items-center gap-2 p-3 rounded-sm bg-[#101A18] border border-[#3E9B95]/40">
          <CheckCircle2 size={16} className="text-[#48B0A8] flex-none" />
          <span className="text-xs text-[#78D5CB] font-mono">{verifiedPhone}</span>
          <span className="ml-auto text-[9px] uppercase tracking-wider text-[#48B0A8]">TELEGRAM VERIFIED</span>
        </div>
      )}

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
