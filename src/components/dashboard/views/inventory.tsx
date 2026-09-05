"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSort,
} from "@tanstack/react-table";
import { AlertTriangle, ArrowUpRight, ArrowDown, ArrowUp, Box, ChevronsUpDown, MoreHorizontal, PackagePlus, Search, X } from "lucide-react";
import type { Material, MaterialRequest, Role, StockException } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { MaterialRequestsPanel } from "../material-requests-panel";
import { StockoutAlertWidget } from "./stockout-alert-widget";
import { Panel, PanelHeader } from "../../ui/panel";
import { StatusPill } from "../../ui/status-pill";
import { cn } from "@/lib/utils";

const gridCols = "grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]";

function SortIndicator({ direction }: { direction: "asc" | "desc" | false }) {
  if (direction === "asc") return <ArrowUp size={13} className="inline-block ml-1 align-[-2px] text-cyan-dark" />;
  if (direction === "desc") return <ArrowDown size={13} className="inline-block ml-1 align-[-2px] text-cyan-dark" />;
  return <ChevronsUpDown size={13} className="inline-block ml-1 align-[-2px] text-gray-300" />;
}

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
  onShortStock,
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
  onShortStock?: (requestId: string) => void;
  isPending: (key: string) => boolean;
}) {
  const [sorting, setSorting] = useState<ColumnSort[]>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<Material>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Material",
        cell: ({ row }) => {
          const material = row.original;
          return (
            <div className="flex items-center gap-3 min-w-0">
              <span className={cn(
                "flex-none w-8 h-8 rounded-lg grid place-items-center text-white",
                material.accent === "blue" && "bg-blue-500",
                material.accent === "green" && "bg-green-500",
                material.accent === "gold" && "bg-yellow-500",
                material.accent === "violet" && "bg-purple-500",
                material.accent === "cyan" && "bg-cyan-500",
                "bg-gray-500"
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
          );
        },
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => <span className="text-sm text-gray-600 self-center">{row.original.category}</span>,
      },
      {
        accessorKey: "quantity",
        header: "Available",
        sortingFn: "basic",
        cell: ({ row }) => (
          <strong className="text-sm text-navy self-center">
            {formatQuantity(row.original.quantity, row.original.baseUnit ?? row.original.unit)}
          </strong>
        ),
      },
      {
        accessorKey: "reorderAt",
        header: "Reorder Level",
        cell: ({ row }) => (
          <span className="text-sm text-gray-600 self-center">
            {formatQuantity(row.original.reorderAt, row.original.baseUnit ?? row.original.unit)}
          </span>
        ),
      },
      {
        id: "state",
        header: "State",
        cell: ({ row }) => {
          const material = row.original;
          const low = material.reorderAt > 0 && material.quantity <= material.reorderAt;
          return (
            <div className="self-center">
              <StatusPill variant={low ? "warning" : "success"}>
                {low ? "Reorder" : "Healthy"}
              </StatusPill>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const material = row.original;
          if (!canRecordStock) return <div className="w-8" />;
          return (
            <button
              className="flex-none w-8 h-8 grid place-items-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
              onClick={onStock}
              aria-label={`Record stock movement for ${material.name}`}
            >
              <MoreHorizontal size={18} />
            </button>
          );
        },
      },
    ],
    [canRecordStock, onStock]
  );

  const table = useReactTable({
    data: materials,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const material = row.original;
      const haystack = `${material.name} ${material.category} ${material.storageLocation ?? ""} ${material.specification ?? ""} ${material.specificationValue ?? ""}`.toLowerCase();
      return haystack.includes(String(filterValue).toLowerCase());
    },
  });

  const rows = table.getRowModel().rows;

  return (
    <>
      {canCreateRequest || canIssueRequest || canAcknowledgeRequest ? (
        <MaterialRequestsPanel
          requests={requests}
          role={role}
          onRequest={onRequest}
          onIssue={onIssue}
          onAcknowledge={onAcknowledge}
          onShortStock={onShortStock}
          isPending={isPending}
        />
      ) : null}

      {/* Real-time Stockout Forecast & Depletion Radar */}
      <div className="mb-6">
        <StockoutAlertWidget
          canViewFinancial={role === "owner"}
          onNavigateToInventory={undefined}
        />
      </div>

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

        <div className="p-4 border-b border-line flex items-center gap-2">
          <label className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-line flex-1 min-w-[200px]">
            <Search size={15} className="text-gray-400" />
            <input
              placeholder="Search material, category, location..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-ink placeholder:text-gray-400"
            />
            {globalFilter ? <button type="button" onClick={() => setGlobalFilter("")} className="text-gray-400 hover:text-gray-600"><X size={13} /></button> : null}
          </label>
          <span className="text-xs text-gray-500 whitespace-nowrap">{rows.length} of {materials.length} materials</span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Table Header */}
            <div className={cn("grid", gridCols, "gap-4 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider")}>
              {table.getHeaderGroups()[0].headers.map((header) => {
                const canSort = header.column.getCanSort();
                return (
                  <span
                    key={header.id}
                    className={cn(canSort && "cursor-pointer select-none inline-flex items-center", header.id === "actions" && "justify-end")}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {canSort ? <SortIndicator direction={header.column.getIsSorted()} /> : null}
                  </span>
                );
              })}
            </div>

            {/* Table Rows */}
            {rows.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No materials match the current filters.</div>
            ) : rows.map((row) => (
              <div
                key={row.id}
                className={cn("grid", gridCols, "gap-4 px-4 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors")}
              >
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id} className={cn(cell.column.id === "actions" && "justify-self-end")}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            ))}
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
