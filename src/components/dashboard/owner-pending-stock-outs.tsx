"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Check, CircleAlert, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function OwnerPendingStockOuts() {
  const requests = useQuery(api.owner.inventory.getPendingStockOuts);
  const approve = useMutation(api.owner.inventory.approveStockOut);
  const reject = useMutation(api.owner.inventory.rejectStockOut);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function approveRequest(id: Id<"stockExceptions">) {
    setBusyId(id);
    try {
      await approve({ exceptionId: id });
      toast.success("Stock-out approved and recorded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function rejectRequest(id: Id<"stockExceptions">) {
    const note = window.prompt("Reason for rejecting this request:")?.trim();
    if (!note) return;
    setBusyId(id);
    try {
      await reject({ exceptionId: id, note });
      toast.success("Stock-out request rejected.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rejection failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel>
      <PanelHeader title="Stock-out requests" subtitle="Review requests above the emergency limit." kicker="OWNER REVIEW" icon={<CircleAlert size={16} />} />
      {requests === undefined ? <p className="p-4 text-xs text-muted-foreground">Loading requests...</p> : requests.length === 0 ? <p className="p-4 text-xs text-muted-foreground">No requests waiting for approval.</p> : (
        <div className="divide-y divide-border/60">
          {requests.map((request) => (
            <div key={request.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="grid gap-3 sm:grid-cols-4">
                <div><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Material</p><p className="mt-1 text-sm font-semibold text-foreground">{request.materialName}</p><p className="text-[10px] text-muted-foreground">{request.quantity} {request.unit}</p></div>
                <div><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Value</p><p className="mt-1 text-sm font-semibold text-foreground">ETB {request.requestedValue.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Requested by {request.requesterName ?? "Manager"}</p></div>
                <div><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Reason</p><p className="mt-1 text-xs text-foreground">{request.reason}</p><p className="text-[10px] text-muted-foreground">{formatDate(request.createdAt)}</p></div>
                <div><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Note</p><p className="mt-1 text-xs text-foreground">{request.authorizationNote ?? "No note"}</p></div>
              </div>
              <div className="flex gap-2 lg:flex-col">
                <button type="button" disabled={busyId === request.id} onClick={() => void approveRequest(request.id)} className="inline-flex items-center justify-center gap-1.5 rounded-md bg-success px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Check size={14} /> Approve</button>
                <button type="button" disabled={busyId === request.id} onClick={() => void rejectRequest(request.id)} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-danger/30 px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50"><X size={14} /> Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
