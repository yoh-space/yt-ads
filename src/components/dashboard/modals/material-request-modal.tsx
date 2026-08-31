"use client";

import { useMemo, useState } from "react";
import { ClipboardPlus } from "lucide-react";
import type { JobCard, Material, Unit } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { ModalShell } from "./modal-shell";

export type NewMaterialRequestInput = {
  jobCardId: string;
  materialId: string;
  requestedQuantity: number;
  unit: Unit;
  note?: string;
};

export function MaterialRequestModal({
  jobs,
  materials,
  onClose,
  onSave,
}: {
  jobs: JobCard[];
  materials: Material[];
  onClose: () => void;
  onSave: (input: NewMaterialRequestInput) => void;
}) {
  const activeJobs = jobs.filter((job) => job.status !== "Completed");
  const [jobCardId, setJobCardId] = useState(activeJobs[0]?.id ?? "");
  const selectedJob = activeJobs.find((job) => job.id === jobCardId) ?? activeJobs[0];
  const [materialId, setMaterialId] = useState(selectedJob?.materialId ?? materials[0]?.id ?? "");
  const selectedMaterial = materials.find((material) => material.id === materialId);
  const [requestedQuantity, setRequestedQuantity] = useState(selectedJob?.quantity ?? 0);
  const [note, setNote] = useState("");
  const materialOptions = useMemo(() => materials, [materials]);

  return (
    <ModalShell title="Request material" subtitle="One short request for the selected job. The storekeeper will confirm the issued quantity." onClose={onClose}>
      {activeJobs.length === 0 ? (
        <div className="empty-state">No active job cards are available for a material request.</div>
      ) : (
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedJob || !selectedMaterial) return;
            onSave({
              jobCardId: selectedJob.id,
              materialId: selectedMaterial.id,
              requestedQuantity,
              unit: selectedMaterial.unit,
              note: note || undefined,
            });
          }}
        >
          <label>
            Job card
            <select value={jobCardId} onChange={(event) => {
              const nextJob = activeJobs.find((job) => job.id === event.target.value);
              setJobCardId(event.target.value);
              if (nextJob) {
                setMaterialId(nextJob.materialId);
                setRequestedQuantity(nextJob.quantity);
              }
            }}>
              {activeJobs.map((job) => <option key={job.id} value={job.id}>{job.code} · {job.client} · {job.title}</option>)}
            </select>
          </label>
          <label>
            Material
            <select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
              {materialOptions.map((material) => <option key={material.id} value={material.id}>{material.name} · {formatQuantity(material.quantity, material.unit)} available</option>)}
            </select>
          </label>
          <label>
            Quantity ({selectedMaterial?.unit ?? "base unit"})
            <input type="number" min="0.01" step="0.01" required value={requestedQuantity} onChange={(event) => setRequestedQuantity(Number(event.target.value))} />
          </label>
          <label>
            Note <input placeholder="Optional note" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="conversion-box"><ClipboardPlus size={17} /><span>Request stays simple: select, quantity, submit.</span></div>
          <button className="button primary full" type="submit">Request material <ClipboardPlus size={16} /></button>
        </form>
      )}
    </ModalShell>
  );
}
