import type { MiniAppOrderPayload } from "@/telegram/types";

/** True when the page is running inside a Telegram client webview (Mini App). */
export function isTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.Telegram?.WebApp);
}

/** Marks the Mini App as ready and expands it in the Telegram client. */
export function bootstrapTelegramWebApp(): void {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return;
  try {
    webApp.ready();
    webApp.expand?.();
  } catch {
    // Non-fatal; the page still works as a normal website.
  }
}

/**
 * Returns the finished order to the bot chat via `sendData`. The webhook bot
 * receives it as a `web_app_data` message and answers with a confirmation.
 */
export function sendTelegramOrderResult(payload: MiniAppOrderPayload): void {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return;
  try {
    webApp.sendData(JSON.stringify(payload));
  } catch {
    // Non-fatal; the order is already stored in Convex.
  }
}