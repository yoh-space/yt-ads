"use client";

import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { RawMaterialStatusGrid } from "@/components/dashboard/raw-material-status-cards";

export default function ManagerInventoryPage() {
  return (
    <div className="space-y-4">
      <WorkspacePageHeader
        kicker="Materials & Stock · እቃዎች"
        title="Inventory"
        subtitle="Read-only stock visibility across the main material categories."
      />
      <RawMaterialStatusGrid />
    </div>
  );
}