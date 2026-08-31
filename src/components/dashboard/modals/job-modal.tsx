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
  priority: z.enum(["High", "Medium", "Normal"]),
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
      priority: "Normal",
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
    return message ? <small className="field-error">{message}</small> : null;
  };

  return (
    <ModalShell title="Create job card" subtitle="Link order, machinery, and material deduction in one workflow." step={step} onClose={onClose}>
      <form className="modal-form" onSubmit={goNext}>
        {step === 1 ? (
          <>
            <label>
              Client / order owner
              <input autoFocus placeholder="e.g. Addis Breweries" {...register("client")} />
              {stepError("client")}
            </label>
            <label>
              Job description
              <input placeholder="e.g. Building facade branding" {...register("title")} />
              {stepError("title")}
            </label>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <label>
              Assigned machine
              <select {...register("machineId")}>
                {machines.map((entry) => <option value={entry.id} key={entry.id}>{entry.name} · {entry.code}</option>)}
              </select>
              {stepError("machineId")}
            </label>
            <div className="assignment-preview"><Wrench size={18} /><div><strong>{machine?.name}</strong><span>Tracks consumption in {machine?.materialUnit} for this workflow</span></div></div>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <label>
              Raw material
              <select {...register("materialId")}>
                {materials.map((entry) => <option value={entry.id} key={entry.id}>{entry.name} · {formatQuantity(entry.quantity, entry.unit)}</option>)}
              </select>
              {stepError("materialId")}
            </label>
            <label>
              Planned material usage ({material?.unit ?? "m²"})
              <input type="number" min="0.1" step="0.1" {...register("quantity", { valueAsNumber: true })} />
              {stepError("quantity")}
            </label>
            <label>
              Due
              <select {...register("due")}>
                <option>Newly scheduled</option>
                <option>Today, 16:30</option>
                <option>Tomorrow, 10:00</option>
                <option>Tomorrow, 15:00</option>
              </select>
            </label>
            <label>
              Priority
              <select {...register("priority")}>
                <option>High</option>
                <option>Medium</option>
                <option>Normal</option>
              </select>
            </label>
            <div className="conversion-box"><Box size={17} /><span>Available after job</span><strong>{material ? formatQuantity(Math.max(0, material.quantity - quantity), material.unit) : "—"}</strong></div>
            <input type="hidden" {...register("unit")} value={material?.unit ?? "m²"} />
          </>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="button tertiary" onClick={() => (step === 1 ? onClose() : setStep(step - 1))}>{step === 1 ? "Cancel" : "Back"}</button>
          <button className="button primary" type="submit">{step === 3 ? "Create job card" : "Continue"} <ArrowUpRight size={16} /></button>
        </div>
      </form>
    </ModalShell>
  );
}
