"use client";

import { Settings, Sparkles, X } from "lucide-react";
import { navItems, type View } from "./nav-config";

export function Sidebar({
  activeView,
  onNavigate,
  mobileOpen,
  onClose,
  runningJobsCount,
}: {
  activeView: View;
  onNavigate: (view: View) => void;
  mobileOpen: boolean;
  onClose: () => void;
  runningJobsCount: number;
}) {
  return (
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="brand-block">
        <div className="brand-mark"><span>Y</span><i /></div>
        <div><strong>YT Advertising</strong><small>Operations Control</small></div>
        <button className="mobile-close icon-button" onClick={onClose} aria-label="Close navigation"><X size={19} /></button>
      </div>
      <div className="workspace-chip"><span className="live-dot" />ቀጥታ ማዕከል <small>LIVE</small></div>
      <nav className="primary-nav">
        <p>የሥራ ማውጫ <span>WORKSPACE</span></p>
        {navItems.map((item) => {
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
        <button className="nav-item"><Settings size={18} /><span>ማስተካከያ<small>Settings</small></span></button>
      </div>
    </aside>
  );
}
