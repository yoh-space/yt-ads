"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Eye, EyeOff, Link2, Shield, ShieldCheck } from "lucide-react";
import { Button, Input, StatusPill } from "@/components/shared/ui";
import { FieldLabel, FormMessage, FormSection } from "../chrome/form";
import { formatSessionTime, messageToneFromText, summariseSessionUserAgent } from "./security-utils";

type SessionRecord = {
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: Date;
  expiresAt?: Date;
};

/**
 * Password + linked-account management for the signed-in user. Owners get an
 * additional "Active sessions" card for revoking browser sessions via the auth
 * client.
 */
export function SecurityPanel({ isOwner = false }: { isOwner?: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState("");

  useEffect(() => {
    if (!isOwner) return;
    void loadSessions();
  }, [isOwner]);

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
      const result = await authClient.linkSocial({
        provider: "google",
        callbackURL: window.location.href,
      });
      if (result.error) throw new Error(result.error.message ?? "Unable to start Google linking.");
      if (result.data?.url) window.location.assign(result.data.url);
      else setMessage("Google linking started.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google linking is not configured yet.");
      setBusy(false);
    }
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      <FormSection icon={<ShieldCheck size={17} />} title="Change password" note="Keep your account secure.">
        <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Current password</FieldLabel>
            <div className="relative">
              <Input
                required
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((value) => !value)}
                aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                aria-pressed={showCurrentPassword}
                className="absolute inset-y-0 right-0 grid w-9 place-items-center rounded-r-md text-muted-foreground transition-colors hover:text-cyan-dark focus:outline-none focus-visible:text-cyan-dark"
              >
                {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <FieldLabel>New password</FieldLabel>
            <div className="relative">
              <Input
                required
                minLength={8}
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((value) => !value)}
                aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                aria-pressed={showNewPassword}
                className="absolute inset-y-0 right-0 grid w-9 place-items-center rounded-r-md text-muted-foreground transition-colors hover:text-cyan-dark focus:outline-none focus-visible:text-cyan-dark"
              >
                {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button variant="secondary" type="submit" disabled={busy}>
              Change password
            </Button>
            {message ? (
              <FormMessage tone={messageToneFromText(message)}>{message}</FormMessage>
            ) : null}
          </div>
        </form>
      </FormSection>

      <FormSection icon={<Link2 size={17} />} title="Linked accounts" note="Connect third-party sign-in providers.">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-navy/20 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-white/5 text-blue shadow-sm ring-1 ring-border">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-label="Google">
                <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.12-6.73-4.96H1.28v3.1A12 12 0 0 0 12 24Z" />
                <path fill="#FBBC05" d="M5.27 14.28a7.21 7.21 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l3.99-3.1Z" />
                <path fill="#EA4335" d="M12 4.76c1.76 0 3.35.6 4.6 1.8l3.42-3.42A12 12 0 0 0 1.28 6.62l3.99 3.1C6.22 6.88 8.87 4.76 12 4.76Z" />
              </svg>
            </span>
            <div>
              <strong className="block text-sm font-semibold text-foreground">Google</strong>
              <small className="block text-xs text-muted-foreground">Sign in and link with a Google account.</small>
            </div>
          </div>
          <Button variant="secondary" type="button" onClick={linkGoogle} disabled={busy}>
            <Link2 size={15} />
            Attach Google account
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Google OAuth must be configured in the Convex deployment before linking is available.
        </p>
      </FormSection>

      {isOwner ? (
        <FormSection
          icon={<Shield size={17} />}
          tone="navy"
          title="Active sessions"
          note="Owner-only: review and revoke sign-in sessions."
        >
          {sessions === null ? (
            <div className="rounded-lg border border-dashed border-border bg-white/[0.02] px-4 py-8 text-center text-xs text-muted-foreground">
              Loading sessions…
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-white/[0.02] px-4 py-8 text-center text-xs text-muted-foreground">
              No active sessions found.
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const isCurrent = session.token === currentToken;
                return (
                  <div
                    key={session.token}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-navy/20 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="truncate text-sm font-semibold text-foreground">
                          {summariseSessionUserAgent(session.userAgent)}
                        </strong>
                        <StatusPill variant={isCurrent ? "success" : "info"}>{isCurrent ? "Current" : "Active"}</StatusPill>
                      </div>
                      <small className="mt-0.5 block text-xs text-muted-foreground">
                        IP {session.ipAddress ?? "unknown"} · signed in {formatSessionTime(session.createdAt)}
                        {session.expiresAt ? ` · expires ${formatSessionTime(session.expiresAt)}` : ""}
                      </small>
                    </div>
                    {!isCurrent ? (
                      <Button
                        size="tiny"
                        variant="secondary"
                        type="button"
                        onClick={() => void revokeSession(session.token)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {sessionMessage ? (
            <div className="mt-4">
              <FormMessage tone={messageToneFromText(sessionMessage)}>{sessionMessage}</FormMessage>
            </div>
          ) : null}
        </FormSection>
      ) : null}
    </div>
  );
}
