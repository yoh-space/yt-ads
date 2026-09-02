export type ServiceItem = { id: string; label: { en: string; am: string } };
export type ServiceCategory = { categoryId: string; categoryName: { en: string; am: string }; items: ServiceItem[] };

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    categoryId: "LARGE_FORMAT_PRINTING",
    categoryName: { en: "Large Format & Sticker", am: "የትልቅ ቅፅ እና ስቲከር" },
    items: [
      { id: "banner_print", label: { en: "Banner Print", am: "ባነር ህትመት" } },
      { id: "sticker_white", label: { en: "White Sticker", am: "ነጭ ስቲከር" } },
      { id: "sticker_transparent", label: { en: "Transparent Sticker", am: "ትርንስፓሬንት ስቲከር" } },
      { id: "sticker_reflective", label: { en: "Reflective Sticker", am: "ንቁ ስቲከር" } },
      { id: "sticker_mesh", label: { en: "Mesh Sticker", am: "መሽ ስቲከር" } },
      { id: "sticker_frosted", label: { en: "Frosted Sticker", am: "ፍሮስት ስቲከር" } },
      { id: "hq_print_and_cut", label: { en: "High Quality Print & Cut", am: "ከፍተኛ ጥራት ህትመት እና ቁልፍ" } },
    ],
  },
  {
    categoryId: "SIGNAGE_AND_DISPLAYS",
    categoryName: { en: "Signage & Displays", am: "ምልክቶች እና ታያት" },
    items: [
      { id: "light_box_a1", label: { en: "Light Box - A1", am: "ላይት ቦክስ - A1" } },
      { id: "light_box_a2", label: { en: "Light Box - A2", am: "ላይት ቦክስ - A2" } },
      { id: "neon_light", label: { en: "Neon Light", am: "ኒዮን መብራት" } },
      { id: "roll_up_standard", label: { en: "Roll Up Standard", am: "ሮል አፕ ስታንዳርድ" } },
      { id: "roll_up_deluxe", label: { en: "Roll Up Deluxe", am: "ሮል አፕ ዲላክስ" } },
    ],
  },
  {
    categoryId: "FLATBED_UV_PRINTING",
    categoryName: { en: "UV Printing", am: "UV ህትመት" },
    items: [
      { id: "uv_print_mica", label: { en: "Mica UV Print", am: "ሚካ UV ህትመት" } },
      { id: "uv_print_foam", label: { en: "Foam UV Print", am: "ፎም UV ህትመት" } },
      { id: "uv_print_cladding", label: { en: "Cladding UV Print", am: "ክላዲንግ UV ህትመት" } },
      { id: "uv_print_canvas", label: { en: "Canvas UV Print", am: "ካንቫስ UV ህትመት" } },
    ],
  },
  {
    categoryId: "CNC_AND_LASER",
    categoryName: { en: "Cutting & Engraving", am: "እቃ ቁልፍ እና ማስቀርታ" },
    items: [
      { id: "foam_cutout", label: { en: "Foam Cut-out", am: "ፎም ቁልፍ ክፍታ" } },
      { id: "foam_engrave", label: { en: "Foam Engrave", am: "ፎም ማስቀርታ" } },
      { id: "mica_cutout", label: { en: "Mica Cut-out", am: "ሚካ ቁልፍ ክፍታ" } },
      { id: "mica_engrave", label: { en: "Mica Engrave", am: "ሚካ ማስቀርታ" } },
    ],
  },
  {
    categoryId: "TEXTILE_AND_APPAREL",
    categoryName: { en: "Garment Printing", am: "ልብስ ህትመት" },
    items: [
      { id: "dtf", label: { en: "DTF Printing", am: "DTF ህትመት" } },
      { id: "sublimation", label: { en: "Sublimation Printing", am: "Sublimation ህትመት" } },
    ],
  },
];

export function getServiceLabel(id: string, lang: "en" | "am" = "en"): string | undefined {
  for (const c of SERVICE_CATEGORIES) {
    const match = c.items.find((i) => i.id === id);
    if (match) return match.label[lang];
  }
  return undefined;
}

export function allServiceIds(): string[] {
  return SERVICE_CATEGORIES.flatMap((c) => c.items.map((i) => i.id));
}
