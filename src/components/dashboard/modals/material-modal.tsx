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
  canister: 1,
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
    setValue("displayUnit", value === "roll" ? "ሮል" : value === "sheet" ? "ሺት" : value === "pack" ? "Package" : value === "canister" ? "Canister" : value === "liter" ? "ሊትር" : "ቁጥር");
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
      footer={
        <div className="flex items-center justify-between w-full">
          <button 
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-line bg-white text-navy transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
            type="button" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-navy text-white shadow-sm transition-colors hover:bg-navy-2 focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2"
            type="submit" 
            form="new-material-form"
          >
            <Plus size={16} />
            Add material
          </button>
        </div>
      }
    >
      <form
        id="new-material-form"
        className="space-y-4"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div>
          <label className="block text-sm font-semibold text-navy mb-2">
            Material definition
          </label>
          <select 
            value={definition ? definition.name : (name ? "__custom__" : chooseValue)} 
            onChange={(event) => selectMaterial(event.target.value)}
            className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
          >
            <option value={chooseValue} disabled>Select a standard material</option>
            {materialDefinitionOptions.map((materialName) => (
              <option key={materialName} value={materialName}>{materialName}</option>
            ))}
            <option value="__custom__">Custom material</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-navy mb-2">
            Material name
          </label>
          <input 
            autoFocus 
            required 
            placeholder="e.g. Banner" 
            {...register("name")}
            className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
          />
          {errors.name && (
            <small className="block mt-1 text-xs font-medium text-coral">
              {errors.name.message}
            </small>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Category
            </label>
            <input 
              readOnly={Boolean(definition)} 
              placeholder="Custom" 
              {...register("category")}
              className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Purchase/display label
            </label>
            <input 
              readOnly={Boolean(definition)} 
              placeholder="e.g. ሮል" 
              {...register("displayUnit")}
              className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Purchase unit
            </label>
            <Controller
              control={control}
              name="purchaseUnit"
              render={({ field }) => (
                <select 
                  value={field.value} 
                  disabled={Boolean(definition)} 
                  onChange={(event) => selectPurchaseUnit(event.target.value as PurchaseUnit)}
                  className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors disabled:bg-gray-50 disabled:text-gray-500"
                >
                  {purchaseUnitOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              )}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Base production unit
            </label>
            <Controller
              control={control}
              name="baseUnit"
              render={({ field }) => (
                <select 
                  value={field.value} 
                  disabled={Boolean(definition)} 
                  onChange={(event) => setValue("baseUnit", event.target.value as MaterialFormOutput["baseUnit"])}
                  className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors disabled:bg-gray-50 disabled:text-gray-500"
                >
                  {baseUnitOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              )}
            />
          </div>
        </div>
        
        {definition?.specification && (
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              {definition.specification}
            </label>
            <Controller
              control={control}
              name="specificationValue"
              render={({ field }) => (
                <select 
                  required 
                  value={field.value || chooseValue} 
                  onChange={(event) => setValue("specificationValue", event.target.value === chooseValue ? "" : event.target.value)}
                  className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
                >
                  <option value={chooseValue} disabled>Select a standard option</option>
                  {specificationOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              )}
            />
            {specificationOptions.length > 0 && !specificationValue && (
              <small className="block mt-1 text-xs font-medium text-coral">
                Select a {definition?.specification ?? "material specification"} option.
              </small>
            )}
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Conversion ratio
            </label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              required={purchaseUnit !== "roll" || Boolean(definition?.conversionRatio)}
              placeholder={definition?.name === "PVC Film" ? "Pending physical confirmation" : undefined}
              {...register("conversionRatio", { valueAsNumber: true })}
              className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
            />
            {errors.conversionRatio && (
              <small className="block mt-1 text-xs font-medium text-coral">
                {errors.conversionRatio.message}
              </small>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Opening base quantity
            </label>
            <input 
              type="number" 
              min="0" 
              step="0.01" 
              {...register("quantity", { valueAsNumber: true })}
              className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
            />
            {errors.quantity && (
              <small className="block mt-1 text-xs font-medium text-coral">
                {errors.quantity.message}
              </small>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-3 bg-cyan/10 rounded-lg border border-cyan/20">
          <Sparkles size={17} className="text-cyan flex-none" />
          <span className="text-sm text-gray-600">1 {purchaseUnit} converts to</span>
          <span className="font-semibold text-navy ml-auto">
            {conversionRatio ? `${conversionRatio} ${baseUnit}` : "Pending confirmation"}
          </span>
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-navy mb-2">
            Reorder base quantity
          </label>
          <input 
            type="number" 
            min="0" 
            step="0.01" 
            {...register("reorderAt", { valueAsNumber: true })}
            className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
          />
          {errors.reorderAt && (
            <small className="block mt-1 text-xs font-medium text-coral">
              {errors.reorderAt.message}
            </small>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Storage location
            </label>
            <input 
              placeholder="e.g. Store / Rack A" 
              {...register("storageLocation")}
              className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Average use
            </label>
            <input 
              placeholder="e.g. Based on customer requirement" 
              {...register("averageUse")}
              className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Reorder rule
            </label>
            <input 
              placeholder="Optional rule" 
              {...register("reorderRule")}
              className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Scrap rule
            </label>
            <input 
              placeholder="Optional rule" 
              {...register("scrapRule")}
              className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-3 bg-violet/10 rounded-lg border border-violet/20">
          <Sparkles size={17} className="text-violet flex-none" />
          <span className="text-sm text-gray-600">Accent colour</span>
          <Controller
            control={control}
            name="accent"
            render={({ field }) => (
              <select 
                value={field.value} 
                onChange={(event) => setValue("accent", event.target.value as Accent)}
                className="ml-auto border-0 bg-transparent font-semibold text-navy focus:outline-none"
              >
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
