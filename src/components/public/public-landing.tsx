"use client";

import { FormEvent, useEffect, useState, useMemo, useRef } from "react";
import { 
  FileUp, 
  Send, 
  CheckCircle2, 
  Ruler, 
  Layers, 
  Printer, 
  Sparkles,
  User,
  Info,
  X
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { bootstrapTelegramWebApp, sendTelegramOrderResult } from "@/lib/telegram-webapp";

const serviceCategories = [
  { id: "Large Format", label: "Large Format", desc: "Flex Banner, Sticker" },
  { id: "UV Flatbed", label: "UV Flatbed", desc: "Rigid boards, Acrylic" },
  { id: "CNC Router", label: "CNC Router", desc: "3D Letters, Panels" },
  { id: "Laser Cutter", label: "Laser Cutter", desc: "Acrylic & Foam cut" },
  { id: "DTF Printing", label: "DTF Print", desc: "T-Shirts & Apparel" },
  { id: "Signage / Branding", label: "Signage", desc: "Lightboxes, Boards" },
];

export function TelegramMiniAppOrder() {
  const info = useQuery(api.orders.publicInfo);
  const generateUploadUrl = useMutation(api.orders.generateUploadUrl);
  const submitOrder = useMutation(api.orders.submit);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expand and mark the Mini App ready when opened inside a Telegram client.
  useEffect(() => {
    bootstrapTelegramWebApp();
  }, []);

  const [form, setForm] = useState({
    clientName: "",
    phone: "",
    serviceType: serviceCategories[0].id,
    dimensions: "",
    quantity: "1",
    notes: "",
  });

  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Auto-calculate surface area preview if user types dimensions like 2x3 or 1.5x2
  const estimatedArea = useMemo(() => {
    if (!form.dimensions) return null;
    const match = form.dimensions.match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);
    if (match) {
      const area = parseFloat(match[1]) * parseFloat(match[2]);
      const qty = parseInt(form.quantity) || 1;
      return (area * qty).toFixed(2);
    }
    return null;
  }, [form.dimensions, form.quantity]);

  // Handle file change with size check (e.g., max 50MB)
  const handleFileChange = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.size > 50 * 1024 * 1024) {
      setMessage({
        tone: "error",
        text: "የፋይሉ መጠን ከ 50MB ማነስ አለበት።",
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

    // Client-side quick validations
    const cleanPhone = form.phone.trim().replace(/\s+/g, "");
    const ethiopianPhoneRegex = /^(?:\+251|0)?(9|7)\d{8}$/;
    
    if (!ethiopianPhoneRegex.test(cleanPhone)) {
      setMessage({
        tone: "error",
        text: "እባክዎን ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (ምሳሌ፦ 0911... ወይም 0711...)",
      });
      return;
    }

    if (parseInt(form.quantity) < 1 || isNaN(parseInt(form.quantity))) {
      setMessage({
        tone: "error",
        text: "እባክዎን ትክክለኛ የብዛት ቁጥር ያስገቡ።",
      });
      return;
    }

    setBusy(true);
    try {
      const fileStorageId = await uploadSelectedFile();
      const result = await submitOrder({
        clientName: form.clientName.trim(),
        phone: cleanPhone,
        serviceType: form.serviceType,
        dimensions: form.dimensions.trim(),
        quantity: form.quantity,
        preferredDueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        notes: form.notes ? form.notes.trim() : undefined,
        fileStorageId,
        fileName: file?.name,
      });

      setMessage({
        tone: "success",
        text: `ትዕዛዝዎ በተሳካ ሁኔታ ተልኳል! የመከታተያ ኮድዎ፡ ${result.code}`,
      });

      // Return the finished order to the Telegram chat when run as a Mini App.
      sendTelegramOrderResult({
        code: result.code,
        clientName: form.clientName.trim(),
        serviceType: form.serviceType,
        dimensions: form.dimensions.trim(),
        quantity: form.quantity,
      });

      // Reset Form State
      setForm({
        clientName: "",
        phone: "",
        serviceType: serviceCategories[0].id,
        dimensions: "",
        quantity: "1",
        notes: "",
      });
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "ትዕዛዙን መላክ አልተቻለም።",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Telegram App Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-600 text-white font-black grid place-items-center text-sm shadow-sm">
            YT
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none text-slate-800">
              {info?.companyName ?? "YT Advertisement"}
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5">አዲስ የህትመት ትዕዛዝ ማዘጋጃ</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <Sparkles size={11} /> Quick Order
        </span>
      </header>

      <form onSubmit={submit} className="p-4 space-y-5 max-w-lg mx-auto">
        
        {/* Section 1: Service Type (Visual Chips) */}
        <section className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Printer size={14} className="text-cyan-600" /> 1. የህትመት አይነት መረጣ
          </label>
          <div className="grid grid-cols-2 gap-2">
            {serviceCategories.map((srv) => {
              const active = form.serviceType === srv.id;
              return (
                <button
                  type="button"
                  key={srv.id}
                  onClick={() => setForm({ ...form, serviceType: srv.id })}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all active:scale-95 flex flex-col justify-between",
                    active
                      ? "border-cyan-600 bg-cyan-50/60 ring-2 ring-cyan-500/20 text-cyan-950 font-semibold"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  <span className="text-xs font-bold block">{srv.label}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{srv.desc}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 2: Dimensions & Quantity */}
        <section className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Ruler size={14} className="text-cyan-600" /> 2. መጠን እና ብዛት
            </label>
            {estimatedArea && (
              <span className="text-[11px] font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md">
                ጠቅላላ ስፋት: {estimatedArea} m²
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <span className="text-[11px] text-slate-500 font-medium block mb-1">መጠን (ርዝመት x ጎን)</span>
              <input
                required
                value={form.dimensions}
                onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
                placeholder="ምሳሌ፦ 2x3 ሜትር"
                className="w-full h-11 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
              />
            </div>

            <div>
              <span className="text-[11px] text-slate-500 font-medium block mb-1">ብዛት</span>
              <input
                required
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="1"
                className="w-full h-11 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white text-center font-bold transition-all"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Artwork File Upload */}
        <section className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Layers size={14} className="text-cyan-600" /> 3. የዲዛይን ፋይል (አማራጭ)
          </label>

          <div className="relative">
            <label className="flex items-center gap-3 p-3.5 bg-white border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-cyan-500 active:bg-slate-50 transition-all">
              <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 grid place-items-center shrink-0">
                <FileUp size={18} />
              </div>
              <div className="flex-1 overflow-hidden pr-6">
                <span className="text-xs font-semibold text-slate-800 block truncate">
                  {file ? file.name : "ፋይል ወይም ዲዛይን ይላኩ"}
                </span>
                <span className="text-[10px] text-slate-400 block">PDF, PNG, JPG, AI, CDR (Max 50MB)</span>
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
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                title="ፋይሉን ሰርዝ"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </section>

        {/* Section 4: Customer Contact Info */}
        <section className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <User size={14} className="text-cyan-600" /> 4. የደንበኛ መረጃ
          </label>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block mb-1">ስም / ድርጅት</span>
                <input
                  required
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  placeholder="ስም ያስገቡ"
                  className="w-full h-11 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <span className="text-[11px] text-slate-500 font-medium block mb-1">ስልክ ቁጥር</span>
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="09... / 07..."
                  className="w-full h-11 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 font-medium block mb-1">ተጨማሪ ማብራሪያ / ማስታወሻ (አማራጭ)</span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="የከለር ምርጫ፣ የገጠማ ቦታ ወይም ሌላ ማስታወሻ..."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white resize-none transition-all"
              />
            </div>
          </div>
        </section>

        {/* Feedback Message */}
        {message && (
          <div
            className={cn(
              "p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all",
              message.tone === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            )}
          >
            {message.tone === "success" ? (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            ) : (
              <Info size={16} className="shrink-0 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Fixed Sticky Bottom Action Button for Mobile */}
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-50">
          <button
            type="submit"
            disabled={busy}
            className="w-full max-w-lg mx-auto h-12 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all cursor-pointer"
          >
            {busy ? "ትዕዛዝዎ እየተላከ ነው..." : "ትዕዛዝ ላክ (Submit Order)"}
            <Send size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}