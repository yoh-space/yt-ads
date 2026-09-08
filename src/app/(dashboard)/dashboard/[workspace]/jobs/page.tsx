"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { JobsView } from "@/components/dashboard/views/jobs";
import { useSafeMutation } from "@/components/dashboard/pending-store";
import type { JobCard, Machine, Material } from "@/lib/operations-types";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map(({ _id, ...rest }) => ({ ...rest, id: _id }));
}

export default function WorkspaceJobsPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const jobsQuery = useQuery(api.jobs.list, profile?.active ? {} : "skip");
  const machinesQuery = useQuery(api.machines.list, profile?.active ? {} : "skip");
  const materialsQuery = useQuery(api.materials.list, profile?.active ? {} : "skip");

  const completeJob = useMutation(api.jobs.complete);
  const { safeMutation } = useSafeMutation();

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
    <JobsView
      jobs={jobs}
      machines={machines}
      materials={materials}
      canCreate={false}
      canComplete={profile.role === "owner" || profile.role === "admin"}
      onCreate={() => undefined}
      onComplete={(id) => {
        void safeMutation("complete-job", completeJob({ jobId: id as Id<"jobCards"> }));
      }}
      onClearFilter={() => undefined}
    />
  );
}
