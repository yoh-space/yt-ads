import type { MiniAppOrderPayload } from "@/telegram/types";

/** Values the bot launcher URL embeds so the Mini App can pre-fill identity. */
export interface TelegramLaunchContext {
  /** Telegram user id, sourced from `?tgid=` or `window.Telegram.WebApp.initDataUnsafe.user.id`. */
  telegramId?: string;
  /** Display name from `?name=` or `initDataUnsafe.user`. */
  name?: string;
  /** Verified phone (carried in the deep-link URL by the bot webhook). */
  phone?: string;
}

function readLaunchContextFromUrl(): TelegramLaunchContext {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const telegramId = params.get("tgid")?.trim() || undefined;
  const name = params.get("name")?.trim() || undefined;
  const phone = params.get("phone")?.trim() || undefined;
  return { telegramId, name, phone };
}

function readLaunchContextFromWebApp(): TelegramLaunchContext {
  if (typeof window === "undefined") return {};
  const webApp = window.Telegram?.WebApp;
  const user = webApp?.initDataUnsafe?.user;
  if (!user) return {};
  const telegramId = user.id !== undefined ? String(user.id) : undefined;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || undefined;
  // Telegram itself surfaces the customer's phone here if they shared it
  // with the bot; treat as a fallback. The public typings omit the field,
  // but the SDK attaches it at runtime — read defensively.
  const userPhone =
    typeof (user as unknown as { phone_number?: unknown }).phone_number === "string"
      ? ((user as unknown as { phone_number: string }).phone_number).trim()
      : "";
  return { telegramId, name, phone: userPhone || undefined };
}

/** True when the page is running inside a Telegram client webview (Mini App). */
export function isTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.Telegram?.WebApp);
}

/**
 * Resolve the customer identity from the launch context (query string takes
 * precedence because the bot packs the verified phone there on every launch).
 */
function readTelegramLaunchContext(): TelegramLaunchContext {
  const fromUrl = readLaunchContextFromUrl();
  const fromWebApp = readLaunchContextFromWebApp();
  return {
    telegramId: fromUrl.telegramId ?? fromWebApp.telegramId,
    name: fromUrl.name ?? fromWebApp.name,
    phone: fromUrl.phone ?? fromWebApp.phone,
  };
}

/** Marks the Mini App as ready, expands it, and returns the launch context. */
export function bootstrapTelegramWebApp(): TelegramLaunchContext {
  const webApp = window.Telegram?.WebApp;
  if (webApp) {
    try {
      webApp.ready();
      webApp.expand?.();
    } catch {
      // Non-fatal; the page still works as a normal website.
    }
  }
  return readTelegramLaunchContext();
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