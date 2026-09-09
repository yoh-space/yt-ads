"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Scale } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { OperatorStockWidget } from "@/components/dashboard/roles/operator/operator-stock";
import type { OperatorStockEntry } from "@/types/dashboard-types";

export default function OperatorInventoryPage({
  params,
}: {
  params: Promise<{ machine: string }>;
}) {
  const { machine } = use(params);
  const machineParam = machine.toLowerCase();
  const router = useRouter();

  const stock = useQuery(api.operator.inventory.listStock, { machineSlug: machineParam });
  const clearance = useQuery(api.operator.inventory.uncleared, { machineSlug: machineParam });

  if (stock === undefined || clearance === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="የማሽን ዕቃ በመጫን ላይ…" />
      </div>
    );
  }

  const machineId = stock[0]?.machineId ?? clearance.batches[0]?.machineId;

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Machine Stock · የማሽን ዕቃ"
        title="Floor Stock"
        subtitle={`Materials issued to this ${machineParam.toUpperCase()} line, current remainders, and clearance state.`}
      />

      {clearance.hasPendingClearance ? (
        <aside className="flex items-center gap-3 p-4 rounded-sm border border-amber-500/50 bg-amber-950/40 text-amber-200">
          <div className="flex-none p-2 rounded-sm bg-amber-500/20 text-amber-400">
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <strong className="text-sm font-bold text-amber-300">የቀሪ እቃ ማረጋገጫ ይጠበቃል</strong>
            <p className="text-xs text-amber-200/80 mt-0.5">
              በማሽኑ ላይ ያለው ዕቃ መቆጠርና መረጋገጥ አለበት። ባለቤቱ ወይም ሥራ አስኪያጁ እስኪያጸድቁ ድረስ አዲስ ዕቃ መጠየቅ አይቻልም።
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/operator/${machineParam}/reconciliation`)}
            className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-sm border border-amber-500/40 bg-amber-900/40 text-xs font-semibold text-amber-200 hover:bg-amber-800/60 transition-colors"
          >
            <Scale size={13} /> ቆጥር እና አረጋግጥ
          </button>
        </aside>
      ) : null}

      {machineId ? (
        <OperatorStockWidget
          machineId={machineId}
          machineSlug={machineParam}
          stock={stock as OperatorStockEntry[]}
        />
      ) : null}
    </div>
  );
}