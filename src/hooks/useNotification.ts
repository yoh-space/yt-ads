"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSoundStore } from "@/store/useSoundStore";

/** Public path of the notification chime asset. */
const NOTIFICATION_SOUND_URL = "/notification.wav";

export type NotificationPayload = {
  title: string;
  body?: string;
};

let sharedAudio: HTMLAudioElement | null = null;

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
  } catch {
    // Autoplay restriction, audio unsupported, or user gesture required.
    // Quietly ignore — the desktop notification still delivers the alert.
  }
}

function showDesktopNotification({ title, body }: NotificationPayload): void {
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
export function useNotification() {
  const isMuted = useSoundStore((state) => state.isMuted);
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      void Notification.requestPermission().catch(() => {
        // Permission prompt unavailable or dismissed; the chime still works.
      });
    }
  }, []);

  const triggerNotification = useCallback(({ title, body }: NotificationPayload): void => {
    if (!isMutedRef.current) {
      void playChime();
    }
    showDesktopNotification({ title, body });
  }, []);

  return { triggerNotification, isMuted };
}
