"use client";

import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { RawMaterialStatusGrid } from "@/components/dashboard/shared/raw-material-status-cards";
import { ManagerDirectStockOut } from "@/components/dashboard/shared/manager-direct-stock-out";

export default function ManagerInventoryPage() {
  return (
    <div className="space-y-4">
      <WorkspacePageHeader
        kicker="Materials · እቃዎች"
        title="Materials"
        subtitle="See the main store material levels at a glance."
      />
      <RawMaterialStatusGrid />
      <ManagerDirectStockOut />
    </div>
  );
}