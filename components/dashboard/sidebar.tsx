"use client";

import { Settings, Sparkles, X } from "lucide-react";
import { canAccessView, navItems, type View } from "./nav-config";
import type { Role } from "@/lib/operations-types";

export function Sidebar({
  activeView,
  onNavigate,
  mobileOpen,
  onClose,
  onOpenSettings,
  collapsed,
  runningJobsCount,
  companyName,
  logoUrl,
  role,
}: {
  activeView: View;
  onNavigate: (view: View) => void;
  mobileOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  collapsed: boolean;
  runningJobsCount: number;
  companyName?: string;
  logoUrl?: string;
  role: Role;
}) {
  return (
    <aside className={`sidebar ${mobileOpen ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
      <div className="brand-block">
        <div className="brand-mark">{logoUrl ? <img src={logoUrl} alt="" /> : <><span>Y</span><i /></>}</div>
        <div><strong>{companyName ?? "YT Advertising"}</strong><small>Operations Control</small></div>
        <button className="icon-button mobile-close" aria-label="Close navigation" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="workspace-chip"><span className="live-dot" />Live </div>
      <nav className="primary-nav">
        <p>የሥራ ማውጫ <span>WORKSPACE</span></p>
        {navItems.filter((item) => canAccessView(role, item.id)).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${activeView === item.id ? "active" : ""}`}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}<small>{item.english}</small></span>
              {item.id === "jobs" && runningJobsCount > 0 ? <b>{runningJobsCount}</b> : null}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <div className="support-card">
          <Sparkles size={17} />
          <p><strong>YoTech Digitals</strong><br />Enterprise workflow system</p>
        </div>
        <button className="nav-item" onClick={onOpenSettings}><Settings size={18} /><span>ማስተካከያ<small>Settings</small></span></button>
      </div>
    </aside>
  );
}
