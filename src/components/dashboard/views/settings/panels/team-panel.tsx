"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Users } from "lucide-react";
import type { Profile, Role } from "@/lib/operations-types";
import { FormMessage, FormSection } from "../chrome/form";
import { TeamMemberTile } from "./team-member-tile";

/**
 * Team Access: lists every application profile with role + activation controls.
 * Owners can also demote/promote other owners; managers are locked out.
 */
export function TeamPanel({ profile }: { profile: Profile }) {
  const isOwner = profile.role === "owner";
  const users = useQuery(api.users.listUsers, {});
  const machines = useQuery(api.machines.list, {});
  const setRole = useMutation(api.users.setRole);
  const setActive = useMutation(api.users.setActive);
  const setMachineScope = useMutation(api.users.setMachineScope);
  const [message, setMessage] = useState("");

  async function changeRole(userId: Id<"users">, nextRole: Role) {
    try {
      await setRole({ userId, role: nextRole });
      setMessage("Role updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update role.");
    }
  }

  async function changeActive(userId: Id<"users">, active: boolean) {
    try {
      await setActive({ userId, active });
      setMessage(active ? "Profile activated." : "Profile revoked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update profile access.");
    }
  }

  async function changeMachineScope(userId: Id<"users">, machineIds: Id<"machines">[]) {
    try {
      await setMachineScope({ userId, machineIds });
      setMessage("Machine notification scope updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update machine scope.");
    }
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      <FormSection
        icon={<Users size={17} />}
        tone="navy"
        title="Team members"
        note={isOwner ? "Owner can delegate role management to a manager." : "Manage operational roles within your delegation."}
      >
        <div className="space-y-2">
          {users?.map((user) => (
            <TeamMemberTile
              key={user._id}
              member={user}
              machines={machines ?? []}
              currentProfile={profile}
              canDemoteOwner={isOwner}
              isSelf={user.authUserId === profile.authUserId}
              onChangeRole={changeRole}
              onToggleActive={changeActive}
              onChangeMachineScope={changeMachineScope}
              />
          ))}
          {users?.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-white/[0.02] px-4 py-8 text-center text-xs text-muted-foreground">
              No team profiles yet.
            </div>
          ) : null}
        </div>
      </FormSection>
      {message ? (
        <div className="px-5 py-4 sm:px-6">
          <FormMessage tone={message.includes("Unable") ? "error" : "success"}>{message}</FormMessage>
        </div>
      ) : null}
    </div>
  );
}
