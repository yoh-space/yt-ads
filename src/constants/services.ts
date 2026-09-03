export type ServiceId =
  | "banner_print" | "sticker_white" | "sticker_transparent" | "sticker_reflective" | "sticker_mesh" | "sticker_frosted" | "hq_print_and_cut"
  | "light_box_a1" | "light_box_a2" | "neon_light" | "roll_up_standard" | "roll_up_deluxe"
  | "uv_print_mica" | "uv_print_foam" | "uv_print_cladding" | "uv_print_canvas"
  | "foam_cutout" | "foam_engrave" | "mica_cutout" | "mica_engrave" | "dtf" | "sublimation";
export type ServiceItem = { id: ServiceId; label: string };
export type ServiceCategory = { categoryId: string; categoryName: string; items: ServiceItem[] };

/** The single source of truth for customer-facing service selection. */
export const SERVICE_CATEGORIES: ServiceCategory[] = [
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
];

const AMHARIC_SERVICE_LABELS: Record<string, string> = {
  banner_print: "ባነር ህትመት",
  sticker_white: "ነጭ ስቲከር",
  sticker_transparent: "ትርንስፓሬንት ስቲከር",
  sticker_reflective: "ንቁ ስቲከር",
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

export function getServiceLabel(id: string, lang: "en" | "am" = "en"): string | undefined {
  const item = SERVICE_CATEGORIES.flatMap((category) => category.items).find((service) => service.id === id);
  if (!item) return undefined;
  return lang === "am" ? AMHARIC_SERVICE_LABELS[id] ?? item.label : item.label;
}

export function allServiceIds(): string[] {
  return SERVICE_CATEGORIES.flatMap((category) => category.items.map((item) => item.id));
}
