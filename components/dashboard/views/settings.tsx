"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { roleLabels, type Profile, type Role } from "@/lib/operations-types";
import { can } from "@/lib/permissions";
import { ChevronRight, Link2, Save, Shield, ShieldCheck, Building2, UserRound, Users } from "lucide-react";
import type { SettingsCategory } from "../nav-config";

const roleOptions = Object.keys(roleLabels) as Role[];

interface SettingsEntry {
  id: SettingsCategory;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}

export function SettingsView({ profile }: { profile: Profile }) {
  const isOwner = profile.role === "owner";
  const canManageTeam = can(profile, "team.manage");
  const canUpdateCompany = can(profile, "company_settings.update");

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("profile");

  const categories: SettingsEntry[] = [
    { id: "profile", icon: <UserRound size={20} />, title: "Personal Profile", description: "Update your name, profile image, and display information." },
    { id: "security", icon: <Lock size={20} />, title: "Security", description: "Change your password and manage sign-in methods." },
    ...(canManageTeam ? [{ id: "team" as const, icon: <Shield size={20} />, title: "Team Access", description: "Manage team roles and workspace permissions.", badge: isOwner ? "Owner" : "Manager" }] : []),
    ...(canUpdateCompany ? [{ id: "company" as const, icon: <Building2 size={20} />, title: "Company Profile", description: "Manage workspace branding and company settings." }] : []),
  ];

  const selected = categories.find((c) => c.id === activeCategory) ?? categories[0];

  return (
    <div className="settings-layout">
      <aside className="settings-sidebar">
        <div className="settings-sidebar-head">
          <h3>Settings</h3>
          <p>Manage your account and workspace</p>
        </div>
        <nav className="settings-nav">
          {categories.map((category) => (
            <button
              key={category.id}
              className={`settings-nav-item ${activeCategory === category.id ? "active" : ""}`}
              onClick={() => setActiveCategory(category.id)}
            >
              <span className="settings-nav-icon">{category.icon}</span>
              <span className="settings-nav-text">
                <strong>{category.title}</strong>
                <small>{category.description}</small>
              </span>
              <ChevronRight size={16} className="settings-nav-chevron" />
            </button>
          ))}
        </nav>
      </aside>

      <div className="settings-content">
        <div className="settings-content-head">
          <span className="settings-content-icon">{selected.icon}</span>
          <div>
            <h2>{selected.title}</h2>
            <p>{selected.description}</p>
          </div>
          {selected.badge ? <span className="settings-badge">{selected.badge}</span> : null}
        </div>

        {activeCategory === "profile" ? <ProfilePanel profile={profile} /> : null}
        {activeCategory === "security" ? <SecurityPanel /> : null}
        {activeCategory === "team" ? <TeamPanel profile={profile} /> : null}
        {activeCategory === "company" ? <CompanyPanel /> : null}
      </div>
    </div>
  );
}

/* ──────── Profile ──────── */
function ProfilePanel({ profile }: { profile: Profile }) {
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
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-content-card">
      <div className="settings-preview">
        <div className="settings-preview-avatar">
          {profile.image ? <img src={profile.image} alt="" /> : <span>{profile.name.charAt(0).toUpperCase()}</span>}
        </div>
        <div className="settings-preview-info">
          <strong>{profile.name}</strong>
          <small>{profile.email}</small>
          <span className="settings-preview-role">{profile.role.replace(/_/g, " ")}</span>
        </div>
      </div>
      <section className="settings-section">
        <div className="settings-section-head"><UserRound size={17} /><div><strong>Profile information</strong><span>{profile.email}</span></div></div>
        <form onSubmit={saveProfile}>
          <label>Display name<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Profile image URL<input placeholder="Optional image URL" value={image} onChange={(e) => setImage(e.target.value)} /></label>
          <button className="button primary" type="submit" disabled={busy}><Save size={15} />Save profile</button>
        </form>
      </section>
      {message ? <p className="form-message">{message}</p> : null}
    </div>
  );
}

/* ──────── Security ──────── */
function SecurityPanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
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
    <div className="settings-content-card">
      <section className="settings-section">
        <div className="settings-section-head"><ShieldCheck size={17} /><div><strong>Change password</strong><span>Keep your account secure.</span></div></div>
        <form onSubmit={changePassword}>
          <label>Current password<input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
          <label>New password<input required minLength={8} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
          <button className="button secondary" type="submit" disabled={busy}>Change password</button>
        </form>
      </section>
      <section className="settings-section">
        <div className="settings-section-head"><Link2 size={17} /><div><strong>Linked accounts</strong><span>Connect third-party sign-in providers.</span></div></div>
        <button className="button secondary" type="button" onClick={linkGoogle} disabled={busy}><Link2 size={15} />Attach Google account</button>
        <small className="settings-help">Google OAuth must be configured in the Convex deployment before linking is available.</small>
      </section>
      {message ? <p className="form-message">{message}</p> : null}
    </div>
  );
}

/* ──────── Team ──────── */
function TeamPanel({ profile }: { profile: Profile }) {
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
    <div className="settings-content-card">
      <section className="settings-section">
        <div className="settings-section-head"><Users size={17} /><div><strong>Team members</strong><span>{isOwner ? "Owner can delegate role management to a manager." : "Manage operational roles within your delegation."}</span></div></div>
        <div className="team-list">
          {users?.map((user) => (
            <div className="team-row" key={user._id}>
              <div><strong>{user.name}</strong><small>{user.email}</small></div>
              <select value={user.role} onChange={(e) => void changeRole(user._id, e.target.value as Role)} disabled={user.role === "owner" && !isOwner}>
                {roleOptions.map((option) => <option key={option} value={option} disabled={option === "owner" && !isOwner}>{roleLabels[option].en}</option>)}
              </select>
              <button className="button tiny secondary" type="button" onClick={() => void changeActive(user._id, !user.active)} disabled={user.authUserId === profile.authUserId}>{user.active ? "Revoke" : "Activate"}</button>
            </div>
          ))}
          {users?.length === 0 ? <div className="empty-state">No team profiles yet.</div> : null}
        </div>
      </section>
      {message ? <p className="form-message">{message}</p> : null}
    </div>
  );
}

/* ──────── Company ──────── */
function CompanyPanel() {
  const company = useQuery(api.users.getCompanySettings);
  const updateCompanySettings = useMutation(api.users.updateCompanySettings);
  const [companyName, setCompanyName] = useState(company?.companyName ?? "");
  const [logoUrl, setLogoUrl] = useState(company?.logoUrl ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!company) return;
    setCompanyName(company.companyName);
    setLogoUrl(company.logoUrl ?? "");
  }, [company]);

  async function saveCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await updateCompanySettings({ companyName, logoUrl: logoUrl.trim() || undefined });
      setMessage("Company branding updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update company settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-content-card">
      <section className="settings-section">
        <div className="settings-section-head"><Building2 size={17} /><div><strong>Company branding</strong><span>Owner-only workspace settings.</span></div></div>
        <form onSubmit={saveCompany}>
          <label>Company name<input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></label>
          <label>Logo URL<input placeholder="Optional logo image URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} /></label>
          <button className="button primary" type="submit" disabled={busy}><Save size={15} />Save company settings</button>
        </form>
      </section>
      {message ? <p className="form-message">{message}</p> : null}
    </div>
  );
}

function Lock({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
