"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, Box, Wrench } from "lucide-react";
import type { Machine, Material, Priority, Unit } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { ModalShell } from "./modal-shell";

export type NewJobInput = {
  client: string;
  title: string;
  machineId: string;
  materialId: string;
  quantity: number;
  unit: Unit;
  due: string;
  priority: Priority;
};

const jobSchema = z.object({
  client: z.string().min(1, "Client / order owner is required"),
  title: z.string().min(1, "Job description is required"),
  machineId: z.string().min(1, "Assign a machine"),
  materialId: z.string().min(1, "Select a raw material"),
  quantity: z.number({ message: "Quantity must be greater than zero" }).positive("Quantity must be greater than zero"),
  unit: z.string(),
  due: z.string().min(1, "Choose a due date"),
  priority: z.enum(["High", "Medium", "Low"]),
});

type JobForm = z.infer<typeof jobSchema>;

export function JobModal({
  materials,
  machines,
  onClose,
  onSave,
}: {
  materials: Material[];
  machines: Machine[];
  onClose: () => void;
  onSave: (input: NewJobInput) => void;
}) {
  const [step, setStep] = useState(1);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<JobForm>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      machineId: machines[0]?.id ?? "",
      materialId: materials[0]?.id ?? "",
      quantity: 1,
      unit: materials[0]?.unit ?? "m²",
      due: "Newly scheduled",
      priority: "Low",
    },
    mode: "onSubmit",
  });

  const machineId = watch("machineId");
  const materialId = watch("materialId");
  const quantity = watch("quantity");
  const client = watch("client");
  const title = watch("title");
  const due = watch("due");
  const priority = watch("priority");
  const unit = watch("unit");

  const machine = machines.find((entry) => entry.id === machineId);
  const material = materials.find((entry) => entry.id === materialId);
  const fieldError = (field: keyof NewJobInput) => errors[field]?.message;

  const onSubmit = (data: JobForm) => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    onSave({
      client: data.client,
      title: data.title,
      machineId: data.machineId,
      materialId: data.materialId,
      quantity: data.quantity,
      unit: material?.unit ?? "m²",
      due: data.due,
      priority: data.priority,
    });
  };

  function goNext(event: React.FormEvent) {
    event.preventDefault();
    if (step < 3) {
      const stepFields: Array<"client" | "title" | "machineId"> = step === 1 ? ["client", "title"] : ["machineId"];
      const invalid = stepFields.some((field) => !getStepValue(field));
      if (invalid) return;
      setStep(step + 1);
      return;
    }
    handleSubmit(onSubmit)();
  }

  function getStepValue(field: "client" | "title" | "machineId") {
    if (field === "client") return client;
    if (field === "title") return title;
    return machineId;
  }

  const stepError = (field: keyof JobForm) => {
    const message = fieldError(field);
    return message ? (
      <small className="block mt-1 text-xs font-medium text-coral">
        {message}
      </small>
    ) : null;
  };

  return (
    <ModalShell
      title="Create job card" subtitle="Link order, machinery, and material deduction in one workflow."
      step={step}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-line bg-white text-navy transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
            onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-navy text-white shadow-sm transition-colors hover:bg-navy-2 focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2"
            type="submit"
            form="new-job-form"
          >
            {step === 3 ? "Create job card" : "Continue"}
            <ArrowUpRight size={16} />
          </button>
        </div>
      }
    >
      <form id="new-job-form" className="space-y-6" onSubmit={goNext}>
        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                Client / order owner
              </label>
              <input 
                autoFocus 
                placeholder="e.g. Addis Breweries" 
                {...register("client")}
                className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
              />
              {stepError("client")}
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                Job description
              </label>
              <input 
                placeholder="e.g. Building facade branding" 
                {...register("title")}
                className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
              />
              {stepError("title")}
            </div>
          </div>
        ) : null}
        
        {step === 2 ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                Assigned machine
              </label>
              <select 
                {...register("machineId")}
                className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
              >
                {machines.map((entry) => (
                  <option value={entry.id} key={entry.id}>
                    {entry.name} · {entry.code}
                  </option>
                ))}
              </select>
              {stepError("machineId")}
            </div>
            
            {machine && (
              <div className="flex items-center gap-3 p-3 bg-cyan/10 rounded-lg border border-cyan/20">
                <Wrench size={18} className="text-cyan flex-none" />
                <div>
                  <div className="font-semibold text-navy">{machine.name}</div>
                  <div className="text-sm text-gray-600">
                    Tracks consumption in {machine.materialUnit} for this workflow
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
        
        {step === 3 ? (
          <div className="space-y-4">            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                Raw material
              </label>
              <select 
                {...register("materialId")}
                className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
              >
                {materials.map((entry) => (
                  <option value={entry.id} key={entry.id}>
                    {entry.name} · {formatQuantity(entry.quantity, entry.unit)}
                  </option>
                ))}
              </select>
              {stepError("materialId")}
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                Planned material usage ({material?.unit ?? "m²"})
              </label>
              <input 
                type="number" 
                min="0.1" 
                step="0.1" 
                {...register("quantity", { valueAsNumber: true })}
                className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
              />
              {stepError("quantity")}
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                Due
              </label>
              <select 
                {...register("due")}
                className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
              >
                <option>Newly scheduled</option>
                <option>Today, 16:30</option>
                <option>Tomorrow, 10:00</option>
                <option>Tomorrow, 15:00</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                Priority
              </label>
              <select 
                {...register("priority")}
                className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors"
              >
                <option>High</option>
                <option>Medium</option>
                <option>Normal</option>
              </select>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-green/10 rounded-lg border border-green/20">
              <Box size={17} className="text-green flex-none" />
              <span className="text-sm text-gray-600">Available after job</span>
              <span className="font-semibold text-navy ml-auto">
                {material ? formatQuantity(Math.max(0, material.quantity - quantity), material.unit) : "—"}
              </span>
            </div>
            
            <input type="hidden" {...register("unit")} value={material?.unit ?? "m²"} />
          </div>
        ) : null}
      </form>
    </ModalShell>
  );
}
