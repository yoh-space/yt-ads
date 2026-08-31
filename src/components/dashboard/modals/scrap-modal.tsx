"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, Trash2 } from "lucide-react";
import type { Material, Unit } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { ModalShell } from "./modal-shell";

export type NewScrapInput = {
  materialId: string;
  quantity: number;
  reason: string;
};

const scrapSchema = z.object({
  materialId: z.string().min(1, "Select a material"),
  quantity: z.number({ message: "Quantity must be greater than zero" }).positive("Quantity must be greater than zero"),
  reason: z.string().min(1, "Reason is required"),
});

type ScrapForm = z.infer<typeof scrapSchema>;

export function ScrapModal({
  materials,
  onClose,
  onSave,
}: {
  materials: Material[];
  onClose: () => void;
  onSave: (input: NewScrapInput) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ScrapForm>({
    resolver: zodResolver(scrapSchema),
    defaultValues: {
      materialId: materials[0]?.id ?? "",
      quantity: 0.2,
      reason: "Misprint / trim loss",
    },
    mode: "onSubmit",
  });

  const materialId = watch("materialId");
  const quantity = watch("quantity");
  const material = materials.find((entry) => entry.id === materialId);

  const onSubmit = (data: ScrapForm) => {
    if (!material) return;
    onSave({ materialId: data.materialId, quantity: data.quantity, reason: data.reason });
  };

  return (
    <ModalShell title="Log unusable scrap" subtitle="Record non-recoverable waste separately so the wastage metric and discrepancy view remain accurate." onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit(onSubmit)}>
        <label>
          Material
          <select {...register("materialId")}>
            {materials.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
          </select>
          {errors.materialId ? <small className="field-error">{errors.materialId.message}</small> : null}
        </label>
        <label>
          Unusable quantity ({material?.unit})
          <input type="number" min="0.1" step="0.1" {...register("quantity", { valueAsNumber: true })} />
          {errors.quantity ? <small className="field-error">{errors.quantity.message}</small> : null}
        </label>
        <label>
          Waste reason
          <input {...register("reason")} />
          {errors.reason ? <small className="field-error">{errors.reason.message}</small> : null}
        </label>
        <div className="conversion-box"><Trash2 size={17} /><span>Wastage register</span><strong>{formatQuantity(quantity, material?.unit ?? ("m²" as Unit))}</strong></div>
        <button className="button primary full" type="submit">Save scrap record <ArrowUpRight size={16} /></button>
      </form>
    </ModalShell>
  );
}
