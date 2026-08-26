"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Clock3, Filter, Search, Wrench } from "lucide-react";
import type { CustomerOrder, Machine, Material, OrderPriority, CustomerOrderStatus } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";

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
  onConvert,
  onStatus,
}: {
  orders: CustomerOrder[];
  canManage: boolean;
  machines: Machine[];
  materials: Material[];
  onConvert: (order: CustomerOrder) => void;
  onStatus: (orderId: string, status: CustomerOrderStatus) => void;
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
    <div className="view-stack">
      <div className="metric-grid compact-grid">
        <div className="metric-card"><span className="metric-label">QUEUE TOTAL</span><strong>{orders.length}</strong><small>Public and walk-in orders</small></div>
        <div className="metric-card"><span className="metric-label">OPEN</span><strong>{pending}</strong><small>Still moving through production</small></div>
        <div className={`metric-card ${overdue > 0 ? "metric-alert" : ""}`}><span className="metric-label">OVERDUE</span><strong>{overdue}</strong><small>Due date has passed</small></div>
      </div>
      <section className="panel">
        <div className="panel-heading"><div><span className="panel-kicker">LIVE WORK QUEUE</span><h2>Orders ready for action</h2></div><span className="live-chip"><span className="live-dot" />Convex realtime</span></div>
        <div className="filter-bar">
          <label className="search-field"><Search size={16} /><input placeholder="Search order, client, phone…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label><Filter size={14} />Status<select value={status} onChange={(event) => setStatus(event.target.value as CustomerOrderStatus | "all")}>{statuses.map((value) => <option key={value} value={value}>{value === "all" ? "All statuses" : value}</option>)}</select></label>
          <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as OrderPriority | "all")}>{priorities.map((value) => <option key={value} value={value}>{value === "all" ? "All priorities" : value}</option>)}</select></label>
          <label>Machine<select value={machine} onChange={(event) => setMachine(event.target.value)}><option value="all">All machines</option>{machines.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
        </div>
        <div className="table-wrap order-table"><div className="table-header"><span>ORDER / CLIENT</span><span>SERVICE</span><span>PRIORITY</span><span>DUE</span><span>STATUS</span><span>ACTION</span></div>
          {filtered.length === 0 ? <div className="empty-state">No orders match the current filters.</div> : filtered.map((order) => (
            <div className={`table-row order-row ${order.overdue ? "overdue-row" : ""}`} key={order.id}>
              <span><strong>{order.code}</strong><small>{order.clientName} · {order.phone}</small></span>
              <span><strong>{order.serviceType}</strong><small>{order.dimensions} · Qty {order.quantity}</small>{order.fileUrl ? <a className="file-link" href={order.fileUrl} target="_blank" rel="noreferrer">Open {order.fileName ?? "artwork"}</a> : null}</span>
              <span><b className={`priority-dot ${order.priority.toLowerCase()}`} />{order.priority}</span>
              <span><Clock3 size={14} />{formatDue(order.preferredDueDate)}{order.overdue ? <small className="danger-text">Overdue</small> : null}</span>
              <span><span className={`status-pill ${order.status === "Completed" ? "success" : order.overdue ? "warning" : "info"}`}>{order.status}</span>{order.machineName ? <small>{order.machineName}</small> : null}</span>
              <span className="row-actions">{canManage && !order.jobCardId && order.status !== "Completed" ? <button className="button primary small" onClick={() => onConvert(order)}><Wrench size={14} />Convert</button> : null}{canManage && order.jobCardId && order.status === "In Production" ? <button className="button secondary small" onClick={() => onStatus(order.id, "Ready for Pickup")}>Ready</button> : null}{canManage && order.status === "Ready for Pickup" ? <button className="button secondary small" onClick={() => onStatus(order.id, "Completed")}>Complete</button> : null}</span>
            </div>
          ))}
        </div>
      </section>
      <p className="panel-note">Conversion creates a normal job card and does not deduct material until production consumption is recorded. This keeps the regular job-card and inventory workflow intact.</p>
    </div>
  );
}

export function OrderConvertModal({ order, machines, materials, onClose, onSave }: { order: CustomerOrder; machines: Machine[]; materials: Material[]; onClose: () => void; onSave: (input: { machineId: string; materialId: string; quantity: number; unit: Material["unit"]; priority?: OrderPriority }) => void }) {
  const [machineId, setMachineId] = useState(machines[0]?.id ?? "");
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [priority, setPriority] = useState<OrderPriority>(order.priority);
  const material = materials.find((entry) => entry.id === materialId);
  return <div className="modal-backdrop"><section className="modal-card"><div className="modal-header"><div><span className="panel-kicker">CONVERT ORDER</span><h2>{order.code} · {order.clientName}</h2><p>Assign a machine and planned base-unit material quantity.</p></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div><form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (machineId && materialId && quantity > 0) onSave({ machineId, materialId, quantity, unit: material?.baseUnit ?? material?.unit ?? "m²", priority }); }}><label>Assigned machine<select value={machineId} onChange={(event) => setMachineId(event.target.value)}>{machines.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.code}</option>)}</select></label><label>Raw material<select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>{materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {formatQuantity(entry.quantity, entry.baseUnit ?? entry.unit)}</option>)}</select></label><label>Planned usage ({material?.baseUnit ?? material?.unit})<input type="number" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as OrderPriority)}>{priorities.filter((value) => value !== "all").map((value) => <option key={value} value={value}>{value}</option>)}</select></label><div className="modal-actions"><button type="button" className="button tertiary" onClick={onClose}>Cancel</button><button type="submit" className="button primary">Create job card <ArrowUpRight size={16} /></button></div></form></section></div>;
}
