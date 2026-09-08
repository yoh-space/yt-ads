"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, Clock3, Plus, Printer, Search, Wrench, X, FileText, Sparkles, Cpu, Layers } from "lucide-react";
import type { CustomerOrder, Machine, Material, OrderPriority, CustomerOrderStatus } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { getServiceLabel } from "@/constants/services";
import { SERVICE_ROUTING_MAP } from "@/shared/machine-catalog";
import { Button, Panel, PanelHeader, StatusPill } from "@/components/ui";
import { ModalShell } from "../modals/modal-shell";
import { OrderDetailsSheet } from "./order-details-sheet";
import { cn } from "@/lib/utils";
import { isDesktopShell, printNative } from "@/lib/desktop";

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

const statuses: Array<CustomerOrderStatus | "all"> = ["all", "PENDING_REVIEW", "PRICED_AND_PENDING_PAYMENT", "CONFIRMED_PAID_OR_CREDIT", "JOB_CARD_CREATED", "IN_PRODUCTION", "COMPLETED", "READY_FOR_PICKUP", "Expired", "EXPIRED_JUNK"];
const priorities: Array<OrderPriority | "all"> = ["all", "High", "Medium", "Low"];

function formatDue(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-ET", { dateStyle: "medium", timeStyle: "short" });
}

export function OrdersView({
  orders,
  machines,
  materials,
  canManage,
  canCreateOrder,
  canInvoice,
  onConvert,
  onStatus,
  onCreateOrder,
  onInvoice,
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
  onInvoice: (order: CustomerOrder, input?: InvoiceInput) => void;
  canInvoice: boolean;
  isPending: (key: string) => boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerOrderStatus | "all">("all");
  const [priority, setPriority] = useState<OrderPriority | "all">("all");
  const [machine, setMachine] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [printOrder, setPrintOrder] = useState<CustomerOrder | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<CustomerOrder | null>(null);
  const [selected, setSelected] = useState<CustomerOrder | null>(null);

  const filteredByRange = useMemo(() => orders.filter((order) => inRange(order.createdAt, dateRange)), [dateRange, orders]);

  const filtered = useMemo(() => filteredByRange.filter((order) => {
    const haystack = `${order.code} ${order.clientName} ${order.phone} ${getServiceLabel(order.serviceType) ?? order.serviceType} ${order.dimensions}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase()))
       && (status === "all" ? order.status !== "Expired" && order.status !== "EXPIRED_JUNK" : order.status === status)
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
                {isDesktopShell() ? (
                  <Button size="small" variant="tertiary" onClick={(event) => { event.stopPropagation(); setPrintOrder(order); }}>
                    <Printer size={13} />
                    Receipt
                  </Button>
                ) : null}
                {canInvoice ? <Button size="small" variant="secondary" onClick={(event) => { event.stopPropagation(); setInvoiceOrder(order); }}><FileText size={13} />Invoice</Button> : null}
                <ArrowUpRight size={14} className="text-gray-300 flex-none" aria-hidden />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <p className="text-xs text-gray-500">Creating a job card from an order carries client details automatically. Material is deducted when production is recorded, not at creation.</p>

      {printOrder ? (
        <OrderReceiptModal
          order={printOrder}
          onClose={() => setPrintOrder(null)}
          onPrint={() => printNative()}
        />
      ) : null}

      {invoiceOrder ? (
        <OrderInvoiceModal
          order={invoiceOrder}
          onClose={() => setInvoiceOrder(null)}
          onPrint={() => window.print()}
          onSave={onInvoice}
        />
      ) : null}

      {selected ? (
        <OrderDetailsSheet
          order={selected}
          machinesLabel={selectedMachinesLabel}
          canManage={canManage}
          isPending={isPending}
          onConvert={onConvert}
          onStatus={onStatus}
          onClose={() => setSelected(null)}
          canInvoice={canInvoice}
          onInvoice={(order) => setInvoiceOrder(order)}
        />
      ) : null}
    </div>
  );
}

export function OrderReceiptModal({ order, onClose, onPrint }: { order: CustomerOrder; onClose: () => void; onPrint: () => void }) {
  return (
    <ModalShell
      title={`${order.code} · Customer Receipt`}
      subtitle="Native print preview for the receptionist handoff sheet."
      kicker="PRINT RECEIPT"
      onClose={onClose}
      footer={
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="tertiary" onClick={onClose}>Close</Button>
          <Button type="button" variant="primary" onClick={onPrint}>
            <Printer size={15} />Print Receipt
          </Button>
        </div>
      }
    >
      <div className="space-y-4 print:block print:shadow-none print:border-0">
        <div className="border border-line rounded-lg p-5 bg-white">
          <div className="flex items-center justify-between border-b border-dashed border-line pb-4 mb-4">
            <div>
              <strong className="block text-lg font-bold text-navy">YT Advertising</strong>
              <span className="text-xs text-gray-500">Order Receipt</span>
            </div>
            <div className="text-right">
              <span className="font-mono text-xs font-semibold text-cyan">{order.code}</span>
              <span className="block text-xs text-gray-500">{formatDue(order.createdAt)}</span>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm print:text-xs">
            <div><dt className="text-muted-foreground text-xs">Client</dt><dd className="font-semibold text-navy">{order.clientName}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Phone</dt><dd className="font-semibold text-navy">{order.phone}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Service</dt><dd className="font-semibold text-navy">{getServiceLabel(order.serviceType) ?? order.serviceType}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Dimensions</dt><dd className="font-semibold text-navy">{order.dimensions}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Quantity</dt><dd className="font-semibold text-navy">{order.quantity}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Due</dt><dd className="font-semibold text-navy">{formatDue(order.preferredDueDate)}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Priority</dt><dd className="font-semibold text-navy">{order.priority}</dd></div>
            <div><dt className="text-muted-foreground text-xs">Status</dt><dd className="font-semibold text-navy">{order.status}</dd></div>
            {order.amount !== undefined ? (
              <div className="col-span-2 flex items-center justify-between border-t border-dashed border-line pt-3 mt-2">
                <dt className="text-muted-foreground text-xs">Total</dt>
                <dd className="font-bold text-navy">ETB {order.amount.toLocaleString()}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <p className="text-[10px] text-gray-400">Handled by YT Advertising reception · {new Date().toLocaleString("en-ET")}</p>
      </div>
    </ModalShell>
  );
}

export type InvoiceInput = {
  type: "PROFORMA" | "TAX_INVOICE";
  companyLegalName?: string;
  tinNumber?: string;
  taxRate: number;
  lineItems: Array<{ description: string; quantity: number; unit: string; unitPrice: number; lineTotal: number }>;
};

export function OrderInvoiceModal({ order, onClose, onPrint, onSave }: { order: CustomerOrder; onClose: () => void; onPrint: () => void; onSave: (order: CustomerOrder, input: InvoiceInput) => void | Promise<void> }) {
  const [type, setType] = useState<InvoiceInput["type"]>(order.invoiceType ?? "PROFORMA");
  const [companyLegalName, setCompanyLegalName] = useState(order.companyLegalName ?? order.clientName);
  const [tinNumber, setTinNumber] = useState(order.tinNumber ?? "");
  const [taxRate, setTaxRate] = useState(order.taxRate ?? 0);
  const [unitPrice, setUnitPrice] = useState(order.amount ?? 0);
  const subtotal = Number(unitPrice.toFixed(2));
  const taxAmount = Number((subtotal * taxRate / 100).toFixed(2));
  const total = Number((subtotal + taxAmount).toFixed(2));
  async function issueInvoice() {
    await onSave(order, { type, companyLegalName: companyLegalName.trim() || undefined, tinNumber: tinNumber.trim() || undefined, taxRate, lineItems: [{ description: `${getServiceLabel(order.serviceType) ?? order.serviceType} · ${order.dimensions}`, quantity: 1, unit: order.quantity, unitPrice, lineTotal: subtotal }] });
    onClose();
  }

  return (
    <ModalShell
      title={`${order.code} · Formal Invoice`}
      subtitle="Issue a proforma or tax invoice. Billing visibility does not grant owner profitability access."
      kicker="INVOICE DRAWER"
      onClose={onClose}
      footer={<div className="flex gap-3 justify-end"><Button type="button" variant="tertiary" onClick={onClose}>Cancel</Button><Button type="button" variant="secondary" onClick={onPrint}><Printer size={14} />Print preview</Button><Button type="button" variant="primary" onClick={() => void issueInvoice()}>Issue invoice <ArrowUpRight size={15} /></Button></div>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm"><div><small className="text-muted-foreground">Client</small><br /><strong>{order.clientName}</strong></div><div><small className="text-muted-foreground">Order</small><br /><strong>{order.code}</strong></div></div>
        <div className="grid grid-cols-2 gap-3"><label className="block"><span className="block text-xs font-semibold mb-1">Document type</span><select value={type} onChange={(event) => setType(event.target.value as InvoiceInput["type"])} className="w-full px-3 py-2 border border-line rounded-lg bg-white"><option value="PROFORMA">Proforma</option><option value="TAX_INVOICE">Tax Invoice</option></select></label><label className="block"><span className="block text-xs font-semibold mb-1">TIN number</span><input value={tinNumber} onChange={(event) => setTinNumber(event.target.value)} className="w-full px-3 py-2 border border-line rounded-lg bg-white" /></label></div>
        <label className="block"><span className="block text-xs font-semibold mb-1">Legal company name</span><input value={companyLegalName} onChange={(event) => setCompanyLegalName(event.target.value)} className="w-full px-3 py-2 border border-line rounded-lg bg-white" /></label>
        <div className="rounded-lg border border-line overflow-hidden"><div className="grid grid-cols-[2fr_1fr_1fr] gap-3 bg-gray-50 px-4 py-3 text-xs font-semibold"><span>Line item</span><span>Unit price</span><span>Total</span></div><div className="grid grid-cols-[2fr_1fr_1fr] gap-3 px-4 py-3 text-sm items-center"><span>{getServiceLabel(order.serviceType) ?? order.serviceType} · {order.dimensions}<small className="block text-xs text-muted-foreground">Qty {order.quantity}</small></span><input type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(Math.max(0, Number(event.target.value)))} className="w-full px-2 py-1 border border-line rounded" /><strong>ETB {subtotal.toFixed(2)}</strong></div></div>
        <label className="block max-w-[180px]"><span className="block text-xs font-semibold mb-1">Tax rate (%)</span><input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setTaxRate(Math.max(0, Math.min(100, Number(event.target.value))))} className="w-full px-3 py-2 border border-line rounded-lg bg-white" /></label>
        <div className="ml-auto max-w-xs space-y-2 border-t border-line pt-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><strong>ETB {subtotal.toFixed(2)}</strong></div><div className="flex justify-between"><span>Tax ({taxRate}%)</span><strong>ETB {taxAmount.toFixed(2)}</strong></div><div className="flex justify-between text-base"><span>Total</span><strong>ETB {total.toFixed(2)}</strong></div></div>
      </div>
    </ModalShell>
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
  const [paymentDecision, setPaymentDecision] = useState<"PAID" | "APPROVED_CREDIT">("PAID");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Automated Machine Assignment & Job Card Allocation based on service catalog routing
  const routing = SERVICE_ROUTING_MAP[order.serviceType];

  const autoMachine = useMemo(() => {
    if (!routing) return machines[0];
    return (
      machines.find((m) => m.code === routing.preferredMachineCode && m.status !== "Maintenance" && m.status !== "Unavailable") ||
      machines.find((m) => m.code === routing.preferredMachineCode) ||
      machines[0]
    );
  }, [machines, routing]);

  const autoMaterial = useMemo(() => {
    if (!routing) return materials[0];
    const targetName = routing.primaryMaterialName.toLowerCase();
    return (
      materials.find((m) => m.name.toLowerCase() === targetName) ||
      materials.find((m) => m.name.toLowerCase().includes(targetName)) ||
      materials[0]
    );
  }, [materials, routing]);

  // Automated calculation of planned usage with Owner-Configured Standard Waste Margin
  const plannedQuantity = useMemo(() => {
    let baseQty = 1;
    const dimMatch = order.dimensions?.match(/([\d.]+)\s*(?:[xX*×\s])\s*([\d.]+)/);
    const parsedQty = parseFloat(order.quantity) || 1;
    if (dimMatch) {
      const length = parseFloat(dimMatch[1]);
      const width = parseFloat(dimMatch[2]);
      if (!isNaN(length) && !isNaN(width) && length > 0 && width > 0) {
        baseQty = length * width * parsedQty;
      } else {
        baseQty = parsedQty;
      }
    } else {
      baseQty = parsedQty;
    }
    const wasteMargin = routing?.defaultWasteMarginPercent ?? 5;
    return Number((baseQty * (1 + wasteMargin / 100)).toFixed(2));
  }, [order.dimensions, order.quantity, routing]);

  const machineId = autoMachine?.id ?? "";
  const materialId = autoMaterial?.id ?? "";
  const hasShortfall = autoMaterial ? plannedQuantity > autoMaterial.quantity : false;
  const isMachineUnavailable = autoMachine?.status === "Maintenance" || autoMachine?.status === "Unavailable";

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
            disabled={submitting || !machineId || !materialId || plannedQuantity <= 0 || isMachineUnavailable || (paymentDecision === "PAID" && !paymentMethod.trim())}
            onClick={() => {
              if (submitting || !machineId || !materialId || plannedQuantity <= 0 || isMachineUnavailable) return;
              if (paymentDecision === "PAID" && !paymentMethod.trim()) return;
              setSubmitting(true);
              onSave({ 
                paymentDecision, 
                paymentMethod: paymentDecision === "PAID" ? paymentMethod.trim() : undefined,
                machineId, 
                materialId, 
                quantity: plannedQuantity, 
                unit: autoMaterial?.baseUnit ?? autoMaterial?.unit ?? "m²", 
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
                placeholder="e.g. Telebirr, CBE Bank Transfer, Cash"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-line rounded-lg text-sm text-ink outline-none focus:border-cyan"
              />
            </label>
          )}
        </div>

        {/* Automated Resource Assignment Cards */}
        <div className="space-y-3 p-4 bg-surface rounded-lg border border-line">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-navy flex items-center gap-2">
              <Cpu size={16} className="text-cyan" /> Automated Machine & Material Assignment
            </span>
            <span className="text-xs text-muted-foreground">Strict ERP Mapping</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Machine Assignment */}
            <div className="p-3 bg-muted/20 rounded-md border border-line/60">
              <span className="text-xs text-muted-foreground block mb-1">Target Machine</span>
              <strong className="text-sm text-navy block">{autoMachine?.name ?? "Machine Fleet Unavailable"}</strong>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-muted-foreground">{autoMachine?.code}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className={`text-xs font-medium ${isMachineUnavailable ? "text-danger" : "text-emerald-600"}`}>
                  {autoMachine?.status ?? "Unknown"}
                </span>
              </div>
              {isMachineUnavailable && (
                <p className="text-xs text-danger mt-1">Machine under maintenance. Cannot dispatch jobs.</p>
              )}
            </div>

            {/* Material & Ink Assignment */}
            <div className="p-3 bg-muted/20 rounded-md border border-line/60">
              <span className="text-xs text-muted-foreground block mb-1">Primary Material & Ink</span>
              <strong className="text-sm text-navy block">{autoMaterial?.name ?? "Raw Material"}</strong>
              <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                <Layers size={12} />
                <span>{routing?.compatibleInkName ? `Ink: ${routing.compatibleInkName}` : "Zero ink (Dry mechanical cut)"}</span>
              </div>
            </div>
          </div>

          {/* Planned Consumption Calculation */}
          <div className="pt-2 border-t border-line/40">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Calculated Production Input:</span>
              <strong className="text-sm text-navy">
                {plannedQuantity} {autoMaterial?.baseUnit ?? autoMaterial?.unit ?? "m²"}
              </strong>
            </div>
            <p className="text-xs text-muted-foreground">
              Includes <strong>{routing?.defaultWasteMarginPercent ?? 5}%</strong> Owner Standard Waste Margin · Max Allowed Scrap Limit: <strong>{routing?.maxScrapLimitPercent ?? 10}%</strong>.
            </p>
          </div>

          {/* Stock Alert */}
          {hasShortfall ? (
            <div className="p-2.5 bg-danger/10 text-danger rounded border border-danger/20 text-xs">
              ⚠️ Stock shortfall: Central store has only {formatQuantity(autoMaterial?.quantity ?? 0, autoMaterial?.unit ?? "m²")} available.
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Sufficient stock verified ({formatQuantity(autoMaterial?.quantity ?? 0, autoMaterial?.unit ?? "m²")} in store)</span>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
