import { InlineKeyboard, Keyboard } from "grammy";
import type { Language } from "./types";
import { getServiceLabel, SERVICE_CATEGORIES } from "@/constants/services";

export const REPLY_NEW_ORDER = "main.order";
export const REPLY_MINI_APP = "main.miniapp";
export const REPLY_ORDER_STATUS = "main.status";
export const REPLY_MY_ORDERS = "main.my-orders";
export const REPLY_CONTACT = "main.contact";
export const REPLY_LANGUAGE = "main.language";
const REPLY_PHONE = "contact.share";

/** Label of the /start share-contact button (bilingual by design). */
const SHARE_CONTACT_LABEL = "📱 ስልክ ቁጥርዎን ያጋሩ (Share Contact)";

const mainMenuLabels: Record<Language, Record<string, string>> = {
  am: {
    [REPLY_NEW_ORDER]: "✍️ አዲስ ትዕዛዝ",
    [REPLY_MINI_APP]: "🛍️ በ Mini App አዝዝ",
    [REPLY_ORDER_STATUS]: "📦 የትዕዛዝ ሁኔታ",
    [REPLY_MY_ORDERS]: "🧾 የእኔ ትዕዛዞች",
    [REPLY_CONTACT]: "📞 አድራሻ እና ስልክ",
    [REPLY_LANGUAGE]: "🌐 ቋንቋ / Language",
    [REPLY_PHONE]: "📱 ስልክ ቁጥር አጋራ",
  },
  en: {
    [REPLY_NEW_ORDER]: "✍️ Place New Order (by text)",
    [REPLY_MINI_APP]: "🛍️ Order in Mini App (visual)",
    [REPLY_ORDER_STATUS]: "📦 Order Status",
    [REPLY_MY_ORDERS]: "🧾 My Orders",
    [REPLY_CONTACT]: "📞 Address & Phone",
    [REPLY_LANGUAGE]: "🌐 Language / ቋንቋ",
    [REPLY_PHONE]: "📱 Send my phone number",
  },
};

function labelFor(lang: Language, key: string): string {
  return mainMenuLabels[lang][key] ?? key;
}

export function isMainMenuLabel(lang: Language, text: string): string | null {
  const match = Object.entries(mainMenuLabels[lang]).find(([, label]) => label === text.trim());
  return match ? match[0] : null;
}

/** Persistent reply keyboard shown under /start (top-level navigation only). */
export function mainMenuKeyboard(lang: Language): Keyboard {
  const keyboard = new Keyboard()
    .text(labelFor(lang, REPLY_NEW_ORDER))
    .row()
    .text(labelFor(lang, REPLY_MINI_APP))
    .row()
    .text(labelFor(lang, REPLY_ORDER_STATUS))
    .text(labelFor(lang, REPLY_MY_ORDERS))
    .text(labelFor(lang, REPLY_LANGUAGE))
    .row()
    .text(labelFor(lang, REPLY_CONTACT))
    .resized()
    .persistent()
    .placeholder(lang === "am" ? "ምርጫ ..." : "Choose an option…");
  return keyboard;
}

/** Reply keyboard with a `request_contact` button (sensitive data state). */
export function phoneNumberKeyboard(lang: Language): Keyboard {
  return new Keyboard().requestContact(labelFor(lang, REPLY_PHONE)).resized().persistent();
}

/**
 * Reply keyboard shown by /start with a single `request_contact` button so the
 * customer's phone number is captured and stored before they reach the Mini App.
 */
export function shareContactKeyboard(): Keyboard {
  return new Keyboard().requestContact(SHARE_CONTACT_LABEL).resized();
}

export function servicePicker(lang: Language): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const cat of SERVICE_CATEGORIES) {
    // Telegram inline keyboards have no disabled label element, so headers use
    // a harmless callback that the bot acknowledges without changing the flow.
    keyboard.text(`▰ ${cat.categoryName}`, `category:${cat.categoryId}`).row();
    // Add sub-service buttons in rows of up to 2
    let rowCount = 0;
    for (const svc of cat.items) {
      const label = getServiceLabel(svc.id, lang === "am" ? "am" : "en") ?? svc.label;
      // callback data: srv:<id>
      keyboard.text(label, `srv:${svc.id}`);
      rowCount += 1;
      if (rowCount % 2 === 0) keyboard.row();
    }
    // Ensure a row break between categories
    keyboard.row();
  }
  return keyboard.text("❌ " + (lang === "am" ? "ሰርዝ" : "Cancel"), "flow:cancel");
}

export function skipFileKeyboard(lang: Language): InlineKeyboard {
  return new InlineKeyboard()
    .text(lang === "am" ? "⏭️ በኋላ እልካለሁ" : "⏭️ I'll send it later", "flow:skip_file")
    .row()
    .text("❌ " + (lang === "am" ? "ሰርዝ" : "Cancel"), "flow:cancel");
}

export function miniAppKeyboard(launchUrl: string, lang: Language): InlineKeyboard {
  return new InlineKeyboard()
    .webApp(lang === "am" ? "🚀 Mini App ክፈት" : "🚀 Open Mini App", launchUrl)
    .row()
    .text(lang === "am" ? "🌐 ቋንቋ ይቀይሩ" : "🌐 Change language", "open:language");
}

export function languagePicker(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🇪🇹 አማርኛ", "lang:am")
    .text("🇬🇧 English", "lang:en");
}

export function backToMenuKeyboard(lang: Language): InlineKeyboard {
  return new InlineKeyboard().text(lang === "am" ? "🔙 ወደ መነሻ" : "🔙 Home", "menu:back");
}
