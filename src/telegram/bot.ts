import {
  Bot,
  session,
  type Context,
  type SessionFlavor,
} from "grammy";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { TelegramSessionData, OrderDraft } from "./types";
import { createConvexStorage } from "./session-storage";
import {
  REPLY_CONTACT,
  REPLY_LANGUAGE,
  REPLY_MINI_APP,
  REPLY_NEW_ORDER,
  REPLY_ORDER_STATUS,
  backToMenuKeyboard,
  isMainMenuLabel,
  languagePicker,
  mainMenuKeyboard,
  miniAppKeyboard,
  phoneNumberKeyboard,
  servicePicker,
  shareContactKeyboard,
  skipFileKeyboard,
} from "./keyboards";
import {
  formatOrderSummary,
  formatStatusLine,
  serviceLabel,
  serviceTypeFor,
  t,
} from "./i18n";
import {
  isOrderCode,
  looksLikePhone,
  normalizePhone,
  parseDimensions,
} from "./geometry";

type MyContext = Context & SessionFlavor<TelegramSessionData>;

/** The opaque update object accepted by `bot.handleUpdate` (grammY v1 core). */
export type BotUpdate = Parameters<Bot<MyContext>["handleUpdate"]>[0];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // Telegram bot file download limit.

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not configured.");
  return url.replace(/\/$/, "");
}

function ownerChatId(): string | undefined {
  return process.env.TELEGRAM_OWNER_CHAT_ID;
}

/* ─────────────────────────── session ─────────────────────────── */

function sessionKey(ctx: Context): string {
  return `chat:${ctx.chat?.id ?? ctx.from?.id ?? "unknown"}`;
}

const initialSession = (): TelegramSessionData => ({
  language: "am",
});

/* ─────────────────────────── file upload ─────────────────────────── */

interface IncomingFile {
  fileId: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
}

function extractFile(message: {
  document?: { file_id: string; file_name?: string; file_size?: number; mime_type?: string };
  photo?: Array<{ file_id: string; file_size?: number }>;
}): IncomingFile | null {
  if (message.document) {
    return {
      fileId: message.document.file_id,
      fileName: message.document.file_name ?? "artwork.bin",
      fileSize: message.document.file_size,
      mimeType: message.document.mime_type,
    };
  }
  if (message.photo && message.photo.length > 0) {
    const largest = message.photo[message.photo.length - 1];
    return { fileId: largest.file_id, fileName: "photo.jpg", mimeType: "image/jpeg" };
  }
  return null;
}

/** Downloads a Telegram file and uploads its bytes to Convex file storage. */
async function uploadFileToConvex(ctx: MyContext, file: IncomingFile): Promise<{ storageId: string; fileName: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  const telegramFile = await ctx.api.getFile(file.fileId);
  if (!telegramFile.file_path) throw new Error("Telegram file is unavailable.");
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${telegramFile.file_path}`);
  if (!response.ok) throw new Error("Could not download the file from Telegram.");
  const buffer = Buffer.from(await response.arrayBuffer());

  const uploadUrl = await fetchMutation(api.orders.generateUploadUrl, {});
  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.mimeType ?? "application/octet-stream" },
    body: buffer,
  });
  if (!upload.ok) throw new Error("Could not upload the file to storage.");
  const uploaded = (await upload.json()) as { storageId: string };
  return { storageId: uploaded.storageId, fileName: file.fileName };
}

/* ─────────────────────────── order helpers ─────────────────────────── */

function customerDisplayName(ctx: MyContext): string {
  const first = ctx.from?.first_name ?? "";
  const last = ctx.from?.last_name ?? "";
  return `${first}${first && last ? " " : ""}${last}`.trim() || `Telegram user`;
}

async function createOrder(ctx: MyContext, draft: OrderDraft): Promise<string> {
  const result = await fetchMutation(api.orders.createTelegramOrder, {
    telegramChatId: String(ctx.chat!.id),
    customerName: customerDisplayName(ctx).slice(0, 200),
    serviceType: draft.serviceType ?? "Other",
    dimensions: draft.dimensions,
    quantity: draft.area !== undefined ? String(draft.area) : undefined,
    phone: draft.phone,
    fileStorageId: draft.fileStorageId as Id<"_storage"> | undefined,
    fileName: draft.fileName,
  });
  return result.code;
}

async function notifyOwner(input: {
  code: string;
  customer: string;
  service: string;
  dimensions: string;
  phone: string;
  source: string;
}) {
  const chatId = ownerChatId();
  if (!chatId) return;
  try {
    const bot = getTelegramBot();
    const text = t("am", "ownerOrderNotification", {
      code: input.code,
      customer: input.customer,
      service: input.service,
      dimensions: input.dimensions,
      phone: input.phone,
      source: input.source,
    });
    await bot.api.sendMessage(chatId, text);
  } catch (error) {
    console.error("Owner order notification failed:", error);
  }
}

/* ─────────────────────────── flows ─────────────────────────── */

async function startNewOrder(ctx: MyContext) {
  ctx.session.draft = {};
  await ctx.reply(t(ctx.session.language, "serviceChoice"), { reply_markup: servicePicker(ctx.session.language) });
}

async function showMiniApp(ctx: MyContext) {
  await ctx.reply(t(ctx.session.language, "miniAppOffer"), {
    reply_markup: miniAppKeyboard(appUrl(), ctx.session.language),
  });
}

async function showOrderStatusPrompt(ctx: MyContext) {
  ctx.session.step = "order_code";
  await ctx.reply(t(ctx.session.language, "orderCodePrompt"), {
    reply_markup: backToMenuKeyboard(ctx.session.language),
  });
}

async function showAddress(ctx: MyContext) {
  const info = await fetchQuery(api.orders.publicInfo, {});
  await ctx.reply(
    t(ctx.session.language, "address", {
      company: info.companyName,
      address: info.address,
      phone: info.phone ?? "—",
    }),
  );
}

async function showLanguagePicker(ctx: MyContext) {
  await ctx.reply(t(ctx.session.language, "languagePrompt"), { reply_markup: languagePicker() });
}

async function cancelFlow(ctx: MyContext) {
  ctx.session.step = undefined;
  ctx.session.draft = undefined;
  await ctx.reply(t(ctx.session.language, "flowCancelled"), { reply_markup: mainMenuKeyboard(ctx.session.language) });
}

async function goHome(ctx: MyContext) {
  ctx.session.step = undefined;
  ctx.session.draft = undefined;
  await ctx.reply(t(ctx.session.language, "mainIntro"), { reply_markup: mainMenuKeyboard(ctx.session.language) });
}

async function handleMenuAction(ctx: MyContext, action: string) {
  switch (action) {
    case REPLY_NEW_ORDER:
      await startNewOrder(ctx);
      break;
    case REPLY_MINI_APP:
      await showMiniApp(ctx);
      break;
    case REPLY_ORDER_STATUS:
      await showOrderStatusPrompt(ctx);
      break;
    case REPLY_CONTACT:
      await showAddress(ctx);
      break;
    case REPLY_LANGUAGE:
      await showLanguagePicker(ctx);
      break;
  }
}

async function handleDimensions(ctx: MyContext, text: string) {
  const parsed = parseDimensions(text);
  if (!parsed) {
    await ctx.reply(t(ctx.session.language, "dimensionsInvalid"));
    return;
  }
  const draft = ctx.session.draft ?? {};
  draft.dimensions = parsed.label;
  draft.area = parsed.area;
  ctx.session.draft = draft;
  ctx.session.step = "file";
  await ctx.reply(t(ctx.session.language, "filePrompt"), { reply_markup: skipFileKeyboard(ctx.session.language) });
}

async function handleOtherSpec(ctx: MyContext, text: string) {
  const draft = ctx.session.draft ?? {};
  draft.serviceType = text.slice(0, 200);
  draft.serviceLabel = text.slice(0, 200);
  ctx.session.draft = draft;
  ctx.session.step = "dimensions";
  await ctx.reply(t(ctx.session.language, "dimensionsPrompt"));
}

async function handleFile(ctx: MyContext, file: IncomingFile) {
  if (file.fileSize !== undefined && file.fileSize > MAX_FILE_SIZE) {
    await ctx.reply(t(ctx.session.language, "fileTooLarge"), { reply_markup: skipFileKeyboard(ctx.session.language) });
    return;
  }
  const uploaded = await uploadFileToConvex(ctx, file);
  const draft = ctx.session.draft ?? {};
  draft.fileStorageId = uploaded.storageId;
  draft.fileName = uploaded.fileName;
  ctx.session.draft = draft;
  ctx.session.step = "phone";
  await ctx.reply(t(ctx.session.language, "fileReceived"));
  await ctx.reply(t(ctx.session.language, "phonePrompt"), { reply_markup: phoneNumberKeyboard(ctx.session.language) });
}

async function finalizeOrder(ctx: MyContext, phone: string) {
  const draft = ctx.session.draft ?? {};
  draft.phone = phone;
  ctx.session.draft = draft;
  const code = await createOrder(ctx, draft);
  const summary = formatOrderSummary(ctx.session.language, draft, code);
  ctx.session.step = undefined;
  ctx.session.draft = undefined;
  await ctx.reply(summary, { reply_markup: mainMenuKeyboard(ctx.session.language) });
  void notifyOwner({
    code,
    customer: customerDisplayName(ctx),
    service: draft.serviceLabel ?? draft.serviceType ?? "—",
    dimensions: draft.dimensions ?? "—",
    phone: phone || "—",
    source: "Telegram (በፅሁፍ / text)",
  });
}

/**
 * Handles a shared contact. During the text-order "phone" step it finalizes the
 * order draft; otherwise it registers the phone number on the customer's
 * Telegram profile (the /start share-contact flow) and offers the Mini App.
 */
async function handleContact(
  ctx: MyContext,
  contact: { phone_number?: string; user_id?: number },
) {
  const lang = ctx.session.language;
  const phone = normalizePhone(contact.phone_number ?? "");
  if (!phone) {
    await ctx.reply(t(lang, "phoneInvalid"));
    return;
  }
  if (ctx.session.step === "phone") {
    await finalizeOrder(ctx, phone);
    return;
  }

  // Only accept the customer's own contact, not one shared on another user's
  // behalf, so profiles always hold the sender's verified number.
  const telegramId = ctx.from?.id;
  if (telegramId === undefined || (contact.user_id !== undefined && contact.user_id !== telegramId)) {
    await ctx.reply(t(lang, "phoneInvalid"));
    return;
  }
  const name = customerDisplayName(ctx);
  try {
    await fetchMutation(api.users.upsertUser, {
      telegramId: String(telegramId),
      phone,
      name: name === "Telegram user" ? undefined : name,
    });
  } catch (error) {
    console.error("Failed to save the shared contact:", error);
    await ctx.reply(t(lang, "errorGeneric"));
    return;
  }
  await ctx.reply(t(lang, "contactSaved", { phone }), {
    reply_markup: miniAppKeyboard(appUrl(), lang),
  });
  await ctx.reply(t(lang, "mainIntro"), { reply_markup: mainMenuKeyboard(lang) });
}

async function handleTypedPhone(ctx: MyContext, text: string) {
  if (!looksLikePhone(text)) {
    await ctx.reply(t(ctx.session.language, "phoneInvalid"));
    return;
  }
  await finalizeOrder(ctx, normalizePhone(text));
}

async function handleOrderCodeSearch(ctx: MyContext, text: string) {
  const lookup = text.trim().toUpperCase();
  if (!isOrderCode(lookup) && !looksLikePhone(lookup)) {
    await ctx.reply(t(ctx.session.language, "orderCodePrompt"));
    return;
  }
  const orders = await fetchQuery(api.orders.track, { lookup });
  if (orders.length === 0) {
    await ctx.reply(t(ctx.session.language, "orderNotFound"), {
      reply_markup: backToMenuKeyboard(ctx.session.language),
    });
    return;
  }
  ctx.session.step = undefined;
  for (const order of orders.slice(0, 5)) {
    await ctx.reply(
      formatStatusLine(ctx.session.language, {
        code: order.code,
        serviceType: order.serviceType,
        dimensions: order.dimensions,
        status: order.status,
        createdAt: order.createdAt,
      }),
      { reply_markup: backToMenuKeyboard(ctx.session.language) },
    );
  }
}

async function handleWebAppResult(ctx: MyContext, rawData: string) {
  let payload: { code?: string; clientName?: string; serviceType?: string; dimensions?: string; quantity?: string };
  try {
    payload = JSON.parse(rawData) as typeof payload;
  } catch {
    payload = { code: rawData };
  }
  const code = payload.code;
  if (!code) {
    await ctx.reply(t(ctx.session.language, "errorGeneric"));
    return;
  }
  ctx.session.step = undefined;
  ctx.session.draft = undefined;
  await ctx.reply(t(ctx.session.language, "miniAppConfirmed", { code }), {
    reply_markup: mainMenuKeyboard(ctx.session.language),
  });
  void notifyOwner({
    code,
    customer: payload.clientName ?? customerDisplayName(ctx),
    service: payload.serviceType ?? "—",
    dimensions: payload.dimensions ?? "—",
    phone: "—",
    source: "Telegram Mini App",
  });
}

/* ─────────────────────────── message handler ─────────────────────────── */

async function handleMessage(ctx: MyContext) {
  const msg = ctx.message;
  if (!msg) return;
  const lang = ctx.session.language;

  // WebApp order result sent back from the Next.js Mini App (sendData).
  if (msg.web_app_data?.data) {
    await handleWebAppResult(ctx, msg.web_app_data.data);
    return;
  }

  // Shared phone number (reply keyboard with request_contact).
  if (msg.contact) {
    await handleContact(ctx, msg.contact);
    return;
  }

  // Design file upload during the "file" step.
  const file = extractFile(msg);
  if (file) {
    if (ctx.session.step === "file") {
      try {
        await handleFile(ctx, file);
      } catch {
        await ctx.reply(t(lang, "errorGeneric"));
      }
    }
    return;
  }

  const text = msg.text?.trim();
  if (!text) return;

  // Reply-keyboard navigation always wins over a pending step.
  const nav = isMainMenuLabel(lang, text) ?? isMainMenuLabel(lang === "am" ? "en" : "am", text);
  if (nav) {
    await handleMenuAction(ctx, nav);
    return;
  }

  // Pending conversational step.
  if (ctx.session.step) {
    switch (ctx.session.step) {
      case "dimensions":
        await handleDimensions(ctx, text);
        return;
      case "other_spec":
        await handleOtherSpec(ctx, text);
        return;
      case "phone":
        await handleTypedPhone(ctx, text);
        return;
      case "order_code":
        await handleOrderCodeSearch(ctx, text);
        return;
      case "file":
        await ctx.reply(t(lang, "filePrompt"), { reply_markup: skipFileKeyboard(lang) });
        return;
      default:
        return;
    }
  }

  await ctx.reply(t(lang, "mainIntro"), { reply_markup: mainMenuKeyboard(lang) });
}

/* ─────────────────────────── bot assembly ─────────────────────────── */

export function createBot(token: string): Bot<MyContext> {
  const bot = new Bot<MyContext>(token);

  // All bot copy is authored with Telegram HTML tags; default every message
  // send to HTML unless a caller opts out.
  bot.api.config.use((prev, method, payload) => {
    if (method === "sendMessage" && !("parse_mode" in payload)) {
      (payload as { parse_mode?: string }).parse_mode = "HTML";
    }
    return prev(method, payload);
  });

  bot.use(
    session({
      initial: initialSession,
      storage: createConvexStorage(),
      getSessionKey: sessionKey,
    }),
  );

  // This bot is a customer-facing order assistant for private chats.
  bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.type !== "private") return;
    await next();
  });

  bot.command("start", async (ctx) => {
    ctx.session.step = undefined;
    ctx.session.draft = undefined;
    await ctx.reply(t(ctx.session.language, "start"), {
      reply_markup: shareContactKeyboard(),
    });
  });

  bot.command(["menu", "home"], async (ctx) => {
    await goHome(ctx);
  });

  bot.command("cancel", async (ctx) => {
    await cancelFlow(ctx);
  });

  bot.command(["language", "lang"], async (ctx) => {
    await showLanguagePicker(ctx);
  });

  bot.command(["help", "contact"], async (ctx) => {
    await showAddress(ctx);
  });

  bot.on("message", handleMessage);

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const lang = ctx.session.language;
    try {
      await ctx.answerCallbackQuery();
    } catch {
      // Ignore answer failures; the chat reply still proves the tap worked.
    }

    if (data.startsWith("srv:")) {
      ctx.session.draft = {};
      const canned = data.replace("srv:", "") as "banner" | "sticker" | "acrylic" | "other";
      if (canned === "other") {
        ctx.session.step = "other_spec";
        await ctx.reply(t(lang, "serviceSpecPrompt"));
      } else {
        const draft = ctx.session.draft ?? {};
        draft.serviceType = serviceTypeFor(canned);
        draft.serviceLabel = serviceLabel(lang, canned);
        ctx.session.draft = draft;
        ctx.session.step = "dimensions";
        await ctx.reply(t(lang, "dimensionsPrompt"));
      }
      return;
    }

    switch (data) {
      case "flow:service":
        await startNewOrder(ctx);
        break;
      case "flow:skip_file": {
        ctx.session.step = "phone";
        await ctx.reply(t(lang, "phonePrompt"), { reply_markup: phoneNumberKeyboard(lang) });
        break;
      }
      case "flow:cancel":
        await cancelFlow(ctx);
        break;
      case "menu:back":
        await goHome(ctx);
        break;
      case "open:language":
        await showLanguagePicker(ctx);
        break;
      default:
        break;
    }

    if (data.startsWith("lang:")) {
      ctx.session.language = data === "lang:en" ? "en" : "am";
      await ctx.reply(t(ctx.session.language, "languageChanged"));
      await goHome(ctx);
    }
  });

  bot.catch((error) => {
    console.error("Telegram bot error:", error.error);
  });

  return bot;
}

let botSingleton: Bot<MyContext> | null = null;

/** Returns the shared bot instance; optional for webhook (non-polling) use. */
export function getTelegramBot(): Bot<MyContext> {
  if (!botSingleton) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
    botSingleton = createBot(token);
  }
  return botSingleton;
}