import type { Language, OrderDraft, OrderStatus } from "./types";

type Vars = Record<string, string | number>;

export const copy = {
  am: {
    start: "እንኳን ወደ <b>YT Advertisement</b> የቴሌግራም ቦት በደህና መጡ! 🖨️\n\nእኛ ጋር የህትመት፣ የፖስተርና የማስታወቂያ ስራዎችን በዚህ ቴሌግራም ቦት አማካኝነት ማዘዝ ይችላሉ። ትዕዛዝ ለማስመዝገብ መጀመሪያ የስልክ ቁጥርዎ ያስፈልገናል።\n\nከታች <b>« 📱 ስልክ ቁጥርዎን ያጋሩን (Share Contact) »</b> የሚለውን ቁልፍ ተጭነው ቁጥርዎን ያጋሩ።",
    contactSaved: "✅ ስልክ ቁጥርዎ ተመዝግቧል (<code>{phone}</code>)።\n\nአሁን በ Mini App ውስጥ ዋጋዎችን በምስል አይተው ትዕዛዝ ማዘዝ ይችላሉ — ከታች ያለውን ቁልፍ ይጫኑ።",
    mainIntro: "ከታች ካለው ምርጫ የሚፈልጉትን ይምረጡ።",
    serviceChoice: "ምን አይነት የህትመት ስራ ማዘዝ ይፈልጋሉ?",
    serviceSpecPrompt: "የሚፈልጉትን ስራ ይጻፉ ለምሳሌ፦ <i>የመኪና ስቲከር</i>፣ <i>UV ህትመት</i> ወይም <i>CNC የአሽከርካሪ ሰሌዳ</i>።",
    dimensionsPrompt: "የህትመቱን መጠን ወይም ስፋት በሜትር ያስገቡ (ለምሳሌ፦ 2x3 ወይም 1.5x2)፦",
    dimensionsInvalid: "እባክዎ ልኬቱን በዚህ መልኩ ይጻፉ፦ <b>2x3</b> ወይም <b>1.5x2</b> (ርዝመት x ስፋት በሜትር)። ለምሳሌ፦ <code>2x3</code>",
    filePrompt: "የሚታተመውን ዲዛይን/ፋይል እዚሁ ይላኩልን — በፎቶ ወይም በ document መልክ (እስከ 20 ሜባ)።\n\nበኋላ ለማላክ <b>« ⏭️ በኋላ እልካለሁ »</b> የሚለውን ይጫኑ።",
    fileReceived: "ፋይሉን ተቀብለናል ✓ አሁን ወደ ስልክ ቁጥር እንሸጋገራለን።",
    fileTooLarge: "ይቅርታ፣ ፋይሉ ከ 20 ሜባ በላይ ነው። ከ 20 ሜባ በታች ፋይል ይላኩ ወይም <i>በኋላ እልካለሁ</i> ይጫኑ።",
    phonePrompt: "ትዕዛዝዎን ለማረጋገጥና ለማዘጋጀት የስልክ ቁጥርዎ ያስፈልገናል።\n\nከታች <b>« 📱 ስልክ ቁጥሬን ላክ »</b> የሚለውን ቁልፍ ይጫኑ ወይም ቁጥሩን በፅሁፍ ይላኩ።",
    phoneInvalid: "ይህ የስልክ ቁጥር የተሳሳተ ይመስላል። እባክዎ በ <code>+251 91...</code> መልኩ ይላኩ ወይም « 📱 ስልክ ቁጥሬን ላክ » ይጫኑ።",
    orderSummary: "📌 <b>ትዕዛዝዎ ተቀብሎ በመጠባበቅ ላይ ነው (Pending)</b>\n\n• <b>ዓይነት:</b> {service}\n• <b>ስፋት:</b> {area} ሜ² ({dimensions})\n• <b>የትዕዛዝ መለያ:</b> <code>{code}</code>\n\nትዕዛዝዎ በትክክል ተቀብለናል! ነገር ግን ክፍያዎ እስኪረጋገጥ ድረስ በ 📌 Pending (በመጠባበቅ ላይ) ይገኛል። የክፍያ ማረጋገጫዎን ይላኩ።",
    orderCodePrompt: "የትዕዛዝ መለያዎን ይላኩ (ለምሳሌ፦ <code>ORD-2026-123456</code>)፦",
    orderStatusTitle: "📦 <b>{code}</b> — {status}\n\n• ስራ፦ {service}\n• ስፋት፦ {dimensions}\n• የተመዘገበው፦ {date}",
    orderNotFound: "ይቅርታ፣ ይህ የትዕዛዝ መለያ አልተገኘም። ትክክለኛውን መለያ መላክዎን ያረጋግጡ ወይም በ <i>Mini App</i> ውስጥ ያረጋግጡ።",
    address: "<b>{company}</b>\n\n📍 {address}\n📞 {phone}\n\nየስራ ሰአታት፦ ሰኞ – ቅዳሜ 8፡30 – 18፡00",
    miniAppOffer: "የህትመት ዋጋዎችን አይተው ለማዘዝ ከታች ያለውን ይጫኑ፦",
    languagePrompt: "እባክዎ የሚፈልጉትን ቋንቋ ይምረጡ / Please select your preferred language:",
    languageChanged: "ቋንቋዎ ተቀይሯል ✔ / Language updated ✔",
    flowCancelled: "ትዕዛዙ ተሰርዟል።",
    errorGeneric: "ይቅርታ፣ አንድ ችግር ተፈጠረ። እባክዎ ትንሽ ቆይተው እንደገና ይሞክሩ።",
    ownerOrderNotification: "🛒 <b>አዲስ ትዕዛዝ ተቀበልን — የሪሴፕሽን አረጋገጥ ይጠብቋል</b>\n\n• መለያ፦ <code>{code}</code>\n• ደንበኛ፦ {customer}\n• ስራ፦ {service}\n• ስፋት፦ {dimensions}\n• ስልክ፦ {phone}\n• የመጣበት፦ {source}\n\n⏱ ትዕዛዙ 📌 Pending ላይ ነው — እባክዎ ይዘዙ/ክፍያ ያረጋግጡ።",
    miniAppConfirmed: "📌 <b>ትዕዛዝዎ በመጠባበቅ ላይ ነው (Pending)</b>\n\n<b>የትዕዛዝ መለያ:</b> <code>{code}</code>\n\nትዕዛዝዎ በትክክል ተቀብለናል! ነገር ግን ክፍያዎ እስኪረጋገጥ ድረስ በ 📌 Pending (በመጠባበቅ ላይ) ይገኛል። የክፍያ ማረጋገጫዎን ይላኩ።",
    customerOrderAccepted: "✅ <b>የእርስዎ ትዕዛዝ በሪሴፕሽን ተረጋግጧል!</b>\n\n• የትዕዛዝ መለያ: <code>{code}</code>\n• ጠቅላላ: <b>{amount} ብር</b>\n• ክፍያ: {paymentLine}\n\nስራው አሁን ወደ ምርት ሂደት ገብቷል።",
    customerOrderInProduction: "🖨️ <b>ህትመት/ምርት ተጀምሯል</b>\n\n• የትዕዛዝ መለያ: <code>{code}</code>",
    customerOrderCompleted: "🎉 <b>ስራው ተጠናቋል!</b>\n\n• የትዕዛዝ መለያ: <code>{code}</code>\n\nመጥተው መረከብ ወይም በነጣቂ ማስወሰድ ይችላሉ። እናመሰግናለን!",
    customerOrderRejected: "❌ <b>ትዕዛዝዎ ተከለከለ</b>\n\n• የትዕዛዝ መለያ: <code>{code}</code>\n\nለበለጠ መረጃ እባክዎ ከሪሴፕሽን ጋር ይገናኙ።",
    receptionActionAccept: "✅ ተቀበል",
    receptionActionReject: "❌ ከለክ",
    receptionActionVerify: "🔍 ክፍያ አረጋግጥ",
    receptionActionHint: "👆 ተግባር ይምረጡ — ወይም ዳሽቦርድ ይክፈቱ።",
    callbackReceivedAccept: "👍 <b>{code}</b> ተቀብሏል — ዋጋውን በዳሽቦርድ ያስቀምጡ።",
    callbackReceivedVerify: "🔍 <b>{code}</b> — ዋጋውን በዳሽቦርድ ያስቀምጡ እና ክፍያውን ያረጋግጡ።",
    callbackReceivedReject: "❌ <b>{code}</b> ተከልክቷል",
    callbackAlreadyHandled: "⚠️ ይህ ትዕዛዝ አስቀድሞ ተስተናግዷል።",
  },
  en: {
    start: "Welcome to the <b>YT Advertisement</b> Telegram bot! 🖨️\n\nYou can place print, poster, and signage orders with us right from this chat. To register an order we first need your phone number.\n\nTap <b>« 📱 Send my phone number »</b> below to share it.",
    contactSaved: "✅ Your phone number has been saved (<code>{phone}</code>).\n\nYou can now browse prices and place a visual order in the Mini App — tap the button below.",
    mainIntro: "Pick an option from the menu below.",
    serviceChoice: "What kind of print job would you like to order?",
    serviceSpecPrompt: "Type the job you need, e.g. <i>car sticker</i>, <i>UV print</i>, or <i>CNC sign board</i>.",
    dimensionsPrompt: "Enter the size of the print in metres (e.g. 2x3 or 1.5x2):",
    dimensionsInvalid: "Please enter the size like <b>2x3</b> or <b>1.5x2</b> (length x width in metres), e.g. <code>2x3</code>.",
    filePrompt: "Send the design / file to print here — as a photo or a document (up to 20 MB).\n\nIf you prefer to send it later, tap <b>« ⏭️ I'll send it later »</b>.",
    fileReceived: "Got your file ✓ Now let's take your phone number.",
    fileTooLarge: "Sorry, the file is larger than 20 MB. Please send a smaller file or tap <i>I'll send it later</i>.",
    phonePrompt: "We need your phone number to confirm and prepare the order.\n\nTap <b>« 📱 Send my phone number »</b> below or type it in.",
    phoneInvalid: "That doesn't look like a valid phone number. Please send it like <code>+251 91...</code> or tap « 📱 Send my phone number ».",
    orderSummary: "📌 <b>Your order is received and pending for verification</b>\n\n• <b>Service:</b> {service}\n• <b>Size:</b> {area} m² ({dimensions})\n• <b>Order code:</b> <code>{code}</code>\n\nWe've received your order! It will stay in 📌 <b>Pending</b> status until reception verifies your payment. Please send your payment confirmation.",
    orderCodePrompt: "Send your order code (e.g. <code>ORD-2026-123456</code>):",
    orderStatusTitle: "📦 <b>{code}</b> — {status}\n\n• Service: {service}\n• Size: {dimensions}\n• Placed: {date}",
    orderNotFound: "Sorry, we couldn't find that order code. Please double check it, or check inside the <i>Mini App</i>.",
    address: "<b>{company}</b>\n\n📍 {address}\n📞 {phone}\n\nOpening hours: Mon – Sat 8:30 – 18:00",
    miniAppOffer: "To see prices and visuals before ordering, open the Mini App below:",
    languagePrompt: "እባክዎ የሚፈልጉትን ቋንቋ ይምረጡ / Please select your preferred language:",
    languageChanged: "ቋንቋዎ ተቀይሯል ✔ / Language updated ✔",
    flowCancelled: "Order cancelled.",
    errorGeneric: "Sorry, something went wrong. Please try again in a moment.",
    ownerOrderNotification: "🛒 <b>New order received — awaiting reception confirmation</b>\n\n• Code: <code>{code}</code>\n• Customer: {customer}\n• Service: {service}\n• Size: {dimensions}\n• Phone: {phone}\n• Source: {source}\n\n⏱ Order is 📌 Pending — please verify or confirm.",
    miniAppConfirmed: "📌 <b>Your order is received and pending verification</b>\n\n<b>Order code:</b> <code>{code}</code>\n\nWe've received your order! It will stay in 📌 <b>Pending</b> status until reception verifies your payment. Please send your payment confirmation.",
    customerOrderAccepted: "✅ <b>Your order was confirmed by reception!</b>\n\n• Order code: <code>{code}</code>\n• Total: <b>{amount} ETB</b>\n• Payment: {paymentLine}\n\nYour job has now entered production.",
    customerOrderInProduction: "🖨️ <b>Production started</b>\n\n• Order code: <code>{code}</code>",
    customerOrderCompleted: "🎉 <b>Your order is complete!</b>\n\n• Order code: <code>{code}</code>\n\nYou can pick it up in person or arrange delivery.",
    customerOrderRejected: "❌ <b>Your order was declined</b>\n\n• Order code: <code>{code}</code>\n\nPlease contact reception for more information.",
    receptionActionAccept: "✅ Accept",
    receptionActionReject: "❌ Reject",
    receptionActionVerify: "🔍 Verify payment",
    receptionActionHint: "👆 Tap an action, or open the dashboard.",
    callbackReceivedAccept: "👍 <b>{code}</b> accepted — set the price in the dashboard to finalize payment.",
    callbackReceivedVerify: "🔍 <b>{code}</b> — open the dashboard to set the price and verify payment.",
    callbackReceivedReject: "❌ <b>{code}</b> rejected",
    callbackAlreadyHandled: "⚠️ This order was already handled.",
  },
} as const;

export type CopyKey = keyof (typeof copy)["am"];

const statusLabelsAm: Record<OrderStatus, string> = {
  Received: "ተቀብለናል",
  "In Production": "በምርት ላይ ነው",
  "Ready for Pickup": "ለመቀበል ዝግጁ ነው",
  Completed: "ተጠናቋል",
};

const statusLabelsEn: Record<OrderStatus, string> = {
  Received: "Received",
  "In Production": "In production",
  "Ready for Pickup": "Ready for pickup",
  Completed: "Completed",
};

/** Escape a value that will be interpolated into an HTML-formatted message. */
function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function t(lang: Language, key: CopyKey, vars?: Vars): string {
  let text: string = copy[lang][key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, escapeHtml(value));
    }
  }
  return text;
}

export function statusLabel(lang: Language, status: string): string {
  const table = lang === "am" ? statusLabelsAm : statusLabelsEn;
  return table[status as OrderStatus] ?? status;
}

import { getServiceLabel } from "@/constants/services";

const LEGACY_SERVICE_LABELS: Record<string, { en: string; am: string }> = {
  banner: { en: "Banner (Flex)", am: "ባነር (ፍሌክስ)" },
  sticker: { en: "Sticker", am: "ስቲከር" },
  acrylic: { en: "Acrylic", am: "አክሪሊክ" },
};

export function serviceLabel(lang: Language, serviceId: string): string {
  const label = getServiceLabel(serviceId, lang === "am" ? "am" : "en");
  if (label) return label;
  if (LEGACY_SERVICE_LABELS[serviceId]) {
    return lang === "am" ? LEGACY_SERVICE_LABELS[serviceId].am : LEGACY_SERVICE_LABELS[serviceId].en;
  }
  return serviceId;
}

/** Canonical service type stored on the order for a selected service id. */
export function serviceTypeFor(serviceId: string): string {
  const label = getServiceLabel(serviceId, "en");
  if (label) return label;
  if (LEGACY_SERVICE_LABELS[serviceId]) {
    return LEGACY_SERVICE_LABELS[serviceId].en;
  }
  return serviceId;
}

export function formatOrderSummary(lang: Language, draft: OrderDraft, code: string): string {
  return t(lang, "orderSummary", {
    service: draft.serviceLabel ?? draft.serviceType ?? "—",
    area: draft.area !== undefined ? String(draft.area) : "—",
    dimensions: draft.dimensions ?? "—",
    code,
  });
}

export function formatStatusLine(lang: Language, input: {
  code: string;
  serviceType: string;
  dimensions: string;
  status: string;
  createdAt?: number;
}): string {
  const date = input.createdAt
    ? new Intl.DateTimeFormat(lang === "am" ? "en-GB" : "en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(input.createdAt))
    : "—";
  return t(lang, "orderStatusTitle", {
    code: input.code,
    status: statusLabel(lang, input.status),
    service: input.serviceType,
    dimensions: input.dimensions,
    date,
  });
}