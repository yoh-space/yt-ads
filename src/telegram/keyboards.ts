import { InlineKeyboard, Keyboard } from "grammy";
import type { Language } from "./types";

export const REPLY_MAIN_MENU = "main.menu";
export const REPLY_NEW_ORDER = "main.order";
export const REPLY_MINI_APP = "main.miniapp";
export const REPLY_ORDER_STATUS = "main.status";
export const REPLY_CONTACT = "main.contact";
export const REPLY_LANGUAGE = "main.language";
export const REPLY_PHONE = "contact.share";

/** Label of the /start share-contact button (bilingual by design). */
export const SHARE_CONTACT_LABEL = "📱 ስልክ ቁጥርዎን ያጋሩ (Share Contact)";

const mainMenuLabels: Record<Language, Record<string, string>> = {
  am: {
    [REPLY_NEW_ORDER]: "✍️ አዲስ ትዕዛዝ ስጥ (በፅሁፍ)",
    [REPLY_MINI_APP]: "🛍️ በ Mini App አዝዝ (በምስል/በቪዥዋል)",
    [REPLY_ORDER_STATUS]: "📦 የትዕዛዝ ሁኔታ",
    [REPLY_CONTACT]: "📞 አድራሻ እና ስልክ",
    [REPLY_LANGUAGE]: "🌐 ቋንቋ / Language",
    [REPLY_PHONE]: "📱 ስልክ ቁጥሬን ላክ",
  },
  en: {
    [REPLY_NEW_ORDER]: "✍️ Place New Order (by text)",
    [REPLY_MINI_APP]: "🛍️ Order in Mini App (visual)",
    [REPLY_ORDER_STATUS]: "📦 Order Status",
    [REPLY_CONTACT]: "📞 Address & Phone",
    [REPLY_LANGUAGE]: "🌐 Language / ቋንቋ",
    [REPLY_PHONE]: "📱 Send my phone number",
  },
};

export function labelFor(lang: Language, key: string): string {
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
    .text(labelFor(lang, REPLY_LANGUAGE))
    .row()
    .text(labelFor(lang, REPLY_CONTACT))
    .resized()
    .persistent()
    .placeholder(lang === "am" ? "የምናሌ ምርጫ…" : "Choose an option…");
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

const serviceLabels: Record<Language, Array<[string, string]>> = {
  am: [
    ["srv:banner", "🖼️ ባነር (Flex)"],
    ["srv:sticker", "🏷️ ስቲከር (Sticker)"],
    ["srv:acrylic", "🪧 አክሪሊክ (Acrylic)"],
    ["srv:other", "📄 ሌላ"],
  ],
  en: [
    ["srv:banner", "🖼️ Banner (Flex)"],
    ["srv:sticker", "🏷️ Sticker"],
    ["srv:acrylic", "🪧 Acrylic"],
    ["srv:other", "📄 Other"],
  ],
};

export function servicePicker(lang: Language): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const [data, label] of serviceLabels[lang]) {
    keyboard.text(label, data);
    if (data === "srv:sticker") keyboard.row();
  }
  return keyboard.text("❌ " + (lang === "am" ? "ሰርዝ" : "Cancel"), "flow:cancel");
}

export function skipFileKeyboard(lang: Language): InlineKeyboard {
  return new InlineKeyboard()
    .text(lang === "am" ? "⏭️ በኋላ እልካለሁ" : "⏭️ I'll send it later", "flow:skip_file")
    .row()
    .text("❌ " + (lang === "am" ? "ሰርዝ" : "Cancel"), "flow:cancel");
}

export function miniAppKeyboard(appUrl: string, lang: Language): InlineKeyboard {
  return new InlineKeyboard()
    .webApp(lang === "am" ? "🚀 Mini App ክፈት" : "🚀 Open Mini App", appUrl)
    .row()
    .text(lang === "am" ? "🌐 ቋንቋ ይቀይሩ" : "🌐 Change language", "open:language");
}

export function startKeyboard(appUrl: string, lang: Language): InlineKeyboard {
  return new InlineKeyboard()
    .webApp(lang === "am" ? "🛍️ በ Mini App አዝዝ" : "🛍️ Order in Mini App", appUrl)
    .row()
    .text(lang === "am" ? "🌐 ቋንቋ ይቀይሩ" : "🌐 Change language", "open:language")
    .row()
    .text(lang === "am" ? "✍️ በፅሁፍ አዝዝ" : "✍️ Order by text", "flow:service");
}

export function languagePicker(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🇪🇹 አማርኛ", "lang:am")
    .text("🇬🇧 English", "lang:en");
}

export function backToMenuKeyboard(lang: Language): InlineKeyboard {
  return new InlineKeyboard().text(lang === "am" ? "🔙 ወደ መነሻ" : "🔙 Home", "menu:back");
}