"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";

export default function LegacyReceptionRedirectPage() {
  const router = useRouter();
  const profile = useQuery(api.users.getCurrentProfile);

  useEffect(() => {
    if (profile === undefined) return;
    if (!profile || !profile.active) {
      router.replace("/sign-in?redirect=/dashboard/reception");
      return;
    }

    router.replace("/dashboard/receptionist");
  }, [profile, router]);

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <InventoryLoader label="Redirecting to Reception Workspace…" />
    </div>
  );
}
