"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  ClipboardCheck,
  ClipboardList,
  Inbox,
  PackageCheck,
  Send,
  Truck,
} from "lucide-react";
import type { MaterialRequest, MaterialRequestStatus, Role } from "@/lib/operations-types";
import { hasPermission } from "@/lib/permissions";
import { formatQuantity } from "@/lib/units";
import { Panel, PanelHeader, Button, StatusPill, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<MaterialRequestStatus, "success" | "warning" | "info" | "neutral" | "danger"> = {
  Requested: "warning",
  "Partially Issued": "info",
  Issued: "info",
  Received: "success",
  "Short Stock": "danger",
  Discrepancy: "danger",
};

const PHASE_LABEL: Partial<Record<MaterialRequestStatus, string>> = {
  Requested: "Awaiting issue",
  "Partially Issued": "Partially issued",
  Issued: "Awaiting receipt",
  Received: "Received",
  "Short Stock": "Short stock",
  Discrepancy: "Discrepancy",
};

export function MaterialRequestsPanel({
  requests,
  role,
  onRequest,
  onIssue,
  onAcknowledge,
  isPending,
}: {
  requests: MaterialRequest[];
  role: Role;
  onRequest: () => void;
  onIssue: (requestId: string, issuedQuantity: number) => void;
  onAcknowledge: (requestId: string) => void;
  isPending: (key: string) => boolean;
}) {
  const [issueQuantities, setIssueQuantities] = useState<Record<string, number>>({});
  const canRequest = role !== "storekeeper" && hasPermission(role, "request.create");
  const canIssue = hasPermission(role, "request.issue");
  const canAcknowledge = hasPermission(role, "request.acknowledge");

  const visible = requests.slice(0, 8);
  const pendingToIssue = requests.filter((r) => r.status === "Requested" || r.status === "Partially Issued").length;
  const pendingReceipt = requests.filter((r) => r.status === "Issued" || r.status === "Partially Issued").length;
  const received = requests.filter((r) => r.status === "Received").length;
  const hasWorkflow = canRequest || canIssue || canAcknowledge;

  const statItems = [
    { label: "Pending request", value: pendingToIssue, icon: Send, tone: "text-amber-400 bg-amber-950/40 border-amber-800/60" },
    { label: "Awaiting receipt", value: pendingReceipt, icon: Truck, tone: "text-cyan-300 bg-cyan-950/40 border-cyan-800/60" },
    { label: "Received", value: received, icon: PackageCheck, tone: "text-emerald-400 bg-emerald-950/40 border-emerald-800/60" },
  ];

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        kicker="MATERIAL REQUESTS & APPROVAL"
        title="የእቃ ጥያቄዎች"
        subtitle="Request → Issue → Received · store-controlled floor stock handover"
        icon={<ClipboardList size={17} />}
        action={
          canRequest ? (
            <Button size="small" onClick={onRequest}>
              <Send size={13} />
              New request
            </Button>
          ) : undefined
        }
      />

      {/* Phase summary strip */}
      <div className="grid grid-cols-1 gap-3 px-[17px] py-4 sm:grid-cols-3">
        {statItems.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/40 px-3.5 py-2.5">
            <span className={cn("grid h-8 w-8 flex-none place-items-center rounded-lg border", tone)}>
              <Icon size={15} />
            </span>
            <div className="min-w-0">
              <span className="block truncate font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {label}
              </span>
              <strong className="block text-lg font-bold text-foreground leading-tight">{value}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* Request list */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-border/60 bg-secondary/40 text-muted-foreground">
            <Inbox size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">No material requests yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Operators request stock from the store; store staff approve and hand over the quantity.
            </p>
          </div>
          {canRequest ? (
            <Button size="small" onClick={onRequest}>
              <Send size={13} />
              Start a request
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="divide-y divide-border/60 border-t border-border/60">
          {visible.map((request) => {
            const issueQuantity = issueQuantities[request.id] ?? request.requestedQuantity;
            const tone = STATUS_TONE[request.status];
            const showIssue =
              canIssue && (request.status === "Requested" || request.status === "Partially Issued");
            const showAck =
              canAcknowledge && (request.status === "Issued" || request.status === "Partially Issued");

            return (
              <div key={request.id} className="flex flex-col gap-3 px-[17px] py-4 transition-colors hover:bg-secondary/30 md:flex-row md:items-center">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-lg border border-cyan-800/50 bg-cyan-950/30 text-cyan-dark">
                  <ClipboardList size={17} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm font-semibold text-foreground">
                      {request.jobCode} · {request.materialName}
                    </strong>
                    <StatusPill variant={tone}>{request.status}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {request.client} · requested{" "}
                    <b className="text-foreground">{formatQuantity(request.requestedQuantity, request.unit)} {request.unit}</b>
                    {request.issuedQuantity > 0 ? (
                      <span className="text-muted-foreground"> · issued {formatQuantity(request.issuedQuantity, request.unit)} {request.unit}</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/90">
                    {request.requesterName} · {request.machineName ?? "Unassigned station"} · {request.pickLocation ?? "Central store"} · {PHASE_LABEL[request.status] ?? request.status}
                  </p>
                </div>

                <div className="flex flex-none flex-wrap items-center gap-2">
                  {showIssue ? (
                    <>
                      <Input
                        aria-label={`Issue quantity for ${request.jobCode}`}
                        type="number"
                        min="0.01"
                        max={request.requestedQuantity}
                        step="0.01"
                        value={issueQuantity}
                        onChange={(event) =>
                          setIssueQuantities((current) => ({
                            ...current,
                            [request.id]: Number(event.target.value),
                          }))
                        }
                        className="w-24"
                      />
                      <Button
                        size="small"
                        variant="secondary"
                        pending={isPending(`issue-${request.id}`)}
                        disabled={isPending(`issue-${request.id}`)}
                        onClick={() => onIssue(request.id, issueQuantity)}
                      >
                        <PackageCheck size={13} />
                        {isPending(`issue-${request.id}`) ? "Handing over..." : role === "storekeeper" ? "Approve & Hand Over" : "Issue"}
                      </Button>
                    </>
                  ) : null}
                  {showAck ? (
                    <Button
                      size="small"
                      variant="secondary"
                      pending={isPending(`ack-${request.id}`)}
                      disabled={isPending(`ack-${request.id}`)}
                      onClick={() => onAcknowledge(request.id)}
                    >
                      <ClipboardCheck size={13} />
                      {isPending(`ack-${request.id}`) ? "Confirming..." : "Received"}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasWorkflow ? (
        <p className="border-t border-border/60 px-[17px] py-3 text-[11px] text-muted-foreground">
          Request and approval for this workspace is managed by the storekeeper role.
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-1 border-t border-border/40 bg-secondary/20 px-[17px] py-2">
        <ArrowUpRight size={12} className="text-cyan-dark" />
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          Material flow
        </span>
      </div>
    </Panel>
  );
}
