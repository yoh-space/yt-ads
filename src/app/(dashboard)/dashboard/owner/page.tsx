"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import OwnerWorkspace from "@/components/dashboard/owner/owner-workspace";

export default function OwnerDashboardPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const state = useQuery(api.dashboard.getState, profile?.active ? {} : "skip");
  const orders = useQuery(api.orders.list, profile?.active ? {} : "skip");
  const financialMetrics = useQuery(api.dashboard.financialMetrics, profile?.active ? {} : "skip");
  const kpis = useQuery(api.dashboard.getKpis, profile?.active ? {} : "skip");
  const reconciliationSummary = useQuery(api.reconciliation.summary, profile?.active ? {} : "skip");

  if (!profile || !state || orders === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading Owner Analytics & Control…" />
      </div>
    );
  }

  return (
    <OwnerWorkspace
      profile={{ role: profile.role === "admin" ? "admin" : "owner", active: profile.active }}
      state={state}
      orders={orders}
      financialMetrics={financialMetrics ?? undefined}
      kpis={kpis ?? undefined}
      reconciliationSummary={reconciliationSummary ?? undefined}
    />
  );
}
