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
  currentProfile,
  canDemoteOwner,
  isSelf,
  onChangeRole,
  onToggleActive,
}: {
  member: { _id: Id<"users">; authUserId: string; name: string; email: string; role: Role; active: boolean };
  currentProfile: Profile;
  canDemoteOwner: boolean;
  isSelf: boolean;
  onChangeRole: (userId: Id<"users">, nextRole: Role) => void;
  onToggleActive: (userId: Id<"users">, active: boolean) => void;
}) {
  const initials = member.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-gray-800 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-gradient-to-br from-navy to-navy-2 text-xs font-bold text-white">
          {initials}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <strong className="truncate text-sm font-semibold text-navy">{member.name}</strong>
            {isSelf ? <StatusPill variant="success">You</StatusPill> : null}
          </div>
          <small className="block truncate text-xs text-gray-500">{member.email}</small>
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
    </div>
  );
}

/** Re-export shared role list for any other settings UI that needs it. */
export { roleOptions, roleTone };
