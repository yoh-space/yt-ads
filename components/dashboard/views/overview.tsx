"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Box,
  Boxes,
  CircleAlert,
  Factory,
  Gauge,
  MoreHorizontal,
  MoveUpRight,
  Printer,
  Scissors,
  Command,
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
  lowStock: Material[];
  stockValue: number;
  waste: number;
  onView: (view: View) => void;
  onComplete: (id: string) => void;
}) {
  const stats = [
    { label: "የክምችት ንጥሎች", en: "Tracked inventory", value: materials.length.toString(), meta: "6 categories live", icon: Boxes, trend: "Open", tone: "cyan", view: "inventory" as View },
    { label: "በሂደት ላይ ያሉ ሥራዎች", en: "Active production", value: jobs.filter((job) => job.status === "In production").length.toString(), meta: "Across machines", icon: Factory, trend: "Open", tone: "gold", view: "jobs" as View },
    { label: "የዛሬ ብክነት", en: "Waste ratio", value: `${waste}%`, meta: "Target below 5.0%", icon: Trash2, trend: "Open", tone: "violet", view: "offcuts" as View },
    { label: "የክምችት ንቁ መጠን", en: "Active stock units", value: stockValue.toLocaleString("en-US", { maximumFractionDigits: 0 }), meta: "All base units", icon: Gauge, trend: "Open", tone: "blue", view: "inventory" as View },
  ];
  const today = new Date();
  const isToday = (timestamp: number) => { const date = new Date(timestamp); return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate(); };
  const todaysOrders = orders.filter((order) => isToday(order.createdAt));
  const todaysActivities = jobs.filter((job) => isToday(Date.parse(job.due))).length + todaysOrders.length;
  return (
    <>
      {orders.length > 0 ? <section className="executive-strip"><button className="executive-card" onClick={() => onView("orders")}><span>EXECUTIVE QUEUE</span><strong>{todaysOrders.length}</strong><small>Orders received today</small></button><div className="executive-card"><span>DAILY ACTIVITY</span><strong>{todaysActivities}</strong><small>Orders and scheduled job activity</small></div><div className="executive-card"><span>STOCK ACCOUNTING</span><strong>{stockValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</strong><small>Tracked base units, not monetary value</small></div></section> : null}
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
      <section className="dashboard-grid">
        <article className="panel production-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">LIVE PRODUCTION</span>
              <h2>የማሽን የሥራ ሁኔታ</h2>
              <p>Machine workflow status</p>
            </div>
            <button className="text-button" onClick={() => onView("machines")}>
              ሁሉን ይመልከቱ <MoveUpRight size={15} />
            </button>
          </div>
          <div className="machine-strip">
            {machines.map((machine) => (
              <div className="machine-row" key={machine.id}>
                <div className={`machine-symbol ${machine.status === "Running" ? "running" : ""}`}>
                  {machine.type.includes("Laser") ? <Scissors size={18} /> : machine.type.includes("Printer") ? <Printer size={18} /> : <Command size={18} />}
                </div>
                <div className="machine-main">
                  <div>
                    <strong>{machine.name}</strong>
                    <span>{machine.code} · {machine.type}</span>
                  </div>
                  <div className="progress-rail">
                    <i style={{ width: machine.status === "Running" ? "68%" : "10%" }} />
                  </div>
                </div>
                <div className="machine-status">
                  <span className={`status-dot ${statusTone(machine.status)}`} />
                  {machine.status}
                  <small>{machine.activeJob || "No assigned job"}</small>
                </div>
                <button className="icon-button subtle"><MoreHorizontal size={18} /></button>
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
            {materials.slice(0, 4).map((material, index) => (
              <div className="pulse-row" key={material.id}>
                <div className={`material-swatch ${material.accent}`}><Box size={15} /></div>
                <p>
                  <strong>{material.name}</strong>
                  <span>{formatQuantity(material.quantity, material.unit)} on hand</span>
                </p>
                <div className="utilization"><i style={{ width: `${Math.min(100, 30 + index * 17)}%` }} /></div>
                <span>{`${30 + index * 17}%`}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
