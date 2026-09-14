"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";
import type { SubstrateMatchInfo } from "@/convex/operator/overview";
import { StatusPill } from "@/components/shared/ui";
import { formatQuantity } from "@/lib/units";

export interface QueueJobItem {
  id: string;
  code: string;
  title: string;
  client: string;
  quantity: number;
  unit: string;
  status: string;
  priority?: string;
  orderOverdue?: boolean;
  orderDueTimestamp?: number;
  due?: string;
  dimensions?: string;
  requiredMaterialName?: string;
  substrateMatch?: SubstrateMatchInfo;
}

interface SmartBatchQueueProps {
  jobs: QueueJobItem[];
  activeJobId?: string;
  machineSlug: string;
  onSelectJob: (jobId: string) => void;
}

export function SmartBatchQueue({
  jobs,
  activeJobId,
  machineSlug,
  onSelectJob,
}: SmartBatchQueueProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "matched" | "mismatch">("all");

  const matchedJobs = useMemo(
    () => jobs.filter((j) => j.substrateMatch?.status === "MATCHED"),
    [jobs]
  );
  const mismatchJobs = useMemo(
    () => jobs.filter((j) => j.substrateMatch?.status !== "MATCHED"),
    [jobs]
  );

  const displayedJobs = useMemo(() => {
    if (filter === "matched") return matchedJobs;
    if (filter === "mismatch") return mismatchJobs;
    return jobs;
  }, [filter, jobs, matchedJobs, mismatchJobs]);

  const priorityTone: Record<string, string> = {
    High: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    Medium: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    Low: "bg-slate-700/40 text-slate-300 border-slate-600/50",
  };

  const priorityLabel: Record<string, string> = {
    High: "ከፍተኛ",
    Medium: "መካከለኛ",
    Low: "ዝቅተኛ",
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0E121A] p-5 shadow-xl space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers size={16} className="text-[#00B4D8]" /> የማሽን ሥራዎች ወረፋ (Upcoming Jobs Queue)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            ለዚህ ማሽን የተመደቡ ሥራዎች ዝርዝር · በሮል ዓይነት መድበው ይስሩ
          </p>
        </div>

        {/* Batch Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-900 border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              filter === "all"
                ? "bg-[#00B4D8] text-[#07131F]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ሁሉም ({jobs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("matched")}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              filter === "matched"
                ? "bg-emerald-500 text-white"
                : "text-slate-400 hover:text-emerald-300"
            }`}
            title="በማሽኑ ላይ ባለው ሮል ወዲያው የሚሰሩ"
          >
            <Sparkles size={11} /> በዚህ ሮል ዝግጁ ({matchedJobs.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("mismatch")}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              filter === "mismatch"
                ? "bg-amber-500 text-[#0E121A]"
                : "text-slate-400 hover:text-amber-300"
            }`}
            title="ሮል መቀየር የሚፈልጉ"
          >
            ሮል ቅያሬ ({mismatchJobs.length})
          </button>
        </div>
      </div>

      {/* Queue Card Grid / List */}
      {displayedJobs.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-500">
          በዚህ ማጣሪያ ስር የተመደበ ሥራ የለም።
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {displayedJobs.map((job) => {
            const isActive = job.id === activeJobId;
            const isMatched = job.substrateMatch?.status === "MATCHED";
            const isCompleted = job.status === "Completed";
            const isInProduction = job.status === "In production";

            return (
              <div
                key={job.id}
                onClick={() => onSelectJob(job.id)}
                className={`group relative rounded-lg border p-3.5 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  isActive
                    ? "border-[#00B4D8] bg-[#00B4D8]/10 shadow-lg shadow-[#00B4D8]/10"
                    : "border-slate-800 bg-[#090B0F] hover:border-slate-700 hover:bg-slate-900/60"
                }`}
              >
                <div>
                  {/* Top Bar: Code, Status & Substrate Match Pill */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#00B4D8]">
                        #{job.code}
                      </span>
                      <StatusPill
                        variant={
                          isInProduction
                            ? "info"
                            : isCompleted
                              ? "success"
                              : "neutral"
                        }
                      >
                        {job.status}
                      </StatusPill>
                    </div>

                    {isMatched ? (
                      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                        <CheckCircle2 size={10} /> በሮሉ ላይ ዝግጁ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                        <AlertTriangle size={10} /> ሮል ቅያሬ
                      </span>
                    )}
                  </div>

                  {/* Title & Client */}
                  <h4 className="text-sm font-bold text-white mt-1.5 line-clamp-1 group-hover:text-[#00B4D8] transition-colors">
                    {job.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ደንበኛ: <strong className="text-slate-300 font-normal">{job.client}</strong>
                  </p>

                  {/* Material & Dimension Info */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
                    {job.dimensions ? (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-slate-200">
                        {job.dimensions}
                      </span>
                    ) : null}
                    {job.requiredMaterialName ? (
                      <span className="truncate max-w-[180px] text-slate-400" title={job.requiredMaterialName}>
                        ጥሬ እቃ: {job.requiredMaterialName}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Bottom Row: Quantity, Overdue/Due Date & Action Link */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono block">መጠን</span>
                    <span className="font-mono text-xs font-bold text-white">
                      {formatQuantity(job.quantity, (job.unit as any) ?? "m²")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {job.orderOverdue ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                        <Clock size={10} /> ጊዜ ያለፈበት
                      </span>
                    ) : job.orderDueTimestamp ? (
                      <span className="text-[10px] text-slate-400 font-mono">
                        ቀን: {new Date(job.orderDueTimestamp).toLocaleDateString("en-GB")}
                      </span>
                    ) : null}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/operator/${machineSlug}/job/${job.id}`);
                      }}
                      className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                      title="ሙሉ የሥራ ገጽ ተመልከት"
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
