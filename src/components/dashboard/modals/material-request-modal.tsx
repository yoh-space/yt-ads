"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, ClipboardPlus, FileText, Info, Package, Plus, Ruler, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { JobCard, Material, PackageUnit, Unit } from "@/lib/operations-types";
import type { Id } from "@/convex/_generated/dataModel";
import { findMaterialSpecification, isMaterialCompatibleWithMachine } from "@/shared/material-specifications";
import { formatQuantity } from "@/lib/units";
import { ModalShell } from "./modal-shell";
import { Button, NumericInput } from "@/components/shared/ui";

export type NewMaterialRequestInput = {
  jobCardId: Id<"jobCards">;
  materialId: Id<"materials">;
  requestedQuantity: number;
  unit: Unit;
  requestedPackages: number;
  packageUnit?: PackageUnit;
  lines?: Array<{
    materialId: Id<"materials">;
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
  machineSlug,
  onClose,
  onSave,
}: {
  jobs: JobCard[];
  materials: Material[];
  unclearedStock?: UnclearedFloorStock[];
  machineSlug?: string;
  onClose: () => void;
  onSave: (input: NewMaterialRequestInput) => void;
}) {
  const activeJobs = jobs.filter((job) => job.status !== "Completed");
  const [jobCardId, setJobCardId] = useState(activeJobs[0]?.id ?? "");
  const selectedJob = activeJobs.find((job) => job.id === jobCardId) ?? activeJobs[0];

  const eligibility = useQuery(
    api.operator.requests.getEligibility,
    machineSlug && selectedJob ? { machineSlug, jobCardId: selectedJob.id as Id<"jobCards"> } : "skip",
  );

  const packageUnitFor = (material?: { packageUnit?: PackageUnit; purchaseUnit?: string }): PackageUnit =>
    material?.packageUnit ??
    (material?.purchaseUnit === "roll"
      ? "ROLL"
      : material?.purchaseUnit === "sheet"
        ? "SHEET"
        : material?.purchaseUnit === "canister" || material?.purchaseUnit === "liter"
          ? "CANISTER"
          : material?.purchaseUnit === "piece"
            ? "PIECE"
            : "PACKAGE");

  // Allowed materials scoped strictly to this job card
  const materialOptions = useMemo(() => {
    if (eligibility?.allowedMaterials && eligibility.allowedMaterials.length > 0) {
      return eligibility.allowedMaterials.map((m) => {
        const fullMat = materials.find((mat) => mat.id === m.id);
        return {
          id: m.id,
          name: m.name,
          category: fullMat?.category ?? "Raw material",
          unit: m.unit,
          baseUnit: m.baseUnit,
          packageUnit: m.packageUnit,
          conversionRatio: m.conversionRatio,
          isBlocked: m.isBlocked,
          blockReason: m.blockReason,
          priorCustodyState: m.priorCustodyState,
          isPrimary: m.isPrimary,
          quantity: fullMat?.quantity ?? 0,
          reorderAt: fullMat?.reorderAt ?? 0,
          accent: fullMat?.accent ?? "cyan",
        } as Material & { isBlocked?: boolean; blockReason?: string; priorCustodyState?: string; isPrimary?: boolean };
      });
    }
    // Fallback while eligibility query loads or if no machineSlug
    if (selectedJob?.materialId) {
      const primary = materials.filter((m) => m.id === selectedJob.materialId);
      if (primary.length > 0) return primary;
    }
    return materials;
  }, [eligibility, materials, selectedJob]);

  const defaultMaterial = materialOptions[0] ?? materials[0];

  const [lines, setLines] = useState(() =>
    defaultMaterial ? [{ materialId: defaultMaterial.id, packages: "1", specOption: "" }] : [],
  );
  const [note, setNote] = useState("");

  const lineFor = (materialId: string) =>
    materialOptions.find((m) => m.id === materialId) ?? materials.find((m) => m.id === materialId);

  const linesHaveError =
    lines.length === 0 ||
    lines.some(
      (line) =>
        !line.packages.trim() ||
        !Number.isFinite(Number(line.packages)) ||
        Number(line.packages) < 1,
    );

  // Scoped blocking logic: only block if server eligibility rejects or active/pending custody applies to selected materials
  const { isBlocked, blockingReasons, warnings } = useMemo(() => {
    if (eligibility) {
      const reasons = [...eligibility.blockingReasons];
      for (const line of lines) {
        const mat = eligibility.allowedMaterials.find((m) => m.id === line.materialId);
        if (mat?.isBlocked && mat.blockReason && !reasons.includes(mat.blockReason)) {
          reasons.push(mat.blockReason);
        }
      }
      return {
        isBlocked: !eligibility.eligible || reasons.length > 0,
        blockingReasons: reasons,
        warnings: eligibility.warnings ?? [],
      };
    }

    // Fallback: check uncleared stock for this machine
    const reasons: string[] = [];
    for (const line of lines) {
      const mat = lineFor(line.materialId);
      if (!mat) continue;
      const blockingBatch = unclearedStock.find(
        (s) =>
          s.materialName === mat.name &&
          (s.status === "PENDING_CLEARANCE" || (s.status === "ACTIVE" && s.currentRemaining > 0.0001)),
      );
      if (blockingBatch) {
        if (blockingBatch.status === "PENDING_CLEARANCE") {
          reasons.push(`Previous batch for ${blockingBatch.materialName} is awaiting owner clearance.`);
        } else {
          reasons.push(
            `Active stock of ${blockingBatch.materialName} (${blockingBatch.currentRemaining} ${blockingBatch.baseUnit}) is still in custody.`,
          );
        }
      }
    }
    return {
      isBlocked: reasons.length > 0,
      blockingReasons: reasons,
      warnings: [],
    };
  }, [eligibility, lines, unclearedStock, materialOptions]);

  return (
    <ModalShell
      title="Request production material"
      subtitle="Choose the job, confirm the material, and tell the storekeeper how much is needed."
      kicker="OPERATOR MATERIAL REQUEST"
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="tertiary" type="button" onClick={onClose}>
            Cancel
          </Button>
          {activeJobs.length > 0 ? (
            <Button
              type="submit"
              form="material-request-form"
              disabled={isBlocked || linesHaveError}
            >
              {isBlocked ? "Clearance or Reconciliation Required" : "Send request"} <ClipboardPlus size={16} />
            </Button>
          ) : null}
        </div>
      }
    >
      {activeJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/40 px-6 py-12 text-center">
          <BriefcaseBusiness size={24} className="text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">No active jobs available</h3>
          <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
            A material request must be connected to an active job card.
          </p>
        </div>
      ) : (
        <form
          id="material-request-form"
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedJob || isBlocked || lines.length === 0) return;
            const requestLines = lines
              .map((line) => {
                const material = lineFor(line.materialId);
                const packages = Number(line.packages);
                const ratio =
                  material?.conversionRatio && material.conversionRatio > 0 ? material.conversionRatio : 1;
                return material && Number.isFinite(packages) && packages > 0
                  ? {
                      materialId: material.id as Id<"materials">,
                      requestedPackages: packages,
                      packageUnit: packageUnitFor(material),
                      requestedQuantity: Number((packages * ratio).toFixed(3)),
                      unit: (material.baseUnit ?? material.unit) as Unit,
                    }
                  : null;
              })
              .filter((line): line is NonNullable<typeof line> => line !== null);
            if (requestLines.length !== lines.length) return;
            const first = requestLines[0];

            const specSummary = lines
              .filter((l) => l.specOption)
              .map((l) => {
                const mat = lineFor(l.materialId);
                return `${mat?.name ?? "Item"}: ${l.specOption}`;
              })
              .join("; ");

            const fullNote = [specSummary ? `[Spec: ${specSummary}]` : undefined, note || undefined]
              .filter(Boolean)
              .join(" — ");

            onSave({
              jobCardId: selectedJob.id as Id<"jobCards">,
              materialId: first.materialId,
              requestedQuantity: first.requestedQuantity,
              unit: first.unit,
              requestedPackages: first.requestedPackages,
              packageUnit: first.packageUnit,
              lines: requestLines,
              note: fullNote || undefined,
            });
          }}
        >
          {isBlocked && blockingReasons.length > 0 ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"
            >
              <p className="m-0 flex items-center gap-2 font-semibold">
                <AlertTriangle size={17} className="flex-none text-rose-300" />
                Material request restricted
              </p>
              <ul className="mb-0 mt-2 grid list-none gap-1.5 p-0">
                {blockingReasons.map((reason, idx) => (
                  <li key={idx} className="text-xs leading-5 text-rose-200/90">
                    • {reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <Info size={15} className="mt-0.5 flex-none text-amber-300" />
              <div>
                {warnings.map((warning, idx) => (
                  <p key={idx} className="m-0 leading-5">
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-foreground">
                <BriefcaseBusiness size={14} className="text-cyan" /> Job card
              </span>
              <select
                value={jobCardId}
                onChange={(event) => {
                  const nextJob = activeJobs.find((job) => job.id === event.target.value);
                  setJobCardId(event.target.value);
                  if (nextJob) {
                                        setLines([{ materialId: nextJob.materialId, packages: "1", specOption: "" }]);
                  }
                }}
                className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/20"
              >
                {activeJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.code} · {job.client} · {job.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Package size={14} className="text-cyan" /> Physical packages requested
                </span>
                <button
                  type="button"
                                    onClick={() =>
                    setLines((current) => [
                      ...current,
                      { materialId: materialOptions[0]?.id ?? "", packages: "1", specOption: "" },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-cyan/30 px-2 py-1 text-xs font-semibold text-cyan"
                >
                  <Plus size={13} /> Add material
                </button>
              </div>

              {lines.map((line, index) => {
                const material = lineFor(line.materialId);
                const ratio =
                  material?.conversionRatio && material.conversionRatio > 0 ? material.conversionRatio : 1;
                const packageUnit = packageUnitFor(material);
                return (
                  <div
                    key={`${line.materialId}-${index}`}
                     className="grid gap-2 rounded-lg border border-border bg-secondary/50 p-3 sm:grid-cols-[1fr_0.35fr_auto]"
                  >
                    <select
                      value={line.materialId}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, materialId: event.target.value } : item,
                          ),
                        )
                      }
                      className="h-10 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                    >
                      {materialOptions.map((option) => (
                        <option
                          key={option.id}
                          value={option.id}
                          disabled={(option as any).isBlocked}
                        >
                          {option.name}
                          {(option as any).isBlocked
                            ? ` [Blocked: ${(option as any).blockReason}]`
                            : (option as any).isPrimary
                              ? " (Primary)"
                              : ""}
                        </option>
                      ))}
                    </select>

                    <label className="relative">
                      <span className="sr-only">Package quantity</span>
                      <NumericInput
                        min={1}
                        step="1"
                        value={line.packages}
                        emptyValue={1}
                        onChange={(value) =>
                          setLines((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, packages: value } : item,
                            ),
                          )
                        }
                        className="h-10 w-full rounded-md border border-border bg-background px-2 font-mono text-sm text-foreground"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={lines.length === 1}
                      onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      className="rounded-md p-2 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-30"
                      aria-label="Remove material"
                    >
                      <Trash2 size={16} />
                    </button>

                    <p className="col-span-full m-0 text-xs text-muted-foreground">
                      <Ruler size={12} className="mr-1 inline text-cyan" /> 1 {packageUnit} = {ratio}{" "}
                      {material?.baseUnit ?? material?.unit ?? "m²"} · approximately{" "}
                      {formatQuantity(
                        Math.max(0, Number(line.packages) * ratio),
                        (material?.baseUnit ?? material?.unit ?? "m²") as Unit,
                      )}{" "}
                      total
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedJob && lines.length > 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-cyan/20 bg-cyan/5 p-3">
              <CheckCircle2 size={17} className="mt-0.5 flex-none text-cyan" />
              <div className="min-w-0 text-xs leading-5">
                <p className="font-semibold text-foreground">Request summary</p>
                <p className="truncate text-muted-foreground">
                  {selectedJob.code} · {selectedJob.client} · {lines.length} material line
                  {lines.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          ) : null}

          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-foreground">
              <FileText size={14} className="text-cyan" /> Note{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <input
              placeholder="Add a pickup location, urgency, or other useful detail"
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 240))}
              className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-cyan focus:ring-2 focus:ring-cyan/20"
            />
          </label>

          <p className="m-0 text-xs text-muted-foreground">
            The storekeeper will review this request and confirm the issued quantity.
          </p>
        </form>
      )}
    </ModalShell>
  );
}
