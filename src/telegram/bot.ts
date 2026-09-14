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
  REPLY_MY_ORDERS,
  REPLY_NEW_ORDER,
  REPLY_ORDER_STATUS,
  backToMenuKeyboard,
  isMainMenuLabel,
  languagePicker,
  mainMenuKeyboard,
  miniAppKeyboard,
  phoneNumberKeyboard,
  servicePicker,
  specificationPicker,
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
import type { ServiceId } from "@/constants/services";
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

/** Build a Mini App launcher URL that pre-fills the customer's identity. */
function miniAppLaunchUrl(ctx: MyContext): string {
  const base = appUrl();
  const params = new URLSearchParams();
  if (ctx.session.telegramUserId) params.set("tgid", ctx.session.telegramUserId);
  else if (ctx.from?.id !== undefined) params.set("tgid", String(ctx.from.id));
  if (ctx.session.phone) params.set("phone", ctx.session.phone);
  if (ctx.session.telegramUserName) params.set("name", ctx.session.telegramUserName);
  else if (ctx.from?.first_name) {
    const inferred = `${ctx.from.first_name}${ctx.from.last_name ? ` ${ctx.from.last_name}` : ""}`.trim();
    if (inferred) params.set("name", inferred);
  }
  const qs = params.toString();
  return qs ? `${base}/?${qs}` : `${base}/`;
}

/** Reads the cached telegram profile without forcing an initData round-trip. */
async function hydrateSessionFromProfile(ctx: MyContext) {
  if (ctx.session.phone && ctx.session.telegramUserId) return;
  const telegramId = ctx.from?.id;
  if (telegramId === undefined) return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const profile = (await fetchQuery(api.users.getTelegramProfileForBot, {
      telegramId: String(telegramId),
      botToken: token,
    })) as { telegramId?: string; phone?: string; name?: string } | null;
    if (!profile?.phone) return;
    if (!ctx.session.telegramUserId) ctx.session.telegramUserId = profile.telegramId ?? String(telegramId);
    if (!ctx.session.phone) ctx.session.phone = profile.phone;
    if (!ctx.session.telegramUserName && profile.name) ctx.session.telegramUserName = profile.name;
    if (!ctx.session.phoneCapturedAt) ctx.session.phoneCapturedAt = Date.now();
  } catch {
    // Best-effort hydration — a failure here shouldn't block the customer.
  }
}

function ownerChatId(): string | undefined {
  return (
    process.env.TELEGRAM_RECEPTION_CHAT_ID ??
    process.env.TELEGRAM_OWNER_CHAT_ID ??
    process.env.TELEGRAM_OWNER_NOTIFICATIONS_CHAT_ID
  );
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
    serviceType: (draft.serviceType ?? "banner_print") as ServiceId,
    serviceId: (draft.serviceType ?? "banner_print") as ServiceId,
    specifications: draft.specifications,
    dimensions: draft.dimensions,
    quantity: draft.area !== undefined ? String(draft.area) : undefined,
    length: draft.length,
    width: draft.width,
    phone: draft.phone,
    fileStorageId: draft.fileStorageId as Id<"_storage"> | undefined,
    fileName: draft.fileName,
  });
  return result.code;
}

/**
 * Send the "new order received" alert to the receptionist Telegram group/chat.
 * The alert carries an inline action keyboard so the receptionist can Accept,
 * Reject, or Verify Payment straight from the chat without opening the
 * dashboard. Triggered the moment the customer submits an order.
 */
async function notifyReceptionist(input: {
  code: string;
  customer: string;
  service: string;
  dimensions: string;
  phone: string;
  source: string;
  language?: "am" | "en";
}) {
  const chatId = ownerChatId();
  if (!chatId) return;
  try {
    const lang = input.language ?? "am";
    const bot = getTelegramBot();
    const text = t(lang, "ownerOrderNotification", {
      code: input.code,
      customer: input.customer,
      service: input.service,
      dimensions: input.dimensions,
      phone: input.phone,
      source: input.source,
    });
    const reply_markup = {
      inline_keyboard: [
        [
          { text: t(lang, "receptionActionAccept"), callback_data: `act:accept:${input.code}` },
          { text: t(lang, "receptionActionReject"), callback_data: `act:reject:${input.code}` },
        ],
        [{ text: t(lang, "receptionActionVerify"), callback_data: `act:verify:${input.code}` }],
        [{ text: t(lang, "receptionActionHint"), url: `${appUrl()}/dashboard` }],
      ],
    };
    await bot.api.sendMessage(chatId, text, { reply_markup });
  } catch (error) {
    console.error("Reception order notification failed:", error);
  }
}

/**
 * Handle inline-keyboard callbacks from the receptionist alert. Performs the
 * only action that can complete from chat alone (`reject`); Accept/Verify
 * simply acknowledge and direct the receptionist into the dashboard so pricing
 * and machine/material selection can happen with the right context.
 */
async function handleReceptionCallback(ctx: MyContext, data: string) {
  const lang = ctx.session.language ?? "am";
  const [verb, ...rest] = data.split(":");
  if (verb !== "act") return;
  const action = rest[0];
  const code = rest.slice(1).join(":");
  if (!action || !code) return;

  await ctx.answerCallbackQuery({ text: "⏳…" }).catch(() => {});

  try {
    if (action === "reject") {
      const matches = (await fetchQuery(api.orders.track, { lookup: code.toUpperCase() })) as Array<{ id: string }>;
      const orderId = matches[0]?.id;
      if (!orderId) {
        await ctx.reply(t(lang, "callbackAlreadyHandled"));
        return;
      }
      await fetchMutation(api.orders.rejectFromReception, { orderId: orderId as Id<"customerOrders"> });
      await ctx.reply(t(lang, "callbackReceivedReject", { code }), { reply_markup: { remove_keyboard: true } });
      return;
    }
    if (action === "accept" || action === "verify") {
      const reply = action === "accept"
        ? t(lang, "callbackReceivedAccept", { code })
        : t(lang, "callbackReceivedVerify", { code });
      await ctx.reply(reply, {
        reply_markup: {
          inline_keyboard: [[{ text: t(lang, "receptionActionHint"), url: `${appUrl()}/dashboard` }]],
        },
      });
      return;
    }
    await ctx.reply(t(lang, "callbackAlreadyHandled"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to handle this action.";
    await ctx.reply(`⚠️ ${message}`);
  }
}

/* ─────────────────────────── flows ─────────────────────────── */

async function startNewOrder(ctx: MyContext) {
  ctx.session.draft = {};
  const catalog = await fetchQuery(api.catalog.getPublishedCatalog, {});
  if (!catalog || catalog.length === 0) {
    await ctx.reply(
      ctx.session.language === "am"
        ? "ይቅርታ፣ በአሁኑ ጊዜ ምንም አገልግሎቶች አይገኙም። እባክዎ ትንሽ ቆይተው እንደገና ይሞክሩ።"
        : "Sorry, no services are currently available for ordering. Please check back shortly.",
    );
    return;
  }
  await ctx.reply(t(ctx.session.language, "serviceChoice"), {
    reply_markup: servicePicker(ctx.session.language, catalog),
  });
}

async function promptNextSpecification(ctx: MyContext, fieldIndex: number) {
  const draft = ctx.session.draft ?? {};
  const serviceId = draft.serviceType ?? "";
  const fields = await fetchQuery(api.catalog.listServiceSpecFields, { serviceId });
  const field = fields[fieldIndex];
  if (!field) {
    ctx.session.step = "dimensions";
    await ctx.reply(t(ctx.session.language, "dimensionsPrompt"));
    return;
  }
  const fieldLabel = ctx.session.language === "am" ? (field.labelAm || field.labelEn) : field.labelEn;
  await ctx.reply(`${fieldLabel}:`, {
    reply_markup: specificationPicker(
      {
        key: field.fieldKey,
        label: field.labelEn,
        labelEn: field.labelEn,
        labelAm: field.labelAm,
        options: field.options ?? [],
      },
      fieldIndex,
      ctx.session.language,
    ),
  });
}

async function handleSpecificationSelection(ctx: MyContext, data: string) {
  const [, fieldIndexRaw, optionIndexRaw] = data.split(":");
  const fieldIndex = Number(fieldIndexRaw);
  const optionIndex = Number(optionIndexRaw);
  const draft = ctx.session.draft ?? {};
  const serviceId = draft.serviceType ?? "";
  const fields = await fetchQuery(api.catalog.listServiceSpecFields, { serviceId });
  const field = fields[fieldIndex];
  const option = field?.options?.[optionIndex];
  if (!field || !option) return;
  draft.specifications = { ...(draft.specifications ?? {}), [field.fieldKey]: option };
  ctx.session.draft = draft;
  await promptNextSpecification(ctx, fieldIndex + 1);
}

async function showMiniApp(ctx: MyContext) {
  await ctx.reply(t(ctx.session.language, "miniAppOffer"), {
    reply_markup: miniAppKeyboard(miniAppLaunchUrl(ctx), ctx.session.language),
  });
}

async function showOrderStatusPrompt(ctx: MyContext) {
  ctx.session.step = "order_code";
  await ctx.reply(t(ctx.session.language, "orderCodePrompt"), {
    reply_markup: backToMenuKeyboard(ctx.session.language),
  });
}

async function showMyOrders(ctx: MyContext) {
  const orders = await fetchQuery(api.orders.listByTelegramChat, { telegramChatId: String(ctx.chat!.id) });
  if (orders.length === 0) {
    await ctx.reply(ctx.session.language === "am" ? "እስካሁን በዚህ ቴሌግራም የተመዘገበ ትዕዛዝ የለም።" : "No orders are linked to this Telegram account yet.", { reply_markup: backToMenuKeyboard(ctx.session.language) });
    return;
  }
  for (const order of orders.slice(0, 10)) {
    await ctx.reply(
      formatStatusLine(ctx.session.language, {
        code: order.code,
        serviceType: serviceLabel(ctx.session.language, order.serviceType),
        dimensions: order.dimensions,
        status: order.status,
        createdAt: order.createdAt,
      }),
      { reply_markup: backToMenuKeyboard(ctx.session.language) },
    );
  }
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
    case REPLY_MY_ORDERS:
      await showMyOrders(ctx);
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
  draft.width = parsed.width;
  draft.length = parsed.height;
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
  const lang = ctx.session.language;
  // If we already know the customer by phone (share-contact done / typed previously),
  // skip the contact keyboard and submit the order straight away.
  if (ctx.session.phone) {
    draft.phone = ctx.session.phone;
    ctx.session.draft = draft;
    const code = await createOrder(ctx, draft);
    const summary = formatOrderSummary(lang, draft, code);
    ctx.session.step = undefined;
    ctx.session.draft = undefined;
    await ctx.reply(t(lang, "fileReceived"));
    await ctx.reply(summary, { reply_markup: mainMenuKeyboard(lang) });
    void notifyReceptionist({
      code,
      customer: customerDisplayName(ctx),
      service: draft.serviceLabel ?? draft.serviceType ?? "—",
      dimensions: draft.dimensions ?? "—",
      phone: ctx.session.phone,
      source: "Telegram (በፅሁፍ / text)",
      language: lang,
    });
    return;
  }
  ctx.session.step = "phone";
  await ctx.reply(t(lang, "fileReceived"));
  await ctx.reply(t(lang, "phonePrompt"), { reply_markup: phoneNumberKeyboard(lang) });
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
  void notifyReceptionist({
    code,
    customer: customerDisplayName(ctx),
    service: draft.serviceLabel ?? draft.serviceType ?? "—",
    dimensions: draft.dimensions ?? "—",
    phone: phone || "—",
    source: "Telegram (በፅሁፍ / text)",
    language: ctx.session.language,
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
  // Persist the verified contact in the session so we never re-prompt.
  ctx.session.telegramUserId = String(telegramId);
  ctx.session.phone = phone;
  ctx.session.telegramUserName = name === "Telegram user" ? undefined : name;
  ctx.session.phoneCapturedAt = Date.now();
  await ctx.reply(t(lang, "contactSaved", { phone }), {
    reply_markup: miniAppKeyboard(miniAppLaunchUrl(ctx), lang),
  });
  await ctx.reply(t(lang, "mainIntro"), { reply_markup: mainMenuKeyboard(lang) });
}

async function handleTypedPhone(ctx: MyContext, text: string) {
  if (!looksLikePhone(text)) {
    await ctx.reply(t(ctx.session.language, "phoneInvalid"));
    return;
  }
  const normalized = normalizePhone(text);
  // Persist a typed phone into the session so future flows skip the prompt.
  ctx.session.phone = normalized;
  ctx.session.phoneCapturedAt ??= Date.now();
  if (!ctx.session.telegramUserId && ctx.from?.id !== undefined) {
    ctx.session.telegramUserId = String(ctx.from.id);
  }
  if (!ctx.session.telegramUserName) {
    const inferred = `${ctx.from?.first_name ?? ""}${ctx.from?.last_name ? ` ${ctx.from.last_name}` : ""}`.trim();
    if (inferred) ctx.session.telegramUserName = inferred;
  }
  await finalizeOrder(ctx, normalized);
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
  void notifyReceptionist({
    code,
    customer: payload.clientName ?? customerDisplayName(ctx),
    service: payload.serviceType ?? "—",
    dimensions: payload.dimensions ?? "—",
    phone: "—",
    source: "Telegram Mini App",
    language: ctx.session.language,
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

function createBot(token: string): Bot<MyContext> {
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
    // Capture the Telegram user id + display name from the message context so we
    // can deep-link the Mini App later without re-asking the customer.
    if (ctx.from?.id !== undefined) ctx.session.telegramUserId = String(ctx.from.id);
    if (ctx.from?.first_name) {
      const inferred = `${ctx.from.first_name}${ctx.from.last_name ? ` ${ctx.from.last_name}` : ""}`.trim();
      if (inferred) ctx.session.telegramUserName = inferred;
    }
    // Hydrate the verified phone from Convex when this is a returning customer.
    await hydrateSessionFromProfile(ctx);
    const lang = ctx.session.language;
    if (ctx.session.phone) {
      await ctx.reply(t(lang, "contactSaved", { phone: ctx.session.phone }), {
        reply_markup: miniAppKeyboard(miniAppLaunchUrl(ctx), lang),
      });
      await ctx.reply(t(lang, "mainIntro"), { reply_markup: mainMenuKeyboard(lang) });
      return;
    }
    await ctx.reply(t(lang, "start"), {
      reply_markup: shareContactKeyboard(),
    });
  });

  bot.command(["menu", "home"], async (ctx) => {
    await goHome(ctx);
  });

  bot.command("my-orders", async (ctx) => {
    await showMyOrders(ctx);
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
      const serviceId = data.replace("srv:", "");
      const draft = ctx.session.draft ?? {};
      draft.serviceType = serviceId;
      const svc = await fetchQuery(api.catalog.getService, { serviceId });
      draft.serviceLabel = lang === "am" ? (svc?.labelAm || svc?.labelEn || serviceLabel(lang, serviceId)) : (svc?.labelEn || serviceLabel(lang, serviceId));
      draft.specifications = {};
      ctx.session.draft = draft;
      await promptNextSpecification(ctx, 0);
      return;
    }
    if (data.startsWith("spec:")) {
      await handleSpecificationSelection(ctx, data);
      return;
    }

    if (data.startsWith("category:")) {
      return;
    }

    switch (data) {
      case "flow:service":
        await startNewOrder(ctx);
        break;
      case "flow:skip_file": {
        const lang = ctx.session.language;
        const draft = ctx.session.draft ?? {};
        if (ctx.session.phone) {
          draft.phone = ctx.session.phone;
          ctx.session.draft = draft;
          const code = await createOrder(ctx, draft);
          const summary = formatOrderSummary(lang, draft, code);
          ctx.session.step = undefined;
          ctx.session.draft = undefined;
          await ctx.reply(summary, { reply_markup: mainMenuKeyboard(lang) });
          void notifyReceptionist({
            code,
            customer: customerDisplayName(ctx),
            service: draft.serviceLabel ?? draft.serviceType ?? "—",
            dimensions: draft.dimensions ?? "—",
            phone: ctx.session.phone,
            source: "Telegram (በፅሁፍ / text)",
            language: lang,
          });
          return;
        }
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

    if (data.startsWith("act:")) {
      await handleReceptionCallback(ctx, data);
      return;
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
