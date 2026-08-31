"use client";

import { AlertTriangle, ArrowUpRight, Box, MoreHorizontal, PackagePlus } from "lucide-react";
import type { Material, MaterialRequest, Role, StockException } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { MaterialRequestsPanel } from "../material-requests-panel";
import { Panel, PanelHeader } from "../../ui/panel";
import { StatusPill } from "../../ui/status-pill";
import { cn } from "@/lib/utils";

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
      {canCreateRequest || canIssueRequest || canAcknowledgeRequest ? (
        <MaterialRequestsPanel 
          requests={requests} 
          role={role} 
          onRequest={onRequest} 
          onIssue={onIssue} 
          onAcknowledge={onAcknowledge} 
          isPending={isPending} 
        />
      ) : null}
      
      <Panel>
        <PanelHeader
          kicker="STOREKEEPER CONSOLE"
          title="የመጋዘን መዝገብ"
          subtitle="Stock-in uses purchase units; balances and production consumption use normalized base units."
          action={
            <div className="flex items-center gap-3">
              {canRecordException ? (
                <button 
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border border-[#cbdde5] bg-white text-[#16445f] transition-colors hover:border-[#83bdcd] hover:bg-[#f4fbfc]"
                  onClick={onException}
                >
                  <ArrowUpRight size={16} />Direct exception
                </button>
              ) : null}
              {canRecordStock ? (
                <button 
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border border-[#cbdde5] bg-white text-[#16445f] transition-colors hover:border-[#83bdcd] hover:bg-[#f4fbfc]"
                  onClick={onStock}
                >
                  <ArrowUpRight size={16} />Stock In / Out
                </button>
              ) : null}
              {canCreateMaterial ? (
                <button 
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg bg-navy text-white shadow-[0_4px_10px_rgba(0,46,75,0.14)] transition-colors hover:bg-[#074d76]"
                  onClick={onAdd}
                >
                  <PackagePlus size={16} />New material
                </button>
              ) : null}
            </div>
          }
        />

        {lowStock.length ? (
          <div className="mb-6 flex items-center gap-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertTriangle size={18} className="text-orange-600 flex-none" />
            <span className="text-sm text-orange-800">
              <b>{lowStock.length} reorder alert{lowStock.length > 1 ? "s" : ""}</b> require storekeeper attention before the next production cycle.
            </span>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Table Header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <span>MATERIAL</span>
              <span>CATEGORY</span>
              <span>AVAILABLE</span>
              <span>REORDER LEVEL</span>
              <span>STATE</span>
              <span></span>
            </div>

            {/* Table Rows */}
            {materials.map((material) => {
              const low = material.reorderAt > 0 && material.quantity <= material.reorderAt;
              return (
                <div 
                  key={material.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={cn(
                      "flex-none w-8 h-8 rounded-lg grid place-items-center text-white",
                      material.accent === "blue" && "bg-blue-500",
                      material.accent === "green" && "bg-green-500",
                      material.accent === "gold" && "bg-yellow-500",
                      material.accent === "violet" && "bg-purple-500",
                      material.accent === "cyan" && "bg-cyan-500",
                      "bg-gray-500" // fallback
                    )}>
                      <Box size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-navy text-sm truncate">{material.name}</p>
                      <small className="block text-xs text-gray-600 leading-relaxed">
                        {material.specification ? `${material.specification}${material.specificationValue ? `: ${material.specificationValue}` : ""} · ` : ""}
                        Base unit: {material.baseUnit ?? material.unit}
                        {material.purchaseUnit && material.conversionRatio ? ` · 1 ${material.purchaseUnit} = ${material.conversionRatio} ${material.baseUnit ?? material.unit}` : ""}
                        {material.storageLocation ? ` · ${material.storageLocation}` : ""}
                      </small>
                    </div>
                  </div>
                  
                  <span className="text-sm text-gray-600 self-center">{material.category}</span>
                  
                  <strong className="text-sm text-navy self-center">
                    {formatQuantity(material.quantity, material.baseUnit ?? material.unit)}
                  </strong>
                  
                  <span className="text-sm text-gray-600 self-center">
                    {formatQuantity(material.reorderAt, material.baseUnit ?? material.unit)}
                  </span>
                  
                  <div className="self-center">
                    <StatusPill variant={low ? "warning" : "success"}>
                      {low ? "Reorder" : "Healthy"}
                    </StatusPill>
                  </div>

                  {canRecordStock ? (
                    <button 
                      className="flex-none w-8 h-8 grid place-items-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                      onClick={onStock} 
                      aria-label={`Record stock movement for ${material.name}`}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  ) : (
                    <div className="w-8" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      {exceptions.length ? (
        <Panel>
          <PanelHeader
            kicker="EXCEPTION REVIEW"
            kickerVariant="coral"
            title="Recent direct stock-outs"
            subtitle="Separate from normal job-card production issues"
            action={
              <StatusPill variant="warning">
                {exceptions.length} recorded
              </StatusPill>
            }
          />

          <div className="space-y-3">
            {exceptions.slice(0, 6).map((entry) => (
              <div 
                key={entry.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="min-w-0">
                  <strong className="block text-sm font-semibold text-navy">{entry.materialName}</strong>
                  <small className="text-xs text-gray-600">
                    {entry.reason} · {new Date(entry.createdAt).toLocaleString("en-ET")}
                  </small>
                </div>
                <b className="text-sm text-red font-mono">
                  {entry.quantity} {entry.unit}
                </b>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </>
  );
}
