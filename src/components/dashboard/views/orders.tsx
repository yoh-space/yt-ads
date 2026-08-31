"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Clock3, Plus, Search, Wrench, X } from "lucide-react";
import type { CustomerOrder, Machine, Material, OrderPriority, CustomerOrderStatus } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { Button, Panel, PanelHeader, StatusPill } from "@/components/ui";
import { ModalShell } from "../modals/modal-shell";
import { cn } from "@/lib/utils";

const statuses: Array<CustomerOrderStatus | "all"> = ["all", "Received", "In Production", "Ready for Pickup", "Completed"];
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

  const filtered = useMemo(() => orders.filter((order) => {
    const haystack = `${order.code} ${order.clientName} ${order.phone} ${order.serviceType} ${order.dimensions}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase()))
      && (status === "all" || order.status === status)
      && (priority === "all" || order.priority === priority)
      && (machine === "all" || order.machineId === machine);
  }), [machine, orders, priority, search, status]);

  const overdue = orders.filter((order) => order.overdue).length;
  const pending = orders.filter((order) => order.status !== "Completed").length;

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
            <div className={cn("grid grid-cols-[2fr_1.5fr_1fr_1.2fr_1fr_1.2fr] gap-4 px-4 py-3 items-center hover:bg-gray-50 transition-colors", order.overdue && "bg-coral/5")} key={order.id}>
              {/* Order/Client */}
              <div className="min-w-0">
                <b className="block text-sm font-semibold text-navy truncate">{order.code}</b>
                <span className="block text-xs text-gray-600 truncate">{order.clientName}</span>
                <small className="text-xs text-gray-400">{order.phone}</small>
              </div>
              
              {/* Service */}
              <div className="min-w-0">
                <b className="block text-sm font-semibold text-navy truncate">{order.serviceType}</b>
                <span className="block text-xs text-gray-600 truncate">{order.dimensions} · Qty {order.quantity}</span>
                {order.fileUrl ? <a className="text-xs text-cyan hover:text-cyan-dark underline" href={order.fileUrl} target="_blank" rel="noreferrer">Open {order.fileName ?? "artwork"}</a> : null}
              </div>
              
              {/* Priority */}
              <div className="flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full", order.priority === "High" ? "bg-coral" : order.priority === "Medium" ? "bg-gold" : "bg-green")} />
                <span className="text-sm text-gray-700">{order.priority}</span>
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
                  variant={order.status === "Completed" ? "success" : order.overdue ? "warning" : "info"}
                  label={order.status}
                />
                {order.machineName ? <small className="block text-xs text-gray-500 mt-1">{order.machineName}</small> : null}
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2">
                {canManage && !order.jobCardId && order.status !== "Completed" ? (
                  <Button 
                    size="small" 
                    variant="primary" 
                    disabled={isPending(`convert-${order.id}`)} 
                    onClick={() => onConvert(order)}
                  >
                    <Wrench size={13} />
                    {isPending(`convert-${order.id}`) ? "Creating…" : "Create Job Card"}
                  </Button>
                ) : null}
                {canManage && order.jobCardId && order.status === "In Production" ? (
                  <Button 
                    size="small" 
                    variant="secondary" 
                    disabled={isPending(`order-status-${order.id}`)} 
                    onClick={() => onStatus(order.id, "Ready for Pickup")}
                  >
                    {isPending(`order-status-${order.id}`) ? "Saving..." : "Ready"}
                  </Button>
                ) : null}
                {canManage && order.status === "Ready for Pickup" ? (
                  <Button 
                    size="small" 
                    variant="secondary" 
                    disabled={isPending(`order-status-${order.id}`)} 
                    onClick={() => onStatus(order.id, "Completed")}
                  >
                    {isPending(`order-status-${order.id}`) ? "Saving..." : "Complete"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <p className="text-xs text-gray-500">Creating a job card from an order carries client details automatically. Material is deducted when production is recorded, not at creation.</p>
    </div>
  );
}

export function OrderConvertModal({ order, machines, materials, onClose, onSave }: { order: CustomerOrder; machines: Machine[]; materials: Material[]; onClose: () => void; onSave: (input: { machineId: string; materialId: string; quantity: number; unit: Material["unit"]; priority?: OrderPriority }) => void }) {
  const [machineId, setMachineId] = useState(machines[0]?.id ?? "");
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const material = materials.find((entry) => entry.id === materialId);
  const machine = machines.find((entry) => entry.id === machineId);

  return (
    <ModalShell
      title={`${order.code} → New Job Card`}
      subtitle="All client details are carried from the customer order. Select machine and material."
      kicker="CREATE JOB CARD"
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
              if (machineId && materialId && quantity > 0) {
                setSubmitting(true);
                onSave({ machineId, materialId, quantity, unit: material?.baseUnit ?? material?.unit ?? "m²", priority: order.priority });
              }
            }}
          >
            {submitting ? "Creating…" : "Create job card"} <ArrowUpRight size={16} />
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
          <div><small className="text-muted-foreground">Service</small><br /><strong className="text-navy">{order.serviceType}</strong></div>
          <div><small className="text-muted-foreground">Dimensions</small><br /><strong className="text-navy">{order.dimensions}</strong></div>
          <div><small className="text-muted-foreground">Quantity</small><br /><strong className="text-navy">{order.quantity}</strong></div>
          <div><small className="text-muted-foreground">Due</small><br /><strong className="text-navy">{formatDue(order.preferredDueDate)}</strong></div>
        </div>

        {/* Form */}
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
