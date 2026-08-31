"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSort,
  type SortingState,
} from "@tanstack/react-table";
import { Boxes, ChevronLeft, ChevronRight, ClipboardList, Factory, History, RefreshCw, Scissors, Trash2 } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AuditCategory, AuditEvent } from "@/lib/report-types";

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
  if (category === "orders") return ClipboardList;
  return ClipboardList;
}

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
          return <span className={`audit-icon ${row.original.category}`}><Icon size={16} /></span>;
        },
      },
      {
        id: "activity",
        header: () => <span>Activity</span>,
        cell: ({ row }) => {
          const event = row.original;
          return (
            <div className="audit-entry-main">
              <div className="audit-entry-title"><strong>{event.action}</strong><span>{event.actorName}</span></div>
              <p>{event.summary}</p>
              <small>{event.detail}</small>
            </div>
          );
        },
      },
      {
        accessorKey: "at",
        header: "When",
        cell: ({ row }) => (
          <time dateTime={new Date(row.original.at).toISOString()}>{formatActivityTime(row.original.at)}</time>
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
    <div className="audit-view">

      <section className="audit-toolbar panel">
        <div className="audit-filters" aria-label="Activity category">
          {filters.map((filter) => (
            <button
              key={filter.id}
              className={selectedCategory === filter.id ? "selected" : ""}
              onClick={() => setSelectedCategory(filter.id)}
            >
              {filter.label}<small>{filter.english}</small>
            </button>
          ))}
        </div>
        <span className="audit-count">{events?.length ?? 0} activities</span>
      </section>

      <section className="panel audit-panel">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">ACTIVITY HISTORY</span>
            <h2>የተመዘገቡ እንቅስቃሴዎች</h2>
            <p>Created records and auditable movements from the current data set</p>
          </div>
          <History size={19} className="report-head-icon" />
        </div>
        {!events ? (
          <div className="report-loading"><RefreshCw size={16} /> መዝገቡ እየተጫነ ነው…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">በዚህ ምድብ የተመዘገበ እንቅስቃሴ የለም</div>
        ) : (
          <>
            <div className="audit-list">
              {rows.map((row) => (
                <article className="audit-entry" key={row.original.id}>
                  {flexRender(row.getVisibleCells()[0].column.columnDef.cell, row.getVisibleCells()[0].getContext())}
                  {flexRender(row.getVisibleCells()[1].column.columnDef.cell, row.getVisibleCells()[1].getContext())}
                  {flexRender(row.getVisibleCells()[2].column.columnDef.cell, row.getVisibleCells()[2].getContext())}
                </article>
              ))}
            </div>
            <div className="audit-pagination">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="button tertiary small"
              >
                <ChevronLeft size={14} />Prev
              </button>
              <span className="audit-page-indicator">
                Page {table.getState().pagination.pageIndex + 1} of {pageCount}
              </span>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="button tertiary small"
              >
                Next<ChevronRight size={14} />
              </button>
            </div>
          </>
        )}
      </section>

      <section className="audit-note">
        <Trash2 size={16} />
        <p><strong>Transparency note:</strong> seeded data includes job cards and offcuts. Production, stock, and scrap events appear here as soon as those actions are recorded.</p>
      </section>
    </div>
  );
}
