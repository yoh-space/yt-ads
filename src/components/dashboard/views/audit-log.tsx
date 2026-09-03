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
import type { LucideIcon } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AuditCategory, AuditEvent } from "@/lib/report-types";
import { cn } from "@/lib/utils";
import { PanelHead } from "./report-atoms";

const filters: Array<{ id: AuditCategory; label: string; english: string; icon: LucideIcon }> = [
  { id: "all", label: "ሁሉም", english: "All activity", icon: ClipboardList },
  { id: "inventory", label: "ክምችት", english: "Inventory", icon: Boxes },
  { id: "production", label: "ምርት", english: "Production", icon: Factory },
  { id: "recovery", label: "ቅሪት/ብክነት", english: "Recovery", icon: Scissors },
  { id: "orders", label: "ትዕዛዞች", english: "Orders", icon: History },
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
      <section className="bg-white border border-line rounded-xl shadow-sm">
        <div
          className="flex flex-col gap-4 px-5 pt-3 sm:flex-row sm:items-end sm:justify-between"
          role="tablist"
          aria-label="Activity category"
        >
          <nav className="-mb-px flex flex-wrap items-end gap-x-6 gap-y-2" aria-label="Audit filters">
            {filters.map((filter) => {
              const Icon = filter.icon;
              const active = selectedCategory === filter.id;
              return (
                <button
                  key={filter.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(filter.id)}
                  className={cn(
                    "group relative flex flex-col items-start gap-1 pb-3 pt-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
                    active ? "text-navy" : "text-muted-foreground hover:text-navy",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon
                      size={14}
                      className={cn(
                        "transition-colors",
                        active ? "text-cyan-dark" : "text-slate-400 group-hover:text-cyan-dark",
                      )}
                      strokeWidth={2}
                    />
                    <span className="text-sm font-semibold tracking-tight">{filter.label}</span>
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
                      active ? "text-cyan-dark" : "text-slate-400 group-hover:text-slate-500",
                    )}
                  >
                    {filter.english}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-0 -bottom-px h-[2px] rounded-full transition-all duration-200",
                      active ? "bg-cyan-dark shadow-[0_0_8px_rgba(25,196,210,0.45)]" : "bg-transparent",
                    )}
                  />
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 pb-3 sm:pb-3.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Showing
            </span>
            <span className="font-mono text-[11px] font-bold tabular-nums text-navy">
              {String(events?.length ?? 0).padStart(2, "0")}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
              activities
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-700/40 bg-emerald-950/20 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400">
              <span className="relative grid h-1.5 w-1.5 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Live
            </span>
          </div>
        </div>
        <div className="h-px w-full bg-line" />
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