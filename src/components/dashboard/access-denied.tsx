"use client";

import Link from "next/link";
import { ShieldAlert, ArrowLeft, LogIn } from "lucide-react";

export function DashboardAccessDenied({ reason = "Your profile is inactive or has not been linked to this workspace." }: { reason?: string }) {
  return (
    <main className="min-h-screen bg-[#0C0D10] text-[#D4D4D4] flex items-center justify-center p-4">
      <section className="max-w-md w-full bg-[#121316] border border-rose-500/30 rounded-sm p-7 text-center shadow-2xl space-y-4">
        <div className="w-12 h-12 mx-auto rounded-sm bg-rose-950/50 border border-rose-500/40 text-rose-400 grid place-items-center">
          <ShieldAlert size={24} />
        </div>
        <div>
          <span className="font-mono text-[10px] text-rose-400 font-bold uppercase tracking-[0.2em] block mb-1">
            ACCESS RESTRICTED · መዳረሻ ተከልክሏል
          </span>
          <h1 className="font-mono text-base font-semibold text-neutral-100 uppercase tracking-wider">
            Workspace Access Unavailable
          </h1>
        </div>
        <p className="font-sans text-xs text-neutral-400 leading-relaxed">
          {reason} Ask the owner (Yitbarek) or manager to activate and assign your staff profile before returning to operations.
        </p>
        <div className="pt-2 flex items-center justify-center gap-2">
          <Link
            href="/"
            className="flex-1 py-2 px-3 bg-[#17181D] hover:bg-[#1E2026] text-neutral-300 hover:text-white border border-white/[0.1] font-mono text-xs rounded-sm transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <ArrowLeft size={13} />
            <span>Homepage</span>
          </Link>
          <Link
            href="/sign-in"
            className="flex-1 py-2 px-3 bg-[#E5C07B] hover:bg-[#d8b067] text-[#0C0D10] font-mono text-xs font-bold uppercase tracking-wider rounded-sm transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <LogIn size={13} />
            <span>Sign In</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
