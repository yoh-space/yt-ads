"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { MachinesView } from "@/components/dashboard/views/machines";
import { MachineModal, type NewMachineInput } from "@/components/dashboard/modals/machine-modal";
import { MachineEditModal, type MachineEditInput } from "@/components/dashboard/modals/machine-edit-modal";
import { MachineSettingsModal } from "@/components/dashboard/modals/machine-settings-modal";
import { useSafeMutation } from "@/components/dashboard/pending-store";
import type { JobCard, Machine } from "@/lib/operations-types";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map(({ _id, ...rest }) => ({ ...rest, id: _id }));
}

export default function ManagerMachinesPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const machinesQuery = useQuery(api.machines.list, profile?.active ? {} : "skip");
  const jobsQuery = useQuery(api.jobs.list, profile?.active ? {} : "skip");

  const createMachine = useMutation(api.machines.create);
  const updateMachineStatus = useMutation(api.machines.updateStatus);
  const updateMachine = useMutation(api.machines.update);
  const removeMachine = useMutation(api.machines.remove);
  const assignNextJob = useMutation(api.machines.assignNextJob);
  const completeJob = useMutation(api.jobs.complete);
  const { safeMutation, isPending } = useSafeMutation();
  const [showCreate, setShowCreate] = useState(false);
  const [settingsMachine, setSettingsMachine] = useState<Machine | null>(null);
  const [editMachine, setEditMachine] = useState<Machine | null>(null);

  if (!profile || machinesQuery === undefined || jobsQuery === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="የማሽኖች መረጃ በመጫን ላይ…" />
      </div>
    );
  }

  const machines = withIds(machinesQuery) as Machine[];
  const jobs = withIds(jobsQuery) as JobCard[];

  return (
    <>
      <WorkspacePageHeader
        kicker="Machine Fleet · የማሽኖች ሁኔታ"
        title="Machines"
        subtitle="Live status, active job cards, and machine assignment across the floor."
        action={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-2"
          >
            + አዲስ ማሽን ጨምር
          </button>
        }
      />
      <MachinesView
        machines={machines}
        jobs={jobs}
        role="manager"
        canCreateMachine
        canCreateOffcut={false}
        canCreateScrap={false}
        canComplete
        canUpdateMachine
        canDeleteMachine
        onCreate={() => setShowCreate(true)}
        onOffcut={() => undefined}
        onScrap={() => undefined}
        onComplete={(id) => void safeMutation(`complete-job-${id}`, completeJob({ jobId: id as Id<"jobCards"> }))}
        onRecordProduction={() => undefined}
        onAssignNextJob={(machineId) => void safeMutation(`assign-job-${machineId}`, assignNextJob({ machineId: machineId as Id<"machines"> }))}
        onSettings={setSettingsMachine}
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
      {settingsMachine ? (
        <MachineSettingsModal
          machine={settingsMachine}
          onClose={() => setSettingsMachine(null)}
          onEdit={(machine) => { setSettingsMachine(null); setEditMachine(machine); }}
          onRemove={(machineId) => {
            safeMutation(`remove-machine-${machineId}`, removeMachine({ machineId: machineId as Id<"machines"> }), () => setSettingsMachine(null));
          }}
          onStatusChange={(machineId, status) => {
            safeMutation(`status-machine-${machineId}`, updateMachineStatus({ machineId: machineId as Id<"machines">, status }));
          }}
          isPending={isPending}
          canUpdateMachine
          canDeleteMachine
          canCreateOffcut={false}
          onOffcut={() => undefined}
          canCreateScrap={false}
          onScrap={() => undefined}
        />
      ) : null}
      {editMachine ? (
        <MachineEditModal
          machine={editMachine}
          onClose={() => setEditMachine(null)}
          onSave={(input: MachineEditInput) => {
            safeMutation(`edit-machine-${editMachine.id}`, updateMachine({ machineId: editMachine.id as Id<"machines">, ...input }), () => setEditMachine(null));
          }}
        />
      ) : null}
    </>
  );
}