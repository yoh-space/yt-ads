"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, ClipboardPlus, FileText, Package, Ruler } from "lucide-react";
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
  const [requestedQuantity, setRequestedQuantity] = useState(String(selectedJob?.quantity ?? ""));
  const [note, setNote] = useState("");
  const materialOptions = useMemo(() => materials, [materials]);

  return (
    <ModalShell
      title="Request production material"
      subtitle="Choose the job, confirm the material, and tell the storekeeper how much is needed."
      kicker="OPERATOR MATERIAL REQUEST"
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="tertiary" type="button" onClick={onClose}>Cancel</Button>
          {activeJobs.length > 0 ? (
            <Button type="submit" form="material-request-form" disabled={blocked}>
              {blocked ? "Clearance required" : "Send request"} <ClipboardPlus size={16} />
            </Button>
          ) : null}
        </div>
      }
    >
      {activeJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/40 px-6 py-12 text-center">
          <BriefcaseBusiness size={24} className="text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">No active jobs available</h3>
          <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">A material request must be connected to an active job card.</p>
        </div>
      ) : (
        <form
          id="material-request-form"
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedJob || !selectedMaterial || blocked) return;
            const quantity = Number(requestedQuantity);
            if (!Number.isFinite(quantity) || quantity <= 0) return;
            onSave({
              jobCardId: selectedJob.id,
              materialId: selectedMaterial.id,
              requestedQuantity: quantity,
              unit: selectedMaterial.unit,
              note: note || undefined,
            });
          }}
        >
          {blocked ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"
            >
              <p className="m-0 flex items-center gap-2 font-semibold">
                <AlertTriangle size={17} className="flex-none text-rose-300" />
                New requests are paused
              </p>
              <p className="mb-3 mt-2 text-xs leading-5 text-rose-200/80">
                Reconcile the material currently assigned to your machine and wait for clearance approval before requesting more stock.
              </p>
              <ul className="m-0 grid list-none gap-2 p-0">
                {unclearedStock.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-500/20 bg-background/30 px-3 py-2 text-xs">
                    <span className="font-medium">{item.materialName} <span className="text-rose-200/60">· {item.machineName}</span></span>
                    <span className="font-mono text-rose-100">
                      {formatQuantity(item.currentRemaining, item.baseUnit as Unit)} {item.baseUnit} · {item.status === "ACTIVE" ? "in use" : "awaiting clearance"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="grid gap-4">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-foreground"><BriefcaseBusiness size={14} className="text-cyan" /> Job card</span>
            <select value={jobCardId} onChange={(event) => {
              const nextJob = activeJobs.find((job) => job.id === event.target.value);
              setJobCardId(event.target.value);
              if (nextJob) {
                setMaterialId(nextJob.materialId);
                setRequestedQuantity(String(nextJob.quantity));
              }
            }} className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/20">
              {activeJobs.map((job) => <option key={job.id} value={job.id}>{job.code} · {job.client} · {job.title}</option>)}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-[1.35fr_0.65fr]">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-foreground"><Package size={14} className="text-cyan" /> Material</span>
              <select value={materialId} onChange={(event) => setMaterialId(event.target.value)} className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/20">
                {materialOptions.map((material) => <option key={material.id} value={material.id}>{material.name} · {formatQuantity(material.quantity, material.unit)} available</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-foreground"><Ruler size={14} className="text-cyan" /> Quantity <span className="font-normal text-muted-foreground">({selectedMaterial?.unit ?? "base unit"})</span></span>
              <input type="number" min="0.01" step="0.01" required value={requestedQuantity} onChange={(event) => setRequestedQuantity(event.target.value)} className="h-11 w-full rounded-lg border border-border bg-secondary px-3 font-mono text-sm text-foreground outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/20" />
            </label>
          </div>
          </div>
          {selectedJob && selectedMaterial ? (
            <div className="flex items-start gap-3 rounded-xl border border-cyan/20 bg-cyan/5 p-3">
              <CheckCircle2 size={17} className="mt-0.5 flex-none text-cyan" />
              <div className="min-w-0 text-xs leading-5">
                <p className="font-semibold text-foreground">Request summary</p>
                <p className="truncate text-muted-foreground">{selectedJob.code} · {selectedJob.client} · {selectedMaterial.name}</p>
              </div>
            </div>
          ) : null}
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-foreground"><FileText size={14} className="text-cyan" /> Note <span className="font-normal text-muted-foreground">(optional)</span></span>
            <input placeholder="Add a pickup location, urgency, or other useful detail" value={note} onChange={(event) => setNote(event.target.value.slice(0, 240))} className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-cyan focus:ring-2 focus:ring-cyan/20" />
          </label>
          <p className="m-0 text-xs text-muted-foreground">The storekeeper will review this request and confirm the issued quantity.</p>
        </form>
      )}
    </ModalShell>
  );
}
