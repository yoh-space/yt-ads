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
  Clock3,
} from "lucide-react";
import type { SettingsCategory } from "../nav-config";
import { Button, Input, Select, StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";
import { initials } from "../helpers";

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* ── Settings Sidebar ─────────────────────────────── */}
          <aside className="space-y-6">
            <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
              {/* Header band */}
              <div className="relative bg-navy p-5">
                <div className="absolute inset-0 bg-[radial-gradient(420px_160px_at_110%_-40%,rgba(25,196,210,0.35),transparent_65%)]" />
                <div className="relative flex items-center gap-3">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-cyan text-navy shadow-[0_8px_20px_rgba(25,196,210,0.35)]">
                    <Settings2 size={18} />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-bold text-white">Settings</h3>
                    <p className="text-[11px] text-cyan-100/80">Manage account & workspace</p>
                  </div>
                </div>
              </div>

              {/* Tab list */}
              <nav className="space-y-1 p-3">
                {categories.map((category) => {
                  const isActive = activeCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      className={cn(
                        "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
                        isActive
                          ? "bg-navy text-white shadow-[0_10px_24px_rgba(0,46,75,0.28)]"
                          : "text-gray-700 hover:bg-gray-50"
                      )}
                      onClick={() => setActiveCategory(category.id)}
                    >
                      {isActive ? (
                        <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-cyan shadow-[0_0_10px_rgba(25,196,210,0.8)]" />
                      ) : null}

                      <span
                        className={cn(
                          "grid h-9 w-9 flex-none place-items-center rounded-lg transition-colors duration-200",
                          isActive
                            ? "bg-cyan text-navy"
                            : "bg-gray-100 text-gray-500 group-hover:bg-cyan/10 group-hover:text-cyan-dark"
                        )}
                      >
                        {category.icon}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-semibold">{category.title}</span>
                          {category.badge ? (
                            <span
                              className={cn(
                                "flex-none rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                isActive ? "bg-white/20 text-cyan" : "bg-navy/10 text-navy"
                              )}
                            >
                              {category.badge}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block truncate text-[11px]",
                            isActive ? "text-cyan-100/80" : "text-gray-500"
                          )}
                        >
                          {category.description}
                        </span>
                      </span>

                      <ChevronRight
                        size={15}
                        className={cn("flex-none transition-colors", isActive ? "text-cyan" : "text-gray-300")}
                      />
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* ── Settings Content ─────────────────────────────── */}
          <div className="space-y-6">
            <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-cyan/10 text-cyan-dark">
                    {selected.icon}
                  </span>
                  <div>
                    <span className="block text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-cyan-dark">
                      Settings / {selected.title}
                    </span>
                    <h2 className="mt-1 text-xl font-bold text-navy">{selected.title}</h2>
                    <p className="mt-1 text-sm text-gray-600">{selected.description}</p>
                  </div>
                </div>
                {selected.badge ? (
                  <span className="flex-none rounded-full bg-navy px-3 py-1 text-[11px] font-semibold text-white">
                    {selected.badge}
                  </span>
                ) : null}
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

/* ──────── Shared panel chrome ──────── */
type Tone = "cyan" | "gold" | "blue" | "coral" | "navy";

const toneTile: Record<Tone, string> = {
  cyan: "bg-cyan/10 text-cyan-dark",
  gold: "bg-gold/10 text-gold",
  blue: "bg-blue/10 text-blue",
  coral: "bg-coral/10 text-coral",
  navy: "bg-navy/10 text-navy",
};

function FormSection({
  icon,
  tone = "cyan",
  title,
  note,
  children,
}: {
  icon: React.ReactNode;
  tone?: Tone;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className={cn("grid h-9 w-9 flex-none place-items-center rounded-lg", toneTile[tone])}>
          {icon}
        </span>
        <div className="min-w-0">
          <strong className="block text-sm font-bold text-navy">{title}</strong>
          <span className="mt-0.5 block text-xs text-gray-500">{note}</span>
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-xs font-semibold text-navy">{children}</span>;
}

function FormMessage({ children, tone = "success" }: { children: React.ReactNode; tone?: "success" | "error" }) {
  return (
    <p
      className={cn(
        "rounded-lg border px-3.5 py-2.5 text-xs font-medium",
        tone === "success"
          ? "border-green/20 bg-green/10 text-green"
          : "border-coral/20 bg-coral/10 text-coral"
      )}
    >
      {children}
    </p>
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
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      {/* Profile Preview */}
      <div className="border-b border-line bg-gray-50/70 p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-full bg-gradient-to-br from-navy to-navy-2 text-xl font-bold text-white ring-2 ring-cyan/30">
            {profile.image ? (
              <img src={profile.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{profile.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold text-navy">{profile.name}</div>
            <div className="text-sm text-gray-600">{profile.email}</div>
            <span className="mt-2 inline-flex rounded-full bg-cyan/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-dark">
              {profile.role.replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="p-5 sm:p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-cyan/10 text-cyan-dark">
            <UserRound size={17} />
          </span>
          <div>
            <div className="text-sm font-bold text-navy">Profile information</div>
            <div className="text-xs text-gray-500">{profile.email}</div>
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <FieldLabel>Display name</FieldLabel>
            <Input required value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
          </div>

          <div>
            <FieldLabel>Profile image URL</FieldLabel>
            <Input placeholder="Optional image URL" value={image} onChange={(e) => setImage(e.target.value)} className="w-full" />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button variant="primary" type="submit" disabled={busy} className="inline-flex items-center gap-2">
              <Save size={15} />
              Save profile
            </Button>
            {message ? <FormMessage>{message}</FormMessage> : null}
          </div>
        </form>
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
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <FormSection icon={<ShieldCheck size={17} />} title="Change password" note="Keep your account secure.">
        <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Current password</FieldLabel>
            <Input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <FieldLabel>New password</FieldLabel>
            <Input required minLength={8} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button variant="secondary" type="submit" disabled={busy}>
              Change password
            </Button>
            {message ? <FormMessage tone={message.includes("Unable") ? "error" : "success"}>{message}</FormMessage> : null}
          </div>
        </form>
      </FormSection>

      <FormSection icon={<Link2 size={17} />} title="Linked accounts" note="Connect third-party sign-in providers.">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-gray-50/60 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-white text-blue shadow-sm ring-1 ring-line">
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.12-6.73-4.96H1.28v3.1A12 12 0 0 0 12 24Z" />
                <path fill="#FBBC05" d="M5.27 14.28a7.21 7.21 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l3.99-3.1Z" />
                <path fill="#EA4335" d="M12 4.76c1.76 0 3.35.6 4.6 1.8l3.42-3.42A12 12 0 0 0 1.28 6.62l3.99 3.1C6.22 6.88 8.87 4.76 12 4.76Z" />
              </svg>
            </span>
            <div>
              <strong className="block text-sm font-semibold text-navy">Google</strong>
              <small className="block text-xs text-gray-500">Sign in and link with a Google account.</small>
            </div>
          </div>
          <Button variant="secondary" type="button" onClick={linkGoogle} disabled={busy}>
            <Link2 size={15} />
            Attach Google account
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-gray-500">
          Google OAuth must be configured in the Convex deployment before linking is available.
        </p>
      </FormSection>

      {isOwner ? (
        <FormSection icon={<Shield size={17} />} tone="navy" title="Active sessions" note="Owner-only: review and revoke sign-in sessions.">
          {sessions === null ? (
            <div className="rounded-lg border border-dashed border-line bg-gray-50/50 px-4 py-8 text-center text-xs text-gray-500">
              Loading sessions…
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-gray-50/50 px-4 py-8 text-center text-xs text-gray-500">
              No active sessions found.
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const isCurrent = session.token === currentToken;
                return (
                  <div key={session.token} className="flex items-center justify-between gap-4 rounded-lg border border-line bg-gray-50/60 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="truncate text-sm font-semibold text-navy">{sessionSummary(session.userAgent)}</strong>
                        <StatusPill variant={isCurrent ? "success" : "info"}>{isCurrent ? "Current" : "Active"}</StatusPill>
                      </div>
                      <small className="mt-0.5 block text-xs text-gray-500">
                        IP {session.ipAddress ?? "unknown"} · signed in {formatSessionTime(session.createdAt)}
                        {session.expiresAt ? ` · expires ${formatSessionTime(session.expiresAt)}` : ""}
                      </small>
                    </div>
                    {!isCurrent ? (
                      <Button size="tiny" variant="secondary" type="button" onClick={() => void revokeSession(session.token)}>
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {sessionMessage ? <div className="mt-4"><FormMessage tone={sessionMessage.includes("Unable") ? "error" : "success"}>{sessionMessage}</FormMessage></div> : null}
        </FormSection>
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

  const roleTone: Record<Role, "success" | "info" | "warning" | "neutral"> = {
    owner: "warning",
    manager: "info",
    admin: "info",
    storekeeper: "neutral",
    laser_operator: "neutral",
    cnc_operator: "neutral",
    plotter_operator: "neutral",
    printer_operator: "neutral",
  };

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
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <FormSection icon={<Users size={17} />} tone="navy" title="Team members" note={isOwner ? "Owner can delegate role management to a manager." : "Manage operational roles within your delegation."}>
        <div className="space-y-2">
          {users?.map((user) => {
            const isSelf = user.authUserId === profile.authUserId;
            const cannotDemote = user.role === "owner" && !isOwner;
            return (
              <div key={user._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-gray-50/60 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-gradient-to-br from-navy to-navy-2 text-xs font-bold text-white">
                    {initials(user.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="truncate text-sm font-semibold text-navy">{user.name}</strong>
                      {isSelf ? <StatusPill variant="success">You</StatusPill> : null}
                    </div>
                    <small className="block truncate text-xs text-gray-500">{user.email}</small>
                  </div>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <StatusPill variant={roleTone[user.role]}>{roleLabels[user.role].en}</StatusPill>
                  <Select
                    value={user.role}
                    className="w-32"
                    disabled={cannotDemote}
                    onChange={(e) => void changeRole(user._id, e.target.value as Role)}
                  >
                    {roleOptions.map((option) => (
                      <option key={option} value={option} disabled={option === "owner" && !isOwner}>
                        {roleLabels[option].en}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="tiny"
                    variant="secondary"
                    type="button"
                    disabled={isSelf}
                    onClick={() => void changeActive(user._id, !user.active)}
                  >
                    {user.active ? "Revoke" : "Activate"}
                  </Button>
                </div>
              </div>
            );
          })}
          {users?.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-gray-50/50 px-4 py-8 text-center text-xs text-gray-500">
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
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <FormSection icon={<Building2 size={17} />} tone="blue" title="Company branding" note="Owner-only workspace settings.">
        <form onSubmit={saveCompany} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Company name</FieldLabel>
              <Input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Logo URL</FieldLabel>
              <Input placeholder="Optional logo image URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            </div>
          </div>
          {logoUrl.trim() ? (
            <div className="flex items-center gap-3 rounded-lg border border-line bg-gray-50/60 px-4 py-3">
              <span className="grid h-11 w-11 flex-none place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-line">
                <img src={logoUrl} alt="Company logo preview" className="h-full w-full object-cover" />
              </span>
              <div>
                <strong className="block text-sm font-semibold text-navy">Logo preview</strong>
                <small className="block text-xs text-gray-500">Applied to the dashboard sidebar and header.</small>
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <Button variant="primary" type="submit" disabled={busy}>
              <Save size={15} />
              Save company settings
            </Button>
            {message ? <FormMessage tone={message.includes("Unable") ? "error" : "success"}>{message}</FormMessage> : null}
          </div>
        </form>
      </FormSection>
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
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-navy">{label}</span>
        {suffix ? (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">{suffix}</span>
        ) : null}
      </span>
      <Input
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
        className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {hint ? <small className="mt-1.5 block text-[11px] text-gray-500">{hint}</small> : null}
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
  const [orderExpirationHours, setOrderExpirationHours] = useState(12);
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
    setOrderExpirationHours(config.orderExpirationHours ?? 12);
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
        orderExpirationHours,
      });
      setMessage("Operational configuration saved. Production & valuation will use the new rates on the next record.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save operational configuration.");
    } finally {
      setBusy(false);
    }
  }

  if (config === undefined || state === undefined) {
    return (
      <div className="rounded-xl border border-line bg-white p-10 text-center shadow-sm">
        <p className="text-xs text-gray-500">Loading configuration…</p>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <FormSection icon={<CircleDollarSign size={17} />} tone="gold" title="ETB Valuation Rates" note="Used by reconciliation & loss calculations when a material has no explicit price.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <NumericField label="Price per m²" value={etbPerSquareMetre} onChange={setEtbPerSquareMetre} suffix="ETB" min={0} step="0.01" hint="Area materials (banner, vinyl, acrylic, foam, …)" />
          <NumericField label="Price per litre" value={etbPerLitre} onChange={setEtbPerLitre} suffix="ETB" min={0} step="0.01" hint="Ink materials" />
          <NumericField label="Price per piece" value={etbPerPiece} onChange={setEtbPerPiece} suffix="ETB" min={0} step="0.01" hint="Unit hardware (LEDs, electrical parts)" />
          <NumericField label="Price per metre" value={etbPerMetre} onChange={setEtbPerMetre} suffix="ETB" min={0} step="0.01" hint="Linear roll materials" />
          <NumericField label="Price per sheet" value={etbPerSheet} onChange={setEtbPerSheet} suffix="ETB" min={0} step="0.01" hint="Rigid sheet materials" />
        </div>
      </FormSection>

      <FormSection icon={<Cog size={17} />} tone="cyan" title="Individual Material Custom Price Overrides" note="Override the unit rate for high-value materials.">
        {overrides.length > 0 ? (
          <div className="space-y-2">
            {overrides.map((row) => (
              <div key={row.materialName} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-gray-50/60 px-4 py-3">
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-semibold text-navy">{row.materialName}</strong>
                  <small className="block text-[11px] text-gray-500">Custom valuation rate</small>
                </div>
                <div className="flex flex-none items-center gap-3">
                  <b className="font-mono text-sm font-semibold text-navy">{row.etbValue.toLocaleString("en-US")} ETB</b>
                  <button
                    type="button"
                    className="grid h-7 w-7 place-items-center rounded-md border border-line text-gray-400 transition-colors hover:border-coral/30 hover:bg-coral/10 hover:text-coral"
                    onClick={() => removeOverride(row.materialName)}
                    aria-label={`Remove override for ${row.materialName}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-line bg-gray-50/50 px-4 py-6 text-center text-xs text-gray-500">
            No custom overrides configured.
          </p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <FieldLabel>Material</FieldLabel>
            <Select
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
            </Select>
          </div>
          {customMode ? (
            <div>
              <FieldLabel>Custom material name</FieldLabel>
              <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Acrylic Premium" />
            </div>
          ) : null}
          <NumericField label="Override price (ETB per unit)" value={newOverridePrice} onChange={setNewOverridePrice} suffix="ETB" min={0} step="0.01" />
          <div className="flex items-end">
            <Button type="button" variant="secondary" className="w-full" onClick={addOverride}>
              <Plus size={15} />
              Add override
            </Button>
          </div>
        </div>
      </FormSection>

      <FormSection icon={<Settings2 size={17} />} tone="blue" title="Production Engine Rules" note="Drives automatic ink deduction and waste/offcut thresholds.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <NumericField label="Ink Consumption Rate" value={inkMlPerSquareMetre} onChange={setInkMlPerSquareMetre} suffix="mL / m²" min={0} step="0.1" hint="Applied per square metre of printed area." />
          <NumericField label="Max Allowed Waste Rate" value={maxAllowedWastePercent} onChange={setMaxAllowedWastePercent} suffix="%" min={0} max={100} step="0.1" hint="Operator reports above this level flag for review." />
          <NumericField label="Minimum Offcut Registration Size" value={minOffcutAreaSquareMetre} onChange={setMinOffcutAreaSquareMetre} suffix="m²" min={0} step="0.01" hint="Offcuts smaller than this are not tracked." />
        </div>
      </FormSection>

      <FormSection icon={<Clock3 size={17} />} tone="navy" title="Order Management Settings" note="Configure automated order expiration and customer notifications.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <NumericField label="Order Expiration Window" value={orderExpirationHours} onChange={setOrderExpirationHours} suffix="hours" min={1} max={168} step={1} hint="Unpaid/unconfirmed orders auto-expire after this period." />
        </div>
        <p className="mt-3 text-[11px] text-gray-500">
          Orders submitted via Telegram Mini App will automatically expire if not confirmed within this window. Customers receive an Amharic notification when their order expires.
        </p>
      </FormSection>

      <FormSection icon={<ShieldAlert size={17} />} tone="coral" title="Risk & Theft Prevention Controls" note="Direct exception stock-outs are the largest leakage vector — tighten as needed.">
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-4 rounded-lg border border-line bg-gray-50/60 px-4 py-3.5">
            <span className="min-w-0">
              <strong className="block text-sm font-semibold text-navy">Require admin PIN reference for direct exception stock-outs</strong>
              <small className="mt-0.5 block text-xs text-gray-500">Forces the operator to record an authorization note on every direct stock-out.</small>
            </span>
            <input
              type="checkbox"
              className="peer sr-only"
              checked={requireAdminPinForExceptions}
              onChange={(event) => setRequireAdminPinForExceptions(event.target.checked)}
            />
            <span className="relative h-6 w-11 flex-none cursor-pointer rounded-full bg-gray-300 transition-colors peer-checked:bg-cyan after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
          </label>
          <NumericField label="Max ETB Limit for direct stock-outs without approval" value={maxDirectStockOutEtb} onChange={setMaxDirectStockOutEtb} suffix="ETB" min={0} step="1" hint="Above this ETB value, direct stock-outs must be approved before they can be recorded." />
        </div>
      </FormSection>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/70 px-5 py-4 sm:px-6">
        <p className="text-[11px] text-gray-500">
          Owner-only configuration · applied transactionally on the next production record.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {message ? <FormMessage tone={message.includes("Unable") ? "error" : "success"}>{message}</FormMessage> : null}
          <Button variant="primary" type="submit" disabled={busy}>
            <Save size={15} />
            {busy ? "Saving…" : "Save operational configuration"}
          </Button>
        </div>
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