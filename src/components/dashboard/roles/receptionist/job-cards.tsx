"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Factory,
  FilterX,
  Search,
  X,
} from "lucide-react";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { CustomerFilePreview } from "@/components/dashboard/orders/customer-file-preview";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { StatCard } from "@/components/shared/ui/stat-card";
import { cn } from "@/lib/utils";

const jobsApi = (
  api.receptionist as unknown as {
    jobs: { list: typeof api.receptionist.orders.list };
  }
).jobs;
const copy = {
  title: "Job Cards",
  amTitle: "የሥራ ካርዶች",
  kicker: "Reception Desk",
  total: "Total Issued",
  totalAm: "ጠቅላላ የተሰጡ",
  production: "In Production",
  productionAm: "በምርት ላይ ያሉ",
  ready: "Ready for Pickup",
  readyAm: "ለርክክብ የተዘጋጁ",
  overdue: "Overdue / Delayed",
  overdueAm: "ጊዜ ያለፈባቸው",
};
const statusLabels: Record<string, string> = {
  Queued: "QUEUED",
  "In production": "IN_PRODUCTION",
  Completed: "COMPLETED",
  Paused: "PAUSED",
};
const statusTone: Record<string, string> = {
  Queued: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  "In production": "bg-cyan/10 text-cyan border-cyan/20",
  Completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

type Preset = "all" | "today" | "week" | "month";
function dateRange(preset: Preset) {
  if (preset === "all") return {};
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "week")
    from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
  if (preset === "month") from.setDate(1);
  const to = new Date(from);
  to.setDate(
    to.getDate() + (preset === "today" ? 1 : preset === "week" ? 7 : 31)
  );
  return { from: from.getTime(), to: to.getTime() - 1 };
}
function formatDate(timestamp?: number, fallback?: string) {
  return timestamp
    ? new Date(timestamp).toLocaleDateString("en-ET", { dateStyle: "medium" })
    : (fallback ?? "—");
}
function money(value?: number) {
  return value === undefined ? "—" : `${value.toFixed(2)} ETB`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-1 font-mono text-[9px] font-semibold tracking-wide",
        statusTone[status] ?? statusTone.Queued
      )}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}

function InspectionDrawer({
  detail,
  onClose,
}: {
  detail: any;
  onClose: () => void;
}) {
  if (!detail) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/35" onClick={onClose}>
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-border/60 px-5 py-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan">
              Job card inspection
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {detail.code}
            </h2>
            <p className="text-xs text-muted-foreground">
              {detail.orderCode} · {detail.clientName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted/20 hover:text-foreground"
          >
            <X size={17} />
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <section className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Service line</p>
              <p className="mt-1 font-semibold text-foreground">
                {detail.serviceType}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Measurements</p>
              <p className="mt-1 font-semibold text-foreground">
                {detail.dimensions ??
                  `${detail.length ?? "—"} × ${detail.width ?? "—"}`}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Machine</p>
              <p className="mt-1 font-semibold text-foreground">
                {detail.machineName}{" "}
                {detail.machineCode ? `· ${detail.machineCode}` : ""}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Operator</p>
              <p className="mt-1 font-semibold text-foreground">
                {detail.operatorName}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Target completion</p>
              <p className="mt-1 font-semibold text-foreground">
                {formatDate(detail.dueTimestamp, detail.due)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Current status</p>
              <div className="mt-1">
                <StatusBadge status={detail.status} />
              </div>
            </div>
          </section>
          <section className="rounded-xl border border-gold/25 bg-gold/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
              <CheckCircle2 size={14} className="text-gold" /> Payment clearance
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="mt-1 font-semibold text-foreground">
                  {detail.paymentStatus === "PARTIALLY_PAID"
                    ? "50% Advance Paid"
                    : detail.paymentStatus === "FULLY_PAID"
                      ? "Fully Paid"
                      : detail.paymentStatus}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Advance</p>
                <p className="mt-1 font-semibold text-foreground">
                  {money(detail.advancePaidAmount)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Balance</p>
                <p className="mt-1 font-semibold text-foreground">
                  {money(detail.remainingDueAmount)}
                </p>
              </div>
            </div>
          </section>
          <section className="rounded-xl border border-border/60 bg-background/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
              <ClipboardList size={14} className="text-primary" /> Job
              parameters and files
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Quantity</dt>
                <dd className="mt-1 text-foreground">
                  {detail.quantity ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Priority</dt>
                <dd className="mt-1 text-foreground">{detail.priority}</dd>
              </div>
            </dl>
            <div className="mt-3 space-y-3">
              {detail.fileUrl ? (
                <CustomerFilePreview url={detail.fileUrl} fileName={detail.fileName} label="Customer uploaded reference" compact />
              ) : (
                <span className="text-[10px] text-muted-foreground">No customer file attached</span>
              )}
              {detail.attachments?.map((file: any) =>
                file.url ? <CustomerFilePreview key={file.name} url={file.url} fileName={file.name} label="Additional customer attachment" compact /> : null
              )}
            </div>
          </section>
          <section>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
              <Clock3 size={14} className="text-primary" /> Production timeline
            </div>
            <div className="space-y-3 border-l border-border pl-4">
              {detail.timeline?.map((event: any, index: number) => (
                <div
                  key={`${event.label}-${event.at}-${index}`}
                  className="relative"
                >
                  <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                  <p className="text-xs font-semibold text-foreground">
                    {event.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {event.detail} · {formatDate(event.at)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
        <footer className="border-t border-border/60 px-5 py-3 text-center text-[9px] uppercase tracking-[0.16em] text-muted-foreground/60">
          Read-only production inspection · Esc or close to exit
        </footer>
      </aside>
    </div>
  );
}

export function ReceptionistJobCardsWorkspace() {
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<Preset>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("ALL");
  const [machineId, setMachineId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const range = useMemo(
    () =>
      preset !== "all"
        ? dateRange(preset)
        : {
            from: fromDate
              ? new Date(`${fromDate}T00:00:00`).getTime()
              : undefined,
            to: toDate
              ? new Date(`${toDate}T23:59:59.999`).getTime()
              : undefined,
          },
    [preset, fromDate, toDate]
  );
  const data = useQuery(jobsApi.list as any, {
    search: search || undefined,
    status: status === "ALL" ? undefined : status,
    machineId: machineId || undefined,
    from: range.from,
    to: range.to,
    selectedJobId: selectedJobId || undefined,
  });
  const clear = () => {
    setSearch("");
    setPreset("all");
    setFromDate("");
    setToDate("");
    setStatus("ALL");
    setMachineId("");
  };
  if (data === undefined)
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Job Cards…" />
      </div>
    );
  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker={copy.kicker}
        title={`${copy.title} · ${copy.amTitle}`}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<ClipboardList size={16} />}
          label={copy.total}
          subtitle={copy.totalAm}
          value={data.kpis.totalIssued}
          description="Job cards generated from customer orders"
          variant="default"
        />
        <StatCard
          icon={<Factory size={16} />}
          label={copy.production}
          subtitle={copy.productionAm}
          value={data.kpis.inProduction}
          description="Active operator production work"
          variant="default"
        />
        <StatCard
          icon={<CheckCircle2 size={16} />}
          label={copy.ready}
          subtitle={copy.readyAm}
          value={data.kpis.readyForPickup}
          description="Completed work awaiting collection"
          variant="sales"
        />
        <StatCard
          icon={<Clock3 size={16} />}
          label={copy.overdue}
          subtitle={copy.overdueAm}
          value={data.kpis.overdue}
          description="Past target date without clearance"
          variant="alert"
          isAlert={data.kpis.overdue > 0}
        />
      </div>
      <Panel>
        <PanelHeader
          title="Production tracking"
          subtitle="Search and filter issued job cards in real time."
          kicker="Advanced filters"
          icon={<FilterX size={16} />}
        />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[230px] flex-1">
              <Search
                size={14}
                className="absolute left-3 top-3 text-muted-foreground"
              />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search job ID, order code, or client"
                className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-xs text-foreground outline-none focus:border-primary"
              />
            </label>
            <select
              value={status}
              onChange={event => setStatus(event.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground"
            >
              <option value="ALL">All statuses</option>
              <option value="Queued">QUEUED</option>
              <option value="In production">IN_PRODUCTION</option>
              <option value="Completed">COMPLETED</option>
              <option value="Paused">PAUSED</option>
            </select>
            <select
              value={machineId}
              onChange={event => setMachineId(event.target.value)}
              className="h-9 max-w-[210px] rounded-md border border-border bg-background px-3 text-xs text-foreground"
            >
              <option value="">All machines / lines</option>
              {data.machines.map((machine: any) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={clear}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs text-muted-foreground hover:border-primary hover:text-primary"
            >
              <FilterX size={13} /> Clear
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Date
            </span>
            {(
              [
                ["all", "All"],
                ["today", "Today"],
                ["week", "This week"],
                ["month", "This month"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setPreset(value);
                  if (value !== "all") {
                    setFromDate("");
                    setToDate("");
                  }
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-[10px]",
                  preset === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                )}
              >
                {label}
              </button>
            ))}
            <input
              type="date"
              value={fromDate}
              onChange={event => {
                setPreset("all");
                setFromDate(event.target.value);
              }}
              className="h-8 rounded-md border border-border bg-background px-2 text-[10px] text-foreground"
            />
            <span className="text-[10px] text-muted-foreground">to</span>
            <input
              type="date"
              value={toDate}
              onChange={event => {
                setPreset("all");
                setToDate(event.target.value);
              }}
              className="h-8 rounded-md border border-border bg-background px-2 text-[10px] text-foreground"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="border-y border-border/60 bg-background/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Job card</th>
                <th className="px-4 py-3">Parent order</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Service & measurements</th>
                <th className="px-4 py-3">Machine</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Target completion</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {data.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No job cards match the current filters.
                  </td>
                </tr>
              ) : (
                data.rows.map((row: any) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedJobId(row.id)}
                    className="cursor-pointer transition-colors hover:bg-primary/5"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">
                      {row.code}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {row.orderCode}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {row.clientName}
                    </td>
                    <td className="max-w-[190px] px-4 py-3">
                      <p className="truncate text-foreground">
                        {row.serviceType}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {row.dimensions}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.machineName}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={row.status} />
                        {row.overdue ? (
                          <span className="text-[9px] text-amber-400">
                            Delayed
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(row.dueTimestamp, row.due)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          setSelectedJobId(row.id);
                        }}
                        className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/10"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <InspectionDrawer
        detail={data.detail}
        onClose={() => setSelectedJobId(null)}
      />
    </div>
  );
}
