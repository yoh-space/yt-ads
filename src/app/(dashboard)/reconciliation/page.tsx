"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { getRoleHomeRoute, getWorkspaceForRole } from "@/lib/role-routing";
import { hasPermission } from "@/lib/permissions";

export default function LegacyReconciliationRedirectPage() {
  const router = useRouter();
  const profile = useQuery(api.users.getCurrentProfile);

  useEffect(() => {
    if (profile === undefined) return;
    if (!profile || !profile.active) {
      router.replace("/sign-in?redirect=/reconciliation");
      return;
    }

    if (profile.role === "storekeeper") {
      router.replace("/dashboard/storekeeper/reconciliation");
      return;
    }

    const canReview = hasPermission(profile.role, "reconciliation.review");
    if (!canReview) {
      router.replace(getRoleHomeRoute(profile.role));
      return;
    }

    const workspace = getWorkspaceForRole(profile.role);
    router.replace(`/dashboard/${workspace}/reconciliation`);
  }, [profile, router]);

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <InventoryLoader label="Redirecting to Reconciliation Oversight…" />
    </div>
  );
}
