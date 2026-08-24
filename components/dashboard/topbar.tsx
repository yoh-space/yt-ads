"use client";

import { Bell, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { navItems, type View } from "./nav-config";
import { UserMenu } from "./user-menu";
import type { Profile } from "@/lib/operations-types";

export function Topbar({
  activeView,
  onMenu,
  onToggleSidebar,
  sidebarCollapsed,
  profile,
}: {
  activeView: View;
  onMenu: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  profile: Profile | null;
}) {
  const current = navItems.find((item) => item.id === activeView);
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={onMenu}>
          <Menu size={19} />
        </button>
        <button className="collapse-button icon-button" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={onToggleSidebar}>
          {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>
        <div className="breadcrumb">
          <span>YT Advertising</span>
          <i>/</i>
          <strong>{current?.english}</strong>
        </div>
      </div>
      <div className="topbar-right">
        <div className="search-box">
          <Search size={17} />
          <input placeholder="Search material, job card..." />
          <kbd>⌘ K</kbd>
        </div>
        <button className="icon-button notification">
          <Bell size={19} />
          <b>3</b>
        </button>
        <UserMenu profile={profile} />
      </div>
    </header>
  );
}
