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
      className="min-h-screen flex items-center justify-center p-6 bg-[#0C0D10] text-[#D4D4D4] font-mono"
    >
      <div className="max-w-[420px] w-full text-center bg-[#121316] border border-white/[0.08] rounded-sm p-8 shadow-2xl space-y-4">
        <div className="text-[#E5C07B] flex justify-center mb-2">
          <AlertTriangle size={28} />
        </div>
        <span className="text-[10px] text-[#E5C07B] font-bold uppercase tracking-[0.2em] block">
          SYSTEM NOTICE · የስርዓት ማሳሰቢያ
        </span>
        <h1 className="text-base font-semibold text-neutral-100 uppercase tracking-wider">
          Unable to load the workspace
        </h1>
        <p className="text-xs leading-relaxed text-neutral-400">
          The dashboard encountered an error while loading. This usually clears after signing in again or retrying.
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#E5C07B] hover:bg-[#d8b067] text-[#0C0D10] font-mono text-xs font-bold uppercase tracking-wider rounded-sm transition-colors"
          >
            <RefreshCw size={13} />
            <span>Try again</span>
          </button>
          <a
            href="/sign-in"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-sm border border-white/[0.1] bg-[#17181D] hover:bg-[#1E2026] text-neutral-200 text-xs font-mono transition-colors"
          >
            <LogIn size={13} />
            <span>Sign in</span>
          </a>
        </div>
      </div>
    </div>
  );
}
