"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, LogIn } from "lucide-react";
import { DashboardAccessDenied } from "@/components/dashboard/access-denied";
import { Button } from "@/components/ui";

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
      className="min-h-screen flex items-center justify-center p-6 bg-[#0b1020] text-[#e7ecf5] font-sans"
    >
      <div className="max-w-[420px] w-full text-center bg-[#121a30] border border-[#243049] rounded-2xl p-8">
        <div className="text-[#f5b14c] flex justify-center mb-3">
          <AlertTriangle size={30} />
        </div>
        <h1 className="text-xl font-semibold mb-2">Unable to load the workspace</h1>
        <p className="text-sm leading-relaxed text-[#aab4c5] mb-5">
          The dashboard hit a problem while loading. This usually clears after signing in again or retrying.
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            variant="primary"
            onClick={reset}
            className="bg-[#3b82f6] hover:bg-[#2563eb]"
          >
            <RefreshCw size={16} />
            Try again
          </Button>
          <a
            href="/sign-in"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#334155] bg-transparent text-[#e7ecf5] text-sm hover:bg-[#1e293b] transition-colors no-underline"
          >
            <LogIn size={16} />
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
