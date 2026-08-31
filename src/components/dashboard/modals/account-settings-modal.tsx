"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { roleLabels, type Profile, type Role } from "@/lib/operations-types";
import { can } from "@/lib/permissions";
import { Link2, Save, ShieldCheck, UserRound } from "lucide-react";
import { ModalShell } from "./modal-shell";

const roleOptions = Object.keys(roleLabels) as Role[];

export function AccountSettingsModal({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  const canManageTeam = can(profile, "team.manage");
  const isOwner = profile.role === "owner";
  const users = useQuery(api.users.listUsers, canManageTeam ? {} : "skip");
  const company = useQuery(api.users.getCompanySettings);
  const updateApplicationProfile = useMutation(api.users.updateApplicationProfile);
  const updateCompanySettings = useMutation(api.users.updateCompanySettings);
  const setRole = useMutation(api.users.setRole);
  const setActive = useMutation(api.users.setActive);

  const [name, setName] = useState(profile.name);
  const [image, setImage] = useState(profile.image ?? "");
  const [companyName, setCompanyName] = useState(company?.companyName ?? "");
  const [logoUrl, setLogoUrl] = useState(company?.logoUrl ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!company) return;
    setCompanyName(company.companyName);
    setLogoUrl(company.logoUrl ?? "");
  }, [company]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.updateUser({ name, image: image.trim() || null });
      if (result.error) throw new Error(result.error.message ?? "Unable to update the authentication profile.");
      await updateApplicationProfile({ name, image: image.trim() || undefined });
      const profileMessage = "Profile updated.";
      setMessage(profileMessage);
      toast.success(profileMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update profile.";
      setMessage(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

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
      const message = "Password changed. Other sessions were signed out.";
      setMessage(message);
      toast.success(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to change password.";
      setMessage(message);
      toast.error(message);
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
      else {
        const message = "Google linking started.";
        setMessage(message);
        toast.success(message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google linking is not configured yet.";
      setMessage(message);
      toast.error(message);
      setBusy(false);
    }
  }

  async function saveCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await updateCompanySettings({ companyName, logoUrl: logoUrl.trim() || undefined });
      const message = "Company branding updated.";
      setMessage(message);
      toast.success(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update company settings.";
      setMessage(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: Id<"users">, nextRole: Role) {
    try {
      await setRole({ userId, role: nextRole });
      const message = `Role updated to ${roleLabels[nextRole].en}.`;
      setMessage(message);
      toast.success(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update role.";
      setMessage(message);
      toast.error(message);
    }
  }

  async function changeActive(userId: Id<"users">, active: boolean) {
    try {
      await setActive({ userId, active });
      const message = active ? "Profile activated." : "Profile revoked.";
      setMessage(message);
      toast.success(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update profile access.";
      setMessage(message);
      toast.error(message);
    }
  }

  return (
    <ModalShell title="Account settings" subtitle="Manage your profile, sign-in methods, and workspace access." onClose={onClose}>
      <div className="modal-form account-settings-form">
        <section className="settings-section">
          <div className="settings-section-head"><UserRound size={17} /><div><strong>Personal profile</strong><span>{profile.email}</span></div></div>
          <form onSubmit={saveProfile}>
            <label>Name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>Profile image URL<input placeholder="Optional image URL" value={image} onChange={(event) => setImage(event.target.value)} /></label>
            <button className="button primary" type="submit" disabled={busy}><Save size={15} />Save profile</button>
          </form>
        </section>

        <section className="settings-section">
          <div className="settings-section-head"><ShieldCheck size={17} /><div><strong>Password and sign-in</strong><span>Keep your account secure.</span></div></div>
          <form onSubmit={changePassword}>
            <label>Current password<input required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
            <label>New password<input required minLength={8} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <button className="button secondary" type="submit" disabled={busy}>Change password</button>
          </form>
          <button className="button secondary" type="button" onClick={linkGoogle} disabled={busy}><Link2 size={15} />Attach Google account</button>
          <small className="settings-help">Google OAuth must be configured in the Convex deployment before linking is available.</small>
        </section>

        {isOwner ? (
          <section className="settings-section">
            <div className="settings-section-head"><ShieldCheck size={17} /><div><strong>Company branding</strong><span>Owner-only workspace settings.</span></div></div>
            <form onSubmit={saveCompany}>
              <label>Company name<input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></label>
              <label>Logo URL<input placeholder="Optional logo image URL" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} /></label>
              <button className="button primary" type="submit" disabled={busy}><Save size={15} />Save company settings</button>
            </form>
          </section>
        ) : null}

        {canManageTeam ? (
          <section className="settings-section">
            <div className="settings-section-head"><ShieldCheck size={17} /><div><strong>Team access</strong><span>{isOwner ? "Owner can delegate role management to a manager." : "Manage operational roles within your delegation."}</span></div></div>
            <div className="team-list">
              {users?.map((user) => (
                <div className="team-row" key={user._id}>
                  <div><strong>{user.name}</strong><small>{user.email}</small></div>
                  <select value={user.role} onChange={(event) => void changeRole(user._id, event.target.value as Role)} disabled={user.role === "owner" && !isOwner}>
                    {roleOptions.map((option) => <option key={option} value={option} disabled={option === "owner" && !isOwner}>{roleLabels[option].en}</option>)}
                  </select>
                  <button className="button tiny secondary" type="button" onClick={() => void changeActive(user._id, !user.active)} disabled={user.authUserId === profile.authUserId}>{user.active ? "Revoke" : "Activate"}</button>
                </div>
              ))}
              {users?.length === 0 ? <div className="empty-state">No team profiles yet.</div> : null}
            </div>
          </section>
        ) : null}

        {message ? <p className="form-message">{message}</p> : null}
      </div>
    </ModalShell>
  );
}
