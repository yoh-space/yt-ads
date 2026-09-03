"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardPlus } from "lucide-react";
import type { JobCard, Material, Unit } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { ModalShell } from "./modal-shell";
import { Button } from "@/components/ui";

export type NewMaterialRequestInput = {
  jobCardId: string;
  materialId: string;
  requestedQuantity: number;
  unit: Unit;
  note?: string;
};

export type UnclearedFloorStock = {
  id: string;
  status: "ACTIVE" | "PENDING_CLEARANCE";
  materialName: string;
  machineName: string;
  currentRemaining: number;
  baseUnit: string;
};

export function MaterialRequestModal({
  jobs,
  materials,
  unclearedStock = [],
  onClose,
  onSave,
}: {
  jobs: JobCard[];
  materials: Material[];
  unclearedStock?: UnclearedFloorStock[];
  onClose: () => void;
  onSave: (input: NewMaterialRequestInput) => void;
}) {
  const activeJobs = jobs.filter((job) => job.status !== "Completed");
  const blocked = unclearedStock.length > 0;
  const [jobCardId, setJobCardId] = useState(activeJobs[0]?.id ?? "");
  const selectedJob = activeJobs.find((job) => job.id === jobCardId) ?? activeJobs[0];
  const [materialId, setMaterialId] = useState(selectedJob?.materialId ?? materials[0]?.id ?? "");
  const selectedMaterial = materials.find((material) => material.id === materialId);
  const [requestedQuantity, setRequestedQuantity] = useState(selectedJob?.quantity ?? 0);
  const [note, setNote] = useState("");
  const materialOptions = useMemo(() => materials, [materials]);

  return (
    <ModalShell
      title="Request material" subtitle="One short request for the selected job. The storekeeper will confirm the issued quantity." onClose={onClose}
      footer={
        activeJobs.length === 0 ? undefined : (
          <div className="flex items-center justify-end gap-3 w-full">
            <Button variant="tertiary" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" form="material-request-form" disabled={blocked}>
              {blocked ? "Clearance required" : "Request material"} <ClipboardPlus size={16} />
            </Button>
          </div>
        )
      }
    >
      {activeJobs.length === 0 ? (
        <div className="empty-state">No active job cards are available for a material request.</div>
      ) : (
        <form
          id="material-request-form"
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedJob || !selectedMaterial || blocked) return;
            onSave({
              jobCardId: selectedJob.id,
              materialId: selectedMaterial.id,
              requestedQuantity,
              unit: selectedMaterial.unit,
              note: note || undefined,
            });
          }}
        >
          {blocked ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-300"
            >
              <p className="flex items-center gap-2 m-0 font-semibold">
                <AlertTriangle size={16} className="flex-none text-rose-400" />
                Request blocked — Owner Clearance required
              </p>
              <p className="mt-2 mb-2 text-xs text-rose-300/90">
                You still hold active or un-cleared floor material. Reconcile your remaining stock, then wait for the
                Owner to approve your clearance before requesting new stock.
              </p>
              <ul className="m-0 list-none grid gap-1.5 p-0">
                {unclearedStock.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-rose-800/40 bg-rose-950/30 px-3 py-1.5 font-mono text-[11px]">
                    <span>{item.materialName} · {item.machineName}</span>
                    <span className="font-semibold">
                      {formatQuantity(item.currentRemaining, item.baseUnit as Unit)} {item.baseUnit} ·{" "}
                      {item.status === "ACTIVE" ? "in use" : "awaiting clearance"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
        </form>
      )}
    </ModalShell>
  );
}
