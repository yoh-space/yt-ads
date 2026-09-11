"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SettingsView } from "@/components/dashboard/roles/admin/settings";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";

export default function OperatorMachineSettingsPage() {
  const profile = useQuery(api.users.getCurrentProfile);

  if (!profile) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading Settings…" />
      </div>
    );
  }

  const resolvedProfile = { ...profile, id: profile._id };

  return <SettingsView profile={resolvedProfile} />;
}