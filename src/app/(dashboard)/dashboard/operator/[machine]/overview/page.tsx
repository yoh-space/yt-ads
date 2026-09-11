"use client";

import { use, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Plus,
  Scissors,
  Trash2,
} from "lucide-react";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { useSafeMutation } from "@/utils/pending-store";
import { useDashboardModal } from "@/components/dashboard/modals/modal-context";
import { MaterialRequestModal } from "@/components/dashboard/modals/material-request-modal";
import { MachineFluidGauge } from "@/components/dashboard/roles/operator/machine-fluid-gauge";
import { NumericInput, StatusPill } from "@/components/shared/ui";
import { formatQuantity } from "@/lib/units";
import { OperatorStockWidget } from "@/components/dashboard/roles/operator/operator-stock";
import type { OperatorStockEntry } from "@/types/dashboard-types";
import type { AccessContext } from "@/lib/access-policy";
import { WorkspaceModuleGate } from "@/components/dashboard/shell/workspace-renderer";
import type { JobCard, Material } from "@/lib/operations-types";

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

  const profile = useQuery(api.users.getCurrentProfile);
  const overview = useQuery(api.operator.overview.getMachineOverview, { machineSlug: machineParam });
  const materials = useQuery(api.materials.list);

  const { openModal, setFloorMachineId, setFloorSubStockId } = useDashboardModal();
  const { isPending, safeMutation } = useSafeMutation();

  const completeJobMutation = useMutation(api.operator.jobs.complete);
  const recordProductionMutation = useMutation(api.jobs.recordProduction);
  const createRequest = useMutation(api.operator.requests.create);

  const [requestOpen, setRequestOpen] = useState(false);
  const [inputQuantity, setInputQuantity] = useState("");
  const [outputQuantity, setOutputQuantity] = useState("");
  const [wasteQuantity, setWasteQuantity] = useState("");
  const [productionInputsValid, setProductionInputsValid] = useState({ input: true, output: true, waste: true });

  const currentMachine = overview?.machine;
  const machineJobs = withIds(overview?.machineJobs ?? []);
  const floorStock = (overview?.floorStock ?? []) as OperatorStockEntry[];

  const jobOptions = useMemo(
    () => machineJobs as unknown as JobCard[],
    [machineJobs],
  );

  const materialOptions = useMemo(
    () => (materials ? materials.map((material) => ({ ...material, id: material._id })) as Material[] : []),
    [materials],
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
    [floorStock, currentMachine],
  );

  if (!profile || overview === undefined || materials === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label={`የ${machineParam.toUpperCase()} ኦፕሬተር ገጽ በመጫን ላይ…`} />
      </div>
    );
  }

  const displayedJob = overview.displayedJob !== null ? withIds([overview.displayedJob])[0] : undefined;
  const jobRequirements = overview.jobRequirements;
  const hasPendingClearance = overview.pendingClearance;

  const isCompletedJob = displayedJob?.status === "Completed";

  const jobDueTimestamp = displayedJob?.orderDueTimestamp ?? (displayedJob?.due ? Date.parse(displayedJob.due) : NaN);
  const isJobOverdue =
    displayedJob &&
    displayedJob.status !== "Completed" &&
    Number.isFinite(jobDueTimestamp) &&
    jobDueTimestamp < Date.now();

  const activeJobRequiredMl = overview.activeJobRequiredMl;

  const inputNum = Number(inputQuantity);
  const outputNum = Number(outputQuantity);
  const wasteNum = Number(wasteQuantity);
  const hasCrossFieldDraft = inputNum > 0 || outputNum > 0 || wasteNum > 0;
  const outputExceedsInput = hasCrossFieldDraft && outputNum > 0 && inputNum > 0 && outputNum > inputNum;
  const inputExceedsTotal = hasCrossFieldDraft && inputNum > 0 && outputNum + wasteNum > inputNum;

  const priorityLabel: Record<string, string> = {
    High: "ከፍተኛ",
    Medium: "መካከለኛ",
    Low: "ዝቅተኛ",
  };
  const priorityTone: Record<string, string> = {
    High: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    Medium: "bg-gold/20 text-gold border border-gold/30",
    Low: "bg-slate-700/40 text-slate-300 border border-slate-600/50",
  };

  const accessContext: AccessContext = {
    profile: { role: profile.role, active: profile.active },
    attributes: {
      machineId: currentMachine!.id,
      machineType: machineParam as "laser" | "cnc" | "plotter" | "printer",
    },
  };

  const hasManualProductionDraft = Boolean(inputQuantity.trim() || outputQuantity.trim() || wasteQuantity.trim());
  const hasProductionValidationError = hasManualProductionDraft && (
    !productionInputsValid.input ||
    !productionInputsValid.output ||
    !productionInputsValid.waste
  );

  return (
    <WorkspaceModuleGate context={accessContext} moduleId="jobs.queue">
    <div className="space-y-6">
      {/* Top Banner if Active Sub-stock is PENDING_CLEARANCE */}
      {hasPendingClearance ? (
        <div className="flex items-center gap-3 p-4 rounded-sm border border-amber-500/50 bg-amber-950/40 text-amber-200">
          <div className="flex-none p-2 rounded-sm bg-amber-500/20 text-amber-400">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <strong className="text-sm font-bold text-amber-300">
                የቀሪ እቃ ማረጋገጫ ይጠበቃል
              </strong>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                ተቆልፏል
              </span>
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5">
              በማሽኑ ላይ ያለው ዕቃ መቆጠርና መረጋገጥ አለበት። ባለቤቱ ወይም ሥራ አስኪያጁ እስኪያጸድቁ ድረስ አዲስ ዕቃ መጠየቅ አይቻልም።
            </p>
          </div>
          <button
            onClick={() => router.push("/inventory/substock")}
            className="flex-none px-3 py-1.5 rounded-sm border border-amber-500/40 bg-amber-900/40 text-xs font-semibold text-amber-200 hover:bg-amber-800/60 transition-colors"
          >
            የዚህ ማሽን እቃ ክምችት ተመልከት
          </button>
        </div>
      ) : null}

      {/* Overdue Order Banner */}
      {isJobOverdue && displayedJob ? (
        <div className="flex items-center gap-3 p-4 rounded-sm border border-rose-500/50 bg-rose-950/40 text-rose-200">
          <div className="flex-none p-2 rounded-sm bg-rose-500/20 text-rose-400">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <strong className="text-sm font-bold text-rose-300">
                {displayedJob.code} ጊዜ ያለፈበት ሥራ
              </strong>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                Overdue
              </span>
            </div>
            <p className="text-xs text-rose-200/80 mt-0.5">
              የደንበኛ ትዕዛዝ የመጨረሻ ቀን (ቀን {new Date(jobDueTimestamp).toLocaleDateString("en-GB")}) ላይ ነበር። ይህን ሥራ እንዲጠናቀቅ ቅድሚያ ይስጡት።
            </p>
          </div>
        </div>
      ) : null}

      {/* ZONE 1: Machine Header & Fluid Gauges */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-5">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-[#00B4D8]">
              የኦፕሬተር መቆጣጠሪያ · {machineParam.toUpperCase()}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5 flex items-center gap-2">
              {currentMachine?.name ?? `${machineParam.toUpperCase()} Machine`}
              {currentMachine ? (
                <StatusPill variant={currentMachine.status === "Running" ? "success" : "info"}>
                  {currentMachine.status}
                </StatusPill>
              ) : null}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              የማሽን መለያ: {currentMachine?.code ?? "—"} · የሚለካበት መለኪያ: {currentMachine?.materialUnit ?? "m²"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/inventory/substock")}
              className="px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-semibold text-slate-300 hover:text-white hover:border-[#00B4D8] transition-colors"
            >
              የማሽን ዕቃ
            </button>

            {/* Material Request Action — Locked if hasPendingClearance */}
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
                  : "ከግምጃ ቤት ዕቃ ይጠይቁ"
              }
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm text-xs font-semibold transition-colors ${
                hasPendingClearance
                  ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                  : "bg-[#00B4D8] text-[#0B132B] hover:bg-[#90E0EF]"
              }`}
            >
              {hasPendingClearance ? <Lock size={13} /> : <Plus size={13} />}
              {hasPendingClearance ? "የዕቃ ጥያቄ ተቆልፏል" : "ዕቃ ጠይቅ"}
            </button>
          </div>
        </div>

        {currentMachine ? (
          <MachineFluidGauge machineId={currentMachine.id as Id<"machines">} activeJobRequiredMl={activeJobRequiredMl} />
        ) : null}
      </div>

      {/* Grid: Active Job Card & Machine Control / Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Job Card Run */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border border-[#1E293B] rounded-sm bg-[#14161D] p-5">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3 mb-4">
              <span className="font-mono text-xs uppercase tracking-wider text-[#00B4D8]">
                አሁን ያለ የስራ ትእዛዝ የምርት መረጃ
              </span>
              {displayedJob ? (
                <StatusPill variant={displayedJob.status === "In production" ? "info" : "neutral"}>
                  {displayedJob.status}
                </StatusPill>
              ) : null}
            </div>

            {displayedJob ? (
              <div className="space-y-4">
                {/* ZONE 2: Active Job Details & Materials List */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#00B4D8]">{displayedJob.code}</span>
                    <h2 className="text-lg font-bold text-white mt-0.5">{displayedJob.title}</h2>
                    <p className="text-xs text-slate-400">ደንበኛ: {displayedJob.client}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {displayedJob.priority ? (
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold ${priorityTone[displayedJob.priority] ?? priorityTone.Medium}`}>
                          {priorityLabel[displayedJob.priority] ?? displayedJob.priority} ቅድሚያ
                        </span>
                      ) : null}
                      {displayedJob.orderDueTimestamp ? (
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold font-mono border ${
                          isJobOverdue
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                            : "bg-slate-700/40 text-slate-300 border-slate-600/50"
                        }`}>
                          ጊዜ: {new Date(displayedJob.orderDueTimestamp).toLocaleDateString("en-GB")}
                          {isJobOverdue ? " · ጊዜ አልፏል" : ""}
                        </span>
                      ) : displayedJob.due ? (
                        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold font-mono bg-slate-700/40 text-slate-300 border border-slate-600/50">
                          ጊዜ: {displayedJob.due}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-mono block">የሚመረተው መጠን</span>
                    <span className="font-mono text-lg font-bold text-white">
                      {formatQuantity(displayedJob.quantity, displayedJob.unit)}
                    </span>
                  </div>
                </div>

                {/* Job Materials (BOM Requirements) */}
                {jobRequirements && jobRequirements.length > 0 && (
                  <div className="rounded-lg border border-[#1E293B] bg-[#0C0D10]/80 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between font-semibold text-slate-300 border-b border-[#1E293B] pb-1.5">
                      <span>የስራው ጥሬ እቃዎች (Material Requirements)</span>
                      <span className="text-[10px] text-slate-400 font-mono">{jobRequirements.length} materials</span>
                    </div>
                    <div className="divide-y divide-[#1E293B]/60 space-y-1">
                      {jobRequirements.map((req) => (
                        <div key={req._id} className="flex items-center justify-between pt-1 text-[11px]">
                          <div>
                            <span className="font-medium text-white">{req.materialName}</span>
                            <span className="ml-2 text-slate-400">
                              (የታቀደ: {req.plannedBaseQuantity} {req.materialUnit} · ብክነት ማካካሻ: {req.approvedScrapQuantity} {req.materialUnit})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-300">
                              ተወስዷል: {req.consumedBaseQuantity ?? 0} / {req.plannedBaseQuantity + req.approvedScrapQuantity} {req.materialUnit}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                req.status === "COMPLETED"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : req.status === "ISSUED"
                                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                    : "bg-slate-700/40 text-slate-400 border border-slate-600/50"
                              }`}
                            >
                              {req.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ZONE 3: Production Logging & Usable Remainder / Scrap Actions */}
                {isCompletedJob ? (
                  <div className="rounded-sm border border-emerald-500/30 bg-emerald-950/20 p-4 text-sm text-emerald-200">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 size={16} />
                      ይህ የስራ ካርድ ተጠናቅቋል። የምርት መረጃ ማስተካከያ ተቆልፏል።
                    </div>
                    <p className="mt-2 text-xs text-emerald-200/80">የተጠናቀቀ ስራ እንደገና ሊመዘገብ ወይም ሊጠናቀቅ አይችልም።</p>
                  </div>
                ) : (
                <>
                {/* Production Input / Output Logging */}
                <div className="p-4 rounded-sm border border-[#1E293B] bg-[#0C0D10]/60 space-y-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block">
                    የምርት መረጃ መዝግብ ({displayedJob.unit})
                  </span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">የገባ ዕቃ</label>
                      <NumericInput
                        min={0}
                        step="0.1"
                        value={inputQuantity}
                        onChange={setInputQuantity}
                        onValidityChange={(isValid) => setProductionInputsValid((current) => ({ ...current, input: isValid }))}
                        placeholder={String(displayedJob.quantity)}
                        className="w-full px-3 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-mono text-white focus:outline-none focus:border-[#00B4D8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">ጥሩ ውጤት</label>
                      <NumericInput
                        min={0}
                        step="0.1"
                        value={outputQuantity}
                        onChange={setOutputQuantity}
                        onValidityChange={(isValid) => setProductionInputsValid((current) => ({ ...current, output: isValid }))}
                        placeholder={String(displayedJob.quantity)}
                        className="w-full px-3 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-mono text-white focus:outline-none focus:border-[#00B4D8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">ብክነት / ተጥሎ የቀረ</label>
                      <NumericInput
                        min={0}
                        step="0.1"
                        value={wasteQuantity}
                        onChange={setWasteQuantity}
                        onValidityChange={(isValid) => setProductionInputsValid((current) => ({ ...current, waste: isValid }))}
                        placeholder="0.0"
                        className="w-full px-3 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-mono text-white focus:outline-none focus:border-[#00B4D8]"
                      />
                    </div>
                  </div>

                  {outputExceedsInput || inputExceedsTotal ? (
                    <div className="flex items-start gap-2 rounded-sm border border-white/10 bg-gold/10 px-3 py-2 text-xs text-gold">
                      <AlertTriangle size={14} className="mt-0.5 flex-none" />
                      <span>
                        {outputExceedsInput ? "የተመዘገበው ውጤት (output) ከገባው ዕቃ (input) ይበልጣል። እባክዎን ይመልከቱ። " : ""}
                        {inputExceedsTotal ? "የገባ ዕቃ ከውጤት እና ብክነት ድምር ያነሰ ነው። ብክነት ከግቤት ያልበለጠ መሆኑን ያረጋግጡ።" : ""}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isPending(`prod-${displayedJob.id}`) || !hasManualProductionDraft || hasProductionValidationError || outputExceedsInput || inputExceedsTotal}
                      onClick={() => {
                        void safeMutation(
                          `prod-${displayedJob.id}`,
                          recordProductionMutation({
                            jobCardId: displayedJob.id as Id<"jobCards">,
                            inputQuantity: Number(inputQuantity) || displayedJob.quantity,
                            outputQuantity: Number(outputQuantity) || displayedJob.quantity,
                            wasteQuantity: Number(wasteQuantity) || 0,
                          }),
                          () => toast.success("የምርት መረጃ ተመዝግቧል")
                        );
                      }}
                      className="px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-semibold text-slate-200 hover:text-white hover:border-[#00B4D8] transition-colors"
                    >
                      መረጃውን አስቀምጥ
                    </button>
                    <button
                      type="button"
                      disabled={isPending(`complete-${displayedJob.id}`) || hasProductionValidationError || outputExceedsInput || inputExceedsTotal}
                      onClick={() => {
                        void safeMutation(
                          `complete-${displayedJob.id}`,
                          completeJobMutation({ machineSlug: machineParam, jobId: displayedJob.id as Id<"jobCards"> }),
                          () => toast.success("ሥራው በተሳካ ሁኔታ ተጠናቋል")
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-[#38B000] text-xs font-semibold text-white hover:bg-[#2D8B00] transition-colors"
                    >
                      <CheckCircle2 size={13} /> ሥራውን አጠናቅ
                    </button>
                  </div>
                </div>

                {/* Usable remainder & scrap quick actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      if (currentMachine) setFloorMachineId(currentMachine.id);
                      if (floorStock?.[0]) setFloorSubStockId(floorStock[0]._id);
                      openModal("offcut");
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#0C0D10] text-xs font-semibold text-slate-300 hover:text-white hover:border-cyan transition-colors"
                  >
                    <Scissors size={13} /> ጥቅም ላይ የሚውል ቀሪ ዕቃ መዝግብ
                  </button>
                  <button
                    onClick={() => {
                      if (currentMachine) setFloorMachineId(currentMachine.id);
                      if (floorStock?.[0]) setFloorSubStockId(floorStock[0]._id);
                      openModal("scrap");
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#0C0D10] text-xs font-semibold text-slate-300 hover:text-white hover:border-rose-500 transition-colors"
                  >
                    <Trash2 size={13} /> የማይጠቅም ብክነት መዝግብ
                  </button>
                </div>
                </>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                ለዚህ ማሽን የተመደበ ንቁ ሥራ የለም።
              </div>
            )}
          </div>

          {/* Machine Jobs Queue Table */}
          <div className="border border-[#1E293B] rounded-sm bg-[#14161D]">
            <div className="p-4 border-b border-[#1E293B]">
              <h3 className="text-sm font-bold text-white">የማሽን ሥራ ዝርዝር</h3>
              <p className="text-xs text-slate-400">ቀጥሎ የሚሰሩ ሥራዎች</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#1E293B] bg-[#0C0D10]/50 font-mono text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">መለያ</th>
                    <th className="px-4 py-2.5">የሥራ ስም / ደንበኛ</th>
                    <th className="px-4 py-2.5 text-right">የሚሰራው መጠን</th>
                    <th className="px-4 py-2.5 text-center">ሁኔታ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B] text-slate-300 font-mono">
                  {machineJobs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500 font-sans">
                        በአሁኑ ጊዜ ለ{currentMachine?.name ?? "ይህ ማሽን"} የተመደበ ሥራ የለም።
                      </td>
                    </tr>
                  ) : (
                    machineJobs.map((job) => (
                      <tr
                        key={job.id}
                        onClick={() => router.push(`/dashboard/operator/${machineParam}/job/${job.id}`)}
                        className="hover:bg-[#1E293B]/40 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-2.5 font-bold text-[#00B4D8]">{job.code}</td>
                        <td className="px-4 py-2.5 font-sans">
                          <span className="font-medium text-white">{job.title}</span>
                          <span className="block text-[10px] text-slate-400">{job.client}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">{formatQuantity(job.quantity, job.unit)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <StatusPill variant={job.status === "In production" ? "info" : "neutral"}>
                            {job.status}
                          </StatusPill>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Active Floor Sub-Stock Widget */}
        <div className="space-y-6">
          {currentMachine ? (
            <OperatorStockWidget machineId={currentMachine.id} machineSlug={machineParam} stock={floorStock} />
          ) : null}
        </div>
      </div>

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
                toast.error(err instanceof Error ? err.message : "Failed to submit material request");
              },
            );
          }}
        />
      ) : null}
    </div>
    </WorkspaceModuleGate>
  );
}