import { isTauri } from "@tauri-apps/api/core";

/**
 * Small desktop helpers used by the Tauri shell.
 *
 * These are pure wrappers around standard WebView APIs so the shared web
 * client stays unchanged when served as a normal website.
 */

/** True when the app is running inside a Tauri WebView rather than a browser. */
export function isDesktopShell(): boolean {
  return typeof window !== "undefined" && isTauri();
}
