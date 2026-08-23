"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { roleLabels, type Profile } from "@/lib/operations-types";
import { initials } from "./helpers";

export function UserMenu({ profile }: { profile: Profile | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  const role = profile?.role ?? "storekeeper";
  return (
    <div className="role-menu-wrap" style={{ position: "relative" }}>
      <button className="role-menu" onClick={() => setOpen((value) => !value)}>
        <span className="avatar">{profile ? initials(profile.name) : "··"}</span>
        <div>
          <strong>{profile?.name ?? "Team member"}</strong>
          <small>{roleLabels[role].en}</small>
        </div>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="role-popover" style={{ right: 0, bottom: 48 }}>
          <button onClick={signOut}>
            <LogOut size={15} />
            <span>
              Sign out
              <small>{roleLabels[role].am}</small>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
