"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Boxes,
  Factory,
  PackageOpen,
  AlertTriangle,
  Warehouse,
} from "lucide-react";

import { OwnerPageHeader } from "@/components/dashboard/roles/owner/owner-page-header";
import { StatCard } from "@/components/shared/ui/stat-card";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { OwnerPendingStockOuts } from "@/components/dashboard/widgets/owner-pending-stock-outs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/shared/ui/tabs";
import { OwnerInventoryCategoryGrid } from "@/components/dashboard/roles/owner/inventory/owner-inventory-category-grid";
import {
  OwnerProductionFloorTable,
  type FloorMachineRow,
} from "@/components/dashboard/roles/owner/inventory/owner-production-floor-table";
import { MachineInspectionDrawer } from "@/components/dashboard/roles/owner/inventory/machine-inspection-drawer";

const etb = (value: number) =>
  `ETB ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function OwnerInventoryPage() {
  const summary = useQuery(api.owner.inventory.getInventorySummary);
  const parentInventory = useQuery(api.inventory.listParentInventory);
  const floorSummary = useQuery(api.owner.inventory.getOwnerFloorSummary);

  const [selectedMachine, setSelectedMachine] = useState<FloorMachineRow | null>(null);

  // Show loader until the two queries that drive the first paint are ready
  const loading = summary === undefined || parentInventory === undefined || floorSummary === undefined;

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Inventory…" />
      </div>
    );
  }

  const activeMachineCount = floorSummary.activeMachineCount;
  const pendingClearanceCount = floorSummary.pendingClearanceCount;

  return (
    <>
      <div className="space-y-6">
        {/* ── Page header ── */}
        <OwnerPageHeader
          kicker="Stock Levels · ክምችት ደረጃ"
          title="Inventory Overview"
        />

        {/* ── KPI cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Boxes size={16} />}
            label="Total Stock Value"
            subtitle="ጠቅላላ የክምችት ዋጋ"
            value={etb(summary.totalValue)}
            description="Combined central store + production floor estimate."
            variant="sales"
          />
          <StatCard
            icon={<Warehouse size={16} />}
            label="Central Store"
            subtitle="ዋና መጋዘን"
            value={etb(summary.mainStoreValue)}
            description="Materials held in the primary warehouse."
            variant="default"
          />
          <StatCard
            icon={<PackageOpen size={16} />}
            label="Production Floor"
            subtitle="መስሪያ ቤት ክምችት"
            value={etb(summary.floorValue)}
            description={`${activeMachineCount} machine${activeMachineCount !== 1 ? "s" : ""} with active stock.`}
            variant="cost"
          />
          <StatCard
            icon={<AlertTriangle size={16} />}
            label="Uncleared Value"
            subtitle="ያልተመረመረ"
            value={etb(summary.unclearedValue)}
            description={
              pendingClearanceCount > 0
                ? `${pendingClearanceCount} batch${pendingClearanceCount !== 1 ? "es" : ""} awaiting reconciliation.`
                : "No pending clearances right now."
            }
            variant="alert"
            isAlert={summary.unclearedValue > 0}
          />
        </div>

        {/* ── Pending stock-out approvals (between KPIs and tabs) ── */}
        <OwnerPendingStockOuts />

        {/* ── Segmented workspace tabs ── */}
        <Tabs defaultValue="main-store" className="space-y-5">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="main-store">
              <Warehouse size={14} aria-hidden="true" />
              Main Store
              <span className="hidden sm:inline text-muted-foreground/70">· ዋና ስቶክ</span>
            </TabsTrigger>
            <TabsTrigger value="production-floor">
              <Factory size={14} aria-hidden="true" />
              Production Floor
              <span className="hidden sm:inline text-muted-foreground/70">· የማሽን ስቶክ</span>
              {activeMachineCount > 0 && (
                <span className="ml-1 rounded-full bg-background/20 px-1.5 py-0.5 font-mono text-[9px] font-bold tabular-nums">
                  {activeMachineCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab 1 — Main Store category breakdown */}
          <TabsContent value="main-store">
            <OwnerInventoryCategoryGrid items={parentInventory} />
          </TabsContent>

          {/* Tab 2 — Production floor machine table */}
          <TabsContent value="production-floor">
            <OwnerProductionFloorTable
              rows={floorSummary.machines}
              onInspect={setSelectedMachine}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Machine inspection drawer (rendered outside the scroll container) ── */}
      <MachineInspectionDrawer
        row={selectedMachine}
        onClose={() => setSelectedMachine(null)}
      />
    </>
  );
}
