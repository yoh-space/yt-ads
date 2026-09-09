"use client";

import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { RawMaterialStatusGrid } from "@/components/dashboard/raw-material-status-cards";

export default function ManagerInventoryPage() {
  return (
    <div className="space-y-4">
      <WorkspacePageHeader
        kicker="Materials · እቃዎች"
        title="Materials"
        subtitle="See the main store material levels at a glance."
      />
      <RawMaterialStatusGrid />
    </div>
  );
}