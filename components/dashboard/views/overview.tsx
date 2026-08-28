"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Box,
  Boxes,
  CircleAlert,
  Command,
  Factory,
  Gauge,
  MoreHorizontal,
  MoveUpRight,
  Printer,
  Scissors,
  Trash2,
} from "lucide-react";
import type { CustomerOrder, JobCard, Machine, Material } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { statusTone } from "../helpers";
import type { View } from "../nav-config";

export function Overview({
  materials,
  machines,
  jobs,
  orders,
  orderStats,
  lowStock,
  stockValue,
  waste,
  onView,
  onComplete,
}: {
  materials: Material[];
  machines: Machine[];
  jobs: JobCard[];
  orders: CustomerOrder[];
  orderStats: { todaysOrders: number; completedOrders: number; queueOrders: number; activeProductionOrders: number };
  lowStock: Material[];
  stockValue: number;
  waste: number;
  onView: (view: View) => void;
  onComplete: (id: string) => void;
}) {
  const stats = [
    { label: "የዛሬ ትዕዛዞች", en: "Today's orders", value: orderStats.todaysOrders.toString(), meta: "Received today", icon: Boxes, trend: "Live", tone: "cyan", view: "orders" as View },
    { label: "የተጠናቀቁ ትዕዛዞች", en: "Completed orders", value: orderStats.completedOrders.toString(), meta: "All time", icon: Factory, trend: "Live", tone: "green", view: "orders" as View },
    { label: "በመጠባበቅ ላይ ያሉ", en: "Queue orders", value: orderStats.queueOrders.toString(), meta: "Awaiting production", icon: Gauge, trend: "Live", tone: "gold", view: "orders" as View },
    { label: "በሂደት ላይ ያሉ", en: "Active production", value: orderStats.activeProductionOrders.toString(), meta: "Currently producing", icon: Trash2, trend: "Live", tone: "violet", view: "orders" as View },
  ];
  const todaysActivities = jobs.filter((job) => { const d = new Date(); const jd = new Date(job.due); return jd.getFullYear() === d.getFullYear() && jd.getMonth() === d.getMonth() && jd.getDate() === d.getDate(); }).length + orderStats.todaysOrders;
  return (
    <>
      {orders.length > 0 ? <section className="executive-strip"><button className="executive-card" onClick={() => onView("orders")}><span>EXECUTIVE QUEUE</span><strong>{orderStats.todaysOrders}</strong><small>Orders received today</small></button><div className="executive-card"><span>DAILY ACTIVITY</span><strong>{todaysActivities}</strong><small>Orders and scheduled job activity</small></div><div className="executive-card"><span>STOCK ACCOUNTING</span><strong>{stockValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong><small>Tracked base units, not monetary value</small></div></section> : null}
      <section className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article
              className={`stat-card interactive ${stat.tone}`}
              key={stat.en}
              role="button"
              tabIndex={0}
              onClick={() => onView(stat.view)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onView(stat.view);
                }
              }}
            >
              <div className="stat-top">
                <span className="stat-icon"><Icon size={19} /></span>
                <span className="trend"><ArrowUpRight size={13} />{stat.trend}</span>
              </div>
              <strong>{stat.value}</strong>
              <p>{stat.label}</p>
              <small>{stat.en} · {stat.meta}</small>
            </article>
          );
        })}
      </section>
            <section className="dashboard-grid bottom-grid">
        <article className="panel job-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">JOB BOARD</span>
              <h2>ንቁ የሥራ ካርዶች</h2>
              <p>Current production queue</p>
            </div>
            <button className="text-button" onClick={() => onView("jobs")}>
              Open job board <MoveUpRight size={15} />
            </button>
          </div>
          <div className="job-table">
            <div className="table-header"><span>JOB / CLIENT</span><span>MACHINE</span><span>MATERIAL</span><span>STATUS</span><span /></div>
            {jobs
              .filter((job) => job.status !== "Completed")
              .slice(0, 4)
              .map((job) => {
                const machine = machines.find((item) => item.id === job.machineId);
                const material = materials.find((item) => item.id === job.materialId);
                return (
                  <div className="table-row" key={job.id}>
                    <div>
                      <b>{job.code}</b>
                      <span>{job.client} · {job.title}</span>
                    </div>
                    <span>{machine?.code}</span>
                    <span>{material?.name}</span>
                    <span className={`status-pill ${statusTone(job.status)}`}>{job.status}</span>
                    <button
                      className="icon-button subtle"
                      onClick={() => job.status === "In production" && onComplete(job.id)}
                      aria-label="Complete job"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                );
              })}
          </div>
        </article>
        <article className="panel materials-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">MATERIAL PULSE</span>
              <h2>ከፍተኛ መጠቀም ላይ ያሉ እቃዎች</h2>
              <p>Material utilization</p>
            </div>
            <button className="text-button" onClick={() => onView("inventory")}>
              Inventory <MoveUpRight size={15} />
            </button>
          </div>
          <div className="material-pulse">
            {materials.slice(0, 4).map((material) => {
              const stockPct = material.reorderAt > 0 ? Math.round((material.quantity / material.reorderAt) * 100) : 100;
              const utilWidth = Math.min(100, stockPct);
              return (
                <div className="pulse-row" key={material.id}>
                  <div className={`material-swatch ${material.accent}`}><Box size={15} /></div>
                  <p>
                    <strong>{material.name}</strong>
                    <span>{formatQuantity(material.quantity, material.unit)} on hand</span>
                  </p>
                  <div className="utilization"><i style={{ width: `${utilWidth}%` }} /></div>
                  <span>{stockPct}%</span>
                </div>
              );
            })}
          </div>
        </article>
      </section>
      <section className="dashboard-grid">
        <article className="panel production-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">MACHINE WORKFLOW</span>
              <h2>የማሽን የሥራ ሁኔታ</h2>
              <p>Machine workflow status</p>
            </div>
            <button className="text-button" onClick={() => onView("machines")}>View all <MoveUpRight size={14} /></button>
          </div>
          <div className="mw-status-strip">
            <div className="mw-status-card">
              <strong>{machines.length}</strong>
              <span>Total</span>
            </div>
            <div className="mw-status-card running">
              <strong>{machines.filter((m) => m.status === "Running").length}</strong>
              <span>Running</span>
            </div>
            <div className="mw-status-card available">
              <strong>{machines.filter((m) => m.status === "Available").length}</strong>
              <span>Available</span>
            </div>
            <div className="mw-status-card maintenance">
              <strong>{machines.filter((m) => m.status === "Maintenance").length}</strong>
              <span>Maintenance</span>
            </div>
            <div className="mw-status-card unavailable">
              <strong>{machines.filter((m) => m.status === "Unavailable").length}</strong>
              <span>Unavailable</span>
            </div>
          </div>
          <div className="mw-machine-list">
            {machines.map((machine) => (
              <div className="mw-machine-row" key={machine.id}>
                <div className={`mw-machine-icon ${machine.status === "Running" ? "running" : ""}`}>
                  {machine.type.includes("Laser") ? <Scissors size={16} /> : machine.type.includes("Printer") ? <Printer size={16} /> : <Command size={16} />}
                </div>
                <div className="mw-machine-info">
                  <div className="mw-machine-name">
                    <strong>{machine.name}</strong>
                    <span>{machine.code}</span>
                  </div>
                  <span className="mw-machine-type">{machine.type}</span>
                </div>
                <span className={`status-pill ${statusTone(machine.status)}`}>{machine.status}</span>
                <span className="mw-machine-job">{machine.activeJob || "—"}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="panel alerts-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker coral">ATTENTION</span>
              <h2>የቁጥጥር ማሳሰቢያዎች</h2>
              <p>Discrepancies & stock alerts</p>
            </div>
            <CircleAlert className="alert-head-icon" size={20} />
          </div>
          <div className="alert-list">
            {lowStock.map((material) => (
              <div className="alert-entry" key={material.id}>
                <span className="alert-icon"><AlertTriangle size={16} /></span>
                <p>
                  <strong>{material.name}</strong>
                  <span>{formatQuantity(material.quantity, material.unit)} remains · reorder at {formatQuantity(material.reorderAt, material.unit)}</span>
                </p>
                <button onClick={() => onView("inventory")}>Review</button>
              </div>
            ))}
            {lowStock.length === 0 ? <div className="empty-state">አሁን ላይ የተገኘ የክምችት ማስጠንቀቂያ የለም</div> : null}
          </div>
        </article>
      </section>
    </>
  );
}
