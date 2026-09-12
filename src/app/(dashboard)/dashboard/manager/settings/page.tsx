"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SettingsView } from "@/components/dashboard/roles/admin/settings";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";

export default function ManagerSettingsPage() {
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
      <WorkspacePageHeader
        kicker="Workspace Configuration"
        title="System & Account Settings"
      />
      <SettingsView profile={resolvedProfile} />
    </div>
  );
}