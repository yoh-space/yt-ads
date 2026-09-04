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
import { StatusPill } from "@/components/ui/status-pill";
import { formatQuantity } from "@/lib/units";
import { OperatorStockWidget } from "@/components/dashboard/views/operator-stock";
import type { JobCard, Machine } from "@/lib/operations-types";

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
  const state = useQuery(api.dashboard.getState, profile?.active ? {} : "skip");
  const unclearedStockQuery = useQuery(api.inventory.myUnclearedStock, profile?.active ? {} : "skip");

  const { openModal } = useDashboardModal();
  const { isPending, safeMutation } = useSafeMutation();

  const completeJobMutation = useMutation(api.jobs.complete);
  const recordProductionMutation = useMutation(api.jobs.recordProduction);

  const [inputQuantity, setInputQuantity] = useState<number>(0);
  const [outputQuantity, setOutputQuantity] = useState<number>(0);
  const [wasteQuantity, setWasteQuantity] = useState<number>(0);

  if (!profile || !state) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label={`Loading ${machineParam.toUpperCase()} Operator Workspace…`} />
      </div>
    );
  }

  const machines = withIds(state.machines) as Machine[];
  const jobs = withIds(state.jobs) as JobCard[];

  // Find machine matching slug (e.g. "laser", "cnc", "plotter", "printer")
  const currentMachine =
    machines.find((m) => m.type.toLowerCase().includes(machineParam) || m.code.toLowerCase().includes(machineParam)) ??
    machines[0];

  // Assigned jobs for this machine
  const machineJobs = jobs.filter(
    (j) => currentMachine && j.machineId === currentMachine.id
  );
  const activeJob = machineJobs.find((j) => j.status === "In production") ?? machineJobs[0];

  // Clearance Gate Rule: If active sub-stock status is PENDING_CLEARANCE,
  // disable material requests and display the clearance alert banner
  const hasPendingClearance = (unclearedStockQuery ?? []).some(
    (batch) => batch.status === "PENDING_CLEARANCE"
  );

  return (
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
                CLEARANCE GATE: PENDING APPROVAL
              </strong>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                LOCKED
              </span>
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5">
              Active floor sub-stock has batches pending weekly reconciliation clearance. Material requisition actions are temporarily locked until approved by the owner or manager.
            </p>
          </div>
          <button
            onClick={() => router.push("/inventory/substock")}
            className="flex-none px-3 py-1.5 rounded-sm border border-amber-500/40 bg-amber-900/40 text-xs font-semibold text-amber-200 hover:bg-amber-800/60 transition-colors"
          >
            Review Sub-Stock
          </button>
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-5">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[#00B4D8]">
            Operator Console · {machineParam.toUpperCase()}
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
            Machine Code: {currentMachine?.code ?? "—"} · Material Unit: {currentMachine?.materialUnit ?? "m²"} tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/inventory/substock")}
            className="px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-semibold text-slate-300 hover:text-white hover:border-[#00B4D8] transition-colors"
          >
            Floor Sub-Stock
          </button>

          {/* Material Request Action — Locked if hasPendingClearance */}
          <button
            type="button"
            disabled={hasPendingClearance}
            onClick={() => openModal("request")}
            title={
              hasPendingClearance
                ? "Material requests locked: weekly reconciliation clearance pending"
                : "Request materials from storekeeper"
            }
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm text-xs font-semibold transition-colors ${
              hasPendingClearance
                ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                : "bg-[#00B4D8] text-[#0B132B] hover:bg-[#90E0EF]"
            }`}
          >
            {hasPendingClearance ? <Lock size={13} /> : <Plus size={13} />}
            {hasPendingClearance ? "Requisition Locked" : "Request Material"}
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
                Current Production Job Card
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
                    <p className="text-xs text-slate-400">Client: {activeJob.client}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-slate-400 font-mono block">Target Volume</span>
                    <span className="font-mono text-lg font-bold text-white">
                      {formatQuantity(activeJob.quantity, activeJob.unit)}
                    </span>
                  </div>
                </div>

                {/* Production Input / Output Logging */}
                <div className="p-4 rounded-sm border border-[#1E293B] bg-[#0C0D10]/60 space-y-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block">
                    Record Run Telemetry ({activeJob.unit})
                  </span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Material Input</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={inputQuantity || ""}
                        onChange={(e) => setInputQuantity(Number(e.target.value))}
                        placeholder={String(activeJob.quantity)}
                        className="w-full px-3 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-mono text-white focus:outline-none focus:border-[#00B4D8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Good Output</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={outputQuantity || ""}
                        onChange={(e) => setOutputQuantity(Number(e.target.value))}
                        placeholder={String(activeJob.quantity)}
                        className="w-full px-3 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-mono text-white focus:outline-none focus:border-[#00B4D8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Waste / Scrap</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={wasteQuantity || ""}
                        onChange={(e) => setWasteQuantity(Number(e.target.value))}
                        placeholder="0.0"
                        className="w-full px-3 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-mono text-white focus:outline-none focus:border-[#00B4D8]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isPending(`prod-${activeJob.id}`)}
                      onClick={() => {
                        void safeMutation(
                          `prod-${activeJob.id}`,
                          recordProductionMutation({
                            jobCardId: activeJob.id as Id<"jobCards">,
                            inputQuantity: inputQuantity || activeJob.quantity,
                            outputQuantity: outputQuantity || activeJob.quantity,
                            wasteQuantity: wasteQuantity || 0,
                          }),
                          () => toast.success("Production telemetry saved")
                        );
                      }}
                      className="px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-semibold text-slate-200 hover:text-white hover:border-[#00B4D8] transition-colors"
                    >
                      Save Telemetry
                    </button>
                    <button
                      type="button"
                      disabled={isPending(`complete-${activeJob.id}`)}
                      onClick={() => {
                        void safeMutation(
                          `complete-${activeJob.id}`,
                          completeJobMutation({ jobId: activeJob.id as Id<"jobCards"> }),
                          () => toast.success("Job run completed successfully")
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-[#38B000] text-xs font-semibold text-white hover:bg-[#2D8B00] transition-colors"
                    >
                      <CheckCircle2 size={13} /> Complete Run
                    </button>
                  </div>
                </div>

                {/* Usable remainder & scrap quick actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => openModal("offcut")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#0C0D10] text-xs font-semibold text-slate-300 hover:text-white hover:border-cyan transition-colors"
                  >
                    <Scissors size={13} /> Log Usable Remainder
                  </button>
                  <button
                    onClick={() => openModal("scrap")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#0C0D10] text-xs font-semibold text-slate-300 hover:text-white hover:border-rose-500 transition-colors"
                  >
                    <Trash2 size={13} /> Log Unusable Scrap
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                No active jobs queued for this machine.
              </div>
            )}
          </div>

          {/* Machine Jobs Queue Table */}
          <div className="border border-[#1E293B] rounded-sm bg-[#14161D]">
            <div className="p-4 border-b border-[#1E293B]">
              <h3 className="text-sm font-bold text-white">Machine Run Queue</h3>
              <p className="text-xs text-slate-400">Upcoming production runs for this workstation</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#1E293B] bg-[#0C0D10]/50 font-mono text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">Code</th>
                    <th className="px-4 py-2.5">Title / Client</th>
                    <th className="px-4 py-2.5 text-right">Target Volume</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B] text-slate-300 font-mono">
                  {machineJobs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500 font-sans">
                        No jobs currently assigned to {currentMachine?.name ?? "this machine"}.
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
            <OperatorStockWidget machineId={currentMachine.id} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
