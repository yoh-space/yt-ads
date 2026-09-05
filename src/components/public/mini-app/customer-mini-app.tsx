"use client";

import { FormEvent, useEffect, useState, useMemo, useRef, type ComponentType } from "react";
import { 
  FileUp, 
  Send, 
  CheckCircle2, 
  Ruler, 
  Layers, 
  Printer, 
  Sparkles,
  User,
  X,
  AlertTriangle,
  BadgeCheck,
  Loader2,
  Phone,
  Scissors,
  Shirt,
  SunMedium,
  Maximize2,
  Zap,
  Palette,
  Cpu,
  FolderDown,
  Check,
  Plus,
  Minus,
  Building2,
  Clock,
  ArrowUpRight
  ,ClipboardList
} from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { bootstrapTelegramWebApp, isTelegramMiniApp, sendTelegramOrderResult } from "@/lib/telegram-webapp";
import { SERVICE_CATEGORIES, getServiceLabel, type ServiceId } from "@/constants/services";
import { BottomNavigation } from "./bottom-navigation";
import { CustomerOrdersView } from "./customer-orders-view";
import { CustomerProfileView } from "./customer-profile-view";
import { CustomerProfileForm } from "./customer-profile-form";
import { PhoneVerificationGate } from "./phone-verification-gate";
import { DimensionsInput } from "./dimensions-input";
import { ServicePicker } from "./service-picker";
import type { CustomerOrderSummary, MiniAppTab, OrderFormState } from "./types";

// Monochrome icon mapping
const SERVICE_ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  banner_print: Printer,
  sticker_white: Layers,
  sticker_transparent: Maximize2,
  sticker_reflective: Sparkles,
  sticker_mesh: Layers,
  sticker_frosted: Sparkles,
  hq_print_and_cut: Scissors,
  light_box_a1: SunMedium,
  light_box_a2: SunMedium,
  neon_light: Zap,
  roll_up_standard: FolderDown,
  roll_up_deluxe: FolderDown,
  uv_print_mica: Palette,
  uv_print_foam: Palette,
  uv_print_cladding: Palette,
  uv_print_canvas: Palette,
  foam_cutout: Cpu,
  foam_engrave: Cpu,
  mica_cutout: Scissors,
  mica_engrave: Scissors,
  dtf: Shirt,
  sublimation: Shirt,
};

const CATEGORY_TABS = [
  { id: "ALL", label: "ሁሉም (All)" },
  { id: "LARGE_FORMAT_PRINTING", label: "ባነር እና ስቲከር" },
  { id: "SIGNAGE_AND_DISPLAYS", label: "ማስታወቂያ ቦርድ" },
  { id: "FLATBED_UV_PRINTING", label: "UV ህትመት" },
  { id: "CNC_AND_LASER", label: "ቁረጥ እና ቅርጽ" },
  { id: "TEXTILE_AND_APPAREL", label: "DTF ጨርቃጨርቅ" },
] as const;

const DIMENSION_PRESETS = [
  { label: "1m × 1m", width: "1", height: "1" },
  { label: "1.5m × 2m", width: "1.5", height: "2" },
  { label: "2m × 3m", width: "2", height: "3" },
  { label: "3m × 5m", width: "3", height: "5" },
  { label: "A1", width: "0.594", height: "0.841" },
  { label: "RollUp", width: "0.85", height: "2" },
];

export function TelegramMiniAppOrder() {
  const info = useQuery(api.orders.publicInfo);
  const generateUploadUrl = useMutation(api.orders.generateUploadUrl);
  const submitOrder = useMutation(api.orders.submit);
  const updateTelegramProfile = useMutation(api.users.updateTelegramProfile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<MiniAppTab>("create");

  const [launchContext, setLaunchContext] = useState<{
    telegramId?: string;
    name?: string;
    phone?: string;
  }>({});

  useEffect(() => {
    const ctx = bootstrapTelegramWebApp();
    setLaunchContext(ctx);
  }, []);

  const [telegramInitData, setTelegramInitData] = useState<string | null>(null);
  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    setTelegramInitData(webApp?.initData ?? null);
  }, []);

  const telegramId = launchContext.telegramId ?? null;
  const launchPhone = launchContext.phone ?? null;
  const launchName = launchContext.name ?? null;

  const userProfile = useQuery(
    api.users.getByTelegramId,
    telegramId && telegramInitData && !launchPhone ? { telegramId, initData: telegramInitData } : "skip",
  );
  const customerOrders = useQuery(
    api.orders.listForTelegramUser,
    telegramId && telegramInitData ? { telegramId, initData: telegramInitData } : "skip",
  );
  const verifiedPhone = launchPhone ?? userProfile?.phone ?? null;
  const phoneReady = Boolean(verifiedPhone);

  useEffect(() => {
    if (!launchName) return;
    setForm((prev) => (prev.clientName ? prev : { ...prev, clientName: launchName }));
  }, [launchName]);

  useEffect(() => {
    if (!userProfile) return;
    setForm((prev) => ({
      ...prev,
      clientName: prev.clientName || userProfile.name || "",
      companyLegalName: userProfile.companyLegalName ?? prev.companyLegalName,
      tinNumber: userProfile.tinNumber ?? prev.tinNumber,
      notes: prev.notes || userProfile.notes || "",
    }));
  }, [userProfile]);

  const isInsideTelegram = isTelegramMiniApp();

  const [form, setForm] = useState<OrderFormState>({
    clientName: "",
    companyLegalName: "",
    tinNumber: "",
    serviceType: SERVICE_CATEGORIES[0]?.items[0]?.id ?? "banner_print",
    width: "",
    height: "",
    quantity: "1",
    notes: "",
  });

  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string; code?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEnterpriseFields, setShowEnterpriseFields] = useState(false);

  const estimatedArea = useMemo(() => {
    const width = Number(form.width);
    const height = Number(form.height);
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      const area = width * height;
      const qty = parseInt(form.quantity) || 1;
      return {
        unitArea: area.toFixed(2),
        totalArea: (area * qty).toFixed(2),
      };
    }
    return null;
  }, [form.width, form.height, form.quantity]);

  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.size > 20 * 1024 * 1024) {
      setMessage({
        tone: "error",
        text: "የፋይሉ መጠን ከ 20MB ማነስ አለበት። (File exceeds 20MB)",
      });
      return;
    }
    setMessage(null);
    setFile(selectedFile);
  };

  async function uploadSelectedFile() {
    if (!file) return undefined;
    const uploadUrl = await generateUploadUrl({});
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!response.ok) throw new Error("ለዲዛይኑ የተመረጠውን ፋይል መጫን አልተቻለም።");
    const result = (await response.json()) as { storageId: string };
    return result.storageId as Id<"_storage">;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (!telegramId || !telegramInitData || !phoneReady) {
      setMessage({
        tone: "error",
        text: "ስልክ ቁጥርዎ አልተገኘም። እባክዎ በመጀመሪያ ለቦቱ «/start» ልከው ስልክ ቁጥርዎን ያጋሩ።",
      });
      return;
    }
    if (!form.serviceType) {
      setMessage({ tone: "error", text: "እባክዎ የሚፈልጉትን አገልግሎት ይምረጡ።" });
      return;
    }

    const width = Number(form.width);
    const height = Number(form.height);
    const quantity = Number(form.quantity);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      setMessage({ tone: "error", text: "እባክዎ ስፋትና ቁመትን ከዜሮ በላይ በሜትር ያስገቡ።" });
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setMessage({
        tone: "error",
        text: "እባክዎን ትክክለኛ የብዛት ቁጥር ያስገቡ። (Enter valid quantity)",
      });
      return;
    }

    setBusy(true);
    try {
      const fileStorageId = await uploadSelectedFile();
      const dimensions = `${width}m x ${height}m`;
      const result = await submitOrder({
        clientName: form.clientName.trim(),
        phone: verifiedPhone!,
        telegramId,
        telegramInitData,
        serviceType: form.serviceType,
        dimensions,
        quantity: String(quantity),
        preferredDueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        notes: form.notes ? form.notes.trim() : undefined,
        companyLegalName: form.companyLegalName ? form.companyLegalName.trim() : undefined,
        tinNumber: form.tinNumber ? form.tinNumber.trim() : undefined,
        fileStorageId,
        fileName: file?.name,
      });

      setMessage({
        tone: "success",
        code: result.code,
        text: `ትዕዛዝዎ ተመዝግቧል። መለያ፡ ${result.code}። ክፍያዎ በሪሴፕሽን ሲረጋገጥ በቴሌግራም ማረጋገጫ ይደርስዎታል።`,
      });

      sendTelegramOrderResult({
        code: result.code,
        clientName: form.clientName.trim(),
        serviceType: form.serviceType,
        dimensions,
        quantity: String(quantity),
      });

      setForm({
        clientName: launchName ?? "",
        companyLegalName: "",
        tinNumber: "",
        serviceType: null,
        width: "",
        height: "",
        quantity: "1",
        notes: "",
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "ትዕዛዙን መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
      });
    } finally {
      setBusy(false);
    }
  }

  const visibleCategories = useMemo(() => {
    if (activeCategory === "ALL") return SERVICE_CATEGORIES;
    return SERVICE_CATEGORIES.filter((cat) => cat.categoryId === activeCategory);
  }, [activeCategory]);

  async function saveProfile(profile: { name: string; phone: string; companyLegalName: string; tinNumber: string; notes: string }) {
    if (!telegramId || !telegramInitData) throw new Error("Telegram መለያ አልተገኘም።");
    await updateTelegramProfile({ telegramId, initData: telegramInitData, ...profile });
    setMessage({ tone: "success", text: "መገለጫዎ ተቀምጧል።" });
  }

  return (
    <div className="min-h-screen bg-[#0C0D10] text-[#D4D4D4] font-sans antialiased pb-28">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#121316] border-b border-white/[0.08] px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-sm bg-[#E5C07B] text-[#0C0D10] font-mono font-bold text-xs grid place-items-center tracking-tight">
              YT
            </div>
            <div>
              <h1 className="font-mono text-xs uppercase tracking-[0.14em] text-neutral-100 font-semibold leading-none">
                {info?.companyName ?? "YT ADVERTISEMENT"}
              </h1>
              <p className="font-mono text-[10px] text-neutral-400 mt-1">ማስታወቂያ እና ማተሚያ · ትዕዛዝ ማዘጋጃ</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/track"
              className="font-mono text-[11px] text-neutral-400 hover:text-neutral-200 border border-white/[0.1] hover:border-white/[0.2] bg-[#17181D] px-2.5 py-1 rounded-sm transition-colors flex items-center gap-1.5"
            >
              <Clock size={11} className="text-[#E5C07B]" />
              <span>መከታተያ</span>
            </Link>
            <Link
              href="/dashboard"
              className="font-mono text-[11px] text-[#0C0D10] bg-[#E5C07B] hover:bg-[#d8b067] px-2.5 py-1 rounded-sm transition-colors font-semibold flex items-center gap-1"
            >
              <span>መግቢያ</span>
              <ArrowUpRight size={11} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Form ─────────────────────────────────────────────── */}
      <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />

      {!isInsideTelegram ? <div className="mx-auto max-w-md p-6 text-center text-sm text-neutral-300">ይህ ገጽ በTelegram Mini App ውስጥ ብቻ ይሰራል።</div> : !phoneReady ? <PhoneVerificationGate initialName={launchName ?? ""} busy={busy} onSubmit={async (phone) => { if (!telegramId || !telegramInitData) throw new Error("Telegram መለያ አልተገኘም።"); setBusy(true); try { await updateTelegramProfile({ telegramId, initData: telegramInitData, phone, name: launchName ?? undefined }); } finally { setBusy(false); } }} /> : activeTab === "create" ? <form onSubmit={submit} className="p-4 space-y-5 max-w-xl mx-auto">

        {/* Feedback Alert */}
        {message ? (
          <div
            className={cn(
              "p-3.5 rounded-sm text-xs font-mono border transition-all flex items-start gap-2.5",
              message.tone === "success"
                ? "bg-[#101A18] text-[#78D5CB] border-[#3E9B95]/40"
                : "bg-[#1E1111] text-[#F08080] border-rose-500/40"
            )}
          >
            {message.tone === "success" ? (
              <CheckCircle2 size={16} className="shrink-0 text-[#48B0A8] mt-0.5" />
            ) : (
              <AlertTriangle size={16} className="shrink-0 text-rose-400 mt-0.5" />
            )}
            <div className="space-y-0.5">
              {message.code ? (
                <div className="font-bold text-[#E5C07B] tracking-wide">
                  ORDER REF #{message.code}
                </div>
              ) : null}
              <p className="font-sans leading-relaxed text-neutral-200">{message.text}</p>
            </div>
          </div>
        ) : null}

        <ServicePicker value={form.serviceType} onChange={(serviceType) => setForm({ ...form, serviceType })} onClear={() => setForm({ ...form, serviceType: null })} />
        <DimensionsInput form={form} setForm={setForm} estimatedArea={estimatedArea} />
        {false && <>
        {/* ── Section 1: Service Selection ─────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-300">
              01. የህትመት አይነት (Service)
            </span>
            <span className="font-mono text-[10px] text-neutral-400">
              {SERVICE_CATEGORIES.flatMap(c => c.items).length} SERVICES
            </span>
          </div>

          {/* Segmented Category Rail */}
          <div className="flex items-center gap-1 bg-[#131418] border border-white/[0.08] p-1 rounded-sm overflow-x-auto no-scrollbar">
            {CATEGORY_TABS.map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={cn(
                    "font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-sm whitespace-nowrap transition-colors shrink-0 cursor-pointer",
                    isActive
                      ? "bg-[#202228] text-white border border-white/[0.12] font-semibold"
                      : "text-neutral-400 hover:text-neutral-200"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Service Cards Grid */}
          <div className="space-y-4 pt-1">
            {visibleCategories.map((cat) => (
              <div key={cat.categoryId} className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 px-0.5">
                  {cat.categoryName}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {cat.items.map((it) => {
                    const isSelected = form.serviceType === it.id;
                    const IconComponent = SERVICE_ICONS[it.id] ?? Printer;
                    const amharicTitle = getServiceLabel(it.id, "am") ?? it.label;

                    return (
                      <button
                        type="button"
                        key={it.id}
                        onClick={() => setForm({ ...form, serviceType: it.id })}
                        className={cn(
                          "relative p-3 rounded-sm border text-left transition-colors flex flex-col justify-between min-h-[76px] cursor-pointer",
                          isSelected
                            ? "bg-[#1B1C22] border-[#E5C07B] ring-1 ring-[#E5C07B]/40 text-white"
                            : "bg-[#131418] border-white/[0.08] hover:border-white/[0.18] text-neutral-300"
                        )}
                      >
                        <div className="flex items-start justify-between w-full mb-2">
                          <IconComponent
                            size={14}
                            className={isSelected ? "text-[#E5C07B]" : "text-neutral-400"}
                          />
                          {isSelected ? (
                            <span className="font-mono text-[9px] uppercase tracking-wider text-[#E5C07B] font-bold">
                              SELECTED
                            </span>
                          ) : null}
                        </div>

                        <div>
                          <span className={cn("text-xs font-semibold block leading-tight", isSelected ? "text-white" : "text-neutral-200")}>
                            {amharicTitle}
                          </span>
                          <span className="font-mono text-[10px] text-neutral-400 block mt-0.5 truncate">
                            {it.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 2: Dimensions & Quantity ─────────────────────── */}
        <section className="bg-[#131418] border border-white/[0.08] rounded-sm p-4 space-y-3.5">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-300 flex items-center gap-1.5">
              <Ruler size={13} className="text-[#E5C07B]" /> 02. መጠን እና ብዛት (Dimensions & Qty)
            </span>
            {estimatedArea ? (
              <span className="font-mono text-[11px] text-neutral-200 bg-[#1C1D24] border border-white/[0.1] px-2 py-0.5 rounded-sm">
                AREA: {estimatedArea?.totalArea} m²
              </span>
            ) : null}
          </div>

          {/* Dimension Presets */}
          <div className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 block">Presets</span>
            <div className="flex flex-wrap gap-1.5">
              {DIMENSION_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => setForm({ ...form, width: preset.width, height: preset.height })}
                  className={cn(
                    "font-mono text-[11px] px-2.5 py-1 rounded-sm border transition-colors cursor-pointer",
                    form.width === preset.width && form.height === preset.height
                      ? "border-[#E5C07B] bg-[#22232A] text-white font-medium"
                      : "bg-[#18191E] border-white/[0.06] text-neutral-400 hover:text-neutral-200 hover:border-white/[0.12]"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 block">ስፋት (ሜትር)</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.width}
                onChange={(e) => setForm({ ...form, width: e.target.value })}
                placeholder="2"
                className="w-full h-10 px-3 text-xs font-mono bg-[#0C0D10] text-neutral-100 border border-white/[0.12] rounded-sm focus:outline-none focus:border-[#E5C07B] transition-colors placeholder:text-neutral-600"
              />
            </div>

            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 block">ቁመት (ሜትር)</span>
              <input required type="number" min="0.01" step="0.01" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} placeholder="3" className="w-full h-10 px-3 text-xs font-mono bg-[#0C0D10] text-neutral-100 border border-white/[0.12] rounded-sm focus:outline-none focus:border-[#E5C07B] transition-colors placeholder:text-neutral-600" />
            </div>

            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 block">ብዛት (Qty)</span>
              <div className="flex items-center h-10 bg-[#0C0D10] border border-white/[0.12] rounded-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    const current = Math.max(1, parseInt(form.quantity) || 1);
                    setForm({ ...form, quantity: String(Math.max(1, current - 1)) });
                  }}
                  className="w-8 h-full grid place-items-center text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  <Minus size={12} />
                </button>
                <input
                  required
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="flex-1 w-full text-center text-xs font-mono font-bold text-white bg-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(form.quantity) || 1;
                    setForm({ ...form, quantity: String(current + 1) });
                  }}
                  className="w-8 h-full grid place-items-center text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>
        </section>

        </>}
        {/* ── Section 3: Artwork Upload ────────────────────────────── */}
        <section className="bg-[#131418] border border-white/[0.08] rounded-sm p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-300 flex items-center gap-1.5">
              <Layers size={13} className="text-[#E5C07B]" /> 03. የዲዛይን ፋይል (Artwork)
            </span>
            <span className="font-mono text-[10px] text-neutral-400">MAX 20MB</span>
          </div>

          <div className="relative">
            <label className="flex items-center gap-3 p-3 bg-[#0C0D10] border border-dashed border-white/[0.15] hover:border-white/[0.28] rounded-sm cursor-pointer transition-colors">
              <div className="w-8 h-8 rounded-sm bg-[#1A1C22] text-neutral-300 border border-white/[0.08] grid place-items-center shrink-0">
                <FileUp size={15} />
              </div>
              <div className="flex-1 overflow-hidden pr-6">
                <span className="text-xs font-medium text-neutral-200 block truncate">
                  {file ? file.name : "ፋይል ይጫኑ (Click to upload design file)"}
                </span>
                <span className="font-mono text-[10px] text-neutral-400 block mt-0.5">
                  {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "PDF, PNG, JPG, AI, CDR"}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>

            {file && (
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-sm bg-[#1E2026] hover:bg-rose-950 text-neutral-400 hover:text-rose-400 transition-colors"
                title="Remove"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </section>

        {/* ── Section 4: Customer Details ──────────────────────────── */}
        <section className="bg-[#131418] border border-white/[0.08] rounded-sm p-4 space-y-3.5">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-300 flex items-center gap-1.5 border-b border-white/[0.06] pb-2">
            <User size={13} className="text-[#E5C07B]" /> 04. የደንበኛ መረጃ (Customer Details)
          </span>

          <div className="space-y-3">
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 block">የደንበኛ ስም *</span>
              <input
                required
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value.replace(/\s{2,}/g, " ").slice(0, 160) })}
                placeholder="ስም ያስገቡ (Full name / Organization)"
                className="w-full h-10 px-3 text-xs bg-[#0C0D10] text-neutral-100 border border-white/[0.12] rounded-sm focus:outline-none focus:border-[#E5C07B] transition-colors placeholder:text-neutral-600"
              />
            </div>

            {/* Verified Phone Status */}
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 block">ስልክ ቁጥር (Verified Contact)</span>
              {!isInsideTelegram && telegramId === null ? (
                <div className="p-2.5 rounded-sm bg-[#1C1610] border border-amber-500/30 text-amber-200 font-mono text-[11px] flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                  ይህ ቅጽ በቴሌግራም ቦቱ ውስጥ መከፈት አለበት።
                </div>
              ) : launchPhone === null && userProfile === undefined ? (
                <div className="p-2.5 rounded-sm bg-[#0C0D10] border border-white/[0.08] text-neutral-400 font-mono text-[11px] flex items-center gap-2">
                  <Loader2 size={13} className="shrink-0 animate-spin text-[#E5C07B]" />
                  ስልክ ቁጥር በማግኘት ላይ...
                </div>
              ) : verifiedPhone ? (
                <div className="p-2.5 rounded-sm bg-[#101A18] border border-[#3E9B95]/40 text-[#78D5CB] font-mono text-xs flex items-center gap-2">
                  <BadgeCheck size={14} className="shrink-0 text-[#48B0A8]" />
                  <Phone size={12} className="shrink-0 text-[#48B0A8]" />
                  <span>{verifiedPhone}</span>
                  <span className="ml-auto text-[9px] uppercase tracking-wider text-[#48B0A8]">TELEGRAM VERIFIED</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-sm bg-[#1C1610] border border-amber-500/30 text-amber-200 font-mono text-[11px] flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                  ስልክ ቁጥርዎ አልተገኘም። እባክዎ ለቦቱ «/start» ልከው ስልክዎን ያጋሩ።
                </div>
              )}
            </div>

            {/* Optional organization details for reception */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setShowEnterpriseFields(!showEnterpriseFields)}
                className="font-mono text-[11px] text-[#E5C07B] hover:text-[#F0D296] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Building2 size={12} />
                {showEnterpriseFields ? "የድርጅት TIN ደብቅ (Hide TIN)" : "የድርጅት መረጃ አክል (Add Organization Details)"}
              </button>
            </div>

            {showEnterpriseFields && (
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-[#0C0D10] rounded-sm border border-white/[0.08]">
                <div className="space-y-1">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 block">Legal Company Name</span>
                  <input
                    value={form.companyLegalName}
                    onChange={(e) => setForm({ ...form, companyLegalName: e.target.value })}
                    placeholder="ሕጋዊ ድርጅት"
                    className="w-full h-9 px-2.5 text-xs bg-[#131418] text-white border border-white/[0.1] rounded-sm focus:outline-none focus:border-[#E5C07B]"
                  />
                </div>
                <div className="space-y-1">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 block">TIN Number</span>
                  <input
                    value={form.tinNumber}
                    onChange={(e) => setForm({ ...form, tinNumber: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                    placeholder="10-digit TIN"
                    className="w-full h-9 px-2.5 text-xs bg-[#131418] text-white border border-white/[0.1] rounded-sm focus:outline-none focus:border-[#E5C07B] font-mono"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 block">ማስታወሻ (Optional Notes)</span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value.slice(0, 2000) })}
                placeholder="የከለር ምርጫ፣ የገጠማ ቦታ..."
                className="w-full p-2.5 text-xs bg-[#0C0D10] text-neutral-100 border border-white/[0.12] rounded-sm focus:outline-none focus:border-[#E5C07B] resize-none transition-colors placeholder:text-neutral-600"
              />
            </div>
          </div>
        </section>

        {/* ── Recent Orders ────────────────────────────────────────── */}
        {customerOrders && customerOrders.length > 0 ? (
          <section className="bg-[#131418] border border-white/[0.08] rounded-sm p-4 space-y-2">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">
                የቅርብ ትዕዛዞች (RECENT ORDERS)
              </span>
              <Link href="/track" className="font-mono text-[10px] text-[#E5C07B] hover:underline flex items-center gap-0.5">
                TRACK ALL <ArrowUpRight size={10} />
              </Link>
            </div>
            <div className="space-y-1">
              {customerOrders.slice(0, 3).map((order) => (
                <div key={order.code} className="flex items-center justify-between p-2 rounded-sm bg-[#0C0D10] border border-white/[0.06] text-xs font-mono">
                  <span className="font-semibold text-neutral-200">{order.code}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[#1A1C22] text-[#48B0A8] border border-[#3E9B95]/30">
                    {order.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Bottom Submit Action Bar ─────────────────────────────── */}
        <div className="fixed bottom-16 left-0 right-0 p-3 bg-[#0C0D10]/95 backdrop-blur-md border-t border-white/[0.08] z-40">
          <div className="max-w-xl mx-auto">
            <button
              type="submit"
              disabled={busy || !phoneReady}
              className="w-full h-11 bg-[#E5C07B] hover:bg-[#EED08F] active:bg-[#D4AF37] text-[#0C0D10] font-mono font-semibold text-xs tracking-[0.1em] uppercase rounded-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-none"
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin text-[#0C0D10]" />
                  <span>እየተላከ ነው... (SUBMITTING)</span>
                </>
              ) : (
                <>
                  <span>ትዕዛዝ ላክ (SUBMIT ORDER)</span>
                  <Send size={13} />
                </>
              )}
            </button>
          </div>
        </div>
      </form> : activeTab === "orders" ? (
        <CustomerOrdersView orders={customerOrders as CustomerOrderSummary[] | undefined} />
      ) : (
        <CustomerProfileForm initialName={launchName ?? userProfile?.name ?? ""} initialPhone={verifiedPhone ?? ""} initialCompany={userProfile?.companyLegalName ?? ""} initialTin={userProfile?.tinNumber ?? ""} initialNotes={userProfile?.notes ?? ""} onSave={saveProfile} />
      )}
    </div>
  );
}
