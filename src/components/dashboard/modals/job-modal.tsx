"use client";

import { useState } from "react";
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
  const [client, setClient] = useState("");
  const [title, setTitle] = useState("");
  const [machineId, setMachineId] = useState(machines[0]?.id ?? "");
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [due, setDue] = useState("Newly scheduled");
  const [priority, setPriority] = useState<Priority>("Normal");
  const machine = machines.find((entry) => entry.id === machineId);
  const material = materials.find((entry) => entry.id === materialId);

  return (
    <ModalShell title="Create job card" subtitle="Link order, machinery, and material deduction in one workflow." step={step} onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (step < 3) {
            setStep(step + 1);
            return;
          }
          onSave({
            client,
            title,
            machineId,
            materialId,
            quantity,
            unit: material?.unit ?? "m²",
            due,
            priority,
          });
        }}
      >
        {step === 1 ? (
          <>
            <label>Client / order owner<input autoFocus placeholder="e.g. Addis Breweries" value={client} onChange={(event) => setClient(event.target.value)} /></label>
            <label>Job description<input placeholder="e.g. Building facade branding" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <label>
              Assigned machine
              <select value={machineId} onChange={(event) => setMachineId(event.target.value)}>
                {machines.map((entry) => <option value={entry.id} key={entry.id}>{entry.name} · {entry.code}</option>)}
              </select>
            </label>
            <div className="assignment-preview"><Wrench size={18} /><div><strong>{machine?.name}</strong><span>Tracks consumption in {machine?.materialUnit} for this workflow</span></div></div>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <label>
              Raw material
              <select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
                {materials.map((entry) => <option value={entry.id} key={entry.id}>{entry.name} · {formatQuantity(entry.quantity, entry.unit)}</option>)}
              </select>
            </label>
            <label>Planned material usage ({material?.unit})<input type="number" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
            <label>Due<select value={due} onChange={(event) => setDue(event.target.value)}><option>Newly scheduled</option><option>Today, 16:30</option><option>Tomorrow, 10:00</option><option>Tomorrow, 15:00</option></select></label>
            <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option>High</option><option>Medium</option><option>Normal</option></select></label>
            <div className="conversion-box"><Box size={17} /><span>Available after job</span><strong>{material ? formatQuantity(Math.max(0, material.quantity - quantity), material.unit) : "—"}</strong></div>
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

