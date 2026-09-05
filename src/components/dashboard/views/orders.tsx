"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, Clock3, Plus, Search, Wrench, X, Copy, Check } from "lucide-react";
import type { CustomerOrder, Machine, Material, OrderPriority, CustomerOrderStatus } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { getServiceLabel } from "@/constants/services";
import { Button, Panel, PanelHeader, StatusPill } from "@/components/ui";
import { ModalShell } from "../modals/modal-shell";
import { OrderDetailsSheet } from "./order-details-sheet";
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

const statuses: Array<CustomerOrderStatus | "all"> = ["all", "PENDING_REVIEW", "PRICED_AND_PENDING_PAYMENT", "CONFIRMED_PAID_OR_CREDIT", "JOB_CARD_CREATED", "IN_PRODUCTION", "COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"];
const priorities: Array<OrderPriority | "all"> = ["all", "High", "Medium", "Low"];

function formatDue(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-ET", { dateStyle: "medium", timeStyle: "short" });
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
          subtitle="Live work queue"
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
          ) : filtered.map((order) => (
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

      <p className="text-xs text-gray-500">Creating a job card from an order carries client details automatically. Material is deducted when production is recorded, not at creation.</p>

      {selected ? (
        <OrderDetailsSheet
          order={selected}
          machinesLabel={selectedMachinesLabel}
          canManage={canManage}
          isPending={isPending}
          onConvert={onConvert}
          onStatus={onStatus}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

export function OrderPriceModal({ order, onClose, onSave }: { order: CustomerOrder; onClose: () => void; onSave: (amount: number) => void }) {
  const [amount, setAmount] = useState(order.amount || 0);
  const [submitting, setSubmitting] = useState(false);

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
            disabled={submitting || amount <= 0}
            onClick={() => {
              if (submitting || amount <= 0) return;
              setSubmitting(true);
              onSave(amount);
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
          <input 
            type="number" 
            min="0" 
            step="0.01" 
            value={amount} 
            onChange={(event) => setAmount(Number(event.target.value))}
            className="w-full px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink outline-none focus:border-cyan"
          />
        </label>
      </div>
    </ModalShell>
  );
}

export function OrderConfirmModal({ order, machines, materials, onClose, onSave }: { order: CustomerOrder; machines: Machine[]; materials: Material[]; onClose: () => void; onSave: (input: { paymentDecision: "PAID" | "APPROVED_CREDIT"; paymentMethod?: string; machineId: string; materialId: string; quantity: number; unit: Material["unit"]; priority?: OrderPriority }) => void }) {
  const [machineId, setMachineId] = useState(machines[0]?.id ?? "");
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [paymentDecision, setPaymentDecision] = useState<"PAID" | "APPROVED_CREDIT">("PAID");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const material = materials.find((entry) => entry.id === materialId);
  const machine = machines.find((entry) => entry.id === machineId);

  return (
    <ModalShell
      title={`${order.code} · Confirm Payment & Issue Job Card`}
      subtitle="Verify payment method and assign production resources. Job card will be created upon confirmation."
      kicker="CONFIRM ORDER"
      onClose={onClose}
      footer={
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="tertiary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button 
            type="submit" 
            variant="primary" 
            disabled={submitting || !machineId || !materialId || quantity <= 0 || (paymentDecision === "PAID" && !paymentMethod.trim())}
            onClick={() => {
              if (submitting || !machineId || !materialId || quantity <= 0) return;
              if (paymentDecision === "PAID" && !paymentMethod.trim()) return;
              setSubmitting(true);
              onSave({ 
                paymentDecision, 
                paymentMethod: paymentDecision === "PAID" ? paymentMethod.trim() : undefined,
                machineId, 
                materialId, 
                quantity, 
                unit: material?.baseUnit ?? material?.unit ?? "m²", 
                priority: order.priority 
              });
            }}
          >
            {submitting ? "Confirming…" : "Confirm & Create Job Card"} <ArrowUpRight size={16} />
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
        </div>

        {/* Order Details Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><small className="text-muted-foreground">Client</small><br /><strong className="text-navy">{order.clientName}</strong></div>
          <div><small className="text-muted-foreground">Phone</small><br /><strong className="text-navy">{order.phone}</strong></div>
          <div><small className="text-muted-foreground">Service</small><br /><strong className="text-navy">{getServiceLabel(order.serviceType) ?? order.serviceType}</strong></div>
          <div><small className="text-muted-foreground">Total Price</small><br /><strong className="text-navy">{order.amount ? `${order.amount.toFixed(2)} ETB` : "—"}</strong></div>
          <div><small className="text-muted-foreground">Dimensions</small><br /><strong className="text-navy">{order.dimensions}</strong></div>
          <div><small className="text-muted-foreground">Quantity</small><br /><strong className="text-navy">{order.quantity}</strong></div>
        </div>

        {/* Payment Verification Section */}
        <div className="space-y-3 p-4 bg-gold/10 rounded-lg border border-gold/20">
          <span className="block text-sm font-semibold text-navy">Payment Verification</span>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="paymentDecision" 
                value="PAID" 
                checked={paymentDecision === "PAID"}
                onChange={(e) => setPaymentDecision(e.target.value as "PAID" | "APPROVED_CREDIT")}
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
                onChange={(e) => setPaymentDecision(e.target.value as "PAID" | "APPROVED_CREDIT")}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Approved Credit 📒</span>
            </label>
          </div>
          {paymentDecision === "PAID" && (
            <label className="block mt-2">
              <span className="block text-xs font-semibold text-navy mb-1">Payment Method</span>
              <input 
                type="text" 
                placeholder="e.g. Cash, Bank Transfer, Mobile Money"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink outline-none focus:border-cyan"
              />
            </label>
          )}
        </div>

        {/* Production Assignment */}
        <div className="space-y-4">
          <label className="block">
            <span className="block text-sm font-semibold text-navy mb-2">Assigned machine</span>
            <select 
              value={machineId} 
              onChange={(event) => setMachineId(event.target.value)}
              className="w-full px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink outline-none focus:border-cyan"
            >
              {machines.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name} · {entry.code} · {entry.status}</option>
              ))}
            </select>
          </label>
          {machine && (machine.status === "Maintenance" || machine.status === "Unavailable") ? (
            <p className="text-sm text-danger">{machine.name} is {machine.status.toLowerCase()} and cannot accept new jobs.</p>
          ) : null}

          <label className="block">
            <span className="block text-sm font-semibold text-navy mb-2">Raw material</span>
            <select 
              value={materialId} 
              onChange={(event) => setMaterialId(event.target.value)}
              className="w-full px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink outline-none focus:border-cyan"
            >
              {materials.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name} · {formatQuantity(entry.quantity, entry.baseUnit ?? entry.unit)}</option>
              ))}
            </select>
          </label>
          {material && quantity > material.quantity ? (
            <p className="text-sm text-danger">
              Stock shortfall — {material.name} has {formatQuantity(material.quantity, material.unit)} available but {quantity} {material?.baseUnit ?? material?.unit} is required.
            </p>
          ) : null}

          <label className="block">
            <span className="block text-sm font-semibold text-navy mb-2">Planned material usage ({material?.baseUnit ?? material?.unit})</span>
            <input 
              type="number" 
              min="0.1" 
              step="0.1" 
              value={quantity} 
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="w-full px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink outline-none focus:border-cyan"
            />
          </label>

          {/* Stock After Production */}
          <div className="flex items-center gap-3 p-3 bg-green/10 rounded-lg border border-green/20">
            <ArrowUpRight size={17} className="text-green flex-none" />
            <span className="text-sm text-gray-600">Available after production</span>
            <strong className="text-sm text-navy">{material ? formatQuantity(Math.max(0, material.quantity - quantity), material.unit) : "—"}</strong>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
