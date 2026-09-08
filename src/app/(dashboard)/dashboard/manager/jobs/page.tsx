"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { JobsView } from "@/components/dashboard/views/jobs";
import type { JobCard, Machine, Material } from "@/lib/operations-types";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map(({ _id, ...rest }) => ({ ...rest, id: _id }));
}

export default function ManagerJobsPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const jobsQuery = useQuery(api.jobs.list, profile?.active ? {} : "skip");
  const machinesQuery = useQuery(api.machines.list, profile?.active ? {} : "skip");
  const materialsQuery = useQuery(api.materials.list, profile?.active ? {} : "skip");

  if (!profile || jobsQuery === undefined || machinesQuery === undefined || materialsQuery === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading Job Cards…" />
      </div>
    );
  }

  const jobs = withIds(jobsQuery) as JobCard[];
  const machines = withIds(machinesQuery) as Machine[];
  const materials = withIds(materialsQuery) as Material[];

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Job Cards · የሥራ ካርዶች"
        title="Job Cards"
        subtitle="Active and queued production work across the floor."
      />

      <JobsView
        jobs={jobs}
        machines={machines}
        materials={materials}
        canCreate={false}
        canComplete={false}
        onCreate={() => undefined}
        onComplete={() => undefined}
        onClearFilter={() => undefined}
      />
    </div>
  );
}