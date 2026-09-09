"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowDownToLine, ArrowRight, Boxes, ClipboardList, Plus, Warehouse } from "lucide-react";
import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { useDashboardModal } from "@/components/dashboard/modal-context";
import { WorkspaceModuleGate } from "@/components/dashboard/workspace-renderer";
import type { AccessContext } from "@/lib/access-policy";

function unitLabel(unitType: "ROLL" | "SHEET" | "LITER") {
  return unitType === "ROLL" ? "ROLLS" : unitType === "SHEET" ? "SHEETS" : "CANISTERS";
}

function physicalQuantity(quantity: number, unitType: "ROLL" | "SHEET" | "LITER") {
  return `${Number(quantity.toFixed(1))} ${unitLabel(unitType)}`;
}

function inventoryBreakdown(
  items: Array<{ materialName: string; totalStockQuantity: number; unitType: "ROLL" | "SHEET" | "LITER" }>,
  unitType: "ROLL" | "SHEET" | "LITER",
) {
  const totalsByMaterial = new Map<string, number>();
  for (const item of items) {
    if (item.unitType !== unitType) continue;
    totalsByMaterial.set(item.materialName, (totalsByMaterial.get(item.materialName) ?? 0) + item.totalStockQuantity);
  }

  const breakdown = [...totalsByMaterial.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([name, quantity]) => `${Number(quantity.toFixed(1))} ${name}`);

  return breakdown.length > 0 ? breakdown.join(" · ") : "No stock recorded";
}

export default function StorekeeperOverviewPage() {
  const router = useRouter();
  const profile = useQuery(api.users.getCurrentProfile);
  const overview = useQuery(api.storekeeper.overview.getOverview);
  const { openModal } = useDashboardModal();

  if (overview === undefined || !profile) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Storekeeper Overview…" />
      </div>
    );
  }

  const accessContext: AccessContext = {
    profile: { role: profile.role, active: profile.active },
  };
  const items = overview.items;

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Storekeeper Overview · የመጋዘን ማጠቃለያ"
        title="Overview"
        subtitle="Central package stock, requisition inbox, and reorder pressure at a glance."
      />

      <WorkspaceModuleGate context={accessContext} moduleId="inventory.kpis">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Boxes size={16} />}
            label="Rolls in Store"
            subtitle="የሮል እቃዎች"
            value={overview.totals.rolls}
            description={inventoryBreakdown(items, "ROLL")}
            variant="default"
          />
          <StatCard
            icon={<Boxes size={16} />}
            label="Sheets in Store"
            subtitle="አክሪሊክ እና ፎም ሺቶች"
            value={overview.totals.sheets}
            description={inventoryBreakdown(items, "SHEET")}
            variant="default"
          />
          <StatCard
            icon={<Boxes size={16} />}
            label="Inks & Chemicals"
            subtitle="ቀለሞች እና ኬሚካሎች"
            value={overview.totals.inks}
            description={inventoryBreakdown(items, "LITER")}
            variant="default"
          />
          <StatCard
            icon={<ClipboardList size={16} />}
            label="Pending Requests"
            subtitle="ፈቃድ የሚጠብቁ ጥያቄዎች"
            value={overview.pendingRequests}
            description={`${overview.pendingRequests} request${overview.pendingRequests === 1 ? "" : "s"} awaiting handover`}
            variant="alert"
            isAlert={overview.pendingRequests > 0}
          />
        </div>
      </WorkspaceModuleGate>

      <Panel>
        <PanelHeader
          title="Storekeeper Actions"
          subtitle="የመጋዘን ሥራዎች"
          kicker="Quick Actions"
          icon={<Warehouse size={16} />}
        />
        <div className="flex flex-wrap gap-2 p-[17px]">
          <button
            onClick={() => router.push("/dashboard/storekeeper/inventory")}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
          >
            <Warehouse size={14} /> Open Parent Inventory <ArrowRight size={13} />
          </button>
          <button
            onClick={() => router.push("/dashboard/storekeeper/requisitions")}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
          >
            <ClipboardList size={14} /> Requisition Inbox <ArrowRight size={13} />
          </button>
          <button
            onClick={() => openModal("stock")}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus size={14} /> አዲስ እቃ ገቢ አድርግ
          </button>
        </div>
      </Panel>

      <WorkspaceModuleGate context={accessContext} moduleId="inventory.reorder-alerts">
        {overview.lowStockCount > 0 ? (
          <aside className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ArrowDownToLine className="mt-0.5 text-destructive" size={18} />
              <div>
                <p className="font-semibold text-foreground">Critical reorder alert</p>
                <p className="text-xs text-muted-foreground">
                  {overview.lowStockItems
                    .map((item) => `${item.materialName}: ${physicalQuantity(item.totalStockQuantity, item.unitType)}`)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/dashboard/storekeeper/inventory")}
              className="shrink-0 rounded-md bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground hover:bg-destructive/90"
            >
              Review Low Stock
            </button>
          </aside>
        ) : (
          <Panel>
            <PanelHeader
              title="Low Stock / Reorder Materials"
              subtitle="ክምችት እጥረት"
              kicker="Inventory"
              icon={<ArrowDownToLine size={16} />}
            />
            <p className="p-[17px] text-[12px] text-muted-foreground">All stock is above its reorder point.</p>
          </Panel>
        )}
      </WorkspaceModuleGate>
    </div>
  );
}