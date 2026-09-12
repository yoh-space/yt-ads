"use client";

import { CheckCircle2, AlertCircle, Send } from "lucide-react";
import { getServiceLabel } from "@/shared/services";

interface StepProps {
  control: any;
  watch: any;
  errors: any;
  allValues: any;
  busy: boolean;
  error: string | null;
  isEdit?: boolean;
  onSubmit: () => void;
  onBack?: () => void;
}

export function ReviewStep({ watch, errors, allValues, busy, error, isEdit, onSubmit, onBack }: StepProps) {
  const serviceId = allValues?.serviceId as string | undefined;
  const serviceLabel = serviceId ? getServiceLabel(serviceId, "am") ?? getServiceLabel(serviceId) ?? serviceId : "—";

  const lengthVal = allValues?.length ?? allValues?.height;

  const derivedRoll = (() => {
    if (!serviceId || !allValues?.width) return null;
    try {
      const { resolveRollSubstrate } = require("@/shared/roll-width");
      return resolveRollSubstrate(serviceId, allValues.width) as { option: string; rollWidth: number } | null;
    } catch {
      return null;
    }
  })();

  const sections = [
    { label: "ስም", value: allValues?.customerName },
    { label: "ስልክ", value: allValues?.phone },
    { label: "መለያ ዓይነት", value: allValues?.accountType === "individual" ? "ግለሰብ" : allValues?.accountType === "corporate" ? "ድርጅት" : "መንግስት" },
    ...(allValues?.accountType !== "individual"
      ? [
          { label: "የድርጅት ስም", value: allValues?.companyLegalName || "—" },
          { label: "TIN", value: allValues?.tinNumber || "—" },
        ]
      : []),
    { label: "Types", value: serviceLabel },
    { label: "ስፋት", value: allValues?.width ? `${allValues.width}m` : "—" },
    { label: "ርዝመት", value: lengthVal ? `${lengthVal}m` : "—" },
    ...(derivedRoll ? [{ label: "የሚጠቀመው ሮል", value: derivedRoll.option }] : []),
    { label: "ብዛት", value: allValues?.quantity },
    { label: "ማስታወሻ", value: allValues?.notes || "—" },
  ];

  const specEntries = allValues?.specifications ? Object.entries(allValues.specifications) as [string, string][] : [];

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <section className="p-4 space-y-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">የትዕዛዝ ማጠቃለያ</h2>
        <p className="text-sm text-neutral-400 mt-1">የትዕዛዝዎን መረጃ ያረጋግጡ እና ይላኩ.</p>
      </div>

      {hasErrors ? (
        <div className="flex items-start gap-2 p-3 rounded-sm bg-rose-500/10 border border-rose-500/30">
          <AlertCircle size={16} className="text-rose-400 flex-none mt-0.5" />
          <p className="text-xs text-rose-300">አስፈላጊ መረጃዎች አልተሞሉም። እባክዎ ተመልሰው ያረጋግጡ.</p>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 p-3 rounded-sm bg-rose-500/10 border border-rose-500/30">
          <AlertCircle size={16} className="text-rose-400 flex-none mt-0.5" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      ) : null}

      <div className="rounded-sm border border-white/[0.08] overflow-hidden">
        <div className="bg-[#131418] px-4 py-2 border-b border-white/[0.08]">
          <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">የትዕዛዝ መረጃ</span>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {sections.map((s) => (
            <div key={s.label} className="flex justify-between items-center px-4 py-2.5">
              <span className="text-xs text-neutral-400">{s.label}</span>
              <span className="text-xs text-neutral-200 font-medium">{s.value || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {specEntries.length > 0 ? (
        <div className="rounded-sm border border-white/[0.08] overflow-hidden">
          <div className="bg-[#131418] px-4 py-2 border-b border-white/[0.08]">
            <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">የቦታ መጠመኛ</span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {specEntries.map(([key, value]) => (
              <div key={key} className="flex justify-between items-center px-4 py-2.5">
                <span className="text-xs text-neutral-400">{key}</span>
                <span className="text-xs text-neutral-200 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="pt-2 flex gap-3">
        {onBack ? (
          <button type="button" onClick={onBack} disabled={busy} className="flex-1 h-11 rounded-sm border border-white/[0.1] bg-transparent text-neutral-300 font-mono text-xs hover:bg-white/[0.05] transition-colors disabled:opacity-30">
            Back
          </button>
        ) : null}
        <button type="button" onClick={onSubmit} disabled={busy || hasErrors} className="flex-1 h-11 bg-[#E5C07B] hover:bg-[#EED08F] text-[#0C0D10] font-mono font-semibold text-xs tracking-[0.1em] uppercase rounded-sm transition-colors disabled:opacity-30 flex items-center justify-center gap-2">
          {busy ? (
            <>
              <span className="w-4 h-4 border-2 border-[#0C0D10]/30 border-t-[#0C0D10] rounded-full animate-spin" />
              {isEdit ? "በማስተካከል ላይ..." : "በመላክ ላይ..."}
            </>
          ) : (
            <>
              <Send size={13} /> {isEdit ? "ትዕዛዝ አዘምን" : "ትዕዛዝ ላክ"}
            </>
          )}
        </button>
      </div>
    </section>
  );
}
