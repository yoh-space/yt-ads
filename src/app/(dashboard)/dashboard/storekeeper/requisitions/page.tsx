"use client";

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { MaterialRequestsPanel } from "@/components/dashboard/widgets/material-requests-panel";
import { StatusPill } from "@/components/shared/ui/status-pill";
import { useSafeMutation } from "@/utils/pending-store";
import type { MaterialRequest } from "@/lib/operations-types";
import type { AccessContext } from "@/lib/access-policy";
import { WorkspaceModuleGate } from "@/components/dashboard/shell/workspace-renderer";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map(({ _id, ...rest }) => ({ ...rest, id: _id }));
}

export default function StorekeeperRequisitionsPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const materialRequests = useQuery(api.storekeeper.requisitions.list);
  const { isPending, safeMutation } = useSafeMutation();
  const issueMaterialRequest = useMutation(api.storekeeper.requisitions.issue);
  const markShortStockRequest = useMutation(api.storekeeper.requisitions.markShortStock);
  const acknowledgeMaterialRequest = useMutation(api.storekeeper.requisitions.acknowledge);

  const requests = withIds(materialRequests ?? []) as unknown as MaterialRequest[];

  if (!profile || materialRequests === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Requisition Inbox…" />
      </div>
    );
  }

  const accessContext: AccessContext = {
    profile: { role: profile.role, active: profile.active },
  };

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Material Requisitions · የዕቃ ጥያቄዎች"
        title="Requisitions"
      />

      <WorkspaceModuleGate context={accessContext} moduleId="inventory.requisitions">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">የእቃ ጥያቄዎች</p>
              <h2 className="mt-1 text-lg font-bold text-foreground">የኦፕሬተሮች የዕቃ ጥያቄ መከታተያ</h2>
            </div>
            <StatusPill variant="warning">PENDING</StatusPill>
          </div>
          <MaterialRequestsPanel
            requests={requests}
            role="storekeeper"
            onRequest={() => {}}
            onIssue={(requestId, input) =>
              void safeMutation(
                `issue-${requestId}`,
                issueMaterialRequest({
                  requestId: requestId as Id<"materialRequests">,
                  issuedQuantity: input.issuedQuantity,
                  issuedPackages: input.issuedPackages,
                  packageUnit: input.packageUnit,
                }),
                () => toast.success("Material handed over to operator"),
                (error) => toast.error(error instanceof Error ? error.message : "Unable to hand over material"),
              )
            }
            onShortStock={(requestId) =>
              void safeMutation(
                `short-${requestId}`,
                markShortStockRequest({ requestId: requestId as Id<"materialRequests"> }),
                () => toast.success("Request marked short stock"),
              )
            }
            onAcknowledge={(requestId) =>
              void safeMutation(
                `ack-${requestId}`,
                acknowledgeMaterialRequest({ requestId: requestId as Id<"materialRequests"> }),
                () => toast.success("Material receipt acknowledged"),
              )
            }
            isPending={isPending}
          />
        </section>
      </WorkspaceModuleGate>
    </div>
  );
}
