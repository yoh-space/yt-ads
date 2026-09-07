"use client";

import { useState } from "react";
import {
  Bell,
  Boxes,
  Check,
  ClipboardList,
  Cog,
  LayoutList,
  ShoppingCart,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { ModalShell } from "./modals/modal-shell";
import { cn } from "@/lib/utils";

type NotificationType =
  | "material_request"
  | "material_issue"
  | "material_received"
  | "short_stock"
  | "material_overuse"
  | "discrepancy"
  | "job_update"
  | "machine_update"
  | "account_update"
  | "order_received"
  | "order_status"
  | "overdue_order"
  | "exception_stock_out"
  | "clearance_granted"
  | "clearance_rejected";

type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  type: NotificationType;
  actorName?: string;
  createdAt: number;
  readAt?: number;
};

type Category = "all" | "orders" | "inventory" | "operations" | "account";

type CategoryFilter = {
  value: Category;
  label: string;
  icon: LucideIcon;
  types?: NotificationType[];
};

const CATEGORY_FILTERS: CategoryFilter[] = [
  { value: "all", label: "All", icon: LayoutList },
  {
    value: "orders",
    label: "Orders",
    icon: ShoppingCart,
    types: ["order_received", "order_status", "overdue_order"],
  },
  {
    value: "inventory",
    label: "Inventory",
    icon: Boxes,
    types: [
      "material_request",
      "material_issue",
      "material_received",
      "short_stock",
      "material_overuse",
      "discrepancy",
      "exception_stock_out",
    ],
  },
  {
    value: "operations",
    label: "Operations",
    icon: Cog,
    types: ["job_update", "machine_update", "clearance_granted", "clearance_rejected"],
  },
  { value: "account", label: "Account", icon: UserRound, types: ["account_update"] },
];

export function NotificationModal({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onClose,
}: {
  notifications: NotificationItem[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const unread = notifications.filter((item) => !item.readAt).length;
  const selectedCategory = CATEGORY_FILTERS.find((category) => category.value === activeCategory);
  const filteredNotifications = selectedCategory?.types
    ? notifications.filter((notification) => selectedCategory.types?.includes(notification.type))
    : notifications;

  return (
    <ModalShell title="Notifications" subtitle="Updates relevant to your work and responsibilities." onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/10 text-cyan-dark">
              <Bell size={14} />
            </span>
            <span>
              <b className="text-foreground">{unread}</b> unread
            </span>
          </span>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm font-semibold text-cyan-dark transition-colors hover:bg-cyan/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-60"
            onClick={onMarkAllRead}
            disabled={unread === 0}
          >
            Mark all as read
          </button>
        </div>

        <div className="rounded-xl border border-border bg-secondary/70 p-1" role="tablist" aria-label="Notification categories">
          <div className="flex gap-1 overflow-x-auto">
            {CATEGORY_FILTERS.map((category) => {
              const Icon = category.icon;
              const count = category.types
                ? notifications.filter((notification) => category.types?.includes(notification.type)).length
                : notifications.length;
              const isActive = activeCategory === category.value;

              return (
                <button
                  key={category.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveCategory(category.value)}
                  className={cn(
                    "inline-flex min-w-max flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-cyan text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-card hover:text-foreground",
                  )}
                >
                  <Icon size={14} aria-hidden="true" />
                  {category.label}
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1.5 py-0.5 text-center font-mono text-[10px] leading-none",
                      isActive ? "bg-primary-foreground/15 text-primary-foreground" : "bg-card text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {filteredNotifications.map((notification) => {
            const read = Boolean(notification.readAt);
            return (
              <article
                key={notification._id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 transition-colors",
                  read ? "border-border bg-secondary/45" : "border-cyan/45 bg-cyan/10",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 flex-none items-center justify-center rounded-lg",
                    read ? "border border-border bg-card text-muted-foreground" : "bg-cyan text-primary-foreground",
                  )}
                >
                  <Bell size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm font-semibold text-foreground">{notification.title}</strong>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.message}</p>
                  <small className="mt-2 block text-xs text-muted-foreground">
                    {notification.actorName ? `${notification.actorName} · ` : ""}
                    {new Date(notification.createdAt).toLocaleString()}
                  </small>
                </div>
                {!read ? (
                  <button
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-cyan-dark hover:text-cyan-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type="button"
                    aria-label={`Mark ${notification.title} as read`}
                    onClick={() => onMarkRead(notification._id)}
                  >
                    <Check size={14} />
                  </button>
                ) : null}
              </article>
            );
          })}
          {filteredNotifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-secondary/45 p-10 text-center">
              <ClipboardList className="mx-auto mb-3 text-muted-foreground" size={24} aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">
                {notifications.length === 0 ? "No notifications yet." : `No ${selectedCategory?.label.toLowerCase()} notifications.`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">New activity will appear here when it needs your attention.</p>
            </div>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
}
