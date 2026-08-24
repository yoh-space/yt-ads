"use client";

import { Bell, Check, X } from "lucide-react";
import { ModalShell } from "./modals/modal-shell";

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
  return (
    <ModalShell title="Notifications" subtitle="Updates relevant to your work and responsibilities." onClose={onClose}>
      <div className="notification-modal-body">
        <div className="notification-modal-actions">
          <span><Bell size={14} />{notifications.filter((item) => !item.readAt).length} unread</span>
          <button className="text-button" type="button" onClick={onMarkAllRead}>Mark all as read</button>
        </div>
        <div className="notification-list">
          {notifications.map((notification) => (
            <article className={`notification-item ${notification.readAt ? "read" : "unread"}`} key={notification._id}>
              <div className="notification-item-icon"><Bell size={15} /></div>
              <div className="notification-item-content">
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                <small>{notification.actorName ? `${notification.actorName} · ` : ""}{new Date(notification.createdAt).toLocaleString()}</small>
              </div>
              {!notification.readAt ? (
                <button className="icon-button notification-read" type="button" aria-label={`Mark ${notification.title} as read`} onClick={() => onMarkRead(notification._id)}><Check size={14} /></button>
              ) : null}
            </article>
          ))}
          {notifications.length === 0 ? <div className="empty-state">No notifications yet.</div> : null}
        </div>
        <button className="icon-button notification-modal-close" type="button" aria-label="Close notifications" onClick={onClose}><X size={16} /></button>
      </div>
    </ModalShell>
  );
}
