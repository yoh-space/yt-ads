"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import ManagerWorkspace from "@/components/dashboard/manager/manager-workspace";

export default function ManagerDashboardPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const state = useQuery(api.dashboard.getState, profile?.active ? {} : "skip");
  const orders = useQuery(api.orders.list, profile?.active ? {} : "skip");
  const kpis = useQuery(api.dashboard.getKpis, profile?.active ? {} : "skip");

  if (!profile || !state || orders === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading Operations Hub…" />
      </div>
    );
  }

  return (
    <ManagerWorkspace
      profile={{ role: "manager", active: profile.active }}
      state={state}
      orders={orders}
      kpis={kpis ?? undefined}
    />
  );
}
