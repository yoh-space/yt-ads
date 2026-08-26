"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { roleLabels, type Profile, type Role } from "@/lib/operations-types";
import { Shield, Users } from "lucide-react";
import { ModalShell } from "./modal-shell";

const roleOptions = Object.keys(roleLabels) as Role[];

export function TeamSettingsModal({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  const isOwner = profile.role === "owner";
  const users = useQuery(api.users.listUsers, {});
  const setRole = useMutation(api.users.setRole);
  const setActive = useMutation(api.users.setActive);
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

  return (
    <ModalShell title="Team Access" subtitle="Manage team roles and workspace permissions." onClose={onClose}>
      <div className="modal-form">
        <section className="settings-section">
          <div className="settings-section-head">
            <Users size={17} />
            <div>
              <strong>Team members</strong>
              <span>{isOwner ? "Owner can delegate role management to a manager." : "Manage operational roles within your delegation."}</span>
            </div>
          </div>
          <div className="team-list">
            {users?.map((user) => (
              <div className="team-row" key={user._id}>
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
                <select
                  value={user.role}
                  onChange={(event) => void changeRole(user._id, event.target.value as Role)}
                  disabled={user.role === "owner" && !isOwner}
                >
                  {roleOptions.map((option) => (
                    <option key={option} value={option} disabled={option === "owner" && !isOwner}>
                      {roleLabels[option].en}
                    </option>
                  ))}
                </select>
                <button
                  className="button tiny secondary"
                  type="button"
                  onClick={() => void changeActive(user._id, !user.active)}
                  disabled={user.authUserId === profile.authUserId}
                >
                  {user.active ? "Revoke" : "Activate"}
                </button>
              </div>
            ))}
            {users?.length === 0 ? <div className="empty-state">No team profiles yet.</div> : null}
          </div>
        </section>
        {message ? <p className="form-message">{message}</p> : null}
      </div>
    </ModalShell>
  );
}
