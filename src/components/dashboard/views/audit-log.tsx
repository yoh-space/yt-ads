"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Boxes, ChevronLeft, ChevronRight, ClipboardList, Factory, History, RefreshCw, Scissors, Trash2 } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AuditCategory, AuditEvent } from "@/lib/report-types";
import { cn } from "@/lib/utils";
import { PanelHead } from "./report-atoms";

const filters: Array<{ id: AuditCategory; label: string; english: string }> = [
  { id: "all", label: "ሁሉም", english: "All activity" },
  { id: "inventory", label: "ክምችት", english: "Inventory" },
  { id: "production", label: "ምርት", english: "Production" },
  { id: "recovery", label: "ቅሪት/ብክነት", english: "Recovery" },
  { id: "orders", label: "ትዕዛዞች", english: "Orders" },
];

function formatActivityTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function activityIcon(category: AuditEvent["category"]) {
  if (category === "inventory") return Boxes;
  if (category === "recovery") return Scissors;
  if (category === "production") return Factory;
  return ClipboardList;
}

const categoryTone: Record<AuditCategory, string> = {
  all: "bg-gray-100 text-gray-600",
  inventory: "bg-cyan/10 text-cyan-dark",
  production: "bg-violet/10 text-violet",
  recovery: "bg-green/10 text-green",
  orders: "bg-gold/10 text-gold",
};

const PAGE_SIZE = 10;

export function AuditLogView() {
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory>("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "at", desc: true }]);
  const events = useQuery(api.audit.list, { category: selectedCategory, limit: 200 });

  const columns = useMemo<ColumnDef<AuditEvent>[]>(
    () => [
      {
        id: "icon",
        header: "",
        cell: ({ row }) => {
          const Icon = activityIcon(row.original.category);
          return <span className={cn("flex items-center justify-center w-9 h-9 rounded-lg flex-none", categoryTone[row.original.category])}><Icon size={16} /></span>;
        },
      },
      {
        id: "activity",
        header: () => <span>Activity</span>,
        cell: ({ row }) => {
          const event = row.original;
          return (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <strong className="text-sm font-semibold text-navy">{event.action}</strong>
                <span className="text-xs text-gray-500">{event.actorName}</span>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{event.summary}</p>
              {event.detail ? <small className="block text-xs text-gray-500 mt-0.5">{event.detail}</small> : null}
            </div>
          );
        },
      },
      {
        accessorKey: "at",
        header: "When",
        cell: ({ row }) => (
          <time dateTime={new Date(row.original.at).toISOString()} className="text-sm text-gray-500">
            {formatActivityTime(row.original.at)}
          </time>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: events ?? [],
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: PAGE_SIZE },
    },
  });

  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();

  return (
    <div className="space-y-6">
      {/* Toolbar / category filters */}
      <section className="bg-white border border-line rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start gap-4 justify-between">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-100 rounded-lg" aria-label="Activity category">
          {filters.map((filter) => (
            <button
              key={filter.id}
              className={cn(
                "px-3 py-1.5 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-cyan",
                selectedCategory === filter.id ? "bg-white text-navy shadow-sm" : "text-gray-600 hover:text-gray-900",
              )}
              onClick={() => setSelectedCategory(filter.id)}
            >
              {filter.label}<small className={cn("ml-1 text-xs", selectedCategory === filter.id ? "text-gray-500" : "text-gray-400")}>{filter.english}</small>
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500 flex-none sm:mt-2">{events?.length ?? 0} activities</span>
      </section>

      <section className="bg-white border border-line rounded-xl shadow-sm">
        <div className="p-6">
          <PanelHead
            kicker="ACTIVITY HISTORY"
            title="የተመዘገቡ እንቅስቃሴዎች"
            note="Created records and auditable movements from the current data set"
            icon={<History size={19} />}
          />
        </div>

        {!events ? (
          <div className="m-6 flex items-center justify-center gap-2 p-10 text-sm text-gray-500 bg-gray-50 border border-line rounded-lg">
            <RefreshCw size={16} className="animate-spin" /> መዝገቡ እየተጫነ ነው…
          </div>
        ) : rows.length === 0 ? (
          <div className="m-6 p-10 text-center text-sm text-gray-500 bg-gray-50 border border-dashed border-line rounded-lg">
            በዚህ ምድብ የተመዘገበ እንቅስቃሴ የለም
          </div>
        ) : (
          <>
            <div className="px-6 pb-2 space-y-2.5">
              {rows.map((row) => (
                <article
                  key={row.original.id}
                  className="flex items-center gap-4 p-4 bg-white border border-line rounded-lg hover:border-cyan/40 hover:bg-cyan/5 transition-colors"
                >
                  {flexRender(row.getVisibleCells()[0].column.columnDef.cell, row.getVisibleCells()[0].getContext())}
                  <div className="min-w-0 flex-1">
                    {flexRender(row.getVisibleCells()[1].column.columnDef.cell, row.getVisibleCells()[1].getContext())}
                  </div>
                  <div className="flex-none">
                    {flexRender(row.getVisibleCells()[2].column.columnDef.cell, row.getVisibleCells()[2].getContext())}
                  </div>
                </article>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-line">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />Prev
              </button>
              <span className="text-xs text-gray-500">
                Page {table.getState().pagination.pageIndex + 1} of {pageCount}
              </span>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next<ChevronRight size={14} />
              </button>
            </div>
          </>
        )}
      </section>

      <div className="flex items-start gap-2.5 p-4 bg-cyan/5 border border-cyan/20 rounded-lg text-sm text-gray-600">
        <Trash2 size={16} className="text-cyan-dark flex-none mt-0.5" />
        <p>
          <strong className="text-navy">Transparency note:</strong> seeded data includes job cards and offcuts. Production, stock, and scrap events appear here as soon as those actions are recorded.
        </p>
      </div>
    </div>
  );
}