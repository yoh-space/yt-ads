"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { getRoleHomeRoute, getWorkspaceForRole } from "@/lib/role-routing";
import { hasPermission } from "@/lib/permissions";

export default function LegacyReportsRedirectPage() {
  const router = useRouter();
  const profile = useQuery(api.users.getCurrentProfile);

  useEffect(() => {
    if (profile === undefined) return;
    if (!profile || !profile.active) {
      router.replace("/sign-in?redirect=/reports");
      return;
    }

    const canViewReports = hasPermission(profile.role, "reports.view");
    if (!canViewReports) {
      router.replace(getRoleHomeRoute(profile.role));
      return;
    }

    const workspace = getWorkspaceForRole(profile.role);
    router.replace(`/dashboard/${workspace}/reports`);
  }, [profile, router]);

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <InventoryLoader label="Redirecting to Workspace Reports…" />
    </div>
  );
}
