"use client";

import { AlertTriangle, ArrowUpRight, Box, MoreHorizontal, PackagePlus } from "lucide-react";
import type { Material, MaterialRequest, Role, StockException } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { MaterialRequestsPanel } from "../material-requests-panel";

export function InventoryView({
  materials,
  lowStock,
  requests,
  role,
  onStock,
  onException,
  exceptions,
  canRecordStock,
  canRecordException,
  canCreateMaterial,
  canCreateRequest,
  canIssueRequest,
  canAcknowledgeRequest,
  onAdd,
  onRequest,
  onIssue,
  onAcknowledge,
  isPending,
}: {
  materials: Material[];
  lowStock: Material[];
  requests: MaterialRequest[];
  role: Role;
  onStock: () => void;
  onException: () => void;
  exceptions: StockException[];
  canRecordStock: boolean;
  canRecordException: boolean;
  canCreateMaterial: boolean;
  canCreateRequest: boolean;
  canIssueRequest: boolean;
  canAcknowledgeRequest: boolean;
  onAdd: () => void;
  onRequest: () => void;
  onIssue: (requestId: string, issuedQuantity: number) => void;
  onAcknowledge: (requestId: string) => void;
  isPending: (key: string) => boolean;
}) {
  return (
    <>
      {canCreateRequest || canIssueRequest || canAcknowledgeRequest ? <MaterialRequestsPanel requests={requests} role={role} onRequest={onRequest} onIssue={onIssue} onAcknowledge={onAcknowledge} isPending={isPending} /> : null}
      <section className="panel inventory-panel">
      <div className="inventory-callout">
        <div>
          <span className="panel-kicker">STOREKEEPER CONSOLE</span>
          <h2>የመጋዘን መዝገብ</h2>
          <p>Stock-in uses purchase units; balances and production consumption use normalized base units.</p>
        </div>
        <div>
          {canRecordException ? <button className="button secondary" onClick={onException}><ArrowUpRight size={16} />Direct exception</button> : null}
          {canRecordStock ? <button className="button secondary" onClick={onStock}><ArrowUpRight size={16} />Stock In / Out</button> : null}
          {canCreateMaterial ? <button className="button primary" onClick={onAdd}><PackagePlus size={16} />New material</button> : null}
        </div>
      </div>
      {lowStock.length ? (
        <div className="low-stock-banner">
          <AlertTriangle size={18} />
          <span>
            <b>{lowStock.length} reorder alert{lowStock.length > 1 ? "s" : ""}</b> require storekeeper attention before the next production cycle.
          </span>
        </div>
      ) : null}
      <div className="inventory-table">
        <div className="table-header"><span>MATERIAL</span><span>CATEGORY</span><span>AVAILABLE</span><span>REORDER LEVEL</span><span>STATE</span><span /></div>
        {materials.map((material) => {
          const low = material.reorderAt > 0 && material.quantity <= material.reorderAt;
          return (
            <div className="table-row material-row" key={material.id}>
              <div className="material-name">
                <span className={`material-swatch ${material.accent}`}><Box size={16} /></span>
                <p>
                  <b>{material.name}</b>
                  <small>
                    {material.specification ? `${material.specification}${material.specificationValue ? `: ${material.specificationValue}` : ""} · ` : ""}
                    Base unit: {material.baseUnit ?? material.unit}
                    {material.purchaseUnit && material.conversionRatio ? ` · 1 ${material.purchaseUnit} = ${material.conversionRatio} ${material.baseUnit ?? material.unit}` : ""}
                    {material.storageLocation ? ` · ${material.storageLocation}` : ""}
                  </small>
                </p>
              </div>
              <span>{material.category}</span>
              <strong>{formatQuantity(material.quantity, material.baseUnit ?? material.unit)}</strong>
              <span>{formatQuantity(material.reorderAt, material.baseUnit ?? material.unit)}</span>
              <span className={`status-pill ${low ? "warning" : "success"}`}>{low ? "Reorder" : "Healthy"}</span>
              {canRecordStock ? <button className="icon-button subtle" onClick={onStock} aria-label={`Record stock movement for ${material.name}`}><MoreHorizontal size={18} /></button> : null}
            </div>
          );
        })}
      </div>
      </section>
      {exceptions.length ? <section className="panel exception-review"><div className="panel-head"><div><span className="panel-kicker coral">EXCEPTION REVIEW</span><h2>Recent direct stock-outs</h2><p>Separate from normal job-card production issues</p></div><span className="status-pill warning">{exceptions.length} recorded</span></div><div className="exception-list">{exceptions.slice(0, 6).map((entry) => <div className="exception-row" key={entry.id}><div><strong>{entry.materialName}</strong><small>{entry.reason} · {new Date(entry.createdAt).toLocaleString("en-ET")}</small></div><b>{entry.quantity} {entry.unit}</b></div>)}</div></section> : null}
    </>
  );
}
