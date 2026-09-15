"use client";

import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useSoundStore } from "@/store/useSoundStore";

/** Public path of the notification chime asset. */
const NOTIFICATION_SOUND_URL = "/notification.wav";

export type NotificationPayload = {
  title: string;
  body?: string;
};

export type NotificationSummary = {
  _id: string;
  title: string;
  message: string;
  createdAt: number;
};

let sharedAudio: HTMLAudioElement | null = null;

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(NOTIFICATION_SOUND_URL);
    sharedAudio.preload = "auto";
  }
  return sharedAudio;
}

async function playChime(): Promise<void> {
  const audio = getAudio();
  if (!audio) return;
  try {
    audio.currentTime = 0;
    await audio.play();
  } catch (error) {
    // Autoplay restriction, audio unsupported, or user gesture required.
    // Quietly ignore — the desktop notification still delivers the alert.
    console.warn("Web notification sound could not play.", error);
  }
}

async function playNativeChime(): Promise<void> {
  try {
    await invoke("play_notification_sound");
  } catch (error) {
    console.warn("Native notification sound could not play.", error);
  }
}

function unlockAudio(): void {
  const audio = getAudio();
  if (!audio || !audio.paused) return;
  void audio.play().then(() => {
    audio.pause();
    audio.currentTime = 0;
  }).catch(() => {
    // The browser may still require a later user gesture to unlock audio.
  });
}

function showDesktopNotification({ title, body }: NotificationPayload): void {
  if (isTauriRuntime()) {
    try {
      sendNotification({ title, body });
    } catch (error) {
      console.warn("Native desktop notification could not be delivered.", error);
    }
    return;
  }
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      silent: true,
    });
  } catch {
    // Some browsers throw in restricted contexts; fall back silently.
  }
}

/**
 * Real-time notification manager: plays the in-app chime (unless muted) and
 * fires a native OS desktop notification alongside it. Also requests browser
 * notification permission once on mount.
 */
export function useNotification(notifications?: NotificationSummary[]) {
  const isMuted = useSoundStore((state) => state.isMuted);
  const isMutedRef = useRef(isMuted);
  const seenNotificationIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (isTauriRuntime()) {
      void (async () => {
        try {
          let granted = await isPermissionGranted();
          if (!granted) granted = (await requestPermission()) === "granted";
        } catch (error) {
          console.warn("Native notification permission was unavailable.", error);
        }
      })();
      return;
    }
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      void Notification.requestPermission().catch(() => {
        // Permission prompt unavailable or dismissed; the chime still works.
      });
    }
  }, []);

  useEffect(() => {
    if (isTauriRuntime()) return;
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const triggerNotification = useCallback(({ title, body }: NotificationPayload): void => {
    if (!isMutedRef.current) {
      void (isTauriRuntime() ? playNativeChime() : playChime());
    }
    showDesktopNotification({ title, body });
  }, []);

  useEffect(() => {
    if (notifications === undefined) {
      seenNotificationIds.current = null;
      return;
    }

    if (seenNotificationIds.current === null) {
      seenNotificationIds.current = new Set(notifications.map((notification) => notification._id));
      return;
    }

    const seenIds = seenNotificationIds.current;
    const newNotifications = notifications
      .filter((notification) => !seenIds.has(notification._id))
      .sort((a, b) => a.createdAt - b.createdAt);

    notifications.forEach((notification) => seenIds.add(notification._id));
    newNotifications.forEach((notification) => {
      triggerNotification({ title: notification.title, body: notification.message });
    });
  }, [notifications, triggerNotification]);

  return { triggerNotification, isMuted };
}
