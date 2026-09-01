"use client";

import { Edit3, Power, PowerOff, Trash2, Wrench } from "lucide-react";
import type { Machine, MachineStatus } from "@/lib/operations-types";
import { statusTone } from "../helpers";
import { ModalShell } from "./modal-shell";
import { Button } from "@/components/ui";
import { StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";

const statusActions: Array<{ label: string; status: MachineStatus; tone: "success" | "neutral" | "warning" | "danger"; icon: "available" | "maintenance" | "wrench" }> = [
  { label: "Available", status: "Available", tone: "neutral", icon: "available" },
  { label: "Running", status: "Running", tone: "success", icon: "wrench" },
  { label: "Maintenance", status: "Maintenance", tone: "warning", icon: "maintenance" },
  { label: "Unavailable", status: "Unavailable", tone: "danger", icon: "wrench" },
];

const statusButtonTones: Record<string, string> = {
  neutral: "border-line text-gray-700 hover:border-gray-300 hover:bg-gray-50",
  success: "border-green/30 text-green hover:border-green hover:bg-green/5",
  warning: "border-gold/40 text-gold hover:border-gold hover:bg-gold/5",
  danger: "border-coral/40 text-coral hover:border-coral hover:bg-coral/5",
};

export function MachineSettingsModal({
  machine,
  canUpdateMachine,
  canDeleteMachine,
  onClose,
  onStatusChange,
  onEdit,
  onRemove,
  isPending,
}: {
  machine: Machine;
  canUpdateMachine: boolean;
  canDeleteMachine: boolean;
  canCreateOffcut: boolean;
  onOffcut: () => void;
  canCreateScrap: boolean;
  onScrap: () => void;
  onClose: () => void;
  onStatusChange: (machineId: string, status: MachineStatus) => void;
  onEdit: (machine: Machine) => void;
  onRemove: (machineId: string) => void;
  isPending: (key: string) => boolean;
}) {
  return (
    <ModalShell title={machine.name} subtitle={`${machine.code} · ${machine.type}`} onClose={onClose}>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 p-4 bg-gray-50 border border-line rounded-lg">
          <span className="text-[10px] font-mono font-bold tracking-wider text-gray-500 uppercase">Current status</span>
          <StatusPill variant={statusTone(machine.status) as "success" | "warning" | "danger" | "neutral"}>
            {machine.status}
          </StatusPill>
        </div>

        {machine.model || machine.capability || machine.manufacturer ? (
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {machine.manufacturer ? (
              <div className="p-3 bg-white border border-line rounded-lg">
                <dt className="text-[10px] font-mono font-semibold tracking-wider text-gray-500 uppercase mb-1">Manufacturer</dt>
                <dd className="text-sm font-semibold text-navy">{machine.manufacturer}</dd>
              </div>
            ) : null}
            {machine.model ? (
              <div className="p-3 bg-white border border-line rounded-lg">
                <dt className="text-[10px] font-mono font-semibold tracking-wider text-gray-500 uppercase mb-1">Model</dt>
                <dd className="text-sm font-semibold text-navy">{machine.model}</dd>
              </div>
            ) : null}
            {machine.capability ? (
              <div className="p-3 bg-white border border-line rounded-lg">
                <dt className="text-[10px] font-mono font-semibold tracking-wider text-gray-500 uppercase mb-1">Capability</dt>
                <dd className="text-sm font-semibold text-navy">{machine.capability}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <div className={cn("flex items-center gap-2 text-sm", machine.activeJob ? "text-navy" : "text-gray-500")}>
          {machine.activeJob ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green" />
              <span>
                Active job: <strong className="font-mono text-navy">{machine.activeJob}</strong>
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              <span>No active job assigned.</span>
            </>
          )}
        </div>

        {canUpdateMachine ? (
          <div className="space-y-3">
            <span className="block text-[10px] font-mono font-bold tracking-wider text-gray-500 uppercase">Set status</span>
            <div className="grid grid-cols-2 gap-2">
              {statusActions.map((sa) => {
                const pending = isPending(`status-machine-${machine.id}`);
                const isActive = machine.status === sa.status;
                return (
                  <button
                    key={sa.status}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2 disabled:cursor-not-allowed",
                      isActive
                        ? "bg-navy text-white border-navy shadow-sm"
                        : `bg-white ${statusButtonTones[sa.tone]}`,
                      pending ? "opacity-60" : "",
                    )}
                    disabled={isActive || pending}
                    onClick={() => onStatusChange(machine.id, sa.status)}
                  >
                    {sa.icon === "available" ? <Power size={13} /> : sa.icon === "maintenance" ? <PowerOff size={13} /> : <Wrench size={13} />}
                    {pending && !isActive ? "Saving..." : sa.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {canUpdateMachine ? (
          <div className="space-y-3 border-t border-line pt-5">
            <span className="block text-[10px] font-mono font-bold tracking-wider text-gray-500 uppercase">Manage</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  onClose();
                  onEdit(machine);
                }}
              >
                <Edit3 size={13} />Edit
              </Button>
              {canDeleteMachine && !machine.activeJob ? (
                <Button
                  variant="secondary"
                  pending={isPending(`remove-machine-${machine.id}`)}
                  disabled={isPending(`remove-machine-${machine.id}`)}
                  onClick={() => onRemove(machine.id)}
                  className="border-coral/40 text-coral hover:border-coral hover:bg-coral/5"
                >
                  <Trash2 size={13} />
                  {isPending(`remove-machine-${machine.id}`) ? "Removing..." : "Remove"}
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="p-4 text-sm text-gray-500 bg-gray-50 border border-line rounded-lg">
            You have view-only access to this machine.
          </p>
        )}
      </div>
    </ModalShell>
  );
}