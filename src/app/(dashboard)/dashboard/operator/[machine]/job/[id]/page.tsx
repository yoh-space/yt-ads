"use client";

import { use } from "react";
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
  const { isPending, safeMutation } = useSafeMutation();

  if (detail === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="የሥራ ካርድ በመጫን ላይ…" />
      </div>
    );
  }

  const { job, requirements } = detail;
  const isCompleted = job.status === "Completed";
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
        subtitle={job.title ?? "Untitled job"}
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

        {isCompleted ? (
          <div className="rounded-sm border border-emerald-500/30 bg-emerald-950/20 p-4 text-sm text-emerald-200">
            ይህ የስራ ካርድ ተጠናቅቋል። የተጠናቀቀ ስራ እንደገና አይጠናቀቅም።
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isPending(`complete-${jobId}`)}
              onClick={() => {
                void safeMutation(
                  `complete-${jobId}`,
                  completeJob({ machineSlug: machineParam, jobId }),
                  () => toast.success("ሥራው በተሳካ ሁኔታ ተጠናቋል")
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