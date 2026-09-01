"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { roleLabels, type Profile, type Role } from "@/lib/operations-types";
import { can } from "@/lib/permissions";
import {
  Building2,
  ChevronRight,
  CircleDollarSign,
  Cog,
  Link2,
  Plus,
  Save,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import type { SettingsCategory } from "../nav-config";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

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
    { id: "security", icon: <ShieldCheck size={20} />, title: "Security", description: "Change your password and manage sign-in methods." },
    ...(canManageTeam ? [{ id: "team" as const, icon: <Shield size={20} />, title: "Team Access", description: "Manage team roles and workspace permissions.", badge: isOwner ? "Owner" : "Manager" }] : []),
    ...(canUpdateCompany ? [{ id: "company" as const, icon: <Building2 size={20} />, title: "Company Profile", description: "Manage workspace branding and company settings." }] : []),
    ...(isOwner ? [{ id: "operations" as const, icon: <Settings2 size={20} />, title: "Operational & Financial Rules", description: "Configure ETB valuation, production rules, and risk controls.", badge: "Owner" }] : []),
  ];

  const selected = categories.find((c) => c.id === activeCategory) ?? categories[0];

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
          {/* Settings Sidebar */}
          <aside className="space-y-6">
            <div className="bg-white border border-line rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-bold text-navy mb-2">Settings</h3>
              <p className="text-sm text-gray-600">Manage your account and workspace</p>
            </div>
            
            <nav className="space-y-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 text-left rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2",
                    activeCategory === category.id
                      ? "bg-cyan/10 border-cyan/20 text-cyan-dark"
                      : "bg-white border-line text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                  )}
                  onClick={() => setActiveCategory(category.id)}
                >
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg",
                    activeCategory === category.id
                      ? "bg-cyan/20 text-cyan"
                      : "bg-gray-100 text-gray-600"
                  )}>
                    {category.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{category.title}</span>
                      {category.badge && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-navy/10 text-navy">
                          {category.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{category.description}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400 flex-none" />
                </button>
              ))}
            </nav>
          </aside>

          {/* Settings Content */}
          <div className="space-y-6">
            <div className="bg-white border border-line rounded-lg p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-lg",
                  "bg-cyan/10 text-cyan"
                )}>
                  {selected.icon}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-navy">{selected.title}</h2>
                  <p className="text-sm text-gray-600 mt-1">{selected.description}</p>
                </div>
                {selected.badge && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-navy text-white">
                    {selected.badge}
                  </span>
                )}
              </div>
            </div>

            {activeCategory === "profile" && <ProfilePanel profile={profile} />}
            {activeCategory === "security" && <SecurityPanel isOwner={isOwner} />}
            {activeCategory === "team" && <TeamPanel profile={profile} />}
            {activeCategory === "company" && <CompanyPanel />}
            {activeCategory === "operations" && isOwner && <OperationalPanel />}
          </div>
        </div>
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
    <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
      {/* Profile Preview */}
      <div className="p-6 border-b border-line bg-gray-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-navy text-white text-xl font-bold overflow-hidden">
            {profile.image ? (
              <img src={profile.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{profile.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <div className="font-semibold text-navy text-lg">{profile.name}</div>
            <div className="text-sm text-gray-600">{profile.email}</div>
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan/10 text-cyan mt-2">
              {profile.role.replace(/_/g, " ")}
            </div>
          </div>
        </div>
      </div>
      
      {/* Profile Form */}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <UserRound size={17} className="text-cyan" />
          <div>
            <div className="font-semibold text-navy">Profile information</div>
            <div className="text-sm text-gray-600">{profile.email}</div>
          </div>
        </div>
        
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Display name
            </label>
            <Input 
              required 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              Profile image URL
            </label>
            <Input 
              placeholder="Optional image URL" 
              value={image} 
              onChange={(e) => setImage(e.target.value)}
              className="w-full"
            />
          </div>
          
          <Button 
            variant="primary" 
            type="submit" 
            disabled={busy}
            className="inline-flex items-center gap-2"
          >
            <Save size={15} />
            Save profile
          </Button>
        </form>
        
        {message && (
          <div className="mt-4 p-3 bg-green/10 border border-green/20 rounded-lg text-sm text-green">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────── Security ──────── */
function SecurityPanel({ isOwner = false }: { isOwner?: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [sessions, setSessions] = useState<Array<{
    token: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    createdAt?: Date;
    expiresAt?: Date;
  }> | null>(null);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState("");

  async function loadSessions() {
    try {
      const [sessionResult, listResult] = await Promise.all([
        authClient.getSession(),
        authClient.listSessions(),
      ]);
      setCurrentToken(sessionResult.data?.session.token ?? null);
      setSessions(listResult.data ?? []);
    } catch {
      setSessions([]);
    }
  }

  useEffect(() => {
    if (isOwner) void loadSessions();
  }, [isOwner]);

  async function revokeSession(token: string) {
    setSessionMessage("");
    const result = await authClient.revokeSession({ token });
    if (result.error) {
      setSessionMessage(result.error.message ?? "Unable to revoke the session.");
      return;
    }
    setSessionMessage("Session revoked.");
    await loadSessions();
  }

  function sessionSummary(userAgent?: string | null): string {
    if (!userAgent) return "Unknown device";
    const os = /Windows/i.test(userAgent) ? "Windows" : /Mac OS X/i.test(userAgent) ? "macOS" : /Android/i.test(userAgent) ? "Android" : /iPhone/i.test(userAgent) ? "iPhone" : /iPad/i.test(userAgent) ? "iPad" : /Linux/i.test(userAgent) ? "Linux" : "Unknown OS";
    const browser = /Edg\//i.test(userAgent) ? "Edge" : /Chrome\//i.test(userAgent) || /CriOS\//i.test(userAgent) ? "Chrome" : /Firefox\//i.test(userAgent) || /FxiOS\//i.test(userAgent) ? "Firefox" : /Safari\//i.test(userAgent) ? "Safari" : "Browser";
    return `${browser} · ${os}`;
  }

  function formatSessionTime(timestamp?: Date) {
    if (!timestamp) return "—";
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
  }

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
          <label>Current password<Input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
          <label>New password<Input required minLength={8} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
          <Button variant="secondary" type="submit" disabled={busy}>Change password</Button>
        </form>
      </section>
      <section className="settings-section">
        <div className="settings-section-head"><Link2 size={17} /><div><strong>Linked accounts</strong><span>Connect third-party sign-in providers.</span></div></div>
        <Button variant="secondary" type="button" onClick={linkGoogle} disabled={busy}><Link2 size={15} />Attach Google account</Button>
        <small className="settings-help">Google OAuth must be configured in the Convex deployment before linking is available.</small>
      </section>
      {message ? <p className="form-message">{message}</p> : null}

      {isOwner ? (
        <section className="settings-section">
          <div className="settings-section-head"><Shield size={17} /><div><strong>Active sessions</strong><span>Owner-only: review and revoke sign-in sessions.</span></div></div>
          {sessions === null ? (
            <div className="empty-state">Loading sessions…</div>
          ) : sessions.length === 0 ? (
            <div className="empty-state">No active sessions found.</div>
          ) : (
            <div className="team-list">
              {sessions.map((session) => {
                const isCurrent = session.token === currentToken;
                return (
                  <div className="team-row" key={session.token}>
                    <div className="min-w-0">
                      <strong>{sessionSummary(session.userAgent)}</strong>
                      <small>
                        IP {session.ipAddress ?? "unknown"} · signed in {formatSessionTime(session.createdAt)}
                        {session.expiresAt ? ` · expires ${formatSessionTime(session.expiresAt)}` : ""}
                        {isCurrent ? " · this device" : ""}
                      </small>
                    </div>
                    <span className={`status-pill ${isCurrent ? "success" : "info"}`}>{isCurrent ? "Current" : "Active"}</span>
                    {!isCurrent ? (
                      <Button size="tiny" variant="secondary" type="button" onClick={() => void revokeSession(session.token)}>Revoke</Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {sessionMessage ? <p className="form-message">{sessionMessage}</p> : null}
        </section>
      ) : null}
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
              <Button size="tiny" variant="secondary" type="button" onClick={() => void changeActive(user._id, !user.active)} disabled={user.authUserId === profile.authUserId}>{user.active ? "Revoke" : "Activate"}</Button>
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
          <label>Company name<Input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></label>
          <label>Logo URL<Input placeholder="Optional logo image URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} /></label>
          <Button variant="primary" type="submit" disabled={busy}><Save size={15} />Save company settings</Button>
        </form>
      </section>
      {message ? <p className="form-message">{message}</p> : null}
    </div>
  );
}

/* ──────── Operational & Financial Rules (owner-only) ──────── */
interface MaterialOption {
  id: string;
  name: string;
  baseUnit?: string;
  unit: string;
}

interface OverrideRow {
  materialName: string;
  etbValue: number;
}

interface NumericFieldProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: string | number;
  hint?: string;
}

function NumericField({ label, value, onChange, suffix, min, max, step, hint }: NumericFieldProps) {
  return (
    <label>
      <span className="field-label-row">
        <span>{label}</span>
        {suffix ? <small className="field-suffix">{suffix}</small> : null}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step ?? "any"}
        onChange={(event) => {
          const raw = event.target.value;
          const parsed = raw === "" ? 0 : Number(raw);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
      />
      {hint ? <small className="settings-help">{hint}</small> : null}
    </label>
  );
}

function OperationalPanel() {
  const config = useQuery(api.systemConfigs.getSystemConfig);
  const state = useQuery(api.dashboard.getState, {});
  const updateSystemConfig = useMutation(api.systemConfigs.updateSystemConfig);

  const [etbPerSquareMetre, setEtbPerSquareMetre] = useState(0);
  const [etbPerLitre, setEtbPerLitre] = useState(0);
  const [etbPerPiece, setEtbPerPiece] = useState(0);
  const [etbPerMetre, setEtbPerMetre] = useState(0);
  const [etbPerSheet, setEtbPerSheet] = useState(0);
  const [inkMlPerSquareMetre, setInkMlPerSquareMetre] = useState(0);
  const [maxAllowedWastePercent, setMaxAllowedWastePercent] = useState(0);
  const [minOffcutAreaSquareMetre, setMinOffcutAreaSquareMetre] = useState(0);
  const [requireAdminPinForExceptions, setRequireAdminPinForExceptions] = useState(true);
  const [maxDirectStockOutEtb, setMaxDirectStockOutEtb] = useState(0);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [newOverrideName, setNewOverrideName] = useState("");
  const [customName, setCustomName] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [newOverridePrice, setNewOverridePrice] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!config || hydrated) return;
    setEtbPerSquareMetre(config.etbPerSquareMetre);
    setEtbPerLitre(config.etbPerLitre);
    setEtbPerPiece(config.etbPerPiece);
    setEtbPerMetre(config.etbPerMetre);
    setEtbPerSheet(config.etbPerSheet);
    setInkMlPerSquareMetre(config.inkMlPerSquareMetre);
    setMaxAllowedWastePercent(config.maxAllowedWastePercent);
    setMinOffcutAreaSquareMetre(config.minOffcutAreaSquareMetre);
    setRequireAdminPinForExceptions(config.requireAdminPinForExceptions);
    setMaxDirectStockOutEtb(config.maxDirectStockOutEtb);
    setOverrides(config.materialOverrides.map((row) => ({ materialName: row.materialName, etbValue: row.etbValue })));
    setHydrated(true);
  }, [config, hydrated]);

  const materials = useMemo<MaterialOption[]>(() => {
    if (!state) return [];
    return state.materials
      .map((material) => ({ id: material._id, name: material.name, baseUnit: material.baseUnit ?? material.unit, unit: material.unit }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [state]);

  const remainingMaterialOptions = useMemo(() => {
    const overrideNames = new Set(overrides.map((row) => row.materialName.toLowerCase()));
    return materials.filter((material) => !overrideNames.has(material.name.toLowerCase()));
  }, [materials, overrides]);

  function addOverride() {
    const name = customMode ? customName.trim() : newOverrideName;
    if (!name) {
      setMessage("Select or enter a material name to add a custom price override.");
      return;
    }
    if (!Number.isFinite(newOverridePrice) || newOverridePrice <= 0) {
      setMessage("Override price must be greater than zero.");
      return;
    }
    if (overrides.some((row) => row.materialName.toLowerCase() === name.toLowerCase())) {
      setMessage("That material already has a custom override.");
      return;
    }
    setOverrides([...overrides, { materialName: name, etbValue: newOverridePrice }]);
    setNewOverrideName("");
    setCustomName("");
    setCustomMode(false);
    setNewOverridePrice(0);
    setMessage("");
  }

  function removeOverride(materialName: string) {
    setOverrides(overrides.filter((row) => row.materialName !== materialName));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await updateSystemConfig({
        etbPerSquareMetre,
        etbPerLitre,
        etbPerPiece,
        etbPerMetre,
        etbPerSheet,
        materialOverrides: overrides,
        inkMlPerSquareMetre,
        maxAllowedWastePercent,
        minOffcutAreaSquareMetre,
        requireAdminPinForExceptions,
        maxDirectStockOutEtb,
      });
      setMessage("Operational configuration saved. Production & valuation will use the new rates on the next record.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save operational configuration.");
    } finally {
      setBusy(false);
    }
  }

  if (config === undefined || state === undefined) {
    return <div className="settings-content-card"><div className="empty-state">Loading configuration…</div></div>;
  }

  return (
    <form className="settings-content-card operational-rules" onSubmit={save}>
      <section className="settings-section">
        <div className="settings-section-head"><CircleDollarSign size={17} /><div><strong>ETB Valuation Rates</strong><span>Used by reconciliation & loss calculations when a material has no explicit price.</span></div></div>
        <div className="settings-grid">
          <NumericField label="Price per m²" value={etbPerSquareMetre} onChange={setEtbPerSquareMetre} suffix="ETB" min={0} step="0.01" hint="Area materials (banner, vinyl, acrylic, foam, …)" />
          <NumericField label="Price per litre" value={etbPerLitre} onChange={setEtbPerLitre} suffix="ETB" min={0} step="0.01" hint="Ink materials" />
          <NumericField label="Price per piece" value={etbPerPiece} onChange={setEtbPerPiece} suffix="ETB" min={0} step="0.01" hint="Unit hardware (LEDs, electrical parts)" />
          <NumericField label="Price per metre" value={etbPerMetre} onChange={setEtbPerMetre} suffix="ETB" min={0} step="0.01" hint="Linear roll materials" />
          <NumericField label="Price per sheet" value={etbPerSheet} onChange={setEtbPerSheet} suffix="ETB" min={0} step="0.01" hint="Rigid sheet materials" />
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head"><Cog size={17} /><div><strong>Individual Material Custom Price Overrides</strong><span>Override the unit rate for high-value materials.</span></div></div>
        {overrides.length > 0 ? (
          <div className="override-list">
            {overrides.map((row) => (
              <div key={row.materialName} className="override-row">
                <strong>{row.materialName}</strong>
                <span>{row.etbValue.toLocaleString("en-US")} ETB</span>
                <button type="button" className="icon-button" onClick={() => removeOverride(row.materialName)} aria-label={`Remove override for ${row.materialName}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <small className="settings-help">No custom overrides configured.</small>
        )}
        <div className="override-add">
          <label>Material
            <select
              value={newOverrideName}
              onChange={(e) => {
                const next = e.target.value;
                if (next === "__custom__") {
                  setCustomMode(true);
                  setNewOverrideName("__custom__");
                } else {
                  setCustomMode(false);
                  setNewOverrideName(next);
                }
              }}
            >
              <option value="">Choose a material…</option>
              {remainingMaterialOptions.map((material) => (
                <option key={material.id} value={material.name}>{material.name} · {material.baseUnit ?? material.unit}</option>
              ))}
              <option value="__custom__">Custom material name…</option>
            </select>
          </label>
          {customMode ? (
            <label>Custom material name<input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Acrylic Premium" /></label>
          ) : null}
          <NumericField label="Override price (ETB per unit)" value={newOverridePrice} onChange={setNewOverridePrice} suffix="ETB" min={0} step="0.01" />
          <Button type="button" variant="secondary" onClick={addOverride}><Plus size={15} />Add override</Button>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head"><Settings2 size={17} /><div><strong>Production Engine Rules</strong><span>Drives automatic ink deduction and waste/offcut thresholds.</span></div></div>
        <div className="settings-grid">
          <NumericField label="Ink Consumption Rate" value={inkMlPerSquareMetre} onChange={setInkMlPerSquareMetre} suffix="mL / m²" min={0} step="0.1" hint="Applied per square metre of printed area." />
          <NumericField label="Max Allowed Waste Rate" value={maxAllowedWastePercent} onChange={setMaxAllowedWastePercent} suffix="%" min={0} max={100} step="0.1" hint="Operator reports above this level flag for review." />
          <NumericField label="Minimum Offcut Registration Size" value={minOffcutAreaSquareMetre} onChange={setMinOffcutAreaSquareMetre} suffix="m²" min={0} step="0.01" hint="Offcuts smaller than this are not tracked." />
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head"><ShieldAlert size={17} /><div><strong>Risk & Theft Prevention Controls</strong><span>Direct exception stock-outs are the largest leakage vector — tighten as needed.</span></div></div>
        <label className="toggle-row">
          <span className="toggle-label">
            <strong>Require admin PIN reference for direct exception stock-outs</strong>
            <small>Forces the operator to record an authorization note on every direct stock-out.</small>
          </span>
          <input
            type="checkbox"
            checked={requireAdminPinForExceptions}
            onChange={(event) => setRequireAdminPinForExceptions(event.target.checked)}
          />
        </label>
        <NumericField label="Max ETB Limit for direct stock-outs without approval" value={maxDirectStockOutEtb} onChange={setMaxDirectStockOutEtb} suffix="ETB" min={0} step="1" hint="Above this ETB value, direct stock-outs must be approved before they can be recorded." />
      </section>

      <div className="settings-actions">
        <Button variant="primary" type="submit" disabled={busy}><Save size={15} />{busy ? "Saving…" : "Save operational configuration"}</Button>
        {message ? <p className="form-message">{message}</p> : null}
      </div>
    </form>
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