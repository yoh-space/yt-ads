"use client";

import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { InventoryManagementInterface } from "@/components/dashboard/inventory-management-interface";

export default function ManagerInventoryPage() {
  return (
    <div className="space-y-4">
      <WorkspacePageHeader
        kicker="Materials & Stock · እቃዎች"
        title="Inventory"
        subtitle="Track material stock, unit conversions, reorder points, and stock movement history."
      />
      <InventoryManagementInterface initialView="main" />
    </div>
  );
}