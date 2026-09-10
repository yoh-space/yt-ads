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
import Image from "next/image";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { bootstrapTelegramWebApp, isTelegramMiniApp, sendTelegramOrderResult } from "@/lib/telegram-webapp";
import { SERVICE_CATEGORIES, getServiceLabel, type ServiceId } from "@/constants/services";
import { serviceSpecificationFields } from "@/shared/service-specifications";
import { BottomNavigation } from "./bottom-navigation";
import { CustomerOrdersView } from "./customer-orders-view";
import { CustomerProfileForm } from "./customer-profile-form";
import { PhoneVerificationGate } from "./phone-verification-gate";
import { DimensionsInput } from "./dimensions-input";
import { ServicePicker } from "./service-picker";
import { OrderWizard } from "./order-wizard";
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
  const [isInsideTelegram, setIsInsideTelegram] = useState(false);

  useEffect(() => {
    const ctx = bootstrapTelegramWebApp();
    setLaunchContext(ctx);
    setIsInsideTelegram(isTelegramMiniApp());
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

  const [form, setForm] = useState<OrderFormState>({
    clientName: "",
    companyLegalName: "",
    tinNumber: "",
    accountType: "individual",
    serviceType: SERVICE_CATEGORIES[0]?.items[0]?.id ?? "banner_print",
    specifications: {},
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
    const specificationFields = serviceSpecificationFields(form.serviceType);
    if (specificationFields.some((field) => !form.specifications[field.key])) {
      setMessage({ tone: "error", text: "እባክዎ ሁሉንም የእቃ መለያ ምርጫዎች ይሙሉ። (Select all material specifications.)" });
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
        serviceId: form.serviceType,
        specifications: form.specifications,
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
        accountType: "individual",
        serviceType: null,
        specifications: {},
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
  const selectedSpecificationFields = useMemo(
    () => form.serviceType ? serviceSpecificationFields(form.serviceType) : [],
    [form.serviceType],
  );

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
            <Image
              src="/logo.webp"
              alt="YT Advertisement"
              width={42}
              height={42}
              className="h-9 w-9 object-contain"
            />
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
          </div>
        </div>
      </header>

      {/* ── Main Form ─────────────────────────────────────────────── */}
      <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />

      {!isInsideTelegram ? <div className="mx-auto max-w-md p-6 text-center text-sm text-neutral-300">ይህ ገጽ በTelegram Mini App ውስጥ ብቻ ይሰራል።</div> : !phoneReady ? <PhoneVerificationGate initialName={launchName ?? ""} busy={busy} onSubmit={async (phone) => { if (!telegramId || !telegramInitData) throw new Error("Telegram መለያ አልተገኘም።"); setBusy(true); try { await updateTelegramProfile({ telegramId, initData: telegramInitData, phone, name: launchName ?? undefined }); } finally { setBusy(false); } }} /> : activeTab === "create" ? (
          <OrderWizard
            telegramId={telegramId}
            telegramInitData={telegramInitData}
            launchName={launchName ?? userProfile?.name}
            launchPhone={verifiedPhone ?? undefined}
            initialCompany={userProfile?.companyLegalName}
            initialTin={userProfile?.tinNumber}
            initialNotes={userProfile?.notes}
            onSuccess={(code) => {
              setMessage({
                tone: "success",
                code,
                text: `ትዕዛዝዎ ተመዝግቧል። መለያ፡ ${code}። ክፍያዎ በሪሴፕሽን ሲረጋገጥ በቴሌግራም ማረጋገጫ ይደርስዎታል።`,
              });
              setActiveTab("orders");
            }}
          />
        ) : activeTab === "orders" ? (
        <CustomerOrdersView orders={customerOrders as CustomerOrderSummary[] | undefined} />
      ) : (
        <CustomerProfileForm initialName={launchName ?? userProfile?.name ?? ""} initialPhone={verifiedPhone ?? ""} initialCompany={userProfile?.companyLegalName ?? ""} initialTin={userProfile?.tinNumber ?? ""} initialNotes={userProfile?.notes ?? ""} onSave={saveProfile} />
      )}
    </div>
  );
}
