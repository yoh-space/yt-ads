"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  ClipboardCheck,
  ClipboardList,
  Inbox,
  PackageCheck,
  Send,
} from "lucide-react";
import type { MaterialRequest, MaterialRequestStatus, Role } from "@/lib/operations-types";
import { hasPermission } from "@/lib/permissions";
import { formatQuantity } from "@/lib/units";
import { Panel, PanelHeader, Button, StatusPill, Input } from "@/components/ui";

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

function requesterInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function relativeTime(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function MaterialRequestsPanel({
  requests,
  role,
  onRequest,
  onIssue,
  onAcknowledge,
  onShortStock,
  isPending,
}: {
  requests: MaterialRequest[];
  role: Role;
  onRequest: () => void;
  onIssue: (requestId: string, issuedQuantity: number) => void;
  onAcknowledge: (requestId: string) => void;
  onShortStock?: (requestId: string) => void;
  isPending: (key: string) => boolean;
}) {
  const [issueQuantities, setIssueQuantities] = useState<Record<string, number>>({});
  const canRequest = role !== "storekeeper" && hasPermission(role, "request.create");
  const canIssue = hasPermission(role, "request.issue");
  const canAcknowledge = hasPermission(role, "request.acknowledge");

  const visible = requests.slice(0, 8);
  const pendingToIssue = requests.filter((r) => r.status === "Requested" || r.status === "Partially Issued").length;
  const hasWorkflow = canRequest || canIssue || canAcknowledge;

  return (
    <Panel className="overflow-hidden border-border bg-card">
      <PanelHeader
        kicker="FLOOR MATERIAL REQUISITIONS"
        title="የኦፕሬተሮች የዕቃ ጥያቄ መከታተያ"
        subtitle="Operator requests awaiting physical stock handover"
        icon={<ClipboardList size={17} />}
        action={
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-400">
            {pendingToIssue} pending
          </span>
        }
      />

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
        <div className="space-y-2 border-t border-border/60 p-3">
          {visible.map((request) => {
            const issueQuantity = issueQuantities[request.id] ?? request.requestedQuantity;
            const tone = STATUS_TONE[request.status];
            const showIssue =
              canIssue && (request.status === "Requested" || request.status === "Partially Issued");
            const showAck =
              canAcknowledge && (request.status === "Issued" || request.status === "Partially Issued");

            return (
              <div key={request.id} className="rounded-md border border-border bg-background/70 p-3 transition-colors hover:border-primary/50">
                <div className="flex items-start gap-2.5">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-full border border-primary/40 bg-primary/10 font-mono text-[10px] font-bold text-primary">
                    {requesterInitials(request.requesterName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="truncate text-xs font-semibold text-foreground">{request.requesterName}</strong>
                      <span className="flex-none font-mono text-[9px] text-muted-foreground">{relativeTime(request.requestedAt)}</span>
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {request.machineName ?? "Unassigned station"} · {request.pickLocation ?? "Central store"}
                    </p>
                  </div>
                  <StatusPill variant={tone}>{PHASE_LABEL[request.status] ?? request.status}</StatusPill>
                </div>
                <div className="mt-3 rounded border border-border/70 bg-muted/30 px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Requested</p>
                  <p className="mt-0.5 text-xs font-semibold text-foreground">
                    {formatQuantity(request.requestedQuantity, request.unit)} {request.unit} · {request.materialName}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{request.jobCode} · {request.client}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
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
                        {isPending(`issue-${request.id}`) ? "Handing over..." : role === "storekeeper" ? `Approve & Hand Over ${formatQuantity(issueQuantity, request.unit)} ${request.unit}` : "Issue"}
                      </Button>
                      {onShortStock ? <Button
                        size="small"
                        variant="tertiary"
                        pending={isPending(`short-${request.id}`)}
                        disabled={isPending(`short-${request.id}`)}
                        onClick={() => onShortStock(request.id)}
                      >
                        Mark short stock
                      </Button> : null}
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
