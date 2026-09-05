"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { MachinesView } from "@/components/dashboard/views/machines";
import { MachineModal, type NewMachineInput } from "@/components/dashboard/modals/machine-modal";
import { useSafeMutation } from "@/components/dashboard/pending-store";
import type { JobCard, Machine, MachineStatus, Material } from "@/lib/operations-types";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map(({ _id, ...rest }) => ({ ...rest, id: _id }));
}

export default function OwnerMachinesPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const state = useQuery(api.dashboard.getState, profile?.active ? {} : "skip");
  const createMachine = useMutation(api.machines.create);
  const updateMachineStatus = useMutation(api.machines.updateStatus);
  const assignNextJob = useMutation(api.machines.assignNextJob);
  const completeJob = useMutation(api.jobs.complete);
  const { safeMutation, isPending } = useSafeMutation();
  const [showCreate, setShowCreate] = useState(false);

  if (!profile || !state) {
    return <div className="flex min-h-[400px] items-center justify-center"><InventoryLoader label="Loading Machines…" /></div>;
  }

  const machines = withIds(state.machines) as Machine[];
  const jobs = withIds(state.jobs) as JobCard[];
  const materials = withIds(state.materials) as Material[];

  return (
    <>
      <div className="mb-6 flex items-center justify-between border-b border-line pb-5">
        <div>
          <p className="m-0 font-mono text-xs uppercase tracking-widest text-cyan-dark">Enterprise machine control</p>
          <h1 className="m-0 mt-1 text-2xl font-bold text-navy">Machines & Production Lanes</h1>
          <p className="m-0 mt-2 text-sm text-gray-600">Monitor availability, active job cards, and machine status in real time.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-2">
          Add machine
        </button>
      </div>
      <MachinesView
        machines={machines}
        jobs={jobs}
        role={profile.role === "admin" ? "admin" : "owner"}
        canCreateMachine
        canCreateOffcut={false}
        canCreateScrap={false}
        canComplete
        canUpdateMachine
        canDeleteMachine={profile.role === "admin" || profile.role === "owner"}
        onCreate={() => setShowCreate(true)}
        onOffcut={() => undefined}
        onScrap={() => undefined}
        onComplete={(id) => void safeMutation(`complete-job-${id}`, completeJob({ jobId: id as Id<"jobCards"> }))}
        onRecordProduction={() => undefined}
        onAssignNextJob={(machineId) => void safeMutation(`assign-job-${machineId}`, assignNextJob({ machineId: machineId as Id<"machines"> }))}
        onSettings={() => undefined}
        onStatusChange={(machineId, status) => void safeMutation(`status-machine-${machineId}`, updateMachineStatus({ machineId: machineId as Id<"machines">, status }))}
        onView={() => undefined}
        isPending={isPending}
      />
      {showCreate ? (
        <MachineModal
          onClose={() => setShowCreate(false)}
          onSave={(input: NewMachineInput) => {
            safeMutation("create-machine", createMachine(input), () => setShowCreate(false));
          }}
        />
      ) : null}
    </>
  );
}
