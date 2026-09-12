"use client";

import { use, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ClipboardPlus, Lock, PackageSearch } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { MaterialRequestModal } from "@/components/dashboard/modals/material-request-modal";
import { MaterialRequestsPanel } from "@/components/dashboard/widgets/material-requests-panel";
import { useSafeMutation } from "@/utils/pending-store";
import type { JobCard, Material, MaterialRequest } from "@/lib/operations-types";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map(({ _id, ...rest }) => ({ ...rest, id: _id }));
}

export default function OperatorRequestsPage({
  params,
}: {
  params: Promise<{ machine: string }>;
}) {
  const { machine } = use(params);
  const machineParam = machine.toLowerCase();

  const profile = useQuery(api.users.getCurrentProfile);
  const requests = useQuery(api.operator.requests.list, { machineSlug: machineParam });
  const jobs = useQuery(api.operator.jobs.list, { machineSlug: machineParam });
  const materials = useQuery(api.materials.list);
  const clearance = useQuery(api.operator.inventory.uncleared, { machineSlug: machineParam });

  const createRequest = useMutation(api.operator.requests.create);
  const acknowledgeRequest = useMutation(api.operator.requests.acknowledge);
  const { isPending, safeMutation } = useSafeMutation();

  const [requestOpen, setRequestOpen] = useState(false);

  const clearancePending = clearance?.hasPendingClearance === true;

  const requestList = useMemo(
    () => (requests ? (withIds(requests) as unknown as MaterialRequest[]) : []),
    [requests],
  );

  const jobOptions = useMemo(
    () => (jobs ? (withIds(jobs) as unknown as JobCard[]) : []),
    [jobs],
  );

  const materialOptions = useMemo(
    () =>
      materials
        ? materials.map((material) => ({ ...material, id: material._id })) as Material[]
        : [],
    [materials],
  );

  const unclearedStock = useMemo(
    () =>
      (clearance?.batches ?? []).map((batch) => ({
        id: batch._id,
        status: batch.status as "ACTIVE" | "PENDING_CLEARANCE",
        materialName: batch.materialName,
        machineName: batch.machineName,
        currentRemaining: batch.currentRemaining,
        baseUnit: batch.baseUnit,
      })),
    [clearance],
  );

    if (
    !profile ||
    requests === undefined ||
    jobs === undefined ||
    materials === undefined ||
    clearance === undefined
  ) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="የዕቃ ጥያቄዎች በመጫን ላይ…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Material Requests · የዕቃ ጥያቄዎች"
        title={`Requests — ${machineParam.toUpperCase()}`}
      />

      {clearancePending ? (
        <aside className="flex items-center gap-3 p-4 rounded-sm border border-amber-500/50 bg-amber-950/40 text-amber-200">
          <div className="flex-none p-2 rounded-sm bg-amber-500/20 text-amber-400">
            <Lock size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <strong className="text-sm font-bold text-amber-300">የዕቃ ጥያቄ ተቆልፏል</strong>
            <p className="mt-0.5 text-xs text-amber-200/80">
              አዲስ ዕቃ መጠየቅ አይቻልም። የቀሪ እቃ ማረጋገጫውን በባለቤቱ እስኪጸድቅ ድረስ ይጠብቁ።
            </p>
          </div>
        </aside>
      ) : null}

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setRequestOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-sm border border-cyan-500/40 bg-cyan-950/30 px-3.5 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/40"
        >
          <ClipboardPlus size={13} /> ዕቃ ጠይቅ
        </button>
      </div>

      {jobOptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/40 px-6 py-14 text-center">
          <PackageSearch size={24} className="text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">No active jobs on this machine</h3>
          <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">A material request must be tied to an active job card.</p>
        </div>
      ) : (
        <MaterialRequestsPanel
          requests={requestList}
          role={profile.role}
          onRequest={() => setRequestOpen(true)}
          onIssue={() => {}}
          onAcknowledge={(requestId) =>
            void safeMutation(
              `ack-${requestId}`,
              acknowledgeRequest({ machineSlug: machineParam, requestId: requestId as Id<"materialRequests"> }),
              () => toast.success("Material receipt acknowledged"),
            )
          }
          isPending={isPending}
        />
      )}

      {requestOpen ? (
        <MaterialRequestModal
          jobs={jobOptions}
          materials={materialOptions}
          unclearedStock={unclearedStock}
          machineSlug={machineParam}
          onClose={() => setRequestOpen(false)}
          onSave={(input) => {
            void safeMutation(
              `create-${Date.now()}`,
              createRequest({ machineSlug: machineParam, ...input }),
              () => {
                setRequestOpen(false);
                toast.success("Material request sent to the storekeeper");
              },
              (err) => {
                toast.error(err instanceof Error ? err.message : "Failed to submit material request");
              },
            );
          }}
        />
      ) : null}
    </div>
  );
}