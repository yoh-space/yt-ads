"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
import type { InputUnit } from "@/lib/units";
import type { Material } from "@/lib/operations-types";
import { convertToBase, formatQuantity } from "@/lib/units";
import { ModalShell } from "./modal-shell";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

function inputUnitsFor(material?: Material): InputUnit[] {
  if (!material) return [];
  return Array.from(new Set<InputUnit>([
    ...(material.purchaseUnit ? [material.purchaseUnit] : []),
    material.unit,
  ]));
}

const stockSchema = z.object({
  materialId: z.string().min(1, "Select a material"),
  direction: z.enum(["in", "out"]),
  quantity: z.number({ message: "Quantity must be greater than zero" }).positive("Quantity must be greater than zero"),
  inputUnit: z.string().min(1, "Choose an entry unit"),
  note: z.string().optional(),
});

type StockForm = z.infer<typeof stockSchema>;

export function StockModal({
  materials,
  onClose,
  onSave,
}: {
  materials: Material[];
  onClose: () => void;
  onSave: (materialId: string, direction: "in" | "out", quantity: number, inputUnit: InputUnit, note: string) => void;
}) {
  const firstMaterial = materials[0];
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StockForm>({
    resolver: zodResolver(stockSchema),
    defaultValues: {
      materialId: firstMaterial?.id ?? "",
      direction: "in",
      quantity: 1,
      inputUnit: (firstMaterial?.purchaseUnit ?? firstMaterial?.unit ?? "m²") as InputUnit,
      note: "",
    },
    mode: "onSubmit",
  });

  const materialId = watch("materialId");
  const direction = watch("direction");
  const quantity = watch("quantity");
  const inputUnit = watch("inputUnit");

  const material = materials.find((entry) => entry.id === materialId);
  const inputUnits = inputUnitsFor(material);
  const converted = material
    ? (() => {
        try {
          return convertToBase(
            quantity,
            inputUnit as InputUnit,
            material.baseUnit ?? material.unit,
            material.conversionRatio,
            material.rollEquivalent,
            material.sheetEquivalent,
          );
        } catch {
          return 0;
        }
      })()
    : 0;

  const onSubmit = (data: StockForm) => {
    onSave(data.materialId, data.direction, data.quantity, data.inputUnit as InputUnit, data.note ?? "");
  };

  return (
    <ModalShell
      title="Stock movement"
      subtitle="Record a purchase-unit movement and convert it into the tracked base unit."
      onClose={onClose}
      footer={
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="tertiary" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form="stock-movement-form"
            variant="primary"
          >
            Save stock movement
            <ArrowUpRight size={16} />
          </Button>
        </div>
      }
    >
      <form id="stock-movement-form" className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="flex gap-3 p-3 bg-gray-50 border border-line rounded-lg">
          <button 
            type="button" 
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
              direction === "in"
                ? "bg-green text-white shadow-sm focus:ring-green"
                : "bg-white text-gray-600 border border-line hover:bg-gray-50 focus:ring-gray-300"
            )}
            onClick={() => setValue("direction", "in")}
          >
            <ArrowDownRight size={18} />
            Stock In
          </button>
          <button 
            type="button" 
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
              direction === "out"
                ? "bg-coral text-white shadow-sm focus:ring-coral"
                : "bg-white text-gray-600 border border-line hover:bg-gray-50 focus:ring-gray-300"
            )}
            onClick={() => setValue("direction", "out")}
          >
            <ArrowUpRight size={18} />
            Stock Out
          </button>
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-navy mb-2">
            Material
          </label>
          <select
            {...register("materialId")}
            onChange={(event) => {
              const next = materials.find((entry) => entry.id === event.target.value);
              setValue("materialId", event.target.value);
              setValue("inputUnit", (next?.purchaseUnit ?? next?.unit ?? "m²") as InputUnit);
            }}
            className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
          >
            {materials.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.name}</option>
            ))}
          </select>
          {errors.materialId && (
            <small className="block mt-1 text-xs font-medium text-coral">
              {errors.materialId.message}
            </small>
          )}
          {material?.specification && (
            <small className="block mt-1 text-xs text-gray-500">
              {material.specification}
              {material.specificationValue ? `: ${material.specificationValue}` : " — choose the configured variant in master data"}
            </small>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Purchase quantity
            </label>
            <input 
              type="number" 
              min="0.001" 
              step="0.001" 
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
              Entry unit
            </label>
            <select 
              {...register("inputUnit")}
              className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
            >
              {inputUnits.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {errors.inputUnit && (
              <small className="block mt-1 text-xs font-medium text-coral">
                {errors.inputUnit.message}
              </small>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-3 bg-cyan/10 rounded-lg border border-cyan/20">
          <Sparkles size={17} className="text-cyan flex-none" />
          <span className="text-sm text-gray-600">Normalized base quantity</span>
          <span className="font-semibold text-navy ml-auto">
            {formatQuantity(converted, material?.baseUnit ?? material?.unit ?? "m²")}
          </span>
        </div>
        
        {material?.conversionRatio ? (
          <small className="text-xs text-gray-500">
            1 {material.purchaseUnit ?? "purchase unit"} = {material.conversionRatio} {material.baseUnit ?? material.unit}
          </small>
        ) : (
          <small className="text-xs text-gray-500">
            No conversion ratio is configured for this material. Confirm it before receiving roll or sheet stock.
          </small>
        )}
        
        <div>
          <label className="block text-sm font-semibold text-navy mb-2">
            Reference note
          </label>
          <input 
            placeholder="Supplier, job card, or issue reason" 
            {...register("note")}
            className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
          />
        </div>
      </form>
    </ModalShell>
  );
}
