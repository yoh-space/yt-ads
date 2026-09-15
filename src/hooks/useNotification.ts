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
const NOTIFICATION_SOUND_URL = "/notification.mp3";
const FALLBACK_NOTIFICATION_SOUND_URL = "/notification.wav";

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
let audioContext: AudioContext | null = null;

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext || audioContext.state === "closed") {
    try {
      audioContext = new AudioContextClass();
    } catch {
      audioContext = null;
    }
  }
  return audioContext;
}

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    try {
      sharedAudio = new Audio();
      const canPlayMp3 = sharedAudio.canPlayType("audio/mpeg");
      sharedAudio.src = canPlayMp3 !== "" ? NOTIFICATION_SOUND_URL : FALLBACK_NOTIFICATION_SOUND_URL;
      sharedAudio.preload = "auto";
      sharedAudio.onerror = () => {
        if (sharedAudio && sharedAudio.src.endsWith(".mp3")) {
          sharedAudio.src = FALLBACK_NOTIFICATION_SOUND_URL;
          sharedAudio.load();
        }
      };
    } catch {
      sharedAudio = null;
    }
  }
  return sharedAudio;
}

/**
 * Synthesizes a crisp two-tone chime (D5 -> A5) via Web Audio API.
 * Guarantees audio feedback even if audio files are blocked by autoplay or loading issues.
 */
export function playSynthesizedChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    // Tone 1: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: A5 (880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.08);
    gain2.gain.setValueAtTime(0.22, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.6);
  } catch {
    // AudioContext blocked or restricted
  }
}

export async function playChime(): Promise<void> {
  const audio = getAudio();
  if (!audio) {
    playSynthesizedChime();
    return;
  }
  try {
    audio.currentTime = 0;
    await audio.play();
  } catch (error) {
    // Fall back to synthesized Web Audio chime if element playback failed
    try {
      playSynthesizedChime();
    } catch {
      console.warn("Web notification sound could not play.", error);
    }
  }
}

async function playNativeChime(): Promise<void> {
  try {
    await invoke("play_notification_sound");
  } catch (error) {
    console.warn("Native notification sound could not play.", error);
  }
}

export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }
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
    const handleUserGesture = () => {
      unlockAudio();
    };
    window.addEventListener("pointerdown", handleUserGesture, { passive: true });
    window.addEventListener("click", handleUserGesture, { passive: true });
    window.addEventListener("keydown", handleUserGesture, { passive: true });
    window.addEventListener("touchstart", handleUserGesture, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", handleUserGesture);
      window.removeEventListener("click", handleUserGesture);
      window.removeEventListener("keydown", handleUserGesture);
      window.removeEventListener("touchstart", handleUserGesture);
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
