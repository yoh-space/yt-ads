"use client";

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ReconciliationView } from "@/components/dashboard/views/reconciliation";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { useDashboardModal } from "@/components/dashboard/modal-context";
import { useSafeMutation } from "@/components/dashboard/pending-store";
import { hasPermission } from "@/lib/permissions";
import type { Material, Role } from "@/lib/operations-types";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  });
}

export default function ReconciliationPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const state = useQuery(api.dashboard.getState, profile?.active ? {} : "skip");

  const { openModal } = useDashboardModal();
  const { safeMutation } = useSafeMutation();
  const reviewReconciliationMutation = useMutation(api.reconciliation.review);

  if (!profile || !state) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading Stock Reconciliation & Clearance Oversight…" />
      </div>
    );
  }

  const role: Role = profile.role;
  const isOwner = role === "owner" || role === "admin";
  const materials = withIds(state.materials) as Material[];

  const canRecord = hasPermission(role, "reconciliation.record");
  const canReview = hasPermission(role, "reconciliation.review") || hasPermission(role, "reconciliation.clearance");

  // Domain Rule: Financial ETB figures are strictly owner-gated.
  const canSeeFinancial = isOwner;

  return (
    <div className="space-y-6">
      <div className="border-b border-[#1E293B] pb-5">
        <span className="font-mono text-xs uppercase tracking-widest text-[#00B4D8]">
          Floor Audits & Stock Approvals
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
          Inventory Reconciliation & Operator Clearance
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Weekly physical count variances, material balances, and floor batch clearance approvals.
          {!canSeeFinancial ? " (Financial ETB figures restricted to owner)" : ""}
        </p>
      </div>

      <ReconciliationView
        materials={materials}
        canRecord={canRecord}
        canReview={canReview}
        canSeeFinancial={canSeeFinancial}
        onCount={() => openModal("reconciliation")}
        onReview={(id, status) => {
          void safeMutation(
            `review-${id}`,
            reviewReconciliationMutation({
              reconciliationId: id as Id<"reconciliations">,
              status,
            }),
            () => {
              toast.success(`Reconciliation record status updated to ${status}`);
            }
          );
        }}
      />
    </div>
  );
}
