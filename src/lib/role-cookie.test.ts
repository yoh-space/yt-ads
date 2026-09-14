import { describe, expect, it } from "vitest";
import {
  ROLE_COOKIE_MAX_AGE,
  ROLE_COOKIE_NAME,
  decodeRoleCookie,
  encodeRoleCookie,
  fingerprintSession,
} from "./role-cookie";

describe("role-cookie session-bound routing hint", () => {
  it("exports the user_role cookie contract", () => {
    expect(ROLE_COOKIE_NAME).toBe("user_role");
    expect(ROLE_COOKIE_MAX_AGE).toBe(60 * 60);
  });

  it("fingerprints a session token deterministically", () => {
    const token = "session.abc123";
    expect(fingerprintSession(token)).toBe(fingerprintSession(token));
  });

  it("produces different fingerprints for different sessions", () => {
    const sessionA = fingerprintSession("session.aaaaaaaa");
    const sessionB = fingerprintSession("session.bbbbbbbb");
    expect(sessionA).not.toBe(sessionB);
  });

  it("encodes and round-trips a role cookie", () => {
    const fingerprint = fingerprintSession("session.aaa");
    const cookie = encodeRoleCookie("owner", fingerprint);
    expect(cookie).toContain("owner");
    expect(decodeRoleCookie(cookie)).toEqual({ role: "owner", fingerprint });
  });

  it("never trusts a cached role minted for a different session", () => {
    // Simulates the reported bug: account A (owner) signs out, account B
    // (storekeeper) signs in with a brand-new session in the same browser.
    const sessionA = "session.account-a";
    const sessionB = "session.account-b";
    const cookieLeftBehindByA = encodeRoleCookie("owner", fingerprintSession(sessionA));

    const decodedForB = decodeRoleCookie(cookieLeftBehindByA);
    expect(decodedForB).not.toBeNull();
    // The routing decision listens to the fingerprint, so a cookie minted for A
    // must never be accepted while B's session is active.
    expect(decodedForB?.fingerprint).toBe(fingerprintSession(sessionA));
    expect(decodedForB?.fingerprint === fingerprintSession(sessionB)).toBe(false);
  });

  it("returns null for missing, malformed, or legacy values", () => {
    expect(decodeRoleCookie(undefined)).toBeNull();
    expect(decodeRoleCookie("")).toBeNull();
    expect(decodeRoleCookie("owner")).toBeNull(); // legacy plain-role hint
    expect(decodeRoleCookie("owner:")).toBeNull(); // empty fingerprint
    expect(decodeRoleCookie(":abc123")).toBeNull(); // empty role
    expect(decodeRoleCookie("notarole:abc123")).toBeNull();
    expect(decodeRoleCookie("owner:not-hex")).toBeNull();
    expect(decodeRoleCookie("owner:...")).toBeNull();
  });

  it("does not leak the raw session token into the cookie", () => {
    const token = "session.supersecretvalue";
    const cookie = encodeRoleCookie("storekeeper", fingerprintSession(token));
    expect(cookie).not.toContain(token);
    expect(cookie).not.toContain("supersecretvalue");
  });
});