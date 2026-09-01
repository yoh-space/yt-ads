import { NextRequest, NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";

const TELEGRAM_API = "https://api.telegram.org";

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: { id: number; first_name?: string; username?: string };
    text?: string;
    from?: { first_name?: string; last_name?: string; username?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    from: { first_name?: string; last_name?: string; username?: string };
    message?: { chat: { id: number } };
  };
};

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  return token;
}

function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not configured.");
  return url.replace(/\/$/, "");
}

async function sendTelegram(method: string, payload: Record<string, unknown>) {
  const token = getBotToken();
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json();
}

async function reply(chatId: number, text: string, keyboard?: Record<string, unknown>) {
  const payload: Record<string, unknown> = { chat_id: chatId, text };
  if (keyboard) {
    payload.reply_markup = JSON.stringify(keyboard);
  }
  return sendTelegram("sendMessage", payload);
}

function buildMainKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "🖨️ Open Booking App",
          web_app: { url: getAppUrl() },
        },
      ],
      [
        { text: "📜 Catalog", callback_data: "catalog" },
        { text: "📦 Track Order", callback_data: "track" },
        { text: "📞 Support", callback_data: "support" },
      ],
    ],
  };
}

const CATALOG_TEXT =
  "🖨️ *Our Print Services*\n\n" +
  "• *Flex Banners* — Large-format indoor/outdoor banners and signage.\n" +
  "• *Stickers* — Die-cut, vinyl, and branded stickers in any size.\n" +
  "• *Acrylic Signs* — Premium cut and printed acrylic for interiors and storefronts.\n" +
  "• *UV Printing* — Durable UV flatbed and roll-to-roll printing.\n\n" +
  "Tap *🖨️ Open Booking App* to submit an order directly.";

const SUPPORT_TEXT =
  "📞 *Customer Support*\n\n" +
  "For help with your order or to speak with our team:\n\n" +
  "• Call or WhatsApp our support line.\n" +
  "• Mention your order code (e.g. ORD-2026-123456) for faster assistance.\n\n" +
  "We typically reply within business hours.";

async function handleMessage(chatId: number, text: string, firstName: string) {
  if (!text) return;
  const lower = text.trim().toLowerCase();

  if (lower.startsWith("/start")) {
    return reply(
      chatId,
      `Welcome, ${firstName}! 👋\n\nI'm the *YT Advertising* ordering assistant. I can help you place print orders, track their status, or reach support.\n\nUse the buttons below to get started.`,
      buildMainKeyboard(),
    );
  }

  if (lower.startsWith("/catalog") || lower === "catalog") {
    return reply(chatId, CATALOG_TEXT, {
      inline_keyboard: [
        [{ text: "🖨️ Open Booking App", web_app: { url: getAppUrl() } }],
      ],
    });
  }

  if (lower.startsWith("/track") || lower === "track") {
    return reply(
      chatId,
      `📦 *Order Tracking*\n\nSend me your order code (e.g. ORD-2026-123456) or your phone number and I'll look up its current status.`,
    );
  }

  if (lower.startsWith("/support") || lower === "support") {
    return reply(chatId, SUPPORT_TEXT);
  }

  await handleOrderText(chatId, text, firstName);
}

async function handleOrderText(chatId: number, text: string, firstName: string) {
  try {
    const result = await fetchMutation(api.orders.createTelegramOrder, {
      telegramChatId: String(chatId),
      customerName: firstName || `Telegram User ${chatId}`,
      serviceType: text.trim().slice(0, 300),
      dimensions: undefined,
      quantity: undefined,
      notes: `Sent via Telegram as free-text order.`,
    });

    await reply(
      chatId,
      `✅ *Order received!*\n\nYour order code is *${result.code}*.\n\nWe've logged it in our system and our team will begin processing shortly. Use the *📦 Track Order* button (or send your order code anytime) to check its status.`,
    );
  } catch {
    await reply(
      chatId,
      "⚠️ Sorry, we couldn't save your order automatically. Please use the *🖨️ Open Booking App* button to submit it, or contact 📞 support.",
    );
  }
}

async function handleCallback(query: TelegramUpdate["callback_query"] & {}) {
  if (!query?.data || !query.message) return;
  const chatId = query.message.chat.id;
  const data = query.data;

  await sendTelegram("answerCallbackQuery", { callback_query_id: query.id });

  if (data === "catalog") {
    await reply(chatId, CATALOG_TEXT, {
      inline_keyboard: [
        [{ text: "🖨️ Open Booking App", web_app: { url: getAppUrl() } }],
      ],
    });
  } else if (data === "track") {
    await reply(
      chatId,
      `📦 *Order Tracking*\n\nSend me your order code (e.g. ORD-2026-123456) or your phone number and I'll look up its current status.`,
    );
  } else if (data === "support") {
    await reply(chatId, SUPPORT_TEXT);
  }
}

export async function POST(request: NextRequest) {
  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (update.message?.text && update.message.chat) {
      await handleMessage(
        update.message.chat.id,
        update.message.text,
        update.message.from?.first_name || update.message.chat.first_name || "there",
      );
    } else if (update.callback_query) {
      await handleCallback(update.callback_query);
    }
  } catch (error) {
    console.error("Telegram webhook error:", error);
  }

  return NextResponse.json({ ok: true });
}
