"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DashboardAccessDenied } from "@/components/dashboard/access-denied";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { OperationalConfigView } from "@/components/dashboard/views/operational-config";

export default function WorkspaceOperationalConfigPage() {
  const profile = useQuery(api.users.getCurrentProfile);

  if (!profile) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading configuration…" />
      </div>
    );
  }

  if (!profile.active || (profile.role !== "owner" && profile.role !== "admin")) {
    return <DashboardAccessDenied reason="Operational configuration is available to owners and admins only." />;
  }

  return <OperationalConfigView />;
}
