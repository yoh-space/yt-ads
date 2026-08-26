"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import type { Profile } from "@/lib/operations-types";
import { Link2, ShieldCheck } from "lucide-react";
import { ModalShell } from "./modal-shell";

export function SecuritySettingsModal({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) throw new Error(result.error.message ?? "Unable to change password.");
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password changed. Other sessions were signed out.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to change password.");
    } finally {
      setBusy(false);
    }
  }

  async function linkGoogle() {
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.linkSocial({ provider: "google", callbackURL: window.location.href });
      if (result.error) throw new Error(result.error.message ?? "Unable to start Google linking.");
      if (result.data?.url) window.location.assign(result.data.url);
      else setMessage("Google linking started.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google linking is not configured yet.");
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Security" subtitle="Manage your password and sign-in methods." onClose={onClose}>
      <div className="modal-form">
        <section className="settings-section">
          <div className="settings-section-head">
            <ShieldCheck size={17} />
            <div>
              <strong>Change password</strong>
              <span>Keep your account secure.</span>
            </div>
          </div>
          <form onSubmit={changePassword}>
            <label>
              Current password
              <input required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </label>
            <label>
              New password
              <input required minLength={8} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </label>
            <button className="button secondary" type="submit" disabled={busy}>
              Change password
            </button>
          </form>
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <Link2 size={17} />
            <div>
              <strong>Linked accounts</strong>
              <span>Connect third-party sign-in providers.</span>
            </div>
          </div>
          <button className="button secondary" type="button" onClick={linkGoogle} disabled={busy}>
            <Link2 size={15} />
            Attach Google account
          </button>
          <small className="settings-help">
            Google OAuth must be configured in the Convex deployment before linking is available.
          </small>
        </section>

        {message ? <p className="form-message">{message}</p> : null}
      </div>
    </ModalShell>
  );
}
