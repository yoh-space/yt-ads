"use client";

import { use } from "react";
import { notFound, redirect } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { DashboardAccessDenied } from "@/components/dashboard/access-denied";
import OwnerWorkspace from "@/components/dashboard/owner/owner-workspace";
import ManagerWorkspace from "@/components/dashboard/manager/manager-workspace";
import ReceptionWorkspace from "@/components/dashboard/reception/reception-workspace";
import StorekeeperWorkspace from "@/components/dashboard/storekeeper/storekeeper-workspace";
import { ROLE_TO_MACHINE_MAP, isValidWorkspaceId, type WorkspaceId } from "@/lib/role-routing";

export default function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = use(params);
  if (!isValidWorkspaceId(workspace)) {
    notFound();
  }

  const profile = useQuery(api.users.getCurrentProfile);

  const isOwnerOrAdmin = workspace === "owner" || workspace === "admin";
  const isManager = workspace === "manager";
  const isReceptionist = workspace === "receptionist";

  const state = useQuery(
    api.dashboard.getState,
    profile?.active && (isOwnerOrAdmin || isManager) ? {} : "skip",
  );
  const orders = useQuery(
    api.orders.list,
    profile?.active && (isOwnerOrAdmin || isManager || isReceptionist) ? {} : "skip",
  );
  const financialMetrics = useQuery(
    api.dashboard.financialMetrics,
    profile?.active && isOwnerOrAdmin ? {} : "skip",
  );
  const kpis = useQuery(
    api.dashboard.getKpis,
    profile?.active && (isOwnerOrAdmin || isManager) ? {} : "skip",
  );
  const reconciliationSummary = useQuery(
    api.reconciliation.summary,
    profile?.active && isOwnerOrAdmin ? {} : "skip",
  );

  if (profile === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading Workspace Overview…" />
      </div>
    );
  }

  if (!profile || !profile.active) {
    return <DashboardAccessDenied />;
  }

  if (workspace === "operator") {
    const machine = ROLE_TO_MACHINE_MAP[profile.role] ?? "laser";
    redirect(`/dashboard/operator/${machine}`);
  }

  if (workspace === "storekeeper") {
    return <StorekeeperWorkspace />;
  }

  if (workspace === "receptionist") {
    if (orders === undefined) {
      return (
        <div className="flex min-h-[400px] items-center justify-center">
          <InventoryLoader label="Loading Reception Workspace…" />
        </div>
      );
    }
    return <ReceptionWorkspace profile={profile} ordersQuery={orders} />;
  }

  if (isManager) {
    if (!state || orders === undefined) {
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

  if (isOwnerOrAdmin) {
    if (!state || orders === undefined) {
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

  notFound();
}
