"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { roleLabels, type Profile, type Role } from "@/lib/operations-types";
import { Button, Select, StatusPill } from "@/components/ui";

const roleOptions = Object.keys(roleLabels) as Role[];

const roleTone: Record<Role, "success" | "info" | "warning" | "neutral"> = {
  owner: "warning",
  manager: "info",
  admin: "info",
  storekeeper: "neutral",
  receptionist: "info",
  laser_operator: "neutral",
  cnc_operator: "neutral",
  plotter_operator: "neutral",
  printer_operator: "neutral",
};

/** Single row inside the team panel: avatar + name + role select + activate toggle. */
export function TeamMemberTile({
  member,
  machines,
  currentProfile,
  canDemoteOwner,
  isSelf,
  onChangeRole,
  onToggleActive,
  onChangeMachineScope,
}: {
  member: {
    _id: Id<"users">;
    authUserId: string;
    name: string;
    email: string;
    role: Role;
    active: boolean;
    assignedMachineIds?: Id<"machines">[];
  };
  machines: Array<{ _id: Id<"machines">; name: string; code: string; operatorRole: Role; active: boolean }>;
  currentProfile: Profile;
  canDemoteOwner: boolean;
  isSelf: boolean;
  onChangeRole: (userId: Id<"users">, nextRole: Role) => void;
  onToggleActive: (userId: Id<"users">, active: boolean) => void;
  onChangeMachineScope: (userId: Id<"users">, machineIds: Id<"machines">[]) => void;
}) {
  const initials = member.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const operatorMachines = machines.filter((machine) => machine.operatorRole === member.role);
  const isOperator = member.role.endsWith("_operator");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-navy/20 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-gradient-to-br from-navy to-navy-2 text-xs font-bold text-white">
          {initials}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <strong className="truncate text-sm font-semibold text-foreground">{member.name}</strong>
            {isSelf ? <StatusPill variant="success">You</StatusPill> : null}
          </div>
          <small className="block truncate text-xs text-muted-foreground">{member.email}</small>
        </div>
      </div>
      <div className="flex flex-none items-center gap-2">
        <StatusPill variant={roleTone[member.role]}>{roleLabels[member.role].en}</StatusPill>
        <Select
          value={member.role}
          className="w-32"
          disabled={!canDemoteOwner && member.role === "owner"}
          onChange={(event) => onChangeRole(member._id, event.target.value as Role)}
        >
          {roleOptions.map((option) => (
            <option key={option} value={option} disabled={option === "owner" && !canDemoteOwner}>
              {roleLabels[option].en}
            </option>
          ))}
        </Select>
        <Button
          size="tiny"
          variant="secondary"
          type="button"
          disabled={isSelf}
          onClick={() => onToggleActive(member._id, !member.active)}
        >
          {member.active ? "Revoke" : "Activate"}
        </Button>
      </div>
      {isOperator && operatorMachines.length > 0 ? (
        <label className="flex w-full flex-col gap-1 text-xs text-muted-foreground sm:ml-[52px] sm:w-auto sm:min-w-56">
          Machine notification scope
          <select
            multiple
            size={Math.min(3, operatorMachines.length)}
            value={(member.assignedMachineIds ?? []).filter((machineId) => operatorMachines.some((machine) => machine._id === machineId))}
            onChange={(event) => {
              const machineIds = Array.from(event.target.selectedOptions, (option) => option.value as Id<"machines">);
              onChangeMachineScope(member._id, machineIds);
            }}
            className="min-h-20 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/20"
            aria-label={`Machine notification scope for ${member.name}`}
          >
            {operatorMachines.map((machine) => (
              <option key={machine._id} value={machine._id}>
                {machine.name} ({machine.code})
              </option>
            ))}
          </select>
          <span className="text-[11px]">Leave empty to use every active machine for this role.</span>
        </label>
      ) : null}
    </div>
  );
}

/** Re-export shared role list for any other settings UI that needs it. */
export { roleOptions, roleTone };
