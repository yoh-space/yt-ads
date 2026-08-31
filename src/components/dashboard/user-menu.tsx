"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { roleLabels, type Profile } from "@/lib/operations-types";
import { initials } from "./helpers";

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
    <div className="role-menu-wrap" ref={wrapRef} style={{ position: "relative" }}>
      <button className="role-menu" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="avatar">{profile ? initials(profile.name) : "··"}</span>
        <div>
          <strong>{profile?.name ?? "Team member"}</strong>
          <small>{roleLabels[role].en}</small>
        </div>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="role-popover">
          {profile ? (
            <button onClick={() => { onOpenSettings(); setOpen(false); }}>
              <Settings size={15} />
              <span>
                Settings
                <small>Profile, security & workspace</small>
              </span>
            </button>
          ) : null}
          <button className="role-popover-signout" onClick={signOut}>
            <LogOut size={15} />
            <span>
              Sign out
              <small>End your session</small>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
