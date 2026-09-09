"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { StatusPill } from "@/components/shared/ui";
import { formatQuantity } from "@/lib/units";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  });
}

export default function OperatorJobsPage({
  params,
}: {
  params: Promise<{ machine: string }>;
}) {
  const { machine } = use(params);
  const machineParam = machine.toLowerCase();
  const router = useRouter();
  const jobs = useQuery(api.operator.jobs.list, { machineSlug: machineParam });

  if (jobs === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label={`የ${machineParam.toUpperCase()} ሥራ ዝርዝር በመጫን ላይ…`} />
      </div>
    );
  }

  const shownJobs = withIds(jobs);

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Machine Jobs · የማሽን ሥራ ካርዶች"
        title="Jobs"
        subtitle={`Every job card scheduled for an operator on this ${machineParam.toUpperCase()} line, past and upcoming.`}
      />

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
              {shownJobs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500 font-sans">
                    በአሁኑ ጊዜ ለዚህ ማሽን የተመደበ ሥራ የለም።
                  </td>
                </tr>
              ) : (
                shownJobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => router.push(`/dashboard/operator/${machineParam}/job/${job.id as Id<"jobCards">}`)}
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
  );
}