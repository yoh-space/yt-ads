"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { roleLabels, type Profile } from "@/lib/operations-types";
import { initials } from "./helpers";
import { cn } from "@/lib/utils";

export function UserMenu({ profile, onOpenSettings }: { profile: Profile | null; onOpenSettings: () => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [open]);

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  const role = profile?.role ?? "storekeeper";
  return (
    <div className="relative" ref={wrapRef}>
      <button
        className="flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-lg transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-navy text-white text-xs font-bold tracking-wide">
          {profile ? initials(profile.name) : "··"}
        </span>
        <span className="hidden sm:block text-left leading-tight">
          <strong className="block text-xs font-semibold text-navy">{profile?.name ?? "Team member"}</strong>
          <small className="block text-[10px] text-gray-500">{roleLabels[role].en}</small>
        </span>
        <ChevronDown
          size={15}
          className={cn("text-gray-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-xl bg-white border border-line shadow-custom p-1.5 animate-[mcSlideIn_0.15s_ease-out]"
          role="menu"
        >
          <div className="px-3 py-2.5 border-b border-line mb-1.5">
            <div className="text-sm font-semibold text-navy truncate">{profile?.name ?? "Team member"}</div>
            <div className="text-xs text-gray-500 truncate">{profile?.email ?? roleLabels[role].en}</div>
          </div>

          {profile ? (
            <button
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-cyan/5"
              onClick={() => { onOpenSettings(); setOpen(false); }}
              role="menuitem"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan/10 text-cyan flex-none">
                <Settings size={15} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-navy">Settings</span>
                <small className="block text-xs text-gray-500">Profile, security & workspace</small>
              </span>
            </button>
          ) : null}

          <button
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-coral/5"
            onClick={signOut}
            role="menuitem"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-coral/10 text-coral flex-none">
              <LogOut size={15} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-coral">Sign out</span>
              <small className="block text-xs text-gray-500">End your session</small>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}