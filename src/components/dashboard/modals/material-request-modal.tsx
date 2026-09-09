"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, ClipboardPlus, FileText, Package, Plus, Ruler, Trash2 } from "lucide-react";
import type { JobCard, Material, PackageUnit, Unit } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { ModalShell } from "./modal-shell";
import { Button, NumericInput } from "@/components/shared/ui";

export type NewMaterialRequestInput = {
  jobCardId: string;
  materialId: string;
  requestedQuantity: number;
  unit: Unit;
  requestedPackages?: number;
  packageUnit?: PackageUnit;
  lines?: Array<{
    materialId: string;
    requestedPackages: number;
    packageUnit: PackageUnit;
    requestedQuantity: number;
    unit: Unit;
  }>;
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
  const defaultMaterial = materials.find((material) => material.id === selectedJob?.materialId) ?? materials[0];
  const packageUnitFor = (material?: Material): PackageUnit => material?.packageUnit
    ?? (material?.purchaseUnit === "roll" ? "ROLL" : material?.purchaseUnit === "sheet" ? "SHEET" : material?.purchaseUnit === "canister" || material?.purchaseUnit === "liter" ? "CANISTER" : material?.purchaseUnit === "piece" ? "PIECE" : "PACKAGE");
  const [lines, setLines] = useState(() => defaultMaterial ? [{ materialId: defaultMaterial.id, packages: "1" }] : []);
  const [note, setNote] = useState("");
  const materialOptions = useMemo(() => materials, [materials]);
  const lineFor = (materialId: string) => materials.find((material) => material.id === materialId);
  const linesHaveError = lines.some((line) => !line.packages.trim() || !Number.isFinite(Number(line.packages)) || Number(line.packages) < 1);

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
             <Button type="submit" form="material-request-form" disabled={blocked || linesHaveError}>
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
            if (!selectedJob || blocked || lines.length === 0) return;
            const requestLines = lines.map((line) => {
              const material = lineFor(line.materialId);
              const packages = Number(line.packages);
              const ratio = material?.conversionRatio && material.conversionRatio > 0 ? material.conversionRatio : 1;
              return material && Number.isFinite(packages) && packages > 0 ? {
                materialId: material.id,
                requestedPackages: packages,
                packageUnit: packageUnitFor(material),
                requestedQuantity: Number((packages * ratio).toFixed(3)),
                unit: material.baseUnit ?? material.unit,
              } : null;
            }).filter((line): line is NonNullable<typeof line> => line !== null);
            if (requestLines.length !== lines.length) return;
            const first = requestLines[0];
            onSave({
              jobCardId: selectedJob.id,
              materialId: first.materialId,
              requestedQuantity: first.requestedQuantity,
              unit: first.unit,
              requestedPackages: first.requestedPackages,
              packageUnit: first.packageUnit,
              lines: requestLines,
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
                      {formatQuantity(item.currentRemaining, item.baseUnit as Unit)} · {item.status === "ACTIVE" ? "in use" : "awaiting clearance"}
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
               if (nextJob) setLines([{ materialId: nextJob.materialId, packages: "1" }]);
            }} className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/20">
              {activeJobs.map((job) => <option key={job.id} value={job.id}>{job.code} · {job.client} · {job.title}</option>)}
            </select>
          </label>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold text-foreground"><Package size={14} className="text-cyan" /> Physical packages requested</span>
              <button type="button" onClick={() => setLines((current) => [...current, { materialId: materialOptions[0]?.id ?? "", packages: "1" }])} className="inline-flex items-center gap-1 rounded-md border border-cyan/30 px-2 py-1 text-xs font-semibold text-cyan"><Plus size={13} /> Add material</button>
            </div>
            {lines.map((line, index) => {
              const material = lineFor(line.materialId);
              const ratio = material?.conversionRatio && material.conversionRatio > 0 ? material.conversionRatio : 1;
              const packageUnit = packageUnitFor(material);
              return <div key={`${line.materialId}-${index}`} className="grid gap-2 rounded-lg border border-border bg-secondary/50 p-3 sm:grid-cols-[1fr_0.35fr_auto]">
                <select value={line.materialId} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, materialId: event.target.value } : item))} className="h-10 rounded-md border border-border bg-background px-2 text-sm text-foreground">
                  {materialOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
                <label className="relative"><span className="sr-only">Package quantity</span><NumericInput min={1} step="1" value={line.packages} emptyValue={1} onChange={(value) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, packages: value } : item))} className="h-10 w-full rounded-md border border-border bg-background px-2 font-mono text-sm text-foreground" /></label>
                <button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-md p-2 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-30" aria-label="Remove material"><Trash2 size={16} /></button>
                <p className="col-span-full m-0 text-xs text-muted-foreground"><Ruler size={12} className="mr-1 inline text-cyan" /> {packageUnit} · approximately {formatQuantity(Math.max(0, Number(line.packages) * ratio), material?.baseUnit ?? material?.unit ?? "m²")} per line</p>
              </div>;
            })}
          </div>
          </div>
          {selectedJob && lines.length > 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-cyan/20 bg-cyan/5 p-3">
              <CheckCircle2 size={17} className="mt-0.5 flex-none text-cyan" />
              <div className="min-w-0 text-xs leading-5">
                <p className="font-semibold text-foreground">Request summary</p>
                <p className="truncate text-muted-foreground">{selectedJob.code} · {selectedJob.client} · {lines.length} material line{lines.length === 1 ? "" : "s"}</p>
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
