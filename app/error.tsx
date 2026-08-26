"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, LogIn } from "lucide-react";
import { DashboardAccessDenied } from "@/components/dashboard/access-denied";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const authenticationFailure = /unauthenticated|not authenticated|no session/i.test(error.message);
  const accessFailure = /active team profile|unauthorized|permission.*required|not permitted/i.test(error.message);

  useEffect(() => {
    console.error("Workspace failed to load:", error);
    if (authenticationFailure) window.location.href = "/sign-in";
  }, [authenticationFailure, error]);

  if (accessFailure) return <DashboardAccessDenied reason="Your account does not have access to this workspace action or view." />;

  return (
    <div
      role="alert"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#0b1020",
        color: "#e7ecf5",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
          background: "#121a30",
          border: "1px solid #243049",
          borderRadius: 16,
          padding: "32px 28px",
        }}
      >
        <div style={{ color: "#f5b14c", display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <AlertTriangle size={30} />
        </div>
        <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Unable to load the workspace</h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: "#aab4c5", margin: "0 0 20px" }}>
          The dashboard hit a problem while loading. This usually clears after signing in again or retrying.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            className="button primary"
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: "#3b82f6",
              color: "white",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={16} />
            Try again
          </button>
          <a
            href="/sign-in"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #334155",
              background: "transparent",
              color: "#e7ecf5",
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            <LogIn size={16} />
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
