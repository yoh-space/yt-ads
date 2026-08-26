"use client";

import { ClipboardCheck, ClipboardList, PackageCheck, Send } from "lucide-react";
import { useState } from "react";
import type { MaterialRequest, Role } from "@/lib/operations-types";
import { hasPermission } from "@/lib/permissions";
import { formatQuantity } from "@/lib/units";

export function MaterialRequestsPanel({
  requests,
  role,
  onRequest,
  onIssue,
  onAcknowledge,
}: {
  requests: MaterialRequest[];
  role: Role;
  onRequest: () => void;
  onIssue: (requestId: string, issuedQuantity: number) => void;
  onAcknowledge: (requestId: string) => void;
}) {
  const [issueQuantities, setIssueQuantities] = useState<Record<string, number>>({});
  const canRequest = hasPermission(role, "request.create");
  const canIssue = hasPermission(role, "request.issue");
  const canAcknowledge = hasPermission(role, "request.acknowledge");

  return (
    <section className="panel request-panel">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">SIMPLE MATERIAL FLOW</span>
          <h2>የእቃ ጥያቄዎች</h2>
          <p>Request → Issue → Received</p>
        </div>
        {canRequest ? <button className="button primary small" onClick={onRequest}><Send size={14} />Request</button> : null}
      </div>
      {requests.length === 0 ? (
        <div className="empty-state">No material requests yet. Start with one job and one quantity.</div>
      ) : (
        <div className="request-list">
          {requests.slice(0, 8).map((request) => {
            const issueQuantity = issueQuantities[request.id] ?? request.requestedQuantity;
            return (
              <article className="request-row" key={request.id}>
                <span className="request-icon"><ClipboardList size={16} /></span>
                <div className="request-main">
                  <strong>{request.jobCode} · {request.materialName}</strong>
                  <span>{request.client} · requested {formatQuantity(request.requestedQuantity, request.unit)}</span>
                  <small>{request.requesterName} · {request.status}</small>
                </div>
                <div className="request-action">
                  <span className={`status-pill ${request.status === "Received" ? "success" : request.status === "Requested" ? "warning" : "neutral"}`}>{request.status}</span>
                  {canIssue && (request.status === "Requested" || request.status === "Partially Issued") ? (
                    <div className="request-issue-controls">
                      <input aria-label={`Issue quantity for ${request.jobCode}`} type="number" min="0.01" max={request.requestedQuantity} step="0.01" value={issueQuantity} onChange={(event) => setIssueQuantities((current) => ({ ...current, [request.id]: Number(event.target.value) }))} />
                      <button className="button secondary small" onClick={() => onIssue(request.id, issueQuantity)}><PackageCheck size={13} />Issue</button>
                    </div>
                  ) : null}
                  {canAcknowledge && (request.status === "Issued" || request.status === "Partially Issued") ? (
                    <button className="button secondary small" onClick={() => onAcknowledge(request.id)}><ClipboardCheck size={13} />Received</button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
