"use client";

import { FileUp, X, CheckCircle2 } from "lucide-react";
import { useController } from "react-hook-form";

interface StepProps {
  control: any;
  watch: any;
  setValue: any;
  errors: any;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onNext: () => void;
  onBack?: () => void;
}

export function ArtworkStep({ control, watch, setValue, errors, file, onFileChange, onNext, onBack }: StepProps) {
  useController({ control, name: "notes", defaultValue: "" });
  const notes = watch("notes") as string | undefined;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (selected && selected.size > 20 * 1024 * 1024) {
      alert("የፋይሉ መጠን ከ 20MB ማነስ አለበት። (File exceeds 20MB)");
      return;
    }
    onFileChange(selected);
  };

  return (
    <section className="p-4 space-y-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">የስራ ፎቶ እና ማስታወሻ</h2>
        <p className="text-sm text-neutral-400 mt-1">የስራ ፎቶ እና ማስታወሻ ለመላክ.</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-neutral-300 block">የስራ ፎቶ (Optional)</label>
        <div className="border border-dashed border-white/[0.12] rounded-sm p-4 text-center">
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <CheckCircle2 size={18} className="text-green-400" />
              <span className="text-sm text-neutral-200 truncate max-w-[200px]">{file.name}</span>
              <button type="button" onClick={() => onFileChange(null)} className="text-neutral-400 hover:text-rose-400">
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className="cursor-pointer block">
              <FileUp size={24} className="text-neutral-500 mx-auto mb-2" />
              <span className="text-sm text-neutral-400">ፋይል ለመምረጥ ይጫኑ</span>
              <input type="file" accept="image/*,.pdf,.ai,.psd,.svg" onChange={handleFileSelect} className="hidden" />
            </label>
          )}
        </div>
        <p className="text-[10px] text-neutral-500">የፋይሉ መጠን ከ 20MB ማነስ አለበት። (Max 20MB, images/PDF/AI/PSD/SVG)</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-neutral-300 block">ማስታወሻ (Optional)</label>
        <textarea
          value={notes ?? ""}
          onChange={(e) => setValue("notes", e.target.value.slice(0, 2000), { shouldValidate: true })}
          rows={3}
          placeholder="የከለር ምርጫ፣ የገጠማ ቦታ..."
          className="w-full p-2.5 text-xs bg-[#0C0D10] text-neutral-100 border border-white/[0.12] rounded-sm focus:outline-none focus:border-[#E5C07B] resize-none transition-colors placeholder:text-neutral-600"
        />
        {errors.notes && <p className="text-xs text-rose-400">{errors.notes.message}</p>}
      </div>

      <div className="pt-2 flex gap-3">
        {onBack ? (
          <button type="button" onClick={onBack} className="flex-1 h-11 rounded-sm border border-white/[0.1] bg-transparent text-neutral-300 font-mono text-xs hover:bg-white/[0.05] transition-colors">
            Back
          </button>
        ) : null}
        <button type="button" onClick={onNext} className="flex-1 h-11 bg-[#E5C07B] hover:bg-[#EED08F] text-[#0C0D10] font-mono font-semibold text-xs tracking-[0.1em] uppercase rounded-sm transition-colors">
          Next
        </button>
      </div>
    </section>
  );
}
