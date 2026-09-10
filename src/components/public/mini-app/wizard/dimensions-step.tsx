"use client";

import { Minus, Plus, Ruler } from "lucide-react";
import { useController } from "react-hook-form";

interface StepProps {
  control: any;
  watch: any;
  setValue: any;
  errors: any;
  estimatedArea: { unitArea: string; totalArea: string } | null;
  onNext: () => void;
  onBack?: () => void;
}

const DIMENSION_PRESETS = [
  { label: "1m × 1m", width: "1", height: "1" },
  { label: "1.5m × 2m", width: "1.5", height: "2" },
  { label: "2m × 3m", width: "2", height: "3" },
  { label: "3m × 5m", width: "3", height: "5" },
  { label: "A1", width: "0.594", height: "0.841" },
  { label: "RollUp", width: "0.85", height: "2" },
];

export function DimensionsStep({ control, watch, setValue, errors, estimatedArea, onNext, onBack }: StepProps) {
  useController({ control, name: "width", defaultValue: undefined });
  useController({ control, name: "height", defaultValue: undefined });
  useController({ control, name: "quantity", defaultValue: "1" });

  const width = watch("width") as number | undefined;
  const height = watch("height") as number | undefined;
  const quantity = watch("quantity") as string | undefined;

  const canProceed = width && height && width > 0 && height > 0 && quantity && parseInt(quantity) > 0;

  const handlePreset = (preset: { width: string; height: string }) => {
    setValue("width", parseFloat(preset.width) as any, { shouldValidate: true });
    setValue("height", parseFloat(preset.height) as any, { shouldValidate: true });
  };

  return (
    <section className="p-4 space-y-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Ruler size={18} className="text-[#E5C07B]" /> ስፋት እና ብዛት
        </h2>
        <p className="text-sm text-neutral-400 mt-1">አንድ አንድ ሜትር እና ደረጃዎች.</p>
      </div>
      {estimatedArea ? (
        <div className="p-3 rounded-sm bg-[#1C1D24] border border-[#E5C07B]/20">
          <span className="font-mono text-xs text-neutral-400">ጠቅላላ ትክክል</span>
          <span className="font-mono text-lg font-bold text-[#E5C07B] block">{estimatedArea.totalArea} m²</span>
        </div>
      ) : null}
      <div className="space-y-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 block">የተዘጋጁ መጠኖች</span>
        <div className="flex flex-wrap gap-1.5">
          {DIMENSION_PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => handlePreset(p)} className="font-mono text-[11px] px-2.5 py-1 rounded-sm border bg-[#18191E] border-white/[0.06] text-neutral-400 hover:border-[#E5C07B] hover:text-white transition-colors cursor-pointer">{p.label}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5 pt-1">
        <div className="space-y-1">
          <label className="font-mono text-[10px] uppercase text-neutral-400 block">ስፋት (m)</label>
          <input type="number" min="0.01" step="0.01" value={width ?? ""} onChange={(e) => setValue("width", e.target.value ? parseFloat(e.target.value) : undefined, { shouldValidate: true })} placeholder="2" className="w-full h-10 px-3 text-xs font-mono bg-[#0C0D10] text-neutral-100 border border-white/[0.12] rounded-sm focus:outline-none focus:border-[#E5C07B]" />
          {errors.width && <p className="text-xs text-rose-400">{errors.width.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="font-mono text-[10px] uppercase text-neutral-400 block">ቁመት (m)</label>
          <input type="number" min="0.01" step="0.01" value={height ?? ""} onChange={(e) => setValue("height", e.target.value ? parseFloat(e.target.value) : undefined, { shouldValidate: true })} placeholder="3" className="w-full h-10 px-3 text-xs font-mono bg-[#0C0D10] text-neutral-100 border border-white/[0.12] rounded-sm focus:outline-none focus:border-[#E5C07B]" />
          {errors.height && <p className="text-xs text-rose-400">{errors.height.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="font-mono text-[10px] uppercase text-neutral-400 block">ብዛት</label>
          <div className="flex items-center h-10 bg-[#0C0D10] border border-white/[0.12] rounded-sm overflow-hidden">
            <button type="button" onClick={() => setValue("quantity", String(Math.max(1, (parseInt(quantity || "1") || 1) - 1)), { shouldValidate: true })} className="w-8 h-full grid place-items-center text-neutral-400 hover:text-white"><Minus size={12} /></button>
            <input required type="number" min="1" value={quantity || "1"} onChange={(e) => setValue("quantity", e.target.value.replace(/\D/g, "").slice(0, 5) || "1", { shouldValidate: true })} className="flex-1 w-full text-center text-xs font-mono font-bold text-white bg-transparent outline-none" />
            <button type="button" onClick={() => setValue("quantity", String((parseInt(quantity || "1") || 1) + 1), { shouldValidate: true })} className="w-8 h-full grid place-items-center text-neutral-400 hover:text-white"><Plus size={12} /></button>
          </div>
          {errors.quantity && <p className="text-xs text-rose-400">{errors.quantity.message}</p>}
        </div>
      </div>
      {errors.dimensions && <p className="text-xs text-rose-400">{errors.dimensions.message}</p>}
      <div className="pt-2 flex gap-3">
        {onBack ? <button type="button" onClick={onBack} className="flex-1 h-11 rounded-sm border border-white/[0.1] bg-transparent text-neutral-300 font-mono text-xs hover:bg-white/[0.05] transition-colors">Back</button> : null}
        <button type="button" onClick={onNext} disabled={!canProceed} className="flex-1 h-11 bg-[#E5C07B] hover:bg-[#EED08F] text-[#0C0D10] font-mono font-semibold text-xs tracking-[0.1em] uppercase rounded-sm transition-colors disabled:opacity-30">Next</button>
      </div>
    </section>
  );
}

