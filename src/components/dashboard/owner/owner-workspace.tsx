"use client";

import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { Overview, type FinancialMetrics, type Kpis } from "@/components/dashboard/views/overview";
import { useSafeMutation } from "@/components/dashboard/pending-store";
import type { CustomerOrder, JobCard, Machine, Material, ScrapLog } from "@/lib/operations-types";
import type { AccessContext } from "@/lib/access-policy";
import { WorkspaceModuleGate } from "@/components/dashboard/workspace-renderer";
import type { View } from "@/components/dashboard/nav-config";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  });
}

export default function OwnerWorkspace({
  profile,
  state,
  orders,
  financialMetrics,
  kpis,
  reconciliationSummary,
}: {
  profile: { role: "owner" | "admin"; active: boolean };
  state: {
    materials: Array<{ _id: string; [key: string]: unknown }>;
    machines: Array<{ _id: string; [key: string]: unknown }>;
    jobs: Array<{ _id: string; [key: string]: unknown }>;
    scraps: Array<{ _id: string; [key: string]: unknown }>;
    orderStats: { todaysOrders: number; completedOrders: number; queueOrders: number; activeProductionOrders: number };
    orderPulse: Array<{ materialId: string; consumedLast30Days: number; utilizationPct: number }>;
  };
  orders: Array<{ _id: string; [key: string]: unknown }>;
  financialMetrics?: FinancialMetrics;
  kpis?: Kpis;
  reconciliationSummary?: { currentVariances: Array<{ variance: number; monetaryLoss: number }> };
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
            Executive Oversight
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
            Owner Financial & Operations Control
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/reports")}
            className="px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-semibold text-slate-300 hover:text-white hover:border-[#00B4D8] transition-colors"
          >
            Financial Reports
          </button>
          <button
            onClick={() => router.push("/reconciliation")}
            className="px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-semibold text-slate-300 hover:text-white hover:border-[#00B4D8] transition-colors"
          >
            Reconciliation Approvals
          </button>
        </div>
      </div>

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
        reconciliationVariances={reconciliationSummary?.currentVariances ?? []}
        financialMetrics={financialMetrics ?? null}
        kpis={kpis ?? undefined}
        role="owner"
        onView={(view: View) => {
          if (view === "orders") router.push("/orders");
          else if (view === "inventory") router.push("/inventory/parent");
          else if (view === "reports") router.push("/reports");
          else if (view === "reconciliation") router.push("/reconciliation");
          else if (view === "settings") router.push("/settings");
        }}
        onFilterJobs={() => router.push("/dashboard/manager")}
        onComplete={(id) => {
          void safeMutation("complete-job", Promise.resolve(id));
        }}
      />
    </div>
    </WorkspaceModuleGate>
  );
}
