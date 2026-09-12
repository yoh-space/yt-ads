"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OwnerPageHeader } from "@/components/dashboard/roles/owner/owner-page-header";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import {
  BarChart3,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FilterX,
  PackageCheck,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const revenueApi = (api.owner.revenue as any).getRevenueWorkspace;
const etb = (value: number) =>
  `ETB ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const paymentTone: Record<string, string> = {
  "ADVANCE_50%": "border-cyan/25 bg-cyan/10 text-cyan",
  SETTLEMENT: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  FULL_PAYMENT: "border-violet-500/25 bg-violet-500/10 text-violet-300",
};
function dateValue(value: string) {
  return value ? new Date(value).getTime() : undefined;
}
function formatTimestamp(value: number) {
  return new Date(value).toLocaleString("en-ET", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function FinancialDrawer({
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
              Financial inspection
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {detail.orderCode}
            </h2>
            <p className="text-xs text-muted-foreground">
              {detail.customerName} · {detail.paymentType}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted/20"
          >
            <X size={17} />
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <section className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Customer contact</p>
              <p className="mt-1 font-semibold text-foreground">
                {detail.phone ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Service</p>
              <p className="mt-1 font-semibold text-foreground">
                {detail.serviceType ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Dimensions</p>
              <p className="mt-1 font-semibold text-foreground">
                {detail.dimensions ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Transaction</p>
              <p className="mt-1 font-semibold text-foreground">
                {etb(detail.amount)} · {detail.paymentChannel}
              </p>
            </div>
          </section>
          <section className="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
              <BarChart3 size={14} className="text-primary" /> Profit
              realization
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Gross revenue</p>
                <p className="mt-1 font-semibold text-foreground">
                  {etb(detail.orderAmount)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Actual COGS</p>
                <p className="mt-1 font-semibold text-amber-300">
                  {etb(detail.realizedCost)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Gross profit</p>
                <p className="mt-1 font-semibold text-emerald-400">
                  {etb(detail.grossProfit)}
                </p>
              </div>
            </div>
          </section>
          <section>
            <p className="mb-3 text-xs font-semibold text-foreground">
              Payment audit history
            </p>
            <div className="space-y-2">
              {detail.paymentAudit?.map((item: any) => (
                <div
                  key={`${item.type}-${item.timestamp}`}
                  className="rounded-lg border border-border/60 bg-background/30 p-3 text-xs"
                >
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-foreground">
                      {item.type}
                    </span>
                    <span className="text-emerald-400">{etb(item.amount)}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {item.method} · {formatTimestamp(item.timestamp)}
                    {item.reference ? ` · Ref ${item.reference}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <section>
            <p className="mb-3 text-xs font-semibold text-foreground">
              Associated job cards
            </p>
            <div className="space-y-2">
              {detail.jobs?.length ? (
                detail.jobs.map((job: any) => (
                  <div
                    key={job.code}
                    className="rounded-lg border border-border/60 bg-background/30 p-3 text-xs"
                  >
                    <div className="flex justify-between">
                      <span className="font-mono font-semibold text-foreground">
                        {job.code}
                      </span>
                      <span className="text-muted-foreground">
                        {job.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {job.title} · {job.machineName ?? "Machine"} · due{" "}
                      {job.due}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  No job card linked.
                </p>
              )}
            </div>
          </section>
          <section>
            <p className="mb-3 text-xs font-semibold text-foreground">
              Realized job material cost
            </p>
            <div className="space-y-2">
              {detail.costLines?.length ? (
                detail.costLines.map((line: any, index: number) => (
                  <div
                    key={`${line.materialName}-${index}`}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs"
                  >
                    <span className="text-muted-foreground">
                      {line.materialName} · {line.quantity} {line.unit} ×{" "}
                      {etb(line.unitCost)}
                    </span>
                    <strong className="text-foreground">
                      {etb(line.cost)}
                    </strong>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  No production consumption has been recorded yet.
                </p>
              )}
            </div>
          </section>
        </div>
        <footer className="border-t border-border/60 px-5 py-3 text-center text-[9px] uppercase tracking-[0.16em] text-muted-foreground/60">
          Owner-only financial detail
        </footer>
      </aside>
    </div>
  );
}

export default function OwnerRevenuePage() {
  const [preset, setPreset] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [shift, setShift] = useState("ALL");
  const [hourStart, setHourStart] = useState("");
  const [hourEnd, setHourEnd] = useState("");
  const [method, setMethod] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const bounds = useMemo(() => {
    if (preset === "all") return { from: dateValue(from), to: dateValue(to) };
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (preset === "week")
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    if (preset === "month") start.setDate(1);
    const end = new Date(start);
    end.setDate(
      end.getDate() + (preset === "today" ? 1 : preset === "week" ? 7 : 31)
    );
    return { from: start.getTime(), to: end.getTime() - 1 };
  }, [preset, from, to]);
  const data = useQuery(revenueApi, {
    ...bounds,
    shift,
    hourStart: hourStart ? Number(hourStart) : undefined,
    hourEnd: hourEnd ? Number(hourEnd) : undefined,
    paymentMethod: method,
    paymentStatus: status,
    selectedTransactionId: selectedId ?? undefined,
  });
  const clear = () => {
    setPreset("all");
    setFrom("");
    setTo("");
    setShift("ALL");
    setHourStart("");
    setHourEnd("");
    setMethod("ALL");
    setStatus("ALL");
  };
  if (data === undefined)
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Revenue…" />
      </div>
    );
  return (
    <div className="space-y-6">
      <OwnerPageHeader
        kicker="Revenue & Profit · ገቢ እና ትርፍ"
        title="Revenue & Profit"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<CircleDollarSign size={16} />}
          label="Realized Revenue"
          subtitle="የተሰበሰበ ገቢ"
          value={etb(data.kpis.realizedRevenue)}
          description="Filtered payment collections"
          variant="sales"
        />
        <StatCard
          icon={<PackageCheck size={16} />}
          label="Actual Material COGS"
          subtitle="የተጠቀሰ የግብዓት ወጪ"
          value={etb(data.kpis.materialCost)}
          description="Production consumption only"
          variant="cost"
        />
        <StatCard
          icon={<BarChart3 size={16} />}
          label="Gross Profit"
          subtitle="ጠቅላላ ትርፍ"
          value={etb(data.kpis.grossProfit)}
          description={`${data.kpis.margin}% realized margin`}
          variant="profit"
        />
        <StatCard
          icon={<CreditCard size={16} />}
          label="Collections"
          subtitle="የክፍያ መዝገቦች"
          value={data.transactions.length}
          description="Filtered financial transactions"
          variant="default"
        />
      </div>
      <Panel>
        <PanelHeader
          title="Revenue filters"
          subtitle="Date, shift, payment channel, and settlement state"
          kicker="Financial controls"
          icon={<FilterX size={16} />}
        />
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="flex flex-wrap gap-1">
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
                onClick={() => setPreset(value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[10px]",
                  preset === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="datetime-local"
            value={from}
            onChange={event => {
              setPreset("all");
              setFrom(event.target.value);
            }}
            className="h-8 rounded-md border border-border bg-background px-2 text-[10px] text-foreground"
          />
          <span className="text-[10px] text-muted-foreground">to</span>
          <input
            type="datetime-local"
            value={to}
            onChange={event => {
              setPreset("all");
              setTo(event.target.value);
            }}
            className="h-8 rounded-md border border-border bg-background px-2 text-[10px] text-foreground"
          />
          <select
            value={shift}
            onChange={event => setShift(event.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-[10px] text-foreground"
          >
            <option value="ALL">All shifts</option>
            <option value="MORNING">Morning</option>
            <option value="AFTERNOON">Afternoon</option>
            <option value="EVENING">Evening</option>
            <option value="NIGHT">Night</option>
          </select>
          <select
            value={hourStart}
            onChange={event => setHourStart(event.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-[10px] text-foreground"
          >
            <option value="">Hour from</option>
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, "0")}:00
              </option>
            ))}
          </select>
          <select
            value={hourEnd}
            onChange={event => setHourEnd(event.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-[10px] text-foreground"
          >
            <option value="">Hour to</option>
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, "0")}:00
              </option>
            ))}
          </select>
          <select
            value={method}
            onChange={event => setMethod(event.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-[10px] text-foreground"
          >
            <option value="ALL">All channels</option>
            <option>CBE</option>
            <option>BOA</option>
            <option>Telebirr</option>
            <option>Cash</option>
          </select>
          <select
            value={status}
            onChange={event => setStatus(event.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-[10px] text-foreground"
          >
            <option value="ALL">All payment states</option>
            <option value="ADVANCE_50%">ADVANCE_50%</option>
            <option value="SETTLEMENT">SETTLEMENT</option>
            <option value="FULL_PAYMENT">FULL_PAYMENT</option>
          </select>
          <button
            type="button"
            onClick={clear}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-[10px] text-muted-foreground hover:border-primary hover:text-primary"
          >
            <FilterX size={12} /> Clear
          </button>
        </div>
      </Panel>
      <Panel>
        <PanelHeader
          title="Recent collections"
          subtitle="Interactive payment and realization ledger"
          kicker="Transactions"
          icon={<Clock3 size={16} />}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="border-y border-border/60 bg-background/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Payment type</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {data.transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No payment transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                data.transactions.map((transaction: any) => (
                  <tr
                    key={transaction.id}
                    onClick={() => setSelectedId(transaction.id)}
                    className="cursor-pointer transition-colors hover:bg-primary/5"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">
                      {transaction.orderCode}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {transaction.customerName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {transaction.paymentType}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {transaction.paymentChannel}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatTimestamp(transaction.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {etb(transaction.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-1 font-mono text-[9px]",
                          paymentTone[transaction.status]
                        )}
                      >
                        {transaction.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          setSelectedId(transaction.id);
                        }}
                        className="rounded-md border border-border px-2 py-1 text-[10px] text-primary"
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
      <FinancialDrawer
        detail={data.detail}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
