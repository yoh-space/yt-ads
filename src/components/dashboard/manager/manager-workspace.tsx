"use client";

import { useRouter } from "next/navigation";
import { useSafeMutation } from "@/components/dashboard/pending-store";
import { Overview, type Kpis } from "@/components/dashboard/views/overview";
import type { CustomerOrder, JobCard, Machine, Material, ScrapLog } from "@/lib/operations-types";
import type { AccessContext } from "@/lib/access-policy";
import { WorkspaceModuleGate } from "@/components/dashboard/workspace-renderer";
import type { View } from "@/types/dashboard-types";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  });
}

export default function ManagerWorkspace({
  profile,
  state,
  orders,
  kpis,
}: {
  profile: { role: "manager"; active: boolean };
  state: {
    materials: Array<{ _id: string; [key: string]: unknown }>;
    machines: Array<{ _id: string; [key: string]: unknown }>;
    jobs: Array<{ _id: string; [key: string]: unknown }>;
    scraps: Array<{ _id: string; [key: string]: unknown }>;
    orderStats: { todaysOrders: number; completedOrders: number; queueOrders: number; activeProductionOrders: number };
    orderPulse: Array<{ materialId: string; consumedLast30Days: number; utilizationPct: number }>;
  };
  orders: Array<{ _id: string; [key: string]: unknown }>;
  kpis?: Kpis;
}) {
  const router = useRouter();
  const { safeMutation } = useSafeMutation();

  const materials = withIds(state.materials) as Material[];
  const machines = withIds(state.machines) as Machine[];
  const jobs = withIds(state.jobs) as JobCard[];
  const typedOrders = withIds(orders) as CustomerOrder[];
  const scraps = withIds(state.scraps) as ScrapLog[];
  const accessContext: AccessContext = {
    profile: { role: profile.role, active: profile.active },
  };

  const stockValue = materials.reduce((total, m) => total + m.quantity, 0);
  const averageWaste = Number(
    (3.4 + Math.min(5, scraps.reduce((total, scrap) => total + scrap.quantity, 0) / 10)).toFixed(1)
  );

  return (
    <WorkspaceModuleGate context={accessContext} moduleId="dashboard.kpis">
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-5">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[#00B4D8]">
            Operations Hub
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
            Manager Production & Fleet Operations
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/orders")}
            className="px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-semibold text-slate-300 hover:text-white hover:border-[#00B4D8] transition-colors"
          >
            Orders Queue
          </button>
          <button
            onClick={() => router.push("/inventory/parent")}
            className="px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-semibold text-slate-300 hover:text-white hover:border-[#00B4D8] transition-colors"
          >
            Inventory
          </button>
        </div>
      </div>

      {/* Financial metrics are strictly owner-gated (passed as null) */}
      <Overview
        materials={materials}
        machines={machines}
        jobs={jobs}
        orders={typedOrders}
        orderStats={state.orderStats}
        materialPulse={state.orderPulse}
        lowStock={materials.filter((m) => m.reorderAt > 0 && m.quantity <= m.reorderAt)}
        stockValue={stockValue}
        waste={averageWaste}
        reconciliationVariances={[]}
        financialMetrics={null}
        kpis={kpis ?? undefined}
        role="manager"
        onView={(view: View) => {
          if (view === "orders") router.push("/orders");
          else if (view === "inventory") router.push("/inventory/parent");
          else if (view === "settings") router.push("/settings");
        }}
        onFilterJobs={() => {}}
        onComplete={(id) => {
          void safeMutation("complete-job", Promise.resolve(id));
        }}
      />
    </div>
    </WorkspaceModuleGate>
  );
}
