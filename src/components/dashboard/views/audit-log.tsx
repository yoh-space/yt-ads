"use client";

import { Boxes, ClipboardList, Factory, History, RefreshCw, Scissors, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AuditCategory } from "@/lib/report-types";

const filters: Array<{ id: AuditCategory; label: string; english: string }> = [
  { id: "all", label: "ሁሉም", english: "All activity" },
  { id: "inventory", label: "ክምችት", english: "Inventory" },
  { id: "production", label: "ምርት", english: "Production" },
  { id: "recovery", label: "ቅሪት/ብክነት", english: "Recovery" },
  { id: "orders", label: "ትዕዛዞች", english: "Orders" },
];

function formatActivityTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function activityIcon(category: Exclude<AuditCategory, "all">) {
  if (category === "inventory") return Boxes;
  if (category === "recovery") return Scissors;
  if (category === "production") return Factory;
  if (category === "orders") return ClipboardList;
  return ClipboardList;
}

export function AuditLogView() {
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory>("all");
  const events = useQuery(api.audit.list, { category: selectedCategory, limit: 200 });

  return (
    <div className="audit-view">

      <section className="audit-toolbar panel">
        <div className="audit-filters" aria-label="Activity category">
          {filters.map((filter) => (
            <button
              key={filter.id}
              className={selectedCategory === filter.id ? "selected" : ""}
              onClick={() => setSelectedCategory(filter.id)}
            >
              {filter.label}<small>{filter.english}</small>
            </button>
          ))}
        </div>
        <span className="audit-count">{events?.length ?? 0} activities</span>
      </section>

      <section className="panel audit-panel">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">ACTIVITY HISTORY</span>
            <h2>የተመዘገቡ እንቅስቃሴዎች</h2>
            <p>Created records and auditable movements from the current data set</p>
          </div>
          <History size={19} className="report-head-icon" />
        </div>
        {!events ? (
          <div className="report-loading"><RefreshCw size={16} /> መዝገቡ እየተጫነ ነው…</div>
        ) : events.length === 0 ? (
          <div className="empty-state">በዚህ ምድብ የተመዘገበ እንቅስቃሴ የለም</div>
        ) : (
          <div className="audit-list">
            {events.map((event) => {
              const Icon = activityIcon(event.category);
              return (
                <article className="audit-entry" key={event.id}>
                  <span className={`audit-icon ${event.category}`}><Icon size={16} /></span>
                  <div className="audit-entry-main">
                    <div className="audit-entry-title"><strong>{event.action}</strong><span>{event.actorName}</span></div>
                    <p>{event.summary}</p>
                    <small>{event.detail}</small>
                  </div>
                  <time dateTime={new Date(event.at).toISOString()}>{formatActivityTime(event.at)}</time>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="audit-note">
        <Trash2 size={16} />
        <p><strong>Transparency note:</strong> seeded data includes job cards and offcuts. Production, stock, and scrap events appear here as soon as those actions are recorded.</p>
      </section>
    </div>
  );
}
