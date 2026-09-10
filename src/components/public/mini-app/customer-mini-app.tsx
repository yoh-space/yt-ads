"use client";

import { useEffect, useState } from "react";
import { Clock, CheckCircle2, AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { CompleteOrderPayloadInput } from "@/shared/order-schemas";
import { bootstrapTelegramWebApp, isTelegramMiniApp } from "@/lib/telegram-webapp";
import { BottomNavigation } from "./bottom-navigation";
import { CustomerOrdersView } from "./customer-orders-view";
import { CustomerProfileForm } from "./customer-profile-form";
import { PhoneVerificationGate } from "./phone-verification-gate";
import { OrderWizard } from "./order-wizard";
import type { CustomerOrderSummary, MiniAppTab } from "./types";

interface EditingOrderState {
  id: string;
  code: string;
  editRevision?: number;
  values: Partial<CompleteOrderPayloadInput>;
}

export function TelegramMiniAppOrder() {
  const info = useQuery(api.orders.publicInfo);
  const updateTelegramProfile = useMutation(api.users.updateTelegramProfile);

  const [activeTab, setActiveTab] = useState<MiniAppTab>("create");
  const [editingOrder, setEditingOrder] = useState<EditingOrderState | null>(null);

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

  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string; code?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const resetEditState = () => {
    setEditingOrder(null);
  };

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

      {/* ── Notification Banner ───────────────────────────────────── */}
      {message && (
        <div className="max-w-xl mx-auto px-4 pt-3">
          <div
            className={`p-3 rounded-sm border flex items-start justify-between gap-2 ${
              message.tone === "success"
                ? "bg-green-500/10 border-green-500/30 text-green-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            <div className="flex items-start gap-2">
              {message.tone === "success" ? (
                <CheckCircle2 size={16} className="text-green-400 flex-none mt-0.5" />
              ) : (
                <AlertTriangle size={16} className="text-rose-400 flex-none mt-0.5" />
              )}
              <p className="text-xs leading-relaxed">{message.text}</p>
            </div>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="text-neutral-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Main Navigation & Tabs ─────────────────────────────────── */}
      <BottomNavigation activeTab={activeTab} onChange={(tab) => {
        if (tab !== "create" && editingOrder) {
          resetEditState();
        }
        setActiveTab(tab);
      }} />

      {!isInsideTelegram ? (
        <div className="mx-auto max-w-md p-6 text-center text-sm text-neutral-300">
          ይህ ገጽ በTelegram Mini App ውስጥ ብቻ ይሰራል።
        </div>
      ) : !phoneReady ? (
        <PhoneVerificationGate
          initialName={launchName ?? ""}
          busy={busy}
          onSubmit={async (phone) => {
            if (!telegramId || !telegramInitData) throw new Error("Telegram መለያ አልተገኘም።");
            setBusy(true);
            try {
              await updateTelegramProfile({
                telegramId,
                initData: telegramInitData,
                phone,
                name: launchName ?? undefined,
              });
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : activeTab === "create" ? (
        <OrderWizard
          key={editingOrder ? `edit-${editingOrder.id}` : "new-order"}
          telegramId={telegramId}
          telegramInitData={telegramInitData}
          launchName={launchName ?? userProfile?.name}
          launchPhone={verifiedPhone ?? undefined}
          initialCompany={userProfile?.companyLegalName}
          initialTin={userProfile?.tinNumber}
          initialNotes={userProfile?.notes}
          editingOrderId={editingOrder?.id}
          editRevision={editingOrder?.editRevision}
          editingOrderCode={editingOrder?.code}
          initialValues={editingOrder?.values}
          onSuccess={(code, isEdit) => {
            setMessage({
              tone: "success",
              code,
              text: isEdit
                ? `ትዕዛዝ ${code} በተሳካ ሁኔታ ተስተካክሏል። (Order ${code} updated successfully.)`
                : `ትዕዛዝዎ ተመዝግቧል። መለያ፡ ${code}። ክፍያዎ በሪሴፕሽን ሲረጋገጥ በቴሌግራም ማረጋገጫ ይደርስዎታል።`,
            });
            resetEditState();
            setActiveTab("orders");
          }}
          onCancel={() => {
            resetEditState();
            if (editingOrder) setActiveTab("orders");
          }}
        />
      ) : activeTab === "orders" ? (
        <CustomerOrdersView
          orders={customerOrders as CustomerOrderSummary[] | undefined}
          onEditOrder={(order) => {
            setEditingOrder({
              id: order.id,
              code: order.code,
              editRevision: order.editRevision,
              values: {
                customerName: order.clientName,
                phone: order.phone,
                accountType: order.accountType ?? "individual",
                companyLegalName: order.companyLegalName,
                tinNumber: order.tinNumber,
                serviceId: (order.serviceId as any) ?? (order.serviceType as any),
                specifications: order.specifications ?? {},
                dimensions: order.dimensions,
                length: order.length,
                width: order.width,
                quantity: order.quantity,
                notes: order.notes ?? "",
                preferredDueDate: order.preferredDueDate,
              },
            });
            setActiveTab("create");
          }}
        />
      ) : (
        <CustomerProfileForm
          initialName={launchName ?? userProfile?.name ?? ""}
          initialPhone={verifiedPhone ?? ""}
          initialCompany={userProfile?.companyLegalName ?? ""}
          initialTin={userProfile?.tinNumber ?? ""}
          initialNotes={userProfile?.notes ?? ""}
          onSave={saveProfile}
        />
      )}
    </div>
  );
}
