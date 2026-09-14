import type { Role } from "./operations-types";
import { isValidRole } from "./role-routing";

/**
 * Session-bound role routing hint cookie.
 *
 * The browser stores the resolved role as `"{role}:{sessionFingerprint}"` so the
 * hint can only be reused while the SAME Better Auth session is active. When a
 * different account signs in (a brand-new session token is minted), the
 * fingerprint no longer matches and the edge proxy re-resolves the role from
 * Convex instead of routing the new account with the previous account's cached
 * role.
 *
 * This is a routing hint only — Convex remains the authorization boundary for
 * every business operation.
 */

export const ROLE_COOKIE_NAME = "user_role";

/** Max-age in seconds (1 hour) — short TTL keeps stale hints short-lived. */
export const ROLE_COOKIE_MAX_AGE = 60 * 60;

export const ROLE_COOKIE_PATH = "/";

/**
 * Stable, dependency-free fingerprint of a Better Auth session token.
 *
 * Used exclusively to invalidate the role routing cache when the session
 * changes. It is NOT a security primitive and the raw token is never stored in
 * the cookie — it is a cheap "is this still the same session?" check.
 */
export function fingerprintSession(token: string): string {
  let hash = 2166136261; // FNV-1a offset basis (32-bit)
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = (hash * 16777619) & 0xffffffff;
  }
  return (hash & 0x7fffffff).toString(16);
}

/** Encodes the role hint cookie value: `"{role}:{fingerprint}"`. */
export function encodeRoleCookie(role: Role, fingerprint: string): string {
  return `${role}:${fingerprint}`;
}

export interface RoleCookieCache {
  role: Role;
  fingerprint: string;
}

/**
 * Decodes a role hint cookie value.
 *
 * Returns null for missing, malformed, or legacy plain `"{role}"` values so the
 * caller always falls back to resolving the role from Convex for the current
 * session.
 */
export function decodeRoleCookie(value: string | undefined): RoleCookieCache | null {
  if (!value) return null;
  const sep = value.lastIndexOf(":");
  if (sep <= 0 || sep === value.length - 1) return null;
  const role = value.slice(0, sep);
  const fingerprint = value.slice(sep + 1);
  if (!isValidRole(role)) return null;
  if (fingerprint.length === 0 || !/^[0-9a-f]+$/i.test(fingerprint)) return null;
  return { role, fingerprint };
}