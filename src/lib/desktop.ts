/**
 * Small desktop helpers used by the Tauri shell.
 *
 * These are pure wrappers around standard WebView APIs so the shared web
 * client stays unchanged when served as a normal website. Inside the desktop
 * app `window.print()` maps to the native printing dialog, which the
 * receptionist workflow uses for receipt and invoice output.
 */

/** Opens the native print dialog for the current document (receipts/invoices). */
export function printNative() {
  window.print();
}

/** True when the app is running inside a Tauri WebView rather than a browser. */
export function isDesktopShell(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
