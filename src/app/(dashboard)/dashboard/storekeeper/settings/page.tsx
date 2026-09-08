"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SettingsView } from "@/components/dashboard/views/settings";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";

export default function StorekeeperSettingsPage() {
  const profile = useQuery(api.users.getCurrentProfile);

  if (!profile) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading Settings…" />
      </div>
    );
  }

  const resolvedProfile = { ...profile, id: profile._id };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#1E293B] pb-5">
        <span className="font-mono text-xs uppercase tracking-widest text-[#00B4D8]">
          Storekeeper Configuration
        </span>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-white">
          Profile & Security Settings
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Manage your account details, security preferences, and profile configuration.
        </p>
      </div>

      <SettingsView profile={resolvedProfile} />
    </div>
  );
}