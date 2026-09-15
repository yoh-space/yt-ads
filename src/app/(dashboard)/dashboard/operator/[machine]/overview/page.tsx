"use client";

import { use, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AlertTriangle, Lock, Plus } from "lucide-react";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { useSafeMutation } from "@/utils/pending-store";
import { useDashboardModal } from "@/components/dashboard/modals/modal-context";
import { MaterialRequestModal } from "@/components/dashboard/modals/material-request-modal";
import { MachineFluidGauge } from "@/components/dashboard/roles/operator/machine-fluid-gauge";
import { StatusPill } from "@/components/shared/ui";
import { OperatorStockWidget } from "@/components/dashboard/roles/operator/operator-stock";
import type { OperatorStockEntry } from "@/types/dashboard-types";
import type { AccessContext } from "@/lib/access-policy";
import { WorkspaceModuleGate } from "@/components/dashboard/shell/workspace-renderer";
import type { JobCard, Material } from "@/lib/operations-types";
import { JobTicketHero } from "@/components/dashboard/roles/operator/job-ticket-hero";
import { SmartBatchQueue } from "@/components/dashboard/roles/operator/smart-batch-queue";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  });
}

export default function OperatorMachineOverview({
  params,
}: {
  params: Promise<{ machine: string }>;
}) {
  const resolvedParams = use(params);
  const machineParam = resolvedParams.machine.toLowerCase();
  const router = useRouter();

  const [selectedJobId, setSelectedJobId] = useState<Id<"jobCards"> | undefined>(undefined);

  const profile = useQuery(api.users.getCurrentProfile);
  const overview = useQuery(api.operator.overview.getMachineOverview, {
    machineSlug: machineParam,
    selectedJobId,
  });
  const materials = useQuery(api.materials.list);

  const { openModal, setFloorMachineId, setFloorSubStockId } = useDashboardModal();
  const { isPending, safeMutation } = useSafeMutation();

  const startJobMutation = useMutation(api.operator.jobs.start);
  const pauseJobMutation = useMutation(api.operator.jobs.pause);
  const completeJobMutation = useMutation(api.operator.jobs.complete);
  const recordProductionMutation = useMutation(api.jobs.recordProduction);
  const createRequest = useMutation(api.operator.requests.create);

  const [requestOpen, setRequestOpen] = useState(false);

  const currentMachine = overview?.machine;
  const machineJobs = withIds(overview?.machineJobs ?? []);
  const floorStock = (overview?.floorStock ?? []) as OperatorStockEntry[];

  const jobOptions = useMemo(
    () => machineJobs as unknown as JobCard[],
    [machineJobs]
  );

  const materialOptions = useMemo(
    () =>
      materials
        ? (materials.map((material) => ({ ...material, id: material._id })) as Material[])
        : [],
    [materials]
  );

  const unclearedStock = useMemo(
    () =>
      floorStock
        .filter((batch) => batch.status === "ACTIVE" || batch.status === "PENDING_CLEARANCE")
        .map((batch) => ({
          id: batch._id,
          status: batch.status as "ACTIVE" | "PENDING_CLEARANCE",
          materialName: batch.materialName,
          machineName: batch.machineName ?? currentMachine?.name ?? "Floor stock",
          currentRemaining: batch.currentRemaining,
          baseUnit: batch.baseUnit,
        })),
    [floorStock, currentMachine]
  );

  if (!profile || overview === undefined || materials === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label={`የ${machineParam.toUpperCase()} ኦፕሬተር ገጽ በመጫን ላይ…`} />
      </div>
    );
  }

  const rawDisplayedJob = overview.displayedJob;
  const displayedJob =
    rawDisplayedJob !== null && rawDisplayedJob !== undefined
      ? {
          ...rawDisplayedJob,
          id: rawDisplayedJob._id,
        }
      : undefined;
  const jobRequirements = overview.jobRequirements;
  const hasPendingClearance = overview.pendingClearance;
  const activeJobRequiredMl = overview.activeJobRequiredMl;

  const isCompletedJob = displayedJob?.status === "Completed";
  const jobDueTimestamp =
    displayedJob?.orderDueTimestamp ??
    (displayedJob?.due ? Date.parse(displayedJob.due) : NaN);
  const isJobOverdue =
    displayedJob &&
    displayedJob.status !== "Completed" &&
    Number.isFinite(jobDueTimestamp) &&
    jobDueTimestamp < Date.now();

  const accessContext: AccessContext = {
    profile: { role: profile.role, active: profile.active },
    attributes: {
      machineId: currentMachine!.id,
      machineType: machineParam as
        | "laser"
        | "cnc"
        | "crystek"
        | "crystal_jet"
        | "ricoh_uv"
        | "dtf",
    },
  };

  const handleStartJob = async () => {
    if (!displayedJob) return;
    await safeMutation(
      `start-${displayedJob.id}`,
      startJobMutation({
        machineSlug: machineParam,
        jobId: displayedJob.id as Id<"jobCards">,
      }),
      () => toast.success("ሥራው ተጀምሯል (Job Started)"),
      (err) =>
        toast.error(
          "ሥራ መጀመር አልተቻለም: " + (err instanceof Error ? err.message : String(err))
        )
    );
  };

  const handlePauseJob = async (reason: string) => {
    if (!displayedJob) return;
    await safeMutation(
      `pause-${displayedJob.id}`,
      pauseJobMutation({
        machineSlug: machineParam,
        jobId: displayedJob.id as Id<"jobCards">,
        reason,
      }),
      () => toast.success("ሥራው ለጊዜው ቆሟል (Job Paused)"),
      (err) =>
        toast.error(
          "ሥራ ማቆም አልተቻለም: " + (err instanceof Error ? err.message : String(err))
        )
    );
  };

  const handleCompleteJob = async () => {
    if (!displayedJob) return;
    await safeMutation(
      `complete-${displayedJob.id}`,
      completeJobMutation({
        machineSlug: machineParam,
        jobId: displayedJob.id as Id<"jobCards">,
      }),
      () => toast.success("ሥራው በተሳካ ሁኔታ ተጠናቋል (Job Completed)"),
      (err) =>
        toast.error(
          "ሥራ ማጠናቀቅ አልተቻለም: " + (err instanceof Error ? err.message : String(err))
        )
    );
  };

  const handleRecordProduction = async (
    input: number,
    output: number,
    waste: number
  ) => {
    if (!displayedJob) return;
    await safeMutation(
      `prod-${displayedJob.id}`,
      recordProductionMutation({
        jobCardId: displayedJob.id as Id<"jobCards">,
        inputQuantity: input,
        outputQuantity: output,
        wasteQuantity: waste,
      }),
      () => toast.success("የምርት መረጃ ተመዝግቧል"),
      (err) =>
        toast.error(
          "Failed to save production: " +
            (err instanceof Error ? err.message : String(err))
        )
    );
  };

  return (
    <WorkspaceModuleGate context={accessContext} moduleId="jobs.queue">
      <div className="space-y-6">
        {/* Top Banner if Active Sub-stock is PENDING_CLEARANCE */}
        {hasPendingClearance ? (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-500/50 bg-amber-950/40 text-amber-200">
            <div className="flex-none p-2 rounded bg-amber-500/20 text-amber-400">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <strong className="text-sm font-bold text-amber-300">
                  የቀሪ እቃ ማረጋገጫ ይጠበቃል
                </strong>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase font-bold">
                  ተቆልፏል
                </span>
              </div>
              <p className="text-xs text-amber-200/80 mt-0.5">
                በማሽኑ ላይ ያለው ዕቃ መቆጠርና መረጋገጥ አለበት። ባለቤቱ ወይም ሥራ አስኪያጁ እስኪያጸድቁ ድረስ አዲስ ዕቃ መጠየቅ አይቻልም።
              </p>
            </div>
            <button
              onClick={() => router.push("/inventory/substock")}
              className="flex-none px-3.5 py-1.5 rounded border border-amber-500/40 bg-amber-900/40 text-xs font-semibold text-amber-200 hover:bg-amber-800/60 transition-colors"
            >
              የዚህ ማሽን እቃ ክምችት ተመልከት
            </button>
          </div>
        ) : null}

        {/* Machine Header & Quick Action Buttons */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <span className="font-mono text-xs uppercase tracking-widest text-[#00B4D8] font-bold">
                የኦፕሬተር መቆጣጠሪያ ኮክፒት · {machineParam.toUpperCase()}
              </span>
              <h1 className="text-2xl font-extrabold tracking-tight text-white mt-1 flex items-center gap-2.5">
                {currentMachine?.name ?? `${machineParam.toUpperCase()} Machine`}
                {currentMachine ? (
                  <StatusPill
                    variant={
                      currentMachine.status === "Running" ? "success" : "info"
                    }
                  >
                    {currentMachine.status}
                  </StatusPill>
                ) : null}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                የማሽን መለያ: <span className="font-mono text-slate-200">{currentMachine?.code ?? "—"}</span> · የሚለካበት መለኪያ: <span className="font-mono text-[#00B4D8]">{currentMachine?.materialUnit ?? "m²"}</span>
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => router.push(`/${machineParam}/inventory`)}
                className="h-10 px-4 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                የማሽን ዕቃ (Floor Stock)
              </button>

              <button
                type="button"
                disabled={hasPendingClearance}
                onClick={() => {
                  if (currentMachine) setFloorMachineId(currentMachine.id);
                  setRequestOpen(true);
                }}
                title={
                  hasPendingClearance
                    ? "የዕቃ ቆጠራ ማረጋገጫ ስላልተጠናቀቀ አዲስ ዕቃ መጠየቅ አይቻልም"
                    : "ከዋናው ስቶር ዕቃ ይጠይቁ"
                }
                className={`h-10 inline-flex items-center gap-1.5 px-4 rounded-lg text-xs font-bold transition-all shadow-md active:scale-[0.98] ${
                  hasPendingClearance
                    ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                    : "bg-[#00B4D8] text-[#07131F] hover:bg-[#90E0EF] shadow-[#00B4D8]/10"
                }`}
              >
                {hasPendingClearance ? <Lock size={14} /> : <Plus size={14} />}
                {hasPendingClearance ? "የዕቃ ጥያቄ ተቆልፏል" : "ዕቃ ጠይቅ"}
              </button>
            </div>
          </div>

          {/* Machine Fluid Gauges */}
          {currentMachine ? (
            <MachineFluidGauge
              machineId={currentMachine.id as Id<"machines">}
              activeJobRequiredMl={activeJobRequiredMl}
            />
          ) : null}
        </div>

        {/* 2-Column Responsive Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Cockpit & Batch Queue (8 Columns) */}
          <div className="lg:col-span-8 space-y-6">
            {displayedJob ? (
              <JobTicketHero
                job={displayedJob}
                requirements={jobRequirements}
                machineSlug={machineParam}
                machine={currentMachine!}
                isOverdue={Boolean(isJobOverdue)}
                hasPendingClearance={hasPendingClearance}
                onStartJob={handleStartJob}
                onPauseJob={handlePauseJob}
                onCompleteJob={handleCompleteJob}
                onRecordProduction={handleRecordProduction}
                onOpenOffcutModal={() => {
                  if (currentMachine) setFloorMachineId(currentMachine.id);
                  if (floorStock?.[0]) setFloorSubStockId(floorStock[0]._id);
                  openModal("offcut");
                }}
                onOpenScrapModal={() => {
                  if (currentMachine) setFloorMachineId(currentMachine.id);
                  if (floorStock?.[0]) setFloorSubStockId(floorStock[0]._id);
                  openModal("scrap");
                }}
                isActionPending={isPending}
              />
            ) : (
              <div className="rounded-xl border border-slate-800 bg-[#0E121A] p-12 text-center text-slate-400 text-sm">
                ለዚህ ማሽን የተመደበ ንቁ ሥራ የለም።
              </div>
            )}

            {/* Smart Batch Queue */}
            <SmartBatchQueue
              jobs={machineJobs}
              activeJobId={displayedJob?.id}
              machineSlug={machineParam}
              onSelectJob={(id) => setSelectedJobId(id as Id<"jobCards">)}
            />
          </div>

          {/* Right Column: Machine Sub-Stock / Media Loaded (4 Columns) */}
          <div className="lg:col-span-4 space-y-6">
            {currentMachine ? (
              <OperatorStockWidget
                machineId={currentMachine.id}
                machineSlug={machineParam}
                stock={floorStock}
              />
            ) : null}
          </div>
        </div>

        {/* Material Request Modal */}
        {requestOpen ? (
          <MaterialRequestModal
            jobs={jobOptions}
            materials={materialOptions}
            unclearedStock={unclearedStock}
            machineSlug={machineParam}
            onClose={() => setRequestOpen(false)}
            onSave={(input) => {
              void safeMutation(
                `create-${Date.now()}`,
                createRequest({ machineSlug: machineParam, ...input }),
                () => {
                  setRequestOpen(false);
                  toast.success("Material request sent to the storekeeper");
                },
                (err) => {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : "Failed to submit material request"
                  );
                }
              );
            }}
          />
        ) : null}
      </div>
    </WorkspaceModuleGate>
  );
}