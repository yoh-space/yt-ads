"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Boxes,
  Check,
  CheckCircle2,
  ClipboardList,
  Cog,
  LayoutList,
  ShoppingCart,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { ModalShell } from "@/components/dashboard/modals/modal-shell";
import { cn } from "@/lib/utils";
import { OPERATOR_ROLES } from "@/components/dashboard/roles/operator/operator-nav";

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
  domain?: string;
  relatedLabel?: string;
  actorName?: string;
  createdAt: number;
  readAt?: number;
};

export type Category = "all" | "orders" | "inventory" | "operations" | "account";

type CategoryFilter = {
  value: Category;
  label: string;
  icon: LucideIcon;
  types?: NotificationType[];
};

const ALL_CATEGORY_FILTERS: CategoryFilter[] = [
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

const ATTENTION_TYPES: NotificationType[] = [
  "short_stock",
  "material_overuse",
  "discrepancy",
  "overdue_order",
  "exception_stock_out",
  "clearance_rejected",
];
const SUCCESS_TYPES: NotificationType[] = ["material_received", "clearance_granted"];

function formatNotificationTime(createdAt: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function getAllowedCategoriesForRole(role?: string): Category[] {
  if (role === "receptionist") {
    return ["all", "orders"];
  }
  if (role === "storekeeper") {
    return ["all", "inventory"];
  }
  if (role && (OPERATOR_ROLES as readonly string[]).includes(role)) {
    return ["all", "inventory", "operations"];
  }
  return ["all", "orders", "inventory", "operations", "account"];
}

function getContextualEmptyState(role?: string, category?: CategoryFilter): { title: string; subtitle: string } {
  if (!category || category.value === "all") {
    return {
      title: "No notifications yet.",
      subtitle: "New activity will appear here when it needs your operational attention.",
    };
  }

  if (category.value === "inventory" && role === "storekeeper") {
    return {
      title: "No inventory notifications for your storekeeper workspace.",
      subtitle: "Material requests, stock alerts, and receipt events will appear here.",
    };
  }

  if (category.value === "orders" && role === "receptionist") {
    return {
      title: "No order notifications for your reception queue.",
      subtitle: "New customer orders and status transitions will appear here.",
    };
  }

  if (role && (OPERATOR_ROLES as readonly string[]).includes(role)) {
    return {
      title: `No ${category.label.toLowerCase()} notifications for your machine workspace.`,
      subtitle: "Job assignments, machine maintenance, and stock handovers will appear here.",
    };
  }

  return {
    title: `No ${category.label.toLowerCase()} notifications.`,
    subtitle: "New activity in this domain will appear here when it needs your attention.",
  };
}

export function NotificationModal({
  role,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onClose,
}: {
  role?: string;
  notifications: NotificationItem[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: (category?: Category) => void;
  onClose: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const unreadTotal = notifications.filter((item) => !item.readAt).length;

  const allowedCategories = useMemo(() => getAllowedCategoriesForRole(role), [role]);
  const visibleCategories = useMemo(
    () => ALL_CATEGORY_FILTERS.filter((filter) => allowedCategories.includes(filter.value)),
    [allowedCategories],
  );

  const currentCategory = visibleCategories.find((cat) => cat.value === activeCategory) ?? visibleCategories[0];
  const filteredNotifications = currentCategory?.types
    ? notifications.filter((notification) => currentCategory.types?.includes(notification.type))
    : notifications;

  const emptyState = getContextualEmptyState(role, currentCategory);

  return (
    <ModalShell
      title="Notifications"
      subtitle="Updates relevant to your work and operational scope."
      onClose={onClose}
      className="h-[min(720px,85vh)] max-w-2xl"
      bodyClassName="[scrollbar-width:thin] [scrollbar-color:hsl(var(--navy-2))_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-navy-2 [&::-webkit-scrollbar-thumb]:hover:bg-cyan"
    >
      <div className="flex min-h-full flex-col space-y-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/10 text-cyan-dark">
              <Bell size={14} />
            </span>
            <span>
              <b className="text-foreground">{unreadTotal}</b> unread total
            </span>
          </span>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm font-semibold text-cyan-dark transition-colors hover:bg-cyan/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-60"
            onClick={() => onMarkAllRead(currentCategory?.value === "all" ? undefined : currentCategory?.value)}
            disabled={unreadTotal === 0}
          >
            {currentCategory && currentCategory.value !== "all"
              ? `Mark ${currentCategory.label.toLowerCase()} as read`
              : "Mark all as read"}
          </button>
        </div>

        <div
          className="rounded-xl border border-border bg-secondary/70 p-1"
          role="tablist"
          aria-label="Notification categories"
        >
          <div className={cn(
            "grid gap-1",
            visibleCategories.length <= 2 ? "grid-cols-2" : visibleCategories.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-5"
          )}>
            {visibleCategories.map((category) => {
              const Icon = category.icon;
              const unreadCount = category.types
                ? notifications.filter((n) => !n.readAt && category.types?.includes(n.type)).length
                : unreadTotal;
              const isActive = (currentCategory?.value ?? "all") === category.value;

              return (
                <button
                  key={category.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="notification-list"
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
                  {unreadCount > 0 ? (
                    <span
                      className={cn(
                        "min-w-5 rounded-full px-1.5 py-0.5 text-center font-mono text-[10px] leading-none",
                        isActive ? "bg-primary-foreground/15 text-primary-foreground" : "bg-card text-foreground font-bold",
                      )}
                    >
                      {unreadCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div
          id="notification-list"
          className="space-y-3"
          role="tabpanel"
          aria-label={`${currentCategory?.label} notifications`}
        >
          {filteredNotifications.map((notification) => {
            const read = Boolean(notification.readAt);
            const needsAttention = ATTENTION_TYPES.includes(notification.type);
            const isSuccess = SUCCESS_TYPES.includes(notification.type);
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
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="block text-sm font-semibold text-foreground">{notification.title}</strong>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        needsAttention
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                          : isSuccess
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                            : "border-cyan/40 bg-cyan/10 text-cyan-dark",
                      )}
                    >
                      {needsAttention ? <TriangleAlert size={11} aria-hidden="true" /> : null}
                      {isSuccess ? <CheckCircle2 size={11} aria-hidden="true" /> : null}
                      {needsAttention ? "Attention" : isSuccess ? "Complete" : read ? "Read" : "New"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.message}</p>
                  {notification.relatedLabel ? (
                    <span className="mt-2 inline-flex max-w-full truncate rounded-md border border-border bg-card px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                      {notification.relatedLabel}
                    </span>
                  ) : null}
                  <small className="mt-2 block text-xs text-muted-foreground">
                    {notification.actorName ? `${notification.actorName} · ` : ""}
                    {formatNotificationTime(notification.createdAt)}
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
              <p className="text-sm font-semibold text-foreground">{emptyState.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{emptyState.subtitle}</p>
            </div>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
}
