"use client";

import { use, type ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { DashboardAccessDenied } from "@/components/dashboard/access-denied";
import {
  canAccessWorkspace,
  getRoleHomeRoute,
  isValidWorkspaceId,
  type WorkspaceId,
} from "@/lib/role-routing";

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const resolvedParams = use(params);
  const workspaceSegment = resolvedParams.workspace;

  if (!isValidWorkspaceId(workspaceSegment)) {
    notFound();
  }

  const profile = useQuery(api.users.getCurrentProfile);

  if (profile === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Resolving workspace access…" />
      </div>
    );
  }

  if (!profile || !profile.active) {
    return <DashboardAccessDenied />;
  }

  const hasAccess = canAccessWorkspace(profile.role, workspaceSegment as WorkspaceId);
  if (!hasAccess) {
    redirect(getRoleHomeRoute(profile.role));
  }

  return <>{children}</>;
}
