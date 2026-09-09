"use client";

import { Minus, Plus, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderFormState } from "./types";
import { NumericInput } from "@/components/shared/ui";

const presets = [
  { label: "1m × 1m", width: "1", height: "1" },
  { label: "1.5m × 2m", width: "1.5", height: "2" },
  { label: "2m × 3m", width: "2", height: "3" },
  { label: "3m × 5m", width: "3", height: "5" },
  { label: "A1", width: "0.594", height: "0.841" },
  { label: "RollUp", width: "0.85", height: "2" },
];

export function DimensionsInput({ form, setForm, estimatedArea }: { form: OrderFormState; setForm: (next: OrderFormState) => void; estimatedArea: { totalArea: string } | null }) {
  return <section className="bg-[#131418] border border-white/[0.08] rounded-sm p-4 space-y-3.5"><div className="flex items-center justify-between border-b border-white/[0.06] pb-2"><span className="font-mono text-[11px] font-semibold text-neutral-300 flex items-center gap-1.5"><Ruler size={13} className="text-[#E5C07B]" />02. መጠን እና ብዛት</span>{estimatedArea ? <span className="font-mono text-[11px] text-neutral-200 bg-[#1C1D24] border border-white/[0.1] px-2 py-0.5 rounded-sm">{estimatedArea.totalArea} m²</span> : null}</div><div className="space-y-1.5"><span className="font-mono text-[10px] text-neutral-400 block">የተዘጋጁ መጠኖች</span><div className="flex flex-wrap gap-1.5">{presets.map((preset) => <button type="button" key={preset.label} onClick={() => setForm({ ...form, width: preset.width, height: preset.height })} className={cn("font-mono text-[11px] px-2.5 py-1 rounded-sm border", form.width === preset.width && form.height === preset.height ? "border-[#E5C07B] bg-[#22232A] text-white" : "bg-[#18191E] border-white/[0.06] text-neutral-400")}>{preset.label}</button>)}</div></div><div className="grid grid-cols-3 gap-2.5"><NumericField label="ስፋት (ሜትር)" value={form.width} placeholder="2" onChange={(value) => setForm({ ...form, width: value })} /><NumericField label="ቁመት (ሜትር)" value={form.height} placeholder="3" onChange={(value) => setForm({ ...form, height: value })} /><div className="space-y-1"><span className="font-mono text-[10px] text-neutral-400 block">ብዛት</span><div className="flex items-center h-10 bg-[#0C0D10] border border-white/[0.12] rounded-sm overflow-hidden"><button type="button" onClick={() => setForm({ ...form, quantity: String(Math.max(1, (Number(form.quantity) || 1) - 1)) })} className="w-8 h-full grid place-items-center text-neutral-400"><Minus size={12} /></button><input required type="number" min="1" step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value.replace(/\D/g, "").slice(0, 5) })} className="flex-1 w-full text-center text-xs font-mono font-bold text-white bg-transparent outline-none" /><button type="button" onClick={() => setForm({ ...form, quantity: String(Math.min(100000, (Number(form.quantity) || 1) + 1)) })} className="w-8 h-full grid place-items-center text-neutral-400"><Plus size={12} /></button></div></div></div></section>;
}

function NumericField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return <div className="space-y-1"><span className="font-mono text-[10px] text-neutral-400 block">{label}</span><NumericInput required min={0.01} max={10000} step="0.01" value={value} emptyValue={0.01} onChange={onChange} placeholder={placeholder} className="w-full h-10 px-3 text-xs font-mono bg-[#0C0D10] text-neutral-100 border border-white/[0.12] rounded-sm outline-none focus:border-[#E5C07B]" /></div>;
}
