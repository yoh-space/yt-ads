"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";

export default function WorkspaceInventoryIndexPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = use(params);
  const router = useRouter();
  const profile = useQuery(api.users.getCurrentProfile);

  useEffect(() => {
    if (profile === undefined) return;
    if (workspace === "operator" || ["laser_operator", "cnc_operator", "plotter_operator", "printer_operator"].includes(profile?.role ?? "")) {
      router.replace(`/dashboard/${workspace}/inventory/substock`);
    } else {
      router.replace(`/dashboard/${workspace}/inventory/parent`);
    }
  }, [profile, router, workspace]);

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <InventoryLoader label="Routing to Inventory Custody…" />
    </div>
  );
}
