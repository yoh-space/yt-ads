"use client";

import { Bell, Check, X } from "lucide-react";
import { ModalShell } from "./modals/modal-shell";
import { cn } from "@/lib/utils";

type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  actorName?: string;
  createdAt: number;
  readAt?: number;
};

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
  const unread = notifications.filter((item) => !item.readAt).length;

  return (
    <ModalShell title="Notifications" subtitle="Updates relevant to your work and responsibilities." onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-gray-600">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan/10 text-cyan">
              <Bell size={14} />
            </span>
            <b className="text-navy">{unread}</b> unread
          </span>
          <button
            type="button"
            className="text-sm font-semibold text-cyan-dark transition-colors hover:text-navy disabled:opacity-50"
            onClick={onMarkAllRead}
            disabled={unread === 0}
          >
            Mark all as read
          </button>
        </div>

        <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
          {notifications.map((notification) => {
            const read = Boolean(notification.readAt);
            return (
              <article
                key={notification._id}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border transition-colors",
                  read ? "bg-white border-line" : "bg-cyan/5 border-cyan/25",
                )}
              >
                <span
                  className={cn(
                    "flex-none flex items-center justify-center w-9 h-9 rounded-lg",
                    read ? "bg-gray-100 text-gray-400" : "bg-cyan text-white",
                  )}
                >
                  <Bell size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm font-semibold text-navy">{notification.title}</strong>
                  <p className="mt-0.5 text-sm text-gray-600">{notification.message}</p>
                  <small className="mt-1 block text-xs text-gray-500">
                    {notification.actorName ? `${notification.actorName} · ` : ""}
                    {new Date(notification.createdAt).toLocaleString()}
                  </small>
                </div>
                {!read ? (
                  <button
                    className="flex-none flex items-center justify-center w-7 h-7 rounded-lg bg-white border border-line text-gray-400 transition-colors hover:border-cyan hover:text-cyan-dark"
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
          {notifications.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500 bg-gray-50 border border-dashed border-line rounded-lg">
              No notifications yet.
            </div>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
}