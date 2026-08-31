"use client";

import { useState } from "react";
import type { ExceptionReason, Material } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";

const reasons: ExceptionReason[] = ["Sample Print", "Minor Repair", "Test Cut", "Internal Maintenance"];

export function ExceptionStockModal({ materials, onClose, onSave }: { materials: Material[]; onClose: () => void; onSave: (input: { materialId: string; quantity: number; unit: Material["unit"]; reason: ExceptionReason; authorizationNote?: string }) => void }) {
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<ExceptionReason>(reasons[0]);
  const [authorizationNote, setAuthorizationNote] = useState("");
  const material = materials.find((entry) => entry.id === materialId);
  const unit = material?.baseUnit ?? material?.unit ?? "m²";
  return <div className="modal-backdrop"><section className="modal-card"><div className="modal-header"><div><span className="panel-kicker">EXCEPTION STOCK-OUT</span><h2>Fast material issue</h2><p>For small tasks that do not need a formal job card. Every issue is audited separately.</p></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div><form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (materialId && quantity > 0) onSave({ materialId, quantity, unit, reason, authorizationNote: authorizationNote.trim() || undefined }); }}><label>Material<select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>{materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {formatQuantity(entry.quantity, entry.baseUnit ?? entry.unit)}</option>)}</select></label><label>Quantity ({unit})<input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label><label>Reason<select value={reason} onChange={(event) => setReason(event.target.value as ExceptionReason)}>{reasons.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label><label>Quick authorization note <span className="field-hint">Manager/owner authorization context</span><input placeholder="Optional PIN reference or note — never store a secret" value={authorizationNote} onChange={(event) => setAuthorizationNote(event.target.value)} /></label><div className="conversion-box"><strong>Immediate deduction</strong><span>{quantity} {unit} from the material balance</span></div><div className="modal-actions"><button type="button" className="button tertiary" onClick={onClose}>Cancel</button><button type="submit" className="button primary">Record exception stock-out</button></div></form></section></div>;
}
