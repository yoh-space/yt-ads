"use client";

import { use, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { useSafeMutation } from "@/utils/pending-store";
import { StatusPill } from "@/components/shared/ui";
import { formatQuantity } from "@/lib/units";

export default function OperatorJobDetailPage({
  params,
}: {
  params: Promise<{ machine: string; id: string }>;
}) {
  const { machine, id } = use(params);
  const machineParam = machine.toLowerCase();
  const jobId = id as Id<"jobCards">;
  const router = useRouter();

  const detail = useQuery(api.operator.jobs.getJob, { machineSlug: machineParam, jobId });
  const completeJob = useMutation(api.operator.jobs.complete);
  const startJob = useMutation(api.operator.jobs.start);
  const requestMaterial = useMutation(api.materialRequests.create);
  const pauseJob = useMutation(api.operator.jobs.pause);
  const { isPending, safeMutation } = useSafeMutation();
  const [pauseReason, setPauseReason] = useState("");
  const [startError, setStartError] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestQuantity, setRequestQuantity] = useState("");

  if (detail === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="የሥራ ካርድ በመጫን ላይ…" />
      </div>
    );
  }

  const { job, requirements, stockAudit } = detail;
  const isCompleted = job.status === "Completed";
  const isInProduction = job.status === "In production";
  const jobDueTimestamp = job.orderDueTimestamp ?? (job.due ? Date.parse(job.due) : NaN);
  const isOverdue =
    !isCompleted && Number.isFinite(jobDueTimestamp) && jobDueTimestamp < Date.now();

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.push(`/dashboard/operator/${machineParam}/jobs`)}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={13} /> ወደ ሥራ ዝርዝር ተመለስ
      </button>

      <WorkspacePageHeader
        kicker="Job Card · የሥራ ካርድ"
        title={job.code}
      />

      <div className="rounded-sm border border-[#1E293B] bg-[#14161D] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">{job.title}</h2>
            <p className="text-xs text-slate-400">ደንበኛ: {job.client}</p>
            {job.priority ? (
              <p className="text-xs text-slate-400">ቅድሚያ: {job.priority}</p>
            ) : null}
            {isOverdue ? (
              <p className="text-xs text-rose-300">ጊዜ ያለፈበት ሥራ · ቀን {new Date(jobDueTimestamp).toLocaleDateString("en-GB")}</p>
            ) : jobDueTimestamp ? (
              <p className="text-xs text-slate-400">ጊዜ: {new Date(jobDueTimestamp).toLocaleDateString("en-GB")}</p>
            ) : null}
          </div>
          <div className="text-right space-y-1">
            <StatusPill variant={job.status === "In production" ? "info" : isCompleted ? "success" : "neutral"}>
              {job.status}
            </StatusPill>
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">የሚመረተው መጠን</span>
              <span className="font-mono text-lg font-bold text-white">
                {formatQuantity(job.quantity, job.unit)}
              </span>
            </div>
          </div>
        </div>

        {requirements.length > 0 ? (
          <div className="rounded-lg border border-[#1E293B] bg-[#0C0D10]/80 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between font-semibold text-slate-300 border-b border-[#1E293B] pb-1.5">
              <span>የስራው ጥሬ እቃዎች (Material Requirements)</span>
              <span className="text-[10px] text-slate-400 font-mono">{requirements.length} materials</span>
            </div>
            <div className="divide-y divide-[#1E293B]/60 space-y-1">
              {requirements.map((req) => (
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
        ) : null}

        {!stockAudit.sufficient ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 text-xs text-amber-100">
            <p className="font-semibold">Insufficient Stock — Request required materials from the storekeeper before starting production.</p>
            <div className="mt-2 space-y-1 text-[11px] text-amber-200/80">{stockAudit.missing.map((item: { materialId: string; materialName: string; available: number; required: number; unit: string }) => <p key={item.materialId}>{item.materialName}: {item.available} / {item.required} {item.unit} loaded</p>)}</div>
            <button type="button" onClick={() => { setRequestOpen((value) => !value); setRequestQuantity(String(Math.max(0, stockAudit.missing[0]?.required - stockAudit.missing[0]?.available))); }} className="mt-3 rounded-md border border-amber-400/40 px-3 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-900/30">+ Request Material</button>
            {requestOpen && stockAudit.missing[0] ? <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-amber-500/20 pt-3"><label className="text-[10px] text-amber-100">Quantity<input type="number" min="0.001" step="0.001" value={requestQuantity} onChange={(event) => setRequestQuantity(event.target.value)} className="mt-1 h-8 w-28 rounded border border-amber-500/30 bg-black/20 px-2 text-xs text-white" /></label><button type="button" disabled={isPending(`request-${jobId}`)} onClick={() => { const missing = stockAudit.missing[0]; const requirement = requirements.find((item: any) => item.materialId === missing.materialId); const quantity = Number(requestQuantity); const ratio = requirement?.conversionRatioSnapshot ?? 1; void safeMutation(`request-${jobId}`, requestMaterial({ jobCardId: jobId, materialId: missing.materialId as Id<"materials">, requestedQuantity: quantity, unit: missing.unit as any, requestedPackages: Math.max(0.001, Number((quantity / ratio).toFixed(3))), packageUnit: requirement?.packageUnit ?? "PACKAGE" as any, note: `Required for ${job.code}` }).then(() => { setRequestOpen(false); return true; }), () => toast.success("Material request sent to the storekeeper"), (error) => setStartError(error instanceof Error ? error.message : "Unable to request material")); }} className="h-8 rounded border border-cyan-500/40 bg-cyan-950/30 px-3 text-[11px] font-semibold text-cyan-100 disabled:opacity-50">Send request</button></div> : null}
          </div>
        ) : null}
        {startError ? <div className="rounded-lg border border-rose-500/40 bg-rose-950/20 p-3 text-xs text-rose-200">{startError}</div> : null}

        {isCompleted ? (
          <div className="rounded-sm border border-emerald-500/30 bg-emerald-950/20 p-4 text-sm text-emerald-200">
            ይህ የስራ ካርድ ተጠናቅቋል። የተጠናቀቀ ስራ እንደገና አይጠናቀቅም።
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            {!isInProduction ? (
              <button type="button" disabled={isPending(`start-${jobId}`) || !stockAudit.sufficient} onClick={() => { setStartError(""); void safeMutation(`start-${jobId}`, startJob({ machineSlug: machineParam, jobId }), () => toast.success("Job started"), (error) => setStartError(error instanceof Error ? error.message : "Unable to start job")); }} className="inline-flex items-center gap-1.5 rounded-sm border border-cyan-500/40 bg-cyan-950/30 px-3.5 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/40 disabled:cursor-not-allowed disabled:opacity-50">Start job</button>
            ) : null}
            {isInProduction ? (
              <div className="flex items-center gap-2">
                <input value={pauseReason} onChange={(event) => setPauseReason(event.target.value)} placeholder="Why is it paused?" className="h-8 w-44 rounded-sm border border-slate-700 bg-slate-950 px-2 text-xs text-white outline-none focus:border-cyan-500" />
                <button type="button" disabled={!pauseReason.trim() || isPending(`pause-${jobId}`)} onClick={() => void safeMutation(`pause-${jobId}`, pauseJob({ machineSlug: machineParam, jobId, reason: pauseReason }), () => { setPauseReason(""); toast.success("Job paused"); }, (err) => toast.error("Failed to pause job: " + (err instanceof Error ? err.message : String(err))))} className="inline-flex items-center gap-1.5 rounded-sm border border-amber-500/40 bg-amber-950/30 px-3.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/40 disabled:opacity-50">Pause job</button>
              </div>
            ) : null}
            <button
              type="button"
              disabled={isPending(`complete-${jobId}`)}
              onClick={() => {
                void safeMutation(
                  `complete-${jobId}`,
                  completeJob({ machineSlug: machineParam, jobId }),
                  () => toast.success("ሥራው በተሳካ ሁኔታ ተጠናቋል"),
                  (err) => toast.error("Failed to complete job: " + (err instanceof Error ? err.message : String(err)))
                );
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-[#38B000] text-xs font-semibold text-white hover:bg-[#2D8B00] transition-colors"
            >
              <CheckCircle2 size={13} /> ሥራውን አጠናቅ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
