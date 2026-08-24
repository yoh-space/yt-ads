"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Bell, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { navItems, type View } from "./nav-config";
import { UserMenu } from "./user-menu";
import { NotificationModal } from "./notification-modal";
import type { Profile } from "@/lib/operations-types";

export function Topbar({
  activeView,
  onMenu,
  onToggleSidebar,
  sidebarCollapsed,
  profile,
  companyName,
}: {
  activeView: View;
  onMenu: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  profile: Profile | null;
  companyName?: string;
}) {
  const current = navItems.find((item) => item.id === activeView);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifications = useQuery(api.notifications.list, profile ? {} : "skip");
  const unreadCount = useQuery(api.notifications.unreadCount, profile ? {} : "skip");
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={onMenu}>
            <Menu size={19} />
          </button>
          <button className="collapse-button icon-button" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={onToggleSidebar}>
            {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
          <div className="breadcrumb">
            <span>{companyName ?? "YT Advertising"}</span>
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
          <button className="icon-button notification" aria-label={`${unreadCount ?? 0} unread notifications`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(true)}>
            <Bell size={19} />
            {unreadCount ? <b>{unreadCount > 99 ? "99+" : unreadCount}</b> : null}
          </button>
          <UserMenu profile={profile} />
        </div>
      </header>
      {notificationsOpen && notifications ? (
        <NotificationModal
          notifications={notifications}
          onMarkRead={(id) => void markRead({ notificationId: id as Id<"notifications"> })}
          onMarkAllRead={() => void markAllRead()}
          onClose={() => setNotificationsOpen(false)}
        />
      ) : null}
    </>
  );
}
