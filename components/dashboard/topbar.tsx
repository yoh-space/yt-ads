"use client";

import { Bell, Menu, PanelLeftClose, Search } from "lucide-react";
import { navItems, type View } from "./nav-config";
import { UserMenu } from "./user-menu";
import type { Profile } from "@/lib/operations-types";

export function Topbar({
  activeView,
  onMenu,
  profile,
}: {
  activeView: View;
  onMenu: () => void;
  profile: Profile | null;
}) {
  const current = navItems.find((item) => item.id === activeView);
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="mobile-menu icon-button" onClick={onMenu} aria-label="Open navigation">
          <Menu size={21} />
        </button>
        <button className="collapse-button icon-button" aria-label="Collapse sidebar">
          <PanelLeftClose size={19} />
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
