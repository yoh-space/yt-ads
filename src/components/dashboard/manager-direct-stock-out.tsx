"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { AlertTriangle, Send } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ExceptionReason, Unit } from "@/lib/operations-types";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";

const reasons: ExceptionReason[] = ["Sample Print", "Minor Repair", "Test Cut", "Internal Maintenance"];

export function ManagerDirectStockOut() {
  const materials = useQuery(api.manager.inventory.listMaterials);
  const recordStockOut = useMutation(api.manager.inventory.recordDirectStockOut);
  const [materialId, setMaterialId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<ExceptionReason>(reasons[0]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const selectedMaterial = materials?.find((material) => material.id === materialId);

  async function submit() {
    if (!selectedMaterial) return toast.error("Choose a material first.");
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) return toast.error("Enter a valid quantity.");
    if (note.trim().length < 5) return toast.error("Explain why this emergency stock-out is needed.");
    setSubmitting(true);
    try {
      const result = await recordStockOut({
        materialId: selectedMaterial.id as Id<"materials">,
        quantity: parsedQuantity,
        unit: (selectedMaterial.baseUnit ?? selectedMaterial.unit) as Unit,
        reason,
        authorizationNote: note,
      });
      toast.success(result.status === "RECORDED" ? "Stock-out recorded." : "Sent to the owner for approval.");
      setQuantity("");
      setNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Stock-out could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel>
      <PanelHeader title="Emergency stock-out" subtitle="Use only when the storekeeper is unavailable." kicker="MATERIALS" icon={<AlertTriangle size={16} />} />
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <label className="space-y-1.5 text-xs font-semibold text-foreground">
          Material
          <select value={materialId} onChange={(event) => setMaterialId(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-xs font-normal outline-none focus:border-primary">
            <option value="">Choose material</option>
            {(materials ?? []).map((material) => <option key={material.id} value={material.id}>{material.name} · {material.quantity} {material.baseUnit ?? material.unit}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-foreground">
          Quantity
          <div className="flex gap-2">
            <input value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min="0" step="0.001" className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-xs font-normal outline-none focus:border-primary" placeholder="0" />
            <span className="flex h-10 min-w-16 items-center justify-center rounded-md border border-border bg-muted/20 px-2 text-[10px] text-muted-foreground">{selectedMaterial?.baseUnit ?? selectedMaterial?.unit ?? "unit"}</span>
          </div>
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-foreground">
          Reason
          <select value={reason} onChange={(event) => setReason(event.target.value as ExceptionReason)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-xs font-normal outline-none focus:border-primary">
            {reasons.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-foreground md:col-span-2">
          Why is this needed?
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs font-normal outline-none focus:border-primary" placeholder="Explain the urgent material use..." />
        </label>
        <div className="flex items-center justify-between gap-3 md:col-span-2">
          <p className="text-[10px] text-muted-foreground">Requests above the owner limit wait for approval.</p>
          <button type="button" disabled={submitting || !materials} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
            <Send size={14} /> {submitting ? "Sending..." : "Send request"}
          </button>
        </div>
      </div>
    </Panel>
  );
}
