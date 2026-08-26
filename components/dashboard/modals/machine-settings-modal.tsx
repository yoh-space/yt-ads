"use client";

import { Edit3, Power, PowerOff, Trash2, Wrench, X } from "lucide-react";
import type { Machine, MachineStatus } from "@/lib/operations-types";
import { statusTone } from "../helpers";
import { ModalShell } from "./modal-shell";

const statusActions: Array<{ label: string; status: MachineStatus; tone: string }> = [
  { label: "Available", status: "Available", tone: "success" },
  { label: "Running", status: "Running", tone: "info" },
  { label: "Maintenance", status: "Maintenance", tone: "warning" },
  { label: "Unavailable", status: "Unavailable", tone: "danger" },
];

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
  onClose: () => void;
  onStatusChange: (machineId: string, status: MachineStatus) => void;
  onEdit: (machine: Machine) => void;
  onRemove: (machineId: string) => void;
  isPending: (key: string) => boolean;
}) {
  return (
    <ModalShell title={machine.name} subtitle={`${machine.code} · ${machine.type}`} onClose={onClose}>
      <div className="ms-modal-body">
        <div className="ms-status-row">
          <span className="mc-group-label">CURRENT STATUS</span>
          <span className={`status-pill ${statusTone(machine.status)}`}>{machine.status}</span>
        </div>

        {machine.model || machine.capability || machine.manufacturer ? (
          <div className="ms-meta">
            {machine.manufacturer ? <div><small>Manufacturer</small><strong>{machine.manufacturer}</strong></div> : null}
            {machine.model ? <div><small>Model</small><strong>{machine.model}</strong></div> : null}
            {machine.capability ? <div><small>Capability</small><strong>{machine.capability}</strong></div> : null}
          </div>
        ) : null}

        {machine.activeJob ? (
          <p className="ms-active-note">Active job: <strong>{machine.activeJob}</strong></p>
        ) : (
          <p className="ms-active-note muted">No active job assigned.</p>
        )}

        {canUpdateMachine ? (
          <div className="ms-section">
            <span className="mc-group-label">SET STATUS</span>
            <div className="mc-status-btns">
              {statusActions.map((sa) => {
                const pending = isPending(`status-machine-${machine.id}`);
                return (
                  <button
                    key={sa.status}
                    className={`mc-status-btn mc-status-${sa.tone}${machine.status === sa.status ? " mc-status-active" : ""}${pending ? " pending" : ""}`}
                    disabled={machine.status === sa.status || pending}
                    onClick={() => onStatusChange(machine.id, sa.status)}
                  >
                    {sa.status === "Available" ? <Power size={13} /> : sa.status === "Maintenance" ? <PowerOff size={13} /> : <Wrench size={13} />}
                    {pending && machine.status !== sa.status ? "Saving..." : sa.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {canUpdateMachine ? (
          <div className="ms-section">
            <span className="mc-group-label">MANAGE</span>
            <div className="mc-manage-btns">
              <button className="mc-manage-btn" onClick={() => { onClose(); onEdit(machine); }}>
                <Edit3 size={13} />Edit
              </button>
              {canDeleteMachine && !machine.activeJob ? (
                <button
                  className={`mc-manage-btn mc-danger${isPending(`remove-machine-${machine.id}`) ? " pending" : ""}`}
                  disabled={isPending(`remove-machine-${machine.id}`)}
                  onClick={() => onRemove(machine.id)}
                >
                  <Trash2 size={13} />{isPending(`remove-machine-${machine.id}`) ? "Removing..." : "Remove"}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="ms-readonly-note">You have view-only access to this machine.</p>
        )}
      </div>
    </ModalShell>
  );
}
