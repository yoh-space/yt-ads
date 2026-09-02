"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PackagePlus, Scale } from "lucide-react";
import type { Material } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { ModalShell } from "./modal-shell";
import { Button, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

export type NewReconciliationInput = {
  materialId: string;
  countedQuantity: number;
  note?: string;
};

const reconciliationSchema = z.object({
  materialId: z.string().min(1, "Select a material"),
  countedQuantity: z.number({ message: "Counted quantity cannot be negative" }).min(0, "Counted quantity cannot be negative"),
  note: z.string().optional(),
});

type ReconciliationForm = z.infer<typeof reconciliationSchema>;

export function ReconciliationModal({
  materials,
  onClose,
  onSave,
}: {
  materials: Material[];
  onClose: () => void;
  onSave: (input: NewReconciliationInput) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ReconciliationForm>({
    resolver: zodResolver(reconciliationSchema),
    defaultValues: {
      materialId: materials[0]?.id ?? "",
      countedQuantity: 0,
      note: "",
    },
    mode: "onSubmit",
  });

  const materialId = watch("materialId");
  const countedQuantity = watch("countedQuantity");

  const material = materials.find((entry) => entry.id === materialId);
  const unit = material?.baseUnit ?? material?.unit ?? "m²";
  const systemQuantity = material?.quantity ?? 0;
  const variance = useMemo(() => Number((countedQuantity - systemQuantity).toFixed(3)), [countedQuantity, systemQuantity]);
  const shortage = variance < 0;
  const estimatedLoss = shortage ? (material?.etbValue ?? 0) * -variance : 0;

  const onSubmit = (data: ReconciliationForm) => {
    if (data.materialId && data.countedQuantity >= 0) {
      onSave({ materialId: data.materialId, countedQuantity: data.countedQuantity, note: data.note?.trim() || undefined });
    }
  };

  return (
    <ModalShell
      title="Physical stock count" subtitle="Record the physically counted quantity for a material. The system balance and variance are computed automatically." onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="tertiary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="recon-form"><PackagePlus size={16} />Record count</Button>
        </div>
      }
    >
      <form id="recon-form" className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5" htmlFor="recon-material">Material</label>
          <Select id="recon-material" {...register("materialId")} className="w-full">
            {materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {formatQuantity(entry.quantity, entry.baseUnit ?? entry.unit)}</option>)}
          </Select>
          {errors.materialId ? <small className="block mt-1 text-xs font-medium text-coral">{errors.materialId.message}</small> : null}
        </div>

        <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-line">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-line text-cyan-dark flex-none">
            <Scale size={17} />
          </span>
          <div>
            <strong className="block text-sm font-semibold text-navy">System expected balance</strong>
            <span className="text-xs text-gray-600">{formatQuantity(systemQuantity, unit)}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5" htmlFor="recon-count">Physical counted quantity ({unit})</label>
          <Input id="recon-count" type="number" min="0" step="0.01" {...register("countedQuantity", { valueAsNumber: true })} className="w-full" />
          {errors.countedQuantity ? <small className="block mt-1 text-xs font-medium text-coral">{errors.countedQuantity.message}</small> : null}
        </div>

        <div className={cn("flex items-center justify-between gap-3 p-4 rounded-lg border", shortage ? "bg-coral/5 border-coral/25" : variance > 0 ? "bg-green/5 border-green/25" : "bg-gray-50 border-line")}>
          <span className="flex items-center gap-3 text-sm text-gray-600">
            <Scale size={17} className={shortage ? "text-coral" : variance > 0 ? "text-green" : "text-gray-400"} />
            Variance (counted − system)
          </span>
          <strong className={cn("text-sm font-semibold", shortage ? "text-coral" : variance > 0 ? "text-green" : "text-navy")}>
            {shortage ? "-" : variance > 0 ? "+" : ""}{variance.toLocaleString("en-US", { maximumFractionDigits: 3 })} {unit}
          </strong>
        </div>

        {shortage ? (
          <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-gold/10 border border-gold/25">
            <span className="text-sm text-gray-600">Estimated monetary loss (ETB)</span>
            <strong className="text-sm font-semibold text-gold">ETB {estimatedLoss.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong>
          </div>
        ) : null}

        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5" htmlFor="recon-note">
            Note <span className="ml-1 text-xs font-normal text-gray-500">Count source, order/cycle, or observations</span>
          </label>
          <Input id="recon-note" placeholder="e.g. End-of-week shelf count, Rack B" {...register("note")} className="w-full" />
        </div>
      </form>
    </ModalShell>
  );
}