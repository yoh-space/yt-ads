"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Bell, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getNavItemHref, navItems } from "./nav-config";
import type { View } from "@/types/dashboard-types";
import { UserMenu } from "./user-menu";
import { NotificationModal } from "../modals/notification-modal";
import { SoundControl } from "./sound-control";
import type { Profile } from "@/lib/operations-types";
import { cn } from "@/lib/utils";

function useClock(): string {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  if (!now) return "--:-- --";
  return now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Renders dashboard navigation, activity, and notification controls for a user. */
export function Topbar({
  activeView,
  onMenu,
  onToggleSidebar,
  sidebarCollapsed,
  profile,
  companyName,
  onOpenSettings,
}: {
  activeView?: View;
  onMenu?: () => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
  profile: Profile | null;
  companyName?: string;
  onOpenSettings?: () => void;
}) {
  const pathname = usePathname();
  const current = navItems.find((item) => {
    if (activeView) return item.id === activeView;
    const href = getNavItemHref(item.id, profile?.role ?? "admin");
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const clock = useClock();
  const notifications = useQuery(api.notifications.list, profile ? {} : "skip");
  const unreadCount = useQuery(api.notifications.unreadCount, profile ? {} : "skip");
  const machines = useQuery(api.machines.listForTopbar, profile ? {} : "skip");
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const runningMachines = machines?.filter((machine) => machine.status === "Running").length ?? 0;
  const availableMachines = machines?.filter((machine) => machine.status === "Available").length ?? 0;
  const maintenanceMachines = machines?.filter((machine) => machine.status === "Maintenance").length ?? 0;
  const activityItems = (notifications ?? []).slice(0, 3);

  return (
    <>
      <header className="h-[65px] px-[34px] flex items-center justify-between bg-white border-b border-line">
        <div className="flex items-center gap-5">
          <button 
            className="md:hidden grid place-items-center w-[34px] h-[34px] rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 hover:text-navy"
            aria-label="Open navigation" 
            onClick={onMenu}
          >
            <Menu size={19} />
          </button>
          
          <button 
            className="hidden md:grid place-items-center w-[34px] h-[34px] rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 hover:text-navy"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} 
            onClick={onToggleSidebar}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
          
          <div className="flex items-center gap-[9px] text-xs text-gray-500">
            <span>{companyName ?? "YT Advertising"}</span>
            <i className="text-gray-300 not-italic">/</i>
            <strong className="font-semibold text-navy">{current?.english}</strong>
          </div>
        </div>
        
        <div className="flex items-center gap-5">
          <div className="hidden md:flex items-center gap-2">
            <SoundControl />
          </div>
          
          <button 
            className="relative grid place-items-center w-[34px] h-[34px] rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 hover:text-navy"
            aria-label={`${unreadCount ?? 0} unread notifications`} 
            aria-expanded={notificationsOpen} 
            onClick={() => setNotificationsOpen(true)}
          >
            <Bell size={19} />
            {unreadCount ? (
              <b className="absolute right-1 top-[3px] grid place-items-center w-[14px] h-[14px] rounded-full bg-coral text-white font-mono text-[9px]">
                {unreadCount > 99 ? "99+" : unreadCount}
              </b>
            ) : null}
          </button>
          
          <UserMenu profile={profile} onOpenSettings={onOpenSettings ?? (() => {})} />
        </div>
      </header>

      <div className="flex min-h-8 items-center gap-3 overflow-hidden border-b border-line bg-white px-[34px] text-[10px] text-gray-500">
        <span className="shrink-0 font-mono font-semibold uppercase tracking-[0.12em] text-gray-400">Recent activity</span>
        <div className="flex min-w-0 items-center gap-4 overflow-hidden">
          {activityItems.length > 0 ? activityItems.map((activity) => (
            <span key={activity._id} className="truncate whitespace-nowrap">
              <strong className="font-semibold text-navy">{activity.title}</strong>
              {activity.relatedLabel ? ` · ${activity.relatedLabel}` : ""}
            </span>
          )) : <span className="truncate">No recent activity</span>}
        </div>
      </div>

      {notificationsOpen && notifications ? (
        <NotificationModal
          role={profile?.role}
          notifications={notifications}
          onMarkRead={(id) => void markRead({ notificationId: id as Id<"notifications"> })}
          onMarkAllRead={(category) => void markAllRead({ category })}
          onClose={() => setNotificationsOpen(false)}
        />
      ) : null}
    </>
  );
}
