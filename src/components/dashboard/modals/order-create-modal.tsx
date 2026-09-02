"use client";

import { useState } from "react";
import { ArrowUpRight, Calendar } from "lucide-react";
import type { OrderPriority } from "@/lib/operations-types";
import { ModalShell } from "./modal-shell";

export type NewOrderInput = {
  clientName: string;
  phone: string;
  serviceType: string;
  dimensions: string;
  quantity: string;
  amount?: number;
  preferredDueDate: number;
  priority: OrderPriority;
  notes: string;
};

const SERVICES = [
  "Banner",
  "Sign board",
  "Vinyl wrap",
  "Acrylic sign",
  "Sticker set",
  "Foam board",
  "LED sign",
  "Print & cut",
  "Fleet branding",
  "Other",
];

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(17, 0, 0, 0);
  return d.getTime();
}

export function OrderCreateModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: NewOrderInput) => void;
}) {
  const [step, setStep] = useState(1);
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState(daysFromNow(3));
  const [priority, setPriority] = useState<OrderPriority>("Medium");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    setSubmitting(true);
    onSave({ clientName, phone, serviceType, dimensions, quantity, amount: amount > 0 ? amount : undefined, preferredDueDate: dueDate, priority, notes });
  }

  return (
    <ModalShell
      title="New customer order" subtitle="Register a walk-in or phone order. After acceptance, convert it to a job card with machine and material assignment."
      step={step}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between w-full">
          <button type="button" className="button tertiary" onClick={() => (step === 1 ? onClose() : setStep(step - 1))}>{step === 1 ? "Cancel" : "Back"}</button>
          <button className="button primary" type="submit" form="new-order-form" disabled={submitting}>
            {step === 3 ? (submitting ? "Creating…" : "Create order") : "Continue"} <ArrowUpRight size={16} />
          </button>
        </div>
      }
    >
      <form id="new-order-form" className="modal-form" onSubmit={handleSubmit}>
        {step === 1 ? (
          <>
            <label>
              Client name
              <input autoFocus placeholder="e.g. Addis Breweries" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
            </label>
            <label>
              Phone number
              <input type="tel" placeholder="+251 91 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <label>
              Service type
              <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} required>
                <option value="">Select service…</option>
                {SERVICES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Dimensions / specs
              <input placeholder="e.g. 3m × 1.2m double-sided" value={dimensions} onChange={(e) => setDimensions(e.target.value)} required />
            </label>
            <label>
              Quantity description
              <input placeholder='e.g. 12 pcs, 86.4 m²' value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </label>
            <label>
              Order value (ETB)
              <input type="number" min="0" step="50" placeholder="e.g. 4500" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
            </label>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <label>
              Preferred due date
              <input type="date" value={new Date(dueDate).toISOString().slice(0, 10)} onChange={(e) => { const v = new Date(e.target.value); v.setHours(17, 0, 0, 0); setDueDate(v.getTime()); }} required />
            </label>
            <label>
              Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value as OrderPriority)}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </label>
            <label>
              Notes
              <textarea placeholder="Special instructions (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </label>
            <div className="conversion-box">
              <Calendar size={17} />
              <span>Due</span>
              <strong>{new Date(dueDate).toLocaleString("en-ET", { dateStyle: "medium" })}</strong>
            </div>
          </>
        ) : null}
      </form>
    </ModalShell>
  );
}
