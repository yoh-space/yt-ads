"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PackagePlus, Scale } from "lucide-react";
import type { Material } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { ModalShell } from "./modal-shell";

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
    <ModalShell title="Physical stock count" subtitle="Record the physically counted quantity for a material. The system balance and variance are computed automatically." onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit(onSubmit)}>
        <label>
          Material
          <select {...register("materialId")}>
            {materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {formatQuantity(entry.quantity, entry.baseUnit ?? entry.unit)}</option>)}
          </select>
          {errors.materialId ? <small className="field-error">{errors.materialId.message}</small> : null}
        </label>
        <div className="conversion-box">
          <Scale size={17} />
          <span>System expected balance</span>
          <strong>{formatQuantity(systemQuantity, unit)}</strong>
        </div>
        <label>
          Physical counted quantity ({unit})
          <input type="number" min="0" step="0.01" {...register("countedQuantity", { valueAsNumber: true })} />
          {errors.countedQuantity ? <small className="field-error">{errors.countedQuantity.message}</small> : null}
        </label>
        <div className={`conversion-box ${shortage ? "shortage-box" : variance > 0 ? "surplus-box" : ""}`}>
          <Scale size={17} />
          <span>Variance (counted − system)</span>
          <strong className={shortage ? "warning-text" : variance > 0 ? "success-text" : ""}>
            {shortage ? "-" : variance > 0 ? "+" : ""}{variance.toLocaleString("en-US", { maximumFractionDigits: 3 })} {unit}
          </strong>
        </div>
        {shortage ? (
          <div className="conversion-box shortage-box">
            <span>Estimated monetary loss (ETB)</span>
            <strong className="warning-text">ETB {estimatedLoss.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong>
          </div>
        ) : null}
        <label>
          Note <span className="field-hint">Count source, order/cycle, or observations</span>
          <input placeholder="e.g. End-of-week shelf count, Rack B" {...register("note")} />
        </label>
        <div className="modal-actions">
          <button type="button" className="button tertiary" onClick={onClose}>Cancel</button>
          <button type="submit" className="button primary"><PackagePlus size={16} />Record count</button>
        </div>
      </form>
    </ModalShell>
  );
}
