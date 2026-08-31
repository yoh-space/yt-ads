"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
import type { InputUnit } from "@/lib/units";
import type { Material } from "@/lib/operations-types";
import { convertToBase, formatQuantity } from "@/lib/units";
import { ModalShell } from "./modal-shell";

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
    >
      <form className="modal-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="choice-row">
          <button type="button" className={direction === "in" ? "selected in" : ""} onClick={() => setValue("direction", "in")}><ArrowDownRight size={18} />Stock In</button>
          <button type="button" className={direction === "out" ? "selected out" : ""} onClick={() => setValue("direction", "out")}><ArrowUpRight size={18} />Stock Out</button>
        </div>
        <label>
          Material
          <select
            {...register("materialId")}
            onChange={(event) => {
              const next = materials.find((entry) => entry.id === event.target.value);
              setValue("materialId", event.target.value);
              setValue("inputUnit", (next?.purchaseUnit ?? next?.unit ?? "m²") as InputUnit);
            }}
          >
            {materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
          {errors.materialId ? <small className="field-error">{errors.materialId.message}</small> : null}
          {material?.specification ? <small className="settings-help">{material.specification}{material.specificationValue ? `: ${material.specificationValue}` : " — choose the configured variant in master data"}</small> : null}
        </label>
        <div className="two-field">
          <label>
            Purchase quantity
            <input type="number" min="0.001" step="0.001" {...register("quantity", { valueAsNumber: true })} />
            {errors.quantity ? <small className="field-error">{errors.quantity.message}</small> : null}
          </label>
          <label>
            Entry unit
            <select {...register("inputUnit")}>
              {inputUnits.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            {errors.inputUnit ? <small className="field-error">{errors.inputUnit.message}</small> : null}
          </label>
        </div>
        <div className="conversion-box">
          <Sparkles size={17} />
          <span>Normalized base quantity</span>
          <strong>{formatQuantity(converted, material?.baseUnit ?? material?.unit ?? "m²")}</strong>
        </div>
        {material?.conversionRatio ? <small className="settings-help">1 {material.purchaseUnit ?? "purchase unit"} = {material.conversionRatio} {material.baseUnit ?? material.unit}</small> : <small className="settings-help">No conversion ratio is configured for this material. Confirm it before receiving roll or sheet stock.</small>}
        <label>
          Reference note
          <input placeholder="Supplier, job card, or issue reason" {...register("note")} />
        </label>
        <button className="button primary full" type="submit">Save stock movement <ArrowUpRight size={16} /></button>
      </form>
    </ModalShell>
  );
}
