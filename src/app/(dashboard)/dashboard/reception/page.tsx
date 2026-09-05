"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import ReceptionWorkspace from "@/components/dashboard/reception/reception-workspace";

export default function ReceptionDashboardPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const ordersQuery = useQuery(api.orders.list, profile?.active ? {} : "skip");

  if (!profile || ordersQuery === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading Reception Order Desk…" />
      </div>
    );
  }

  return <ReceptionWorkspace profile={profile} ordersQuery={ordersQuery} />;
}
