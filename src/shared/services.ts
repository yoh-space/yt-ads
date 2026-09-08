/**
 * Canonical service catalog for YT Advertisement.
 *
 * **This is the single source of truth** for service ids, English labels, and
 * Amharic labels used by the Telegram bot, the customer Mini App, and the
 * Convex schema validator. Every other module must import from here.
 *
 * The Convex `serviceType` validator in `convex/schema.ts` mirrors this list
 * as a `v.union(v.literal(...))`. Drift between the two is detected at seed
 * time by `convex/services.ts → assertServiceIdsMatchSchema()` so a runtime
 * mismatch surfaces as a clear error instead of silent label/lookup drift.
 *
 * Adding a new service:
 *   1. Append the id to `SERVICE_IDS` and add it to `SERVICE_CATEGORIES`.
 *   2. Add the Amharic label to `AMHARIC_SERVICE_LABELS`.
 *   3. Mirror the new id in `convex/schema.ts → serviceType` (the seed
 *      drift-check will fail loudly if you forget).
 */

export const SERVICE_IDS = [
  "banner_print",
  "sticker_white",
  "sticker_transparent",
  "sticker_reflective",
  "sticker_mesh",
  "sticker_frosted",
  "hq_print_and_cut",
  "light_box_a1",
  "light_box_a2",
  "neon_light",
  "roll_up_standard",
  "roll_up_deluxe",
  "uv_print_mica",
  "uv_print_foam",
  "uv_print_cladding",
  "uv_print_canvas",
  "foam_cutout",
  "foam_engrave",
  "mica_cutout",
  "mica_engrave",
  "dtf",
  "sublimation",
] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];

export type ServiceItem = { id: ServiceId; label: string };

export type ServiceCategory = {
  categoryId: string;
  categoryName: string;
  items: ServiceItem[];
};

/** UI-facing catalog, grouped for the bot and Mini App pickers. */
export const SERVICE_CATEGORIES: readonly ServiceCategory[] = [
  {
    categoryId: "LARGE_FORMAT_PRINTING",
    categoryName: "Large Format & Sticker",
    items: [
      { id: "banner_print", label: "Banner Print" },
      { id: "sticker_white", label: "White Sticker" },
      { id: "sticker_transparent", label: "Transparent Sticker" },
      { id: "sticker_reflective", label: "Reflective Sticker" },
      { id: "sticker_mesh", label: "Mesh Sticker" },
      { id: "sticker_frosted", label: "Frosted Sticker" },
      { id: "hq_print_and_cut", label: "High Quality Print & Cut" },
    ],
  },
  {
    categoryId: "SIGNAGE_AND_DISPLAYS",
    categoryName: "Signage & Displays",
    items: [
      { id: "light_box_a1", label: "Light Box - A1" },
      { id: "light_box_a2", label: "Light Box - A2" },
      { id: "neon_light", label: "Neon Light" },
      { id: "roll_up_standard", label: "Roll Up Standard" },
      { id: "roll_up_deluxe", label: "Roll Up Deluxe" },
    ],
  },
  {
    categoryId: "FLATBED_UV_PRINTING",
    categoryName: "UV Printing",
    items: [
      { id: "uv_print_mica", label: "Mica UV Print" },
      { id: "uv_print_foam", label: "Foam UV Print" },
      { id: "uv_print_cladding", label: "Cladding UV Print" },
      { id: "uv_print_canvas", label: "Canvas UV Print" },
    ],
  },
  {
    categoryId: "CNC_AND_LASER",
    categoryName: "Cutting & Engraving",
    items: [
      { id: "foam_cutout", label: "Foam Cut-out" },
      { id: "foam_engrave", label: "Foam Engrave" },
      { id: "mica_cutout", label: "Mica Cut-out" },
      { id: "mica_engrave", label: "Mica Engrave" },
    ],
  },
  {
    categoryId: "TEXTILE_AND_APPAREL",
    categoryName: "Garment Printing",
    items: [
      { id: "dtf", label: "DTF Printing" },
      { id: "sublimation", label: "Sublimation Printing" },
    ],
  },
] as const;

/** Amharic labels keyed by canonical id. */
export const AMHARIC_SERVICE_LABELS: Record<ServiceId, string> = {
  banner_print: "ባነር ህትመት",
  sticker_white: "ነጭ ስቲከር",
  sticker_transparent: "ትርንስፓሬንት ስቲከር",
  sticker_reflective: "አንጸባራቂ ስቲከር",
  sticker_mesh: "መሽ ስቲከር",
  sticker_frosted: "ፍሮስት ስቲከር",
  hq_print_and_cut: "ከፍተኛ ጥራት ህትመት እና ቁረጥ",
  light_box_a1: "ላይት ቦክስ - A1",
  light_box_a2: "ላይት ቦክስ - A2",
  neon_light: "ኒዮን መብራት",
  roll_up_standard: "ሮል አፕ ስታንዳርድ",
  roll_up_deluxe: "ሮል አፕ ዲላክስ",
  uv_print_mica: "ሚካ UV ህትመት",
  uv_print_foam: "ፎም UV ህትመት",
  uv_print_cladding: "ክላዲንግ UV ህትመት",
  uv_print_canvas: "ካንቫስ UV ህትመት",
  foam_cutout: "ፎም ቁረጥ",
  foam_engrave: "ፎም ማስቀርታ",
  mica_cutout: "ሚካ ቁረጥ",
  mica_engrave: "ሚካ ማስቀርታ",
  dtf: "DTF ህትመት",
  sublimation: "Sublimation ህትመት",
};

const SERVICE_INDEX = new Map<ServiceId, ServiceItem>(
  SERVICE_CATEGORIES.flatMap((category) => category.items).map((item) => [item.id, item]),
);

/**
 * Returns the localized label for a service id, or `undefined` if the id is
 * not part of the canonical catalog. Callers should treat unknown ids as a
 * caller bug — the canonical union is enforced by the Convex validator.
 */
export function getServiceLabel(id: string, lang: "en" | "am" = "en"): string | undefined {
  const item = SERVICE_INDEX.get(id as ServiceId);
  if (!item) return undefined;
  return lang === "am" ? AMHARIC_SERVICE_LABELS[id as ServiceId] ?? item.label : item.label;
}
