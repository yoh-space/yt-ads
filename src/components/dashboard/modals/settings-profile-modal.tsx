"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import type { Profile } from "@/lib/operations-types";
import { Save, UserRound } from "lucide-react";
import { ModalShell } from "./modal-shell";

export function ProfileSettingsModal({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  const updateApplicationProfile = useMutation(api.users.updateApplicationProfile);
  const [name, setName] = useState(profile.name);
  const [image, setImage] = useState(profile.image ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.updateUser({ name, image: image.trim() || null });
      if (result.error) throw new Error(result.error.message ?? "Unable to update the authentication profile.");
      await updateApplicationProfile({ name, image: image.trim() || undefined });
      const message = "Profile updated.";
      setMessage(message);
      toast.success(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update profile.";
      setMessage(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Personal Profile" subtitle="Update your name and profile image." onClose={onClose}>
      <div className="modal-form">
        <section className="settings-section">
          <div className="settings-section-head">
            <UserRound size={17} />
            <div>
              <strong>Profile information</strong>
              <span>{profile.email}</span>
            </div>
          </div>
          <form onSubmit={saveProfile}>
            <label>
              Display name
              <input required value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              Profile image URL
              <input placeholder="Optional image URL" value={image} onChange={(event) => setImage(event.target.value)} />
            </label>
            <button className="button primary" type="submit" disabled={busy}>
              <Save size={15} />
              Save profile
            </button>
          </form>
        </section>
        {message ? <p className="form-message">{message}</p> : null}
      </div>
    </ModalShell>
  );
}
