"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Clock3,
  Copy,
  Download,
  FileImage,
  FileText,
  ImageIcon,
  Lock,
  Printer,
  Wrench,
  X,
} from "lucide-react";
import type { CustomerOrder, CustomerOrderStatus } from "@/lib/operations-types";
import { Button, StatusPill } from "@/components/shared/ui";
import { getServiceLabel } from "@/constants/services";
import { cn } from "@/lib/utils";
import { isDesktopShell } from "@/lib/desktop";

const statusTone = {
  "PENDING_REVIEW": "warning",
  "RECEPTION_REVIEW": "warning",
  "WAITING_FOR_MATERIAL": "warning",
  "PRICED_AND_PENDING_PAYMENT": "warning",
  "CONFIRMED_PAID_OR_CREDIT": "info",
  "JOB_CARD_CREATED": "info",
  "IN_PRODUCTION": "info",
  "COMPLETED": "success",
  "READY_FOR_PICKUP": "info",
  "EXPIRED": "danger",
  "EXPIRED_JUNK": "danger",
} as const;

const priorityTone = {
  High: "danger",
  Medium: "warning",
  Low: "neutral",
} as const;

const paymentTone = {
  PAID: "success",
  PARTIALLY_PAID: "warning",
  FULLY_PAID: "success",
  APPROVED_CREDIT: "info",
  UNPAID: "danger",
} as const;

function formatDue(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-ET", { dateStyle: "medium", timeStyle: "short" });
}

function assetExtension(fileName?: string): string {
  if (!fileName) return "asset";
  const match = /\.([A-Za-z0-9]+)$/.exec(fileName);
  return match ? match[1].toUpperCase() : "ASSET";
}

export function OrderDetailsSheet({
  order,
  machinesLabel,
  canManage,
  canVerifyPayment = false,
  isPending,
  onConvert,
  onLockReview,
  onStatus,
  onClose,
}: {
  order: CustomerOrder;
  machinesLabel?: string;
  canManage: boolean;
  canVerifyPayment?: boolean;
  isPending: (key: string) => boolean;
  onConvert: (order: CustomerOrder) => void;
  onLockReview: (order: CustomerOrder) => void;
  onStatus: (orderId: string, status: CustomerOrderStatus) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function downloadFileName() {
    const original = order.fileName ?? "artwork";
    const base = original.replace(/\.[^.]+$/, "");
    const ext = /\.[^.]+$/.exec(original)?.[0] ?? "";
    const clean = (value: string) => value.replace(/[^a-zA-Z0-9-_ ]+/g, "").trim() || "order";
    return `${clean(order.clientName)}-${clean(order.code)}-${base}${ext}`;
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function copyAssetUrl() {
    if (!order.fileUrl) return;
    void navigator.clipboard.writeText(order.fileUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  function downloadAsset() {
    if (!order.fileUrl) return;
    const link = document.createElement("a");
    link.href = order.fileUrl;
    link.download = downloadFileName();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const canLockReview = canManage && !order.jobCardId && order.status === "PENDING_REVIEW";
  const canPrice = canManage && !order.jobCardId && order.status === "RECEPTION_REVIEW" && Boolean(order.customerEditLockedAt);
  const canConfirm = Boolean(canVerifyPayment) && canManage && !order.jobCardId && order.status === "PRICED_AND_PENDING_PAYMENT";
  const canComplete = canManage && order.jobCardId && order.status === "IN_PRODUCTION";
  const hasArtwork = Boolean(order.fileUrl && order.fileName);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Order ${order.code} details`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="animate-slide-in-right absolute inset-y-0 right-0 top-0 m-0 flex h-full w-full max-w-xl flex-col overflow-hidden rounded-none border-l border-border bg-card p-0 shadow-2xl"
        style={{ height: "100vh", minHeight: "100vh" }}
      >
        {/* Fixed Header */}
        <header className="flex-shrink-0 flex flex-col gap-4 p-6 border-b border-line bg-background">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-cyan">{order.code}</span>
                {order.overdue ? <StatusPill variant="danger">Overdue</StatusPill> : null}
              </div>
              <h2 className="mt-1 text-xl font-bold text-navy leading-tight truncate">{order.clientName}</h2>
              <span className="block text-sm text-gray-600">{order.phone}</span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close order details"
              className="flex-none grid place-items-center w-9 h-9 rounded-lg border border-line bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-navy"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill variant={statusTone[order.status]}>{order.status}</StatusPill>
            <span className={cn("inline-flex w-max items-center justify-center rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wide", {
              "bg-[#fde8e6] text-[#b84440]": priorityTone[order.priority] === "danger",
              "bg-[#fff3df] text-[#a86e11]": priorityTone[order.priority] === "warning",
              "bg-[#eef4f6] text-[#65818e]": priorityTone[order.priority] === "neutral",
            })}>
              {order.priority} priority
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={13} className="flex-none text-gray-400" />
              Due {formatDue(order.preferredDueDate)}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Printer size={13} className="flex-none text-gray-400" />
              <span className="truncate" title={machinesLabel ?? order.machineName ?? undefined}>
                {machinesLabel ?? order.machineName ?? "Machine not assigned"}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Wrench size={13} className="flex-none text-gray-400" />
              {order.jobCardId ? "Job card issued" : "Job card not issued"}
            </span>
          </div>
          {order.customerEditLockedAt ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-cyan/20 bg-cyan/5 px-3 py-2">
              <Lock size={14} className="text-cyan flex-none" />
              <span className="text-xs text-gray-700">
                Review started {formatDue(order.customerEditLockedAt)} — customer editing is locked
                {order.reviewLockReason ? <span className="block text-gray-500">Note: {order.reviewLockReason}</span> : null}
              </span>
            </div>
          ) : null}
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 pb-16 space-y-6 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:hover:bg-gray-400 [&::-webkit-scrollbar-track]:bg-transparent">
          {/* Service & Specifications */}
          <section className="space-y-3">
            <SectionHeading icon={<ImageIcon size={15} />} title="Service & Specifications" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail term="Service" value={getServiceLabel(order.serviceType) ?? order.serviceType} />
              <Detail term="Dimensions" value={order.dimensions} />
              <Detail term="Quantity" value={order.quantity} />
              <Detail term="Source" value={order.source === "walk_in" ? "Walk-in" : "Online / Telegram"} />
            </dl>
            {order.notes ? (
              <div className="rounded-lg bg-gray-50 border border-line p-3">
                <span className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Customer notes</span>
                <p className="text-xs text-ink whitespace-pre-wrap leading-relaxed">{order.notes}</p>
              </div>
            ) : null}
          </section>

          {/* Telegram Intake & Customer Credentials */}
          <section className="space-y-3">
            <SectionHeading icon={<FileText size={15} />} title="Telegram Intake Credentials" />
            <div className="rounded-lg border border-line bg-gray-900 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 block">Order PIN</span>
                  <strong className="font-mono text-sm text-cyan font-bold">{order.code}</strong>
                </div>
                <Button
                  type="button"
                  size="small"
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard.writeText(order.code);
                    toast.success(`Order PIN copied: ${order.code}`);
                  }}
                >
                  <Copy size={11} /> Copy PIN
                </Button>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-line/60 pt-2.5">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 block">Verified Company Name</span>
                  <strong className="text-xs text-navy font-semibold truncate block">
                    {order.companyLegalName || order.clientName}
                  </strong>
                </div>
                <Button
                  type="button"
                  size="small"
                  variant="secondary"
                  onClick={() => {
                    const text = order.companyLegalName || order.clientName;
                    void navigator.clipboard.writeText(text);
                    toast.success(`Company name copied: ${text}`);
                  }}
                >
                  <Copy size={11} /> Copy Company Name
                </Button>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-line/60 pt-2.5">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 block">Customer TIN</span>
                  <strong className="font-mono text-xs text-navy font-semibold block">
                    {order.tinNumber || "Not provided"}
                  </strong>
                </div>
                <Button
                  type="button"
                  size="small"
                  variant="secondary"
                  disabled={!order.tinNumber}
                  onClick={() => {
                    if (order.tinNumber) {
                      void navigator.clipboard.writeText(order.tinNumber);
                      toast.success(`TIN copied: ${order.tinNumber}`);
                    }
                  }}
                >
                  <Copy size={11} /> Copy TIN
                </Button>
              </div>
            </div>
          </section>

          {/* Graphic Asset & Artwork Preview */}
          <section className="space-y-3">
            <SectionHeading icon={<FileImage size={15} />} title="Graphic Asset & Artwork" />
            {hasArtwork ? (
              <>
                <a
                  href={order.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative block overflow-hidden rounded-lg border border-line bg-[#f8fafb]"
                >
                  <div className="aspect-video w-full grid place-items-center bg-gradient-to-br from-[#eef4f6] to-[#dfecef]">
                    {order.fileUrl && /\.(png|jpe?g|gif|svg|webp|bmp|tiff?|webp)$/i.test(order.fileUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={order.fileUrl}
                        alt={`${order.fileName} artwork preview`}
                        className="w-full h-full object-contain bg-white"
                      />
                    ) : (
                      <span className="flex flex-col items-center gap-2 text-gray-400">
                        <FileImage size={36} />
                        <span className="text-xs font-semibold text-gray-500">Artwork preview</span>
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 p-2 text-[9px] font-mono text-white bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to open in high-res lightbox tab
                    </span>
                  </div>
                </a>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="block text-sm font-semibold text-navy truncate">{order.fileName}</strong>
                    <span className="text-xs text-gray-500">{assetExtension(order.fileName)} file</span>
                  </div>
                  <StatusPill variant="info">{assetExtension(order.fileName)}</StatusPill>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-line">
                  <input
                    readOnly
                    value={order.fileUrl}
                    onFocus={(event) => event.currentTarget.select()}
                    className="flex-1 min-w-0 bg-transparent border-0 outline-none text-xs text-gray-600"
                  />
                  <button
                    onClick={copyAssetUrl}
                    className="flex-none inline-flex items-center gap-1 text-xs font-semibold text-cyan hover:text-cyan-dark"
                  >
                    <Copy size={12} />{copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted-foreground">
                <ImageIcon size={14} className="text-gray-400" />
                No design file attached to this order.
              </div>
            )}
          </section>

          {/* Payment & Pricing */}
          <section className="space-y-3">
            <SectionHeading icon={<Wrench size={15} />} title="Payment & Pricing" />
            <div className="rounded-lg border border-line overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                <span className="text-sm text-gray-600">Total price</span>
                <strong className="font-mono text-lg font-bold text-navy">
                  {order.amount !== undefined ? `ETB ${order.amount.toLocaleString()}` : "—"}
                </strong>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                <span className="text-sm text-gray-600">Payment status</span>
                {order.paymentStatus ? (
                  <StatusPill variant={paymentTone[order.paymentStatus]}>
                    {order.paymentStatus === "APPROVED_CREDIT" ? "APPROVED CREDIT" : order.paymentStatus}
                  </StatusPill>
                ) : (
                  <StatusPill variant="neutral">UNPAID</StatusPill>
                )}
              </div>
              {order.paymentMethod ? (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-600">Payment method</span>
                  <strong className="text-sm font-semibold text-navy capitalize">{order.paymentMethod}</strong>
                </div>
              ) : null}
            </div>
          </section>

          {/* Machine & Operator Queue */}
          <section className="space-y-3">
            <SectionHeading icon={<Printer size={15} />} title="Machine & Operator Queue" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail term="Assigned machine" value={machinesLabel ?? order.machineName ?? "Not assigned"} />
              <Detail term="Job card" value={order.jobCardId ? "Issued" : "Not issued"} />
              <Detail term="Due" value={formatDue(order.preferredDueDate)} withIcon={<Clock3 size={13} className="text-gray-400" />} />
              <Detail term="Updated" value={formatDue(order.updatedAt)} />
            </dl>
          </section>
        </div>

        {/* Sticky Footer (only when there are actionable workflow steps) */}
         {canLockReview || canPrice || canConfirm || canComplete || hasArtwork || (isDesktopShell() && canManage) ? (
          <footer className="flex-shrink-0 flex items-center justify-end gap-3 p-6 border-t border-line bg-muted/30">
            {canLockReview ? (
              <Button
                type="button"
                variant="primary"
                disabled={isPending(`lock-${order.id}`)}
                onClick={() => onLockReview(order)}
              >
                <Lock size={14} />
                {isPending(`lock-${order.id}`) ? "Locking…" : "Begin Review"}
              </Button>
            ) : null}
            {canPrice ? (
              <Button
                type="button"
                variant="primary"
                disabled={isPending(`price-${order.id}`)}
                onClick={() => onConvert(order)}
              >
                <Wrench size={14} />
                {isPending(`price-${order.id}`) ? "Pricing…" : "Set Price"}
              </Button>
            ) : null}
            {canConfirm ? (
              <Button
                type="button"
                variant="primary"
                disabled={isPending(`confirm-${order.id}`)}
                onClick={() => onConvert(order)}
              >
                <Wrench size={14} />
                {isPending(`confirm-${order.id}`) ? "Confirming…" : "Confirm Payment"}
              </Button>
            ) : null}
            {canComplete ? (
              <Button
                type="button"
                variant="primary"
                disabled={isPending(`order-status-${order.id}`)}
                onClick={() => onStatus(order.id, "COMPLETED")}
              >
                {isPending(`order-status-${order.id}`) ? "Saving…" : "Complete"}
              </Button>
            ) : null}
            {hasArtwork ? (
              <Button type="button" variant="secondary" onClick={downloadAsset}>
                <Download size={14} />Download Asset
              </Button>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeading({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="text-cyan-dark">{icon}</span>
      {title}
    </div>
  );
}

function Detail({ term, value, withIcon }: { term: string; value: ReactNode; withIcon?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{term}</dt>
      <dd className="flex items-center gap-1.5 font-semibold text-navy text-sm mt-0.5 truncate">
        {withIcon}
        {value}
      </dd>
    </div>
  );
}
