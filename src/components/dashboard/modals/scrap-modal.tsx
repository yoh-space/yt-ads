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
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="block text-sm font-semibold text-navy mb-2">
            Material
          </label>
          <select 
            {...register("materialId")}
            className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
          >
            {materials.map((entry) => (
              <option value={entry.id} key={entry.id}>{entry.name}</option>
            ))}
          </select>
          {errors.materialId && (
            <small className="block mt-1 text-xs font-medium text-coral">
              {errors.materialId.message}
            </small>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-navy mb-2">
            Unusable quantity ({material?.unit})
          </label>
          <input 
            type="number" 
            min="0.1" 
            step="0.1" 
            {...register("quantity", { valueAsNumber: true })}
            className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
          />
          {errors.quantity && (
            <small className="block mt-1 text-xs font-medium text-coral">
              {errors.quantity.message}
            </small>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-navy mb-2">
            Waste reason
          </label>
          <input 
            {...register("reason")}
            className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
          />
          {errors.reason && (
            <small className="block mt-1 text-xs font-medium text-coral">
              {errors.reason.message}
            </small>
          )}
        </div>
        
        <div className="flex items-center gap-3 p-3 bg-coral/10 rounded-lg border border-coral/20">
          <Trash2 size={17} className="text-coral flex-none" />
          <span className="text-sm text-gray-600">Wastage register</span>
          <span className="font-semibold text-navy ml-auto">
            {formatQuantity(quantity, material?.unit ?? ("m²" as Unit))}
          </span>
        </div>
        
        <button 
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg bg-navy text-white shadow-sm transition-colors hover:bg-navy-2 focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2"
          type="submit"
        >
          Save scrap record 
          <ArrowUpRight size={16} />
        </button>
      </form>
    </ModalShell>
  );
}
