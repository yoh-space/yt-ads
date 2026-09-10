"use client";

import { User, Send, Sparkles } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/shared/services";
import { getServiceLabel } from "@/constants/services";

interface StepProps {
  onNext: () => void;
  onCancel?: () => void;
}

export function WelcomeStep({ onNext, onCancel }: StepProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center bg-[#0C0D10]">
      <Sparkles size={48} className="text-[#E5C07B] mb-4" />
      <h1 className="text-2xl font-bold text-white mb-2">እንደደဂኛት ወደ YT Advertisement</h1>
      <p className="text-sm text-neutral-400 mb-6 max-w-sm">
        ትዕዛዝ ለመፍጠር መረጃዊ ቦታ ወይም የቤት ለዩ. ሁሉንም የመጠኖ እና የሚስተዋውቅ የመረጃ ቅጥር ይጠቀማል.
      </p>
      <button
        type="button"
        onClick={onNext}
        className="w-full max-w-xs h-12 bg-[#E5C07B] hover:bg-[#EED08F] text-[#0C0D10] font-mono font-semibold text-xs tracking-[0.1em] uppercase rounded-sm transition-colors flex items-center justify-center gap-2"
      >
        ጀምር <Send size={13} />
      </button>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="mt-4 text-xs text-neutral-500 hover:text-neutral-300"
        >
          መዝገብ ለመቀበል ይደርስኝታል
        </button>
      ) : null}
    </div>
  );
}
