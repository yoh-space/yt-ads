"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Bell, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getNavItemHref, navItems } from "./nav-config";
import type { View } from "@/types/dashboard-types";
import { UserMenu } from "./user-menu";
import { NotificationModal } from "./notification-modal";
import { TelemetryBar } from "@/components/ui/telemetry-bar";
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
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

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
          <div className="w-[245px] h-[34px] flex items-center gap-[7px] px-[7px_7px_7px_10px] border border-line rounded-lg text-gray-500">
            <Search size={17} />
            <input 
              className="flex-1 min-w-0 border-0 outline-0 bg-transparent text-[11px] text-ink placeholder:text-gray-400"
              placeholder="Search material, job card..." 
            />
            <kbd className="font-mono text-[9px] px-1 py-[3px] bg-gray-100 rounded-[3px] text-gray-400">
              ⌘ K
            </kbd>
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

      <TelemetryBar
        items={[
          { label: "ማሽን ሁኔታ", value: "Running", tone: "green" },
          { label: "የሙቀት መጠን", value: "22°C / 44%", tone: "cyan" },
          { label: "ስቴሽን", value: "#4", tone: "green" },
          { label: "የወቅቱ ሰዓት", value: clock, tone: "amber" },
        ]}
      />

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
