"use client";

import { useMemo, useState } from "react";
import { useQuery, useQuery_experimental } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ArrowUpRight, CalendarDays, Clock3, Plus, Search, Wrench, X, Copy, Check, Lock, Sparkles, Scissors, Trash2 } from "lucide-react";
import type { CustomerOrder, Machine, Material, OrderPriority, CustomerOrderStatus } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { getServiceLabel } from "@/constants/services";
import { Button, NumericInput, Panel, PanelHeader, StatusPill } from "@/components/shared/ui";
import { ModalShell } from "../../modals/modal-shell";
import { OrderDetailsSheet } from "../../widgets/order-details-sheet";
import { cn } from "@/lib/utils";

type DateRange = "all" | "today" | "yesterday" | "thisWeek" | "thisMonth";

const dateRanges: Array<{ value: DateRange; label: string }> = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "thisWeek", label: "This week" },
  { value: "thisMonth", label: "This month" },
];

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function inRange(timestamp: number, range: DateRange): boolean {
  if (range === "all") return true;
  const date = new Date(timestamp);
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (range === "today") return date >= today;
  if (range === "yesterday") return date >= yesterday && date < today;
  if (range === "thisWeek") {
    const start = startOfDay(now);
    start.setDate(start.getDate() - start.getDay());
    return date >= start;
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return date >= start;
}

const statuses: Array<CustomerOrderStatus | "all"> = ["all", "PENDING_REVIEW", "RECEPTION_REVIEW", "PRICED_AND_PENDING_PAYMENT", "CONFIRMED_PAID_OR_CREDIT", "JOB_CARD_CREATED", "IN_PRODUCTION", "COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"];
const priorities: Array<OrderPriority | "all"> = ["all", "High", "Medium", "Low"];

function formatDue(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-ET", { dateStyle: "medium", timeStyle: "short" });
}

function formatNum(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function copyToClipboard(value: string, key: string, setCopiedKey: (key: string | null) => void) {
  if (!value) return;
  void navigator.clipboard.writeText(value).then(() => {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1600);
  });
}

export function OrdersView({
  orders,
  machines,
  materials,
  canManage,
  canCreateOrder,
  onConvert,
  onLockReview,
  onStatus,
  onCreateOrder,
  isPending,
}: {
  orders: CustomerOrder[];
  canManage: boolean;
  canCreateOrder: boolean;
  machines: Machine[];
  materials: Material[];
  onConvert: (order: CustomerOrder) => void;
  onLockReview: (order: CustomerOrder) => void;
  onStatus: (orderId: string, status: CustomerOrderStatus) => void;
  onCreateOrder: () => void;
  isPending: (key: string) => boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerOrderStatus | "all">("all");
  const [priority, setPriority] = useState<OrderPriority | "all">("all");
  const [machine, setMachine] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [selected, setSelected] = useState<CustomerOrder | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const filteredByRange = useMemo(() => orders.filter((order) => inRange(order.createdAt, dateRange)), [dateRange, orders]);

  const filtered = useMemo(() => filteredByRange.filter((order) => {
    const haystack = `${order.code} ${order.clientName} ${order.phone} ${getServiceLabel(order.serviceType) ?? order.serviceType} ${order.dimensions}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase()))
       && (status === "all" ? order.status !== "EXPIRED" && order.status !== "EXPIRED_JUNK" : order.status === status)
      && (priority === "all" || order.priority === priority)
      && (machine === "all" || order.machineId === machine);
  }), [filteredByRange, machine, priority, search, status]);

  const overdue = filteredByRange.filter((order) => order.overdue).length;
  const pending = filteredByRange.filter((order) => order.status !== "COMPLETED").length;

  const selectedMachinesLabel = selected
    ? machines.find((m) => m.id === selected.machineId)?.name
    : undefined;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-line rounded-lg p-4 shadow-sm">
          <span className="block text-[10px] font-mono tracking-wider uppercase text-muted-foreground mb-1">QUEUE TOTAL</span>
          <strong className="block text-2xl font-bold text-navy">{orders.length}</strong>
          <small className="text-xs text-gray-500">Public and walk-in orders</small>
        </div>
        <div className="bg-white border border-line rounded-lg p-4 shadow-sm">
          <span className="block text-[10px] font-mono tracking-wider uppercase text-muted-foreground mb-1">OPEN</span>
          <strong className="block text-2xl font-bold text-navy">{pending}</strong>
          <small className="text-xs text-gray-500">Still moving through production</small>
        </div>
        <div className={cn("bg-white border border-line rounded-lg p-4 shadow-sm", overdue > 0 && "border-coral/50 bg-coral/5")}>
          <span className="block text-[10px] font-mono tracking-wider uppercase text-muted-foreground mb-1">OVERDUE</span>
          <strong className={cn("block text-2xl font-bold", overdue > 0 ? "text-coral" : "text-navy")}>{overdue}</strong>
          <small className="text-xs text-gray-500">Due date has passed</small>
        </div>
      </div>

      {/* Orders Panel */}
      <Panel>
        <PanelHeader
          title="Orders ready for action"
          kicker="LIVE WORK QUEUE"
          action={
            <div className="flex items-center gap-2">
              {canCreateOrder ? <Button size="small" variant="primary" onClick={onCreateOrder}><Plus size={15} />New Order</Button> : null}
              <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-green/10 text-green text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-green animate-pulse" />Realtime
              </span>
            </div>
          }
        />

        {/* Filters */}
        <div className="p-4 border-b border-line flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-line flex-1 min-w-[200px]">
            <Search size={15} className="text-gray-400" />
            <input 
              placeholder="Search order, client, phone..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-ink placeholder:text-gray-400"
            />
            {search ? <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600"><X size={13} /></button> : null}
          </label>
          <select 
            value={status} 
            onChange={(e) => setStatus(e.target.value as CustomerOrderStatus | "all")}
            className="px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink outline-none focus:border-cyan"
          >
            {statuses.map((v) => <option key={v} value={v}>{v === "all" ? "All statuses" : v}</option>)}
          </select>
          <select 
            value={priority} 
            onChange={(e) => setPriority(e.target.value as OrderPriority | "all")}
            className="px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink outline-none focus:border-cyan"
          >
            {priorities.map((v) => <option key={v} value={v}>{v === "all" ? "All priorities" : v}</option>)}
          </select>
          <select 
            value={machine} 
            onChange={(e) => setMachine(e.target.value)}
            className="px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink outline-none focus:border-cyan"
          >
            <option value="all">All machines</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink outline-none focus:border-cyan"
            aria-label="Date range"
          >
            {dateRanges.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="divide-y divide-line">
          {/* Table Header */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1.2fr_1fr_1.2fr] gap-4 px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">
            <span>Order / Client</span>
            <span>Service</span>
            <span>Priority</span>
            <span>Due</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No orders match the current filters.</div>
          ) : filtered.reverse().map((order) => (
            <div
              className={cn(
                "grid grid-cols-[2fr_1.5fr_1fr_1.2fr_1fr_1.2fr] gap-4 px-4 py-3 items-center transition-colors cursor-pointer",
                "border-l-4 border-l-transparent",
                selected?.id === order.id
                  ? "bg-[#1E293B] border-l-[#00B4D8]"
                  : "hover:bg-[#16202f]",
                order.overdue && "bg-rose-950/20"
              )}
              key={order.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(order)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelected(order);
                }
              }}
            >
              {/* Order/Client */}
              <div className="min-w-0">
                <b className="block text-sm font-semibold text-navy truncate">{order.code}</b>
                <span className="block text-xs text-gray-600 truncate">{order.clientName}</span>
                <small className="text-xs text-gray-400">{order.phone}</small>
                {order.companyLegalName || order.tinNumber ? (
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    {order.companyLegalName ? (
                      <button
                        onClick={(event) => { event.stopPropagation(); copyToClipboard(order.companyLegalName as string, `company-${order.id}`, setCopiedKey); }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-medium text-gray-600 hover:bg-gray-200 hover:text-navy"
                        title={`Verified company: ${order.companyLegalName}`}
                      >
                        {copiedKey === `company-${order.id}` ? <Check size={10} /> : <Copy size={10} />}
                        {copiedKey === `company-${order.id}` ? "Copied" : "Company"}
                      </button>
                    ) : null}
                    {order.tinNumber ? (
                      <button
                        onClick={(event) => { event.stopPropagation(); copyToClipboard(order.tinNumber as string, `tin-${order.id}`, setCopiedKey); }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-medium text-gray-600 hover:bg-gray-200 hover:text-navy"
                        title={`TIN: ${order.tinNumber}`}
                      >
                        {copiedKey === `tin-${order.id}` ? <Check size={10} /> : <Copy size={10} />}
                        TIN {order.tinNumber}
                      </button>
                    ) : null}
                  </span>
                ) : null}
              </div>
              
              {/* Service */}
              <div className="min-w-0">
                <b className="block text-sm font-semibold text-navy truncate">{getServiceLabel(order.serviceType) ?? order.serviceType}</b>
                <span className="block text-xs text-gray-600 truncate">{order.dimensions} · Qty {order.quantity}</span>
                {order.fileUrl ? <a className="text-xs text-cyan hover:text-cyan-dark underline" href={order.fileUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Open {order.fileName ?? "artwork"}</a> : null}
              </div>
              
              {/* Priority */}
              <div className="flex items-center">
                <StatusPill variant={order.priority === "High" ? "danger" : order.priority === "Medium" ? "warning" : "success"}>
                  {order.priority}
                </StatusPill>
              </div>
              
              {/* Due */}
              <div className="flex items-center gap-2 min-w-0">
                <Clock3 size={13} className="text-gray-400 flex-none" />
                <span className="text-xs text-gray-600 truncate">{formatDue(order.preferredDueDate)}</span>
                {order.overdue ? <small className="text-xs font-semibold text-coral">Overdue</small> : null}
              </div>
              
              {/* Status */}
              <div className="min-w-0">
                <StatusPill 
                  variant={order.status === "COMPLETED" || order.status === "READY_FOR_PICKUP" ? "success" : order.overdue ? "warning" : "info"}
                >
                  {order.status}
                </StatusPill>
                {order.machineName ? <small className="block text-xs text-gray-500 mt-1">{order.machineName}</small> : null}
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2">
                {canManage && !order.jobCardId && order.status === "PENDING_REVIEW" ? (
                  <Button 
                    size="small" 
                    variant="primary" 
                    disabled={isPending(`lock-${order.id}`)} 
                    onClick={(event) => { event.stopPropagation(); onLockReview(order); }}
                  >
                    <Wrench size={13} />
                    {isPending(`lock-${order.id}`) ? "Locking…" : "Begin Review"}
                  </Button>
                ) : null}
                {canManage && !order.jobCardId && order.status === "RECEPTION_REVIEW" ? (
                  <Button 
                    size="small" 
                    variant="primary" 
                    disabled={isPending(`price-${order.id}`)} 
                    onClick={(event) => { event.stopPropagation(); onConvert(order); }}
                  >
                    <Wrench size={13} />
                    {isPending(`price-${order.id}`) ? "Pricing…" : "Price Order"}
                  </Button>
                ) : null}
                {canManage && !order.jobCardId && order.status === "PRICED_AND_PENDING_PAYMENT" ? (
                  <Button 
                    size="small" 
                    variant="primary" 
                    disabled={isPending(`confirm-${order.id}`)} 
                    onClick={(event) => { event.stopPropagation(); onConvert(order); }}
                  >
                    <Wrench size={13} />
                    {isPending(`confirm-${order.id}`) ? "Confirming…" : "Confirm & Issue Job Card"}
                  </Button>
                ) : null}
                {canManage && order.jobCardId && order.status === "IN_PRODUCTION" ? (
                  <Button 
                    size="small" 
                    variant="secondary" 
                    disabled={isPending(`order-status-${order.id}`)} 
                    onClick={(event) => { event.stopPropagation(); onStatus(order.id, "COMPLETED"); }}
                  >
                    {isPending(`order-status-${order.id}`) ? "Saving..." : "Complete"}
                  </Button>
                ) : null}
                <ArrowUpRight size={14} className="text-gray-300 flex-none" aria-hidden />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {selected ? (
        <OrderDetailsSheet
          order={selected}
          machinesLabel={selectedMachinesLabel}
          canManage={canManage}
          isPending={isPending}
          onConvert={onConvert}
          onLockReview={onLockReview}
          onStatus={onStatus}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

export function OrderPriceModal({ order, onClose, onSave }: { order: CustomerOrder; onClose: () => void; onSave: (amount: number) => void }) {
  const [amount, setAmount] = useState(String(order.amount || ""));
  const [amountValid, setAmountValid] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const parsedAmount = Number(amount);
  const hasValidationError = !amount.trim() || !amountValid || !Number.isFinite(parsedAmount) || parsedAmount <= 0;

  return (
    <ModalShell
      title={`${order.code} · Set Price`}
      subtitle="Enter the final total price in ETB. The order will move to payment verification."
      kicker="PRICE ORDER"
      onClose={onClose}
      footer={
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="tertiary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button 
            type="submit" 
            variant="primary" 
             disabled={submitting || hasValidationError}
             onClick={() => {
               if (submitting || hasValidationError) return;
               setSubmitting(true);
               onSave(parsedAmount);
            }}
          >
            {submitting ? "Saving…" : "Set Price & Request Payment"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-cyan/10 rounded-lg border border-cyan/20">
          <ArrowUpRight size={17} className="text-cyan flex-none" />
          <span className="text-sm text-gray-600">Order</span>
          <strong className="text-sm text-navy">{order.code}</strong>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><small className="text-muted-foreground">Client</small><br /><strong className="text-navy">{order.clientName}</strong></div>
        <div><small className="text-muted-foreground">Service</small><br /><strong className="text-navy">{getServiceLabel(order.serviceType) ?? order.serviceType}</strong></div>
          <div><small className="text-muted-foreground">Dimensions</small><br /><strong className="text-navy">{order.dimensions}</strong></div>
          <div><small className="text-muted-foreground">Quantity</small><br /><strong className="text-navy">{order.quantity}</strong></div>
        </div>

        <label className="block">
          <span className="block text-sm font-semibold text-navy mb-2">Final Total Price (ETB)</span>
           <NumericInput
             min={0}
             step="0.01"
             value={amount}
             emptyValue={0}
             onChange={setAmount}
             onValidityChange={setAmountValid}
             className="w-full px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink outline-none focus:border-cyan"
           />
        </label>
      </div>
    </ModalShell>
  );
}

export function OrderReviewLockModal({ order, onClose, onSave }: { order: CustomerOrder; onClose: () => void; onSave: (reason?: string) => void }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <ModalShell
      title={`${order.code} · Start Review`}
      subtitle="Lock the customer request so no further edits are accepted while you price and confirm it."
      kicker="REVIEW LOCK"
      onClose={onClose}
      footer={
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="tertiary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            onClick={() => {
              if (submitting) return;
              setSubmitting(true);
              onSave(reason.trim() || undefined);
            }}
          >
            {submitting ? "Locking…" : "Lock & Start Review"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-cyan/10 rounded-lg border border-cyan/20">
          <Lock size={15} className="text-cyan flex-none" />
          <span className="text-sm text-gray-600">
            The customer will no longer be able to edit this request after this action. Pricing stays the next step.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><small className="text-muted-foreground">Client</small><br /><strong className="text-navy">{order.clientName}</strong></div>
          <div><small className="text-muted-foreground">Service</small><br /><strong className="text-navy">{getServiceLabel(order.serviceType) ?? order.serviceType}</strong></div>
          <div><small className="text-muted-foreground">Dimensions</small><br /><strong className="text-navy">{order.dimensions}</strong></div>
          <div><small className="text-muted-foreground">Quantity</small><br /><strong className="text-navy">{order.quantity}</strong></div>
        </div>

        <label className="block">
          <span className="block text-sm font-semibold text-navy mb-2">Review note (optional)</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="e.g. Waiting on the customer to confirm the LED color before pricing."
            className="w-full px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink outline-none focus:border-cyan resize-none"
          />
        </label>
      </div>
    </ModalShell>
  );
}

export function OrderConfirmModal({ order, machines, materials, onClose, onSave }: { order: CustomerOrder; machines: Machine[]; materials: Material[]; onClose: () => void; onSave: (input: { paymentDecision: "ADVANCE_PAID" | "APPROVED_CREDIT"; paymentMethod?: string; advancePaidAmount?: number; priority?: OrderPriority }) => void }) {
  const [paymentDecision, setPaymentDecision] = useState<"ADVANCE_PAID" | "APPROVED_CREDIT">("ADVANCE_PAID");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [advancePaidAmount, setAdvancePaidAmount] = useState(String(order.advanceDueAmount ?? (order.amount ? order.amount / 2 : "")));
  const [copiedPaymentAccount, setCopiedPaymentAccount] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Non-throwing query form: when the server rejects the routing preview we
  // render the ConvexError message inline instead of letting the error blow up
  // the whole workspace with an opaque "Server Error".
  const previewResult = useQuery_experimental({
    query: api.orders.previewAutoRouting,
    args: { orderId: order.id as Id<"customerOrders"> },
    throwOnError: false,
  });
  const dispatchPreviewError =
    previewResult.status === "error"
      ? (previewResult.error as Error & { data?: unknown })
      : null;
  const dispatchPreview =
    previewResult.status === "success" ? previewResult.data : null;
  const previewErrorMessage =
    dispatchPreviewError &&
    typeof dispatchPreviewError.data === "string" &&
    dispatchPreviewError.data.trim()
      ? dispatchPreviewError.data
      : dispatchPreviewError?.message ||
        "Could not preview the production routing for this order.";
  const dispatchBlocked =
    !dispatchPreview || !dispatchPreview.canDispatch || Boolean(dispatchPreviewError);

  return (
    <ModalShell
      title={`${order.code} · Confirm Payment & Issue Job Card`}
      subtitle="Verify payment to trigger automated machine routing and job card creation. Manual allocation is disabled per ERP rules."
      kicker="AUTOMATED PRODUCTION DISPATCH"
      onClose={onClose}
      footer={
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="tertiary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button 
            type="submit" 
            variant="primary" 
             disabled={submitting || dispatchBlocked || (paymentDecision === "ADVANCE_PAID" && (!paymentMethod.trim() || !advancePaidAmount))}
            onClick={() => {
                if (submitting || dispatchBlocked) return;
              if (paymentDecision === "ADVANCE_PAID" && (!paymentMethod.trim() || !advancePaidAmount)) return;
              setSubmitting(true);
              onSave({ 
                paymentDecision, 
                paymentMethod: paymentDecision === "ADVANCE_PAID" ? paymentMethod.trim() : undefined,
                advancePaidAmount: paymentDecision === "ADVANCE_PAID" ? Number(advancePaidAmount) : undefined,
                 priority: order.priority 
              });
            }}
          >
            {submitting ? "Dispatching…" : "Confirm & Auto-Create Job Card"} <ArrowUpRight size={16} />
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Order Info Box */}
        <div className="flex items-center gap-3 p-3 bg-cyan/10 rounded-lg border border-cyan/20">
          <ArrowUpRight size={17} className="text-cyan flex-none" />
          <span className="text-sm text-gray-600">Order</span>
          <strong className="text-sm text-navy">{order.code}</strong>
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <Sparkles size={12} /> Auto-Calculated
          </span>
        </div>

        {/* Order Details Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><small className="text-muted-foreground">Client</small><br /><strong className="text-navy">{order.clientName}</strong></div>
          <div><small className="text-muted-foreground">Phone</small><br /><strong className="text-navy">{order.phone}</strong></div>
          <div><small className="text-muted-foreground">Service</small><br /><strong className="text-navy">{getServiceLabel(order.serviceType) ?? order.serviceType}</strong></div>
          <div><small className="text-muted-foreground">Total Price</small><br /><strong className="text-navy">{order.amount ? `${order.amount.toFixed(2)} ETB` : "—"}</strong></div>
          <div><small className="text-muted-foreground">Dimensions</small><br /><strong className="text-navy">{order.dimensions}</strong></div>
          <div><small className="text-muted-foreground">Order Quantity</small><br /><strong className="text-navy">{order.quantity}</strong></div>
        </div>

        {/* Payment Verification Section */}
        <div className="space-y-3 p-4 bg-gold/10 rounded-lg border border-gold/20">
          <span className="block text-sm font-semibold text-navy">Payment Verification</span>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="paymentDecision" 
                value="ADVANCE_PAID"
                checked={paymentDecision === "ADVANCE_PAID"}
                onChange={() => setPaymentDecision("ADVANCE_PAID")}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Advance Payment Received ✅</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="paymentDecision" 
                value="APPROVED_CREDIT" 
                checked={paymentDecision === "APPROVED_CREDIT"}
                onChange={() => setPaymentDecision("APPROVED_CREDIT")}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Approved Credit 📒</span>
            </label>
          </div>
          {paymentDecision === "ADVANCE_PAID" && (
            <label className="block mt-2">
              <span className="block text-xs font-semibold text-navy mb-1">Required advance ({(order.advanceDueAmount ?? (order.amount ? order.amount / 2 : 0)).toFixed(2)} ETB)</span>
              <input type="number" min="0" step="0.01" value={advancePaidAmount} onChange={(e) => setAdvancePaidAmount(e.target.value)} className="mb-2 w-full px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink outline-none focus:border-cyan" />
              <span className="block text-xs font-semibold text-navy mb-1">Payment Method</span>
              <input 
                type="text" 
                placeholder="e.g. Telebirr, CBE Bank Transfer, Cash"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink outline-none focus:border-cyan"
              />
            </label>
          )}
          {order.paymentInstructionsSnapshot?.accounts.length ? (
            <div className="mt-4 space-y-2 border-t border-gold/20 pt-3">
              <span className="block text-xs font-semibold text-navy">Customer payment accounts</span>
              {order.paymentInstructionsSnapshot.accounts.map((account) => (
                <div key={`${account.channel}-${account.identifier}`} className="flex items-center justify-between gap-3 rounded-md border border-line bg-white px-3 py-2">
                  <div className="min-w-0">
                    <span className="block text-[11px] font-semibold text-navy">{account.label}</span>
                    <span className="block truncate text-[11px] text-gray-500">{account.name} · {account.identifier}</span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex flex-none items-center gap-1 rounded-md border border-line px-2 py-1 text-[10px] font-semibold text-gray-600 hover:border-cyan hover:text-navy"
                    onClick={() => copyToClipboard(account.identifier, `payment-${account.channel}`, setCopiedPaymentAccount)}
                  >
                    {copiedPaymentAccount === `payment-${account.channel}` ? <Check size={11} /> : <Copy size={11} />}
                    {copiedPaymentAccount === `payment-${account.channel}` ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-4 rounded-xl border border-border-token bg-surface p-4">

          {dispatchPreviewError ? (
            <div className="rounded-lg border border-danger/40 bg-danger/15 p-3 text-xs text-danger" role="alert">
              <strong className="block font-bold">Cannot Preview Auto-Routing:</strong>
              <p className="mt-1 font-mono text-[11px] leading-relaxed break-all">{previewErrorMessage}</p>
              {!dispatchPreviewError.data ? (
                <p className="mt-2 text-[10px] text-text-secondary">
                  Contact the owner to register the routed raw material or machine, then retry.
                </p>
              ) : null}
            </div>
          ) : dispatchPreview ? (
            <>
              {/* Section 1: Workstation & Material Summary */}
              <div className="grid gap-3 rounded-lg bg-surface-elevated p-3 text-xs sm:grid-cols-2">
                <div>
                  <span className="block text-text-secondary">Assigned Workstation</span>
                  <strong className="text-sm font-bold text-text-primary">{dispatchPreview.machineName}</strong>
                </div>
                <div>
                  <span className="block text-text-secondary">Required Material</span>
                  <strong className="text-sm font-bold text-text-primary">{dispatchPreview.materialCheck.materialName}</strong>
                </div>
                <div>
                  <span className="block text-text-secondary">Base Production Size</span>
                  <span className="font-semibold text-text-primary">
                    {dispatchPreview.netBaseQuantity} {dispatchPreview.unit}
                    {dispatchPreview.standardWasteMargin ? ` (+${dispatchPreview.standardWasteMargin}% waste buffer)` : ""}
                  </span>
                </div>
                <div>
                  <span className="block text-text-secondary">Approved Scrap Allowance</span>
                  <span className="font-semibold text-text-primary">
                    {dispatchPreview.approvedScrapQuantity} {dispatchPreview.unit} (up to {dispatchPreview.maxAllowedScrapLimit}%)
                  </span>
                </div>
              </div>

              {/* Auto-Calculated Production Breakdown Card */}
              {dispatchPreview.breakdown ? (
                <div className="space-y-2 rounded-lg border border-brand-primary-bg bg-surface-elevated p-3 text-xs">
                  <div className="flex items-center justify-between border-b border-border-token pb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                      Auto-Calculated Production Breakdown
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan">
                      <Sparkles size={11} /> Deterministic
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Gross Material Deducted</span>
                    <span className="font-semibold text-text-primary">
                      {formatNum(dispatchPreview.breakdown.grossArea)} m²
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Net Job Area</span>
                    <span className="font-semibold text-text-primary">
                      {formatNum(dispatchPreview.breakdown.netArea)} m²
                    </span>
                  </div>

                  {dispatchPreview.breakdown.usableOffcut ? (
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-text-secondary">
                        <Scissors size={13} className="text-green flex-none" /> Auto-Registered Off-Cut
                      </span>
                      <span className="text-right font-semibold text-green">
                        {dispatchPreview.breakdown.usableOffcut.label}
                        <span className="block text-[11px] text-text-secondary">
                          ({formatNum(dispatchPreview.breakdown.usableOffcut.area)} m² Usable Side Roll)
                        </span>
                      </span>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <Trash2 size={13} className="text-warning flex-none" /> Auto-Registered Scrap
                    </span>
                    <span className="font-semibold text-warning">
                      {formatNum(dispatchPreview.breakdown.totalScrapArea)} m² (Owner Margin Included)
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Section 2: Raw Material Status */}
              <div
                className={
                  dispatchPreview.materialCheck.sufficient
                    ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300"
                    : "rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
                }
              >
                <div className="flex items-center justify-between">
                  <strong className="font-bold">
                    {dispatchPreview.materialCheck.sufficient
                      ? "Sufficient Raw Material Verified"
                      : "Insufficient Raw Material"}
                  </strong>
                  <span className="font-semibold">
                    {dispatchPreview.materialCheck.availableQuantity} {dispatchPreview.materialCheck.unit} available /{" "}
                    {dispatchPreview.materialCheck.requiredQuantity} {dispatchPreview.materialCheck.unit} required
                  </span>
                </div>
              </div>

              {/* Section 3: Ink Status & Per-Color Breakdown */}
              <div
                className={
                  dispatchPreview.inkCheck.sufficient
                    ? "space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300"
                    : "space-y-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
                }
              >
                <div className="flex items-center justify-between">
                  <strong className="font-bold">
                    {dispatchPreview.inkCheck.sufficient ? "Sufficient Ink Verified" : "Insufficient Ink Stock"}
                  </strong>
                  {dispatchPreview.inkCheck.required && (
                    <span className="font-semibold">
                      {dispatchPreview.inkCheck.availableLitres} L total / {dispatchPreview.inkCheck.requiredLitres} L total
                    </span>
                  )}
                </div>

                {dispatchPreview.inkCheck.required ? (
                  dispatchPreview.inkCheck.items && dispatchPreview.inkCheck.items.length > 0 ? (
                    <div className="mt-2 space-y-1.5 border-t border-current/20 pt-2">
                      {dispatchPreview.inkCheck.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px]">
                          <span className="font-medium">
                            {item.inkColor ? `${item.inkColor} (${item.materialName})` : item.materialName}
                          </span>
                          <span className={item.sufficient ? "font-semibold text-emerald-700 dark:text-emerald-200" : "font-bold text-danger"}>
                            {item.availableLitres} L in stock / {item.requiredLitres} L needed ({item.sufficient ? "OK" : "Shortage"})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] opacity-90">
                      {dispatchPreview.inkCheck.materialNames?.join(", ") || "Machine ink"}: {dispatchPreview.inkCheck.availableLitres} L available / {dispatchPreview.inkCheck.requiredLitres} L required.
                    </div>
                  )
                ) : (
                  <div className="text-[11px] opacity-80">This workstation does not require tracked liquid ink.</div>
                )}
              </div>

              {/* Section 4: Dispatch Error Notice */}
              {!dispatchPreview.canDispatch && (
                <div className="rounded-lg border border-danger/40 bg-danger/15 p-3 text-xs text-danger">
                  <strong className="block font-bold">Cannot Dispatch Job Card:</strong>
                  <ul className="mt-1 list-disc pl-4 space-y-0.5">
                    {dispatchPreview.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="m-0 text-xs text-text-secondary">Validating equipment, raw material, and ink inventory…</p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
