"use client";

import { use, useState } from "react";
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
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { useSafeMutation } from "@/components/dashboard/pending-store";
import { useDashboardModal } from "@/components/dashboard/modal-context";
import { NumericInput, StatusPill } from "@/components/ui";
import { formatQuantity } from "@/lib/units";
import { OperatorStockWidget } from "@/components/dashboard/views/operator-stock";
import type { OperatorStockEntry } from "@/types/dashboard-types";
import type { JobCard, Machine } from "@/lib/operations-types";
import type { AccessContext } from "@/lib/access-policy";
import { WorkspaceModuleGate } from "@/components/dashboard/workspace-renderer";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  });
}

export default function OperatorMachinePage({
  params,
}: {
  params: Promise<{ machine: string }>;
}) {
  const resolvedParams = use(params);
  const machineParam = resolvedParams.machine.toLowerCase();
  const router = useRouter();

  const profile = useQuery(api.users.getCurrentProfile);
  const machinesQuery = useQuery(api.machines.list, profile?.active ? {} : "skip");
  const jobsQuery = useQuery(api.jobs.list, profile?.active ? {} : "skip");
  const floorStockQuery = useQuery(api.inventory.listOperatorMachineStock, profile?.active ? {} : "skip");
  const unclearedStockQuery = useQuery(api.inventory.myUnclearedStock, profile?.active ? {} : "skip");

  const { openModal } = useDashboardModal();
  const { isPending, safeMutation } = useSafeMutation();

  const completeJobMutation = useMutation(api.jobs.complete);
  const recordProductionMutation = useMutation(api.jobs.recordProduction);

  const [inputQuantity, setInputQuantity] = useState("");
  const [outputQuantity, setOutputQuantity] = useState("");
  const [wasteQuantity, setWasteQuantity] = useState("");
  const [productionInputsValid, setProductionInputsValid] = useState({ input: true, output: true, waste: true });

  if (!profile || machinesQuery === undefined || jobsQuery === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label={`የ${machineParam.toUpperCase()} ኦፕሬተር ገጽ በመጫን ላይ…`} />
      </div>
    );
  }

  const machines = withIds(machinesQuery) as Machine[];
  const jobs = withIds(jobsQuery) as JobCard[];

  // Find machine matching slug (e.g. "laser", "cnc", "plotter", "printer")
  const currentMachine =
    machines.find((m) => m.type.toLowerCase().includes(machineParam) || m.code.toLowerCase().includes(machineParam)) ??
    machines[0];

  // Assigned jobs for this machine
  const machineJobs = jobs.filter(
    (j) => currentMachine && j.machineId === currentMachine.id
  );
  const activeJob = machineJobs.find((j) => j.status === "In production") ?? machineJobs[0];
  const accessContext: AccessContext = {
    profile: { role: profile.role, active: profile.active },
    attributes: {
      machineId: currentMachine?.id,
      machineType: machineParam as "laser" | "cnc" | "plotter" | "printer",
    },
  };

  // Clearance Gate Rule: If active sub-stock status is PENDING_CLEARANCE,
  // disable material requests and display the clearance alert banner
  const hasPendingClearance = (unclearedStockQuery ?? []).some(
    (batch) => batch.status === "PENDING_CLEARANCE"
  );
  const hasProductionValidationError =
    !productionInputsValid.input ||
    !productionInputsValid.output ||
    !productionInputsValid.waste;

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

      {/* Header */}
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
            onClick={() => openModal("request")}
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

      {/* Grid: Active Job Card & Machine Control / Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Job Card Run */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border border-[#1E293B] rounded-sm bg-[#14161D] p-5">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3 mb-4">
              <span className="font-mono text-xs uppercase tracking-wider text-[#00B4D8]">
                አሁን ያለ የስራ ትእዛዝ የምርት መረጃ
              </span>
              {activeJob ? (
                <StatusPill variant={activeJob.status === "In production" ? "info" : "neutral"}>
                  {activeJob.status}
                </StatusPill>
              ) : null}
            </div>

            {activeJob ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#00B4D8]">{activeJob.code}</span>
                    <h2 className="text-lg font-bold text-white mt-0.5">{activeJob.title}</h2>
                    <p className="text-xs text-slate-400">ደንበኛ: {activeJob.client}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-mono block">የሚመረተው መጠን</span>
                    <span className="font-mono text-lg font-bold text-white">
                      {formatQuantity(activeJob.quantity, activeJob.unit)}
                    </span>
                  </div>
                </div>

                {/* Production Input / Output Logging */}
                <div className="p-4 rounded-sm border border-[#1E293B] bg-[#0C0D10]/60 space-y-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block">
                    የምርት መረጃ መዝግብ ({activeJob.unit})
                  </span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">የገባ ዕቃ</label>
                      <NumericInput
                        required
                        min={0}
                        step="0.1"
                        value={inputQuantity}
                        onChange={setInputQuantity}
                        onValidityChange={(isValid) => setProductionInputsValid((current) => ({ ...current, input: isValid }))}
                        placeholder={String(activeJob.quantity)}
                        className="w-full px-3 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-mono text-white focus:outline-none focus:border-[#00B4D8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">ጥሩ ውጤት</label>
                      <NumericInput
                        required
                        min={0}
                        step="0.1"
                        value={outputQuantity}
                        onChange={setOutputQuantity}
                        onValidityChange={(isValid) => setProductionInputsValid((current) => ({ ...current, output: isValid }))}
                        placeholder={String(activeJob.quantity)}
                        className="w-full px-3 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-mono text-white focus:outline-none focus:border-[#00B4D8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">ብክነት / ተጥሎ የቀረ</label>
                      <NumericInput
                        required
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

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isPending(`prod-${activeJob.id}`) || hasProductionValidationError}
                      onClick={() => {
                        void safeMutation(
                          `prod-${activeJob.id}`,
                          recordProductionMutation({
                            jobCardId: activeJob.id as Id<"jobCards">,
                            inputQuantity: Number(inputQuantity) || activeJob.quantity,
                            outputQuantity: Number(outputQuantity) || activeJob.quantity,
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
                      disabled={isPending(`complete-${activeJob.id}`)}
                      onClick={() => {
                        void safeMutation(
                          `complete-${activeJob.id}`,
                          completeJobMutation({ jobId: activeJob.id as Id<"jobCards"> }),
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
                    onClick={() => openModal("offcut")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#0C0D10] text-xs font-semibold text-slate-300 hover:text-white hover:border-cyan transition-colors"
                  >
                    <Scissors size={13} /> ጥቅም ላይ የሚውል ቀሪ ዕቃ መዝግብ
                  </button>
                  <button
                    onClick={() => openModal("scrap")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#0C0D10] text-xs font-semibold text-slate-300 hover:text-white hover:border-rose-500 transition-colors"
                  >
                    <Trash2 size={13} /> የማይጠቅም ብክነት መዝግብ
                  </button>
                </div>
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
                    machineJobs.map((j) => (
                      <tr key={j.id} className="hover:bg-[#1E293B]/40 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-[#00B4D8]">{j.code}</td>
                        <td className="px-4 py-2.5 font-sans">
                          <span className="font-medium text-white">{j.title}</span>
                          <span className="block text-[10px] text-slate-400">{j.client}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">{formatQuantity(j.quantity, j.unit)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <StatusPill variant={j.status === "In production" ? "info" : "neutral"}>
                            {j.status}
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
            <OperatorStockWidget machineId={currentMachine.id} stock={floorStockQuery as OperatorStockEntry[] | undefined} />
          ) : null}
        </div>
      </div>
    </div>
    </WorkspaceModuleGate>
  );
}
