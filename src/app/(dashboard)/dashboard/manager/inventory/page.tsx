"use client";

import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { ManagerDirectStockOut } from "@/components/dashboard/widgets/manager-direct-stock-out";

export default function ManagerInventoryPage() {
  return (
    <div className="space-y-4">
      <WorkspacePageHeader
        kicker="Materials · እቃዎች"
        title="Materials"
      />
      <div className="rounded-xl border border-border/60 bg-card p-6 text-center text-[12px] text-muted-foreground">
        Material status cards require live inventory data integration. Use the Owner Inventory dashboard for full material visibility.
      </div>
      <ManagerDirectStockOut />
    </div>
  );
}