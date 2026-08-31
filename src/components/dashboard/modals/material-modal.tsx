"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Sparkles } from "lucide-react";
import type { Accent, PurchaseUnit, Unit } from "@/lib/operations-types";
import { findMaterialSpecification } from "@/shared/material-specifications";
import { baseUnitOptions, materialDefinitionOptions, purchaseUnitOptions } from "../nav-config";
import { ModalShell } from "./modal-shell";

export type NewMaterialInput = {
  name: string;
  category: string;
  unit: Unit;
  baseUnit: Unit;
  purchaseUnit: PurchaseUnit;
  conversionRatio?: number;
  specification?: string;
  specificationValue?: string;
  specificationOptions?: string[];
  displayUnit?: string;
  quantity: number;
  reorderAt: number;
  rollEquivalent?: number;
  sheetEquivalent?: number;
  storageLocation?: string;
  averageUse?: string;
  reorderRule?: string;
  scrapRule?: string;
  accent: Accent;
};

const defaultRatios: Record<PurchaseUnit, number | undefined> = {
  roll: 160,
  sheet: 2.977,
  pack: 20,
  liter: 1,
  piece: 1,
};

const chooseValue = "__choose__";

const materialSchema = z.object({
  name: z.string().min(1, "Material name is required"),
  category: z.string().trim().min(1, "Category is required"),
  baseUnit: z.enum(baseUnitOptions),
  purchaseUnit: z.enum(purchaseUnitOptions),
  conversionRatio: z.preprocess(
    (value) => (Number.isNaN(value) || value === "" ? undefined : value),
    z.number({ message: "Conversion ratio must be positive" }).positive("Conversion ratio must be positive").optional()
  ),
  specificationValue: z.string().optional(),
  displayUnit: z.string().optional(),
  quantity: z.number({ message: "Opening quantity cannot be negative" }).min(0, "Opening quantity cannot be negative"),
  reorderAt: z.number({ message: "Reorder quantity cannot be negative" }).min(0, "Reorder quantity cannot be negative"),
  storageLocation: z.string().optional(),
  averageUse: z.string().optional(),
  reorderRule: z.string().optional(),
  scrapRule: z.string().optional(),
  accent: z.enum(["cyan", "gold", "violet", "blue", "green"]),
});

type MaterialFormOutput = z.output<typeof materialSchema>;
type MaterialFormInput = z.input<typeof materialSchema>;

export function MaterialModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: NewMaterialInput) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<MaterialFormInput, unknown, MaterialFormOutput>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      name: "",
      category: "Custom",
      baseUnit: "m²",
      purchaseUnit: "roll",
      conversionRatio: defaultRatios.roll,
      specificationValue: "",
      displayUnit: "ሮል",
      quantity: 0,
      reorderAt: 0,
      storageLocation: "",
      averageUse: "",
      reorderRule: "",
      scrapRule: "",
      accent: "cyan",
    },
    mode: "onSubmit",
  });

  const name = watch("name");
  const purchaseUnit = watch("purchaseUnit");
  const conversionRatio = watch("conversionRatio");
  const specificationValue = watch("specificationValue");

  const definition = findMaterialSpecification(name);
  const specificationOptions = definition?.specificationOptions ?? [];
  const baseUnit = getValues("baseUnit");

  function selectMaterial(value: string) {
    if (value === chooseValue) return;
    if (value === "__custom__") {
      setValue("name", "");
      setValue("category", "Custom");
      setValue("specificationValue", "");
      return;
    }
    const selected = findMaterialSpecification(value);
    if (!selected) return;
    setValue("name", selected.name);
    setValue("category", selected.category);
    setValue("baseUnit", selected.baseUnit);
    setValue("purchaseUnit", selected.purchaseUnit);
    setValue("conversionRatio", selected.conversionRatio);
    setValue("displayUnit", selected.displayUnit);
    setValue("specificationValue", "");
    setValue("storageLocation", selected.storageLocation ?? "");
    setValue("averageUse", selected.averageUse ?? "");
  }

  function selectPurchaseUnit(value: PurchaseUnit) {
    setValue("purchaseUnit", value);
    setValue("conversionRatio", defaultRatios[value]);
    setValue("displayUnit", value === "roll" ? "ሮል" : value === "sheet" ? "ቁጥር" : value === "pack" ? "Pack" : value === "liter" ? "ሊትር" : "ቁጥር");
  }

  const onSubmit = (data: MaterialFormOutput) => {
    if (specificationOptions.length > 0 && !data.specificationValue) return;
    onSave({
      name: definition?.name ?? (data.name || "New material"),
      category: definition?.category ?? (data.category.trim() || "Custom"),
      unit: data.baseUnit,
      baseUnit: data.baseUnit,
      purchaseUnit: data.purchaseUnit,
      conversionRatio: data.conversionRatio,
      specification: definition?.specification,
      specificationValue: data.specificationValue || undefined,
      specificationOptions: specificationOptions.length ? [...specificationOptions] : undefined,
      displayUnit: (data.displayUnit ?? "").trim() || undefined,
      quantity: data.quantity,
      reorderAt: data.reorderAt,
      rollEquivalent: data.purchaseUnit === "roll" ? data.conversionRatio : undefined,
      sheetEquivalent: data.purchaseUnit === "sheet" ? data.conversionRatio : undefined,
      storageLocation: data.storageLocation || undefined,
      averageUse: data.averageUse || undefined,
      reorderRule: data.reorderRule || undefined,
      scrapRule: data.scrapRule || undefined,
      accent: data.accent,
    });
  };

  return (
    <ModalShell
      title="Add raw material"
      subtitle="Choose a standard material definition and record its exact type or size."
      onClose={onClose}
      footer={<div className="modal-actions"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" type="submit" form="new-material-form"><Plus size={16} />Add material</button></div>}
    >
      <form
        id="new-material-form"
        className="modal-form compact-form"
        onSubmit={handleSubmit(onSubmit)}
      >
        <label>Material definition
          <select value={definition ? definition.name : (name ? "__custom__" : chooseValue)} onChange={(event) => selectMaterial(event.target.value)}>
            <option value={chooseValue} disabled>Select a standard material</option>
            {materialDefinitionOptions.map((materialName) => <option key={materialName} value={materialName}>{materialName}</option>)}
            <option value="__custom__">Custom material</option>
          </select>
        </label>
        <label>Material name<input autoFocus required placeholder="e.g. Banner" {...register("name")} /></label>
        {errors.name ? <small className="field-error">{errors.name.message}</small> : null}
        <div className="two-field">
          <label>Category<input readOnly={Boolean(definition)} placeholder="Custom" {...register("category")} /></label>
          <label>Purchase/display label<input readOnly={Boolean(definition)} placeholder="e.g. ሮል" {...register("displayUnit")} /></label>
        </div>
        <div className="two-field">
          <label>Purchase unit
            <Controller
              control={control}
              name="purchaseUnit"
              render={({ field }) => (
                <select value={field.value} disabled={Boolean(definition)} onChange={(event) => selectPurchaseUnit(event.target.value as PurchaseUnit)}>
                  {purchaseUnitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              )}
            />
          </label>
          <label>Base production unit
            <Controller
              control={control}
              name="baseUnit"
              render={({ field }) => (
                <select value={field.value} disabled={Boolean(definition)} onChange={(event) => setValue("baseUnit", event.target.value as MaterialFormOutput["baseUnit"])}>
                  {baseUnitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>              )}
            />
          </label>
        </div>
        {definition?.specification ? (
          <label>{definition.specification}
            <Controller
              control={control}
              name="specificationValue"
              render={({ field }) => (
                <select required value={field.value || chooseValue} onChange={(event) => setValue("specificationValue", event.target.value === chooseValue ? "" : event.target.value)}>
                  <option value={chooseValue} disabled>Select a standard option</option>
                  {specificationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              )}
            />
            {specificationOptions.length > 0 && !specificationValue ? <small className="field-error">Select a {definition?.specification ?? "material specification"} option.</small> : null}
          </label>
        ) : null}
        <div className="two-field">
          <label>Conversion ratio<input
            type="number"
            min="0.001"
            step="0.001"
            required={purchaseUnit !== "roll" || Boolean(definition?.conversionRatio)}
            placeholder={definition?.name === "PVC Film" ? "Pending physical confirmation" : undefined}
            {...register("conversionRatio", { valueAsNumber: true })}
          /></label>
          {errors.conversionRatio ? <small className="field-error">{errors.conversionRatio.message}</small> : null}
          <label>Opening base quantity<input type="number" min="0" step="0.01" {...register("quantity", { valueAsNumber: true })} /></label>
          {errors.quantity ? <small className="field-error">{errors.quantity.message}</small> : null}
        </div>
        <div className="conversion-box"><Sparkles size={17} /><span>1 {purchaseUnit} converts to</span><strong>{conversionRatio ? `${conversionRatio} ${baseUnit}` : "Pending confirmation"}</strong></div>
        <label>Reorder base quantity<input type="number" min="0" step="0.01" {...register("reorderAt", { valueAsNumber: true })} /></label>
        {errors.reorderAt ? <small className="field-error">{errors.reorderAt.message}</small> : null}
        <div className="two-field">
          <label>Storage location<input placeholder="e.g. Store / Rack A" {...register("storageLocation")} /></label>
          <label>Average use<input placeholder="e.g. Based on customer requirement" {...register("averageUse")} /></label>
        </div>
        <div className="two-field">
          <label>Reorder rule<input placeholder="Optional rule" {...register("reorderRule")} /></label>
          <label>Scrap rule<input placeholder="Optional rule" {...register("scrapRule")} /></label>
        </div>
        <div className="conversion-box"><Sparkles size={17} /><span>Accent colour</span>
          <Controller
            control={control}
            name="accent"
            render={({ field }) => (
              <select value={field.value} onChange={(event) => setValue("accent", event.target.value as Accent)} style={{ border: 0, background: "transparent", fontWeight: 700, color: "inherit" }}>
                <option value="cyan">Cyan</option>
                <option value="gold">Gold</option>
                <option value="violet">Violet</option>
                <option value="blue">Blue</option>
                <option value="green">Green</option>
              </select>
            )}
          />
        </div>
      </form>
    </ModalShell>
  );
}
