"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ArrowUpRight, Calendar, FileImage, X } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { OrderPriority } from "@/lib/operations-types";
import { ModalShell } from "./modal-shell";
import { SERVICE_CATEGORIES, type ServiceId } from "@/constants/services";

export type NewOrderInput = {
  clientName: string;
  phone: string;
  serviceType: ServiceId;
  dimensions: string;
  quantity: string;
  amount?: number;
  preferredDueDate: number;
  priority: OrderPriority;
  notes: string;
  fileStorageId?: Id<"_storage">;
  fileName?: string;
};


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
  const generateUploadUrl = useMutation(api.orders.generateUploadUrl);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState(1);
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceType, setServiceType] = useState<ServiceId | "">("");
  const [dimensions, setDimensions] = useState("");
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState(daysFromNow(3));
  const [priority, setPriority] = useState<OrderPriority>("Medium");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (selected) setFile(selected);
  }

  async function uploadFile(): Promise<Id<"_storage"> | undefined> {
    if (!file) return undefined;
    const uploadUrl = await generateUploadUrl({});
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!response.ok) throw new Error("Unable to upload the design file.");
    const result = (await response.json()) as { storageId: string };
    return result.storageId as Id<"_storage">;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    // Client-side step validation
    if (step === 1) {
      if (!clientName.trim() || !phone.trim()) {
        setNotice("Please enter client name and phone number.");
        return;
      }
      setNotice("");
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!serviceType || !dimensions.trim() || !quantity.trim()) {
        setNotice("Please complete service, dimensions, and quantity.");
        return;
      }
      setNotice("");
      setStep(3);
      return;
    }

    // Final submission from step 3
    setNotice("");
    setSubmitting(true);
    try {
      const fileStorageId = await uploadFile();
      onSave({
        clientName,
        phone,
        serviceType: serviceType as ServiceId,
        dimensions,
        quantity,
        amount: amount > 0 ? amount : undefined,
        preferredDueDate: dueDate,
        priority,
        notes,
        fileStorageId,
        fileName: file?.name,
      });
    } catch (error) {
      setSubmitting(false);
      setNotice(error instanceof Error ? error.message : "Unable to create the order.");
    }
  }

  return (
    <ModalShell
      title="New customer order" subtitle="Register a walk-in or phone order. After acceptance, convert it to a job card with machine and material assignment."
      step={step}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500">Step {step} of 3</div>
            <div className="hidden sm:flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${step >= 1 ? "bg-cyan" : "bg-gray-300"}`} />
              <span className={`w-2 h-2 rounded-full ${step >= 2 ? "bg-cyan" : "bg-gray-300"}`} />
              <span className={`w-2 h-2 rounded-full ${step >= 3 ? "bg-cyan" : "bg-gray-300"}`} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              {step === 1 ? "Cancel" : "Back"}
            </button>

            <button
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow transition ${submitting ? "opacity-70 cursor-wait" : "hover:bg-cyan-600"} ${step === 3 ? "bg-green-600 text-white" : "bg-cyan text-white"}`}
              type="submit"
              form="new-order-form"
              disabled={submitting}
            >
              {step === 3 ? (submitting ? "Creating…" : "Create order") : "Continue"}
              <ArrowUpRight size={16} />
            </button>
          </div>
        </div>
      }
    >
      <form id="new-order-form" className="space-y-4" onSubmit={handleSubmit}>
        {notice ? (
          <div className="rounded-lg border border-line bg-coral/5 px-3 py-2 text-xs text-coral">{notice}</div>
        ) : null}
        {step === 1 ? (
          <>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Client name</span>
              <input
                autoFocus
                placeholder="e.g. Addis Breweries"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan/60"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Phone number</span>
              <input
                type="tel"
                placeholder="+251 91 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan/60"
              />
            </label>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Service type</span>
              <select
                value={serviceType}
                 onChange={(e) => setServiceType(e.target.value as ServiceId)}
                required
                className="mt-1 block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan/60"
              >
                <option value="">Select service…</option>
                {SERVICE_CATEGORIES.map((cat) => (
                  <optgroup key={cat.categoryId} label={cat.categoryName}>
                    {cat.items.map((it) => (
                      <option key={it.id} value={it.id}>{it.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Dimensions / specs</span>
              <input
                placeholder="e.g. 3m × 1.2m double-sided"
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan/60"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Quantity description</span>
              <input
                placeholder='e.g. 12 pcs, 86.4 m²'
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan/60"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Order value (ETB)</span>
              <input
                type="number"
                min="0"
                step="50"
                placeholder="e.g. 4500"
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan/60"
              />
            </label>
            <div>
              <span className="block mb-1 text-sm font-medium text-gray-700">Design file (optional)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.ai,.eps,.cdr,.png,.jpg,.jpeg,.webp,.svg,.gif,.tif,.tiff,.bmp,application/pdf,image/*"
                onChange={onFileChange}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-cyan/10 file:text-cyan-dark file:font-semibold file:cursor-pointer hover:file:bg-cyan/20"
              />
              {file ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-line bg-gray-50 px-3 py-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <FileImage size={15} className="text-cyan-dark flex-none" />
                    <strong className="text-xs font-semibold text-navy truncate">{file.name}</strong>
                    <small className="text-[9px] text-gray-500">{(file.size / 1024).toFixed(0)} KB</small>
                  </span>
                  <button
                    type="button"
                    className="flex-none text-gray-400 hover:text-coral"
                    onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    aria-label="Remove design file"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Preferred due date</span>
              <input
                type="date"
                value={new Date(dueDate).toISOString().slice(0, 10)}
                onChange={(e) => { const v = new Date(e.target.value); v.setHours(17, 0, 0, 0); setDueDate(v.getTime()); }}
                required
                className="mt-1 block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan/60"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as OrderPriority)}
                className="mt-1 block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan/60"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Notes</span>
              <textarea
                placeholder="Special instructions (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan/60"
              />
            </label>
            <div className="mt-3 flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
              <Calendar size={17} className="text-gray-600" />
              <span className="text-sm text-gray-600">Due</span>
              <strong className="text-sm font-semibold text-navy">{new Date(dueDate).toLocaleString("en-ET", { dateStyle: "medium" })}</strong>
            </div>
          </>
        ) : null}
      </form>
    </ModalShell>
  );
}
