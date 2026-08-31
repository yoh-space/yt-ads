"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Clock3, Plus, Search, Wrench, X } from "lucide-react";
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
    <div className="oq-wrap">
      <div className="oq-stats">
        <div className="oq-stat">
          <span className="oq-stat-label">QUEUE TOTAL</span>
          <strong>{orders.length}</strong>
          <small>Public and walk-in orders</small>
        </div>
        <div className="oq-stat">
          <span className="oq-stat-label">OPEN</span>
          <strong>{pending}</strong>
          <small>Still moving through production</small>
        </div>
        <div className={`oq-stat${overdue > 0 ? " oq-stat-alert" : ""}`}>
          <span className="oq-stat-label">OVERDUE</span>
          <strong>{overdue}</strong>
          <small>Due date has passed</small>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">LIVE WORK QUEUE</span>
            <h2>Orders ready for action</h2>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {canCreateOrder ? <button className="button primary" onClick={onCreateOrder}><Plus size={15} />New Order</button> : null}
            <span className="live-chip"><span className="live-dot" />Realtime</span>
          </div>
        </div>

        <div className="oq-filters">
          <label className="oq-search"><Search size={15} /><input placeholder="Search order, client, phone..." value={search} onChange={(e) => setSearch(e.target.value)} />{search ? <button onClick={() => setSearch("")}><X size={13} /></button> : null}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as CustomerOrderStatus | "all")}>
            {statuses.map((v) => <option key={v} value={v}>{v === "all" ? "All statuses" : v}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value as OrderPriority | "all")}>
            {priorities.map((v) => <option key={v} value={v}>{v === "all" ? "All priorities" : v}</option>)}
          </select>
          <select value={machine} onChange={(e) => setMachine(e.target.value)}>
            <option value="all">All machines</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div className="oq-table">
          <div className="oq-table-head">
            <span>ORDER / CLIENT</span>
            <span>SERVICE</span>
            <span>PRIORITY</span>
            <span>DUE</span>
            <span>STATUS</span>
            <span>ACTION</span>
          </div>

          {filtered.length === 0 ? (
            <div className="oq-empty">No orders match the current filters.</div>
          ) : filtered.map((order) => (
            <div className={`oq-row${order.overdue ? " oq-row-overdue" : ""}`} key={order.id}>
              <div className="oq-cell-code">
                <b>{order.code}</b>
                <span>{order.clientName}</span>
                <small>{order.phone}</small>
              </div>
              <div className="oq-cell-service">
                <b>{order.serviceType}</b>
                <span>{order.dimensions} &middot; Qty {order.quantity}</span>
                {order.fileUrl ? <a className="oq-file" href={order.fileUrl} target="_blank" rel="noreferrer">Open {order.fileName ?? "artwork"}</a> : null}
              </div>
              <div className="oq-cell-priority">
                <b className={`priority-dot ${order.priority.toLowerCase()}`} />
                {order.priority}
              </div>
              <div className="oq-cell-due">
                <Clock3 size={13} />
                <span>{formatDue(order.preferredDueDate)}</span>
                {order.overdue ? <small className="oq-danger">Overdue</small> : null}
              </div>
              <div className="oq-cell-status">
                <span className={`status-pill ${order.status === "Completed" ? "success" : order.overdue ? "warning" : "info"}`}>{order.status}</span>
                {order.machineName ? <small>{order.machineName}</small> : null}
              </div>
              <div className="oq-cell-actions">
                {canManage && !order.jobCardId && order.status !== "Completed" ? <button className={`button primary small${isPending(`convert-${order.id}`) ? " pending" : ""}`} disabled={isPending(`convert-${order.id}`)} onClick={() => onConvert(order)}><Wrench size={13} />{isPending(`convert-${order.id}`) ? "Creating…" : "Create Job Card"}</button> : null}
                {canManage && order.jobCardId && order.status === "In Production" ? <button className={`button secondary small${isPending(`order-status-${order.id}`) ? " pending" : ""}`} disabled={isPending(`order-status-${order.id}`)} onClick={() => onStatus(order.id, "Ready for Pickup")}>{isPending(`order-status-${order.id}`) ? "Saving..." : "Ready"}</button> : null}
                {canManage && order.status === "Ready for Pickup" ? <button className={`button secondary small${isPending(`order-status-${order.id}`) ? " pending" : ""}`} disabled={isPending(`order-status-${order.id}`)} onClick={() => onStatus(order.id, "Completed")}>{isPending(`order-status-${order.id}`) ? "Saving..." : "Complete"}</button> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="oq-note">Creating a job card from an order carries client details automatically. Material is deducted when production is recorded, not at creation.</p>
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
    <div className="modal-backdrop">
      <section className="modal-card">
        <div className="modal-head">
          <div>
            <span className="panel-kicker">CREATE JOB CARD</span>
            <h2>{order.code} → New Job Card</h2>
            <p>All client details are carried from the customer order. Select machine and material.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className="modal-body">
          <div className="conversion-box" style={{ marginBottom: 16 }}>
            <ArrowUpRight size={17} />
            <span>Order</span>
            <strong>{order.code}</strong>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginBottom: 16, fontSize: 13 }}>
            <div><small style={{ color: "var(--muted)" }}>Client</small><br /><strong>{order.clientName}</strong></div>
            <div><small style={{ color: "var(--muted)" }}>Phone</small><br /><strong>{order.phone}</strong></div>
            <div><small style={{ color: "var(--muted)" }}>Service</small><br /><strong>{order.serviceType}</strong></div>
            <div><small style={{ color: "var(--muted)" }}>Dimensions</small><br /><strong>{order.dimensions}</strong></div>
            <div><small style={{ color: "var(--muted)" }}>Quantity</small><br /><strong>{order.quantity}</strong></div>
            <div><small style={{ color: "var(--muted)" }}>Due</small><br /><strong>{formatDue(order.preferredDueDate)}</strong></div>
          </div>

          <form className="modal-form" onSubmit={(event) => {
            event.preventDefault();
            if (submitting) return;
            if (machineId && materialId && quantity > 0) {
              setSubmitting(true);
              onSave({ machineId, materialId, quantity, unit: material?.baseUnit ?? material?.unit ?? "m\u00B2", priority: order.priority });
            }
          }}>
            <label>
              Assigned machine
              <select value={machineId} onChange={(event) => setMachineId(event.target.value)}>
                {machines.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name} · {entry.code} · {entry.status}</option>
                ))}
              </select>
            </label>
            {machine && (machine.status === "Maintenance" || machine.status === "Unavailable") ? (
              <p style={{ color: "var(--danger, #e53935)", fontSize: 12, margin: "-8px 0 8px" }}>{machine.name} is {machine.status.toLowerCase()} and cannot accept new jobs.</p>
            ) : null}

            <label>
              Raw material
              <select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
                {materials.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name} · {formatQuantity(entry.quantity, entry.baseUnit ?? entry.unit)}</option>
                ))}
              </select>
            </label>
            {material && quantity > material.quantity ? (
              <p style={{ color: "var(--danger, #e53935)", fontSize: 12, margin: "-8px 0 8px" }}>
                Stock shortfall — {material.name} has {formatQuantity(material.quantity, material.unit)} available but {quantity} {material?.baseUnit ?? material?.unit} is required.
              </p>
            ) : null}

            <label>
              Planned material usage ({material?.baseUnit ?? material?.unit})
              <input type="number" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
            </label>

            <div className="conversion-box">
              <ArrowUpRight size={17} />
              <span>Available after production</span>
              <strong>{material ? formatQuantity(Math.max(0, material.quantity - quantity), material.unit) : "—"}</strong>
            </div>

            <div className="modal-actions">
              <button type="button" className="button tertiary" onClick={onClose} disabled={submitting}>Cancel</button>
              <button type="submit" className={`button primary${submitting ? " pending" : ""}`} disabled={submitting}>
                {submitting ? "Creating…" : "Create job card"} <ArrowUpRight size={16} />
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
