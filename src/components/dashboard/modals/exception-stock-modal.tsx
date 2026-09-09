"use client";

import { useState } from "react";
import { AlertTriangle, PackageMinus } from "lucide-react";
import type { ExceptionReason, Material } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { ModalShell } from "./modal-shell";
import { Button, Input, NumericInput, Select } from "@/components/shared/ui";

const reasons: ExceptionReason[] = ["Sample Print", "Minor Repair", "Test Cut", "Internal Maintenance"];

export function ExceptionStockModal({ materials, onClose, onSave }: { materials: Material[]; onClose: () => void; onSave: (input: { materialId: string; quantity: number; unit: Material["unit"]; reason: ExceptionReason; authorizationNote?: string }) => void }) {
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [quantityValid, setQuantityValid] = useState(true);
  const [reason, setReason] = useState<ExceptionReason>(reasons[0]);
  const [authorizationNote, setAuthorizationNote] = useState("");
  const material = materials.find((entry) => entry.id === materialId);
  const unit = material?.baseUnit ?? material?.unit ?? "m²";
  const parsedQuantity = Number(quantity);
  const hasValidationError = !quantity.trim() || !quantityValid || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0;

  return (
    <ModalShell
      kicker="EXCEPTION STOCK-OUT"
      title="Fast material issue"
      subtitle="For small tasks that do not need a formal job card. Every issue is audited separately."
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="tertiary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="exception-stock-form" disabled={hasValidationError}>Record exception stock-out</Button>
        </div>
      }
    >
      <form
        id="exception-stock-form"
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
           if (materialId && !hasValidationError) onSave({ materialId, quantity: parsedQuantity, unit, reason, authorizationNote: authorizationNote.trim() || undefined });
        }}
      >
        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5" htmlFor="exception-material">Material</label>
          <Select id="exception-material" value={materialId} onChange={(event) => setMaterialId(event.target.value)} className="w-full">
            {materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {formatQuantity(entry.quantity, entry.baseUnit ?? entry.unit)}</option>)}
          </Select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5" htmlFor="exception-quantity">Quantity ({unit})</label>
          <NumericInput
            id="exception-quantity"
            min={0.01}
            step="0.01"
            value={quantity}
            emptyValue={0.01}
            onChange={setQuantity}
            onValidityChange={setQuantityValid}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5" htmlFor="exception-reason">Reason</label>
          <Select id="exception-reason" value={reason} onChange={(event) => setReason(event.target.value as ExceptionReason)} className="w-full">
            {reasons.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </Select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5" htmlFor="exception-note">
            Quick authorization note
            <span className="ml-1 text-xs font-normal text-gray-500">Manager/owner authorization context</span>
          </label>
          <Input
            id="exception-note"
            placeholder="Optional PIN reference or note — never store a secret"
            value={authorizationNote}
            onChange={(event) => setAuthorizationNote(event.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-3 p-4 rounded-lg bg-cyan/5 border border-cyan/20">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-line text-coral flex-none">
            <PackageMinus size={16} />
          </span>
          <div>
            <strong className="block text-sm font-semibold text-navy">Immediate deduction</strong>
            <span className="text-xs text-gray-600">{quantity || "0"} {unit} from the material balance</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gold/10 border border-gold/20 rounded-lg px-3 py-2.5">
          <AlertTriangle size={14} className="text-gold flex-none" />
          Exceptions are excluded from job-card accounting and flagged in the audit report.
        </div>
      </form>
    </ModalShell>
  );
}
