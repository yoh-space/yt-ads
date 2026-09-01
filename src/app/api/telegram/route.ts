import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getTelegramBot, type BotUpdate } from "@/telegram/bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Telegram webhook endpoint. The update is routed through the grammY bot,
 * which persists chat sessions in Convex and drives the Amharic-first order
 * flows (traditional text flow + Telegram Mini App).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let update: BotUpdate;
  try {
    update = (await request.json()) as BotUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const bot = getTelegramBot();
    await bot.init();
    await bot.handleUpdate(update);
  } catch (error) {
    console.error("Telegram webhook error:", error);
  }

  return NextResponse.json({ ok: true });
}