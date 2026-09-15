import { isTauri } from "@tauri-apps/api/core";

/**
 * Cross-platform native shell helpers used by the Tauri shell (Desktop & Mobile).
 *
 * These are pure wrappers around standard WebView and Tauri APIs so the shared web
 * client stays unchanged when served as a normal website.
 */

/** True when the app is running inside a Tauri WebView rather than a standard browser. */
export function isNativeShell(): boolean {
  return typeof window !== "undefined" && isTauri();
}

/** True when the app is running inside a Tauri WebView on a mobile platform (Android or iOS). */
export function isMobileShell(): boolean {
  if (!isNativeShell()) return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

/** True when running on Android inside the native shell. */
export function isAndroid(): boolean {
  if (!isNativeShell()) return false;
  return /Android/i.test(navigator.userAgent || "");
}

/** True when running on iOS inside the native shell. */
export function isIos(): boolean {
  if (!isNativeShell()) return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

/** True when the app is running inside a desktop Tauri WebView. */
export function isDesktopShell(): boolean {
  return isNativeShell() && !isMobileShell();
}
