"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AlertTriangle, BriefcaseBusiness, CalendarClock, Check, ClipboardList, Clock3, Copy, CreditCard, Factory, Phone, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDate(value?: number) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatMoney(value: number) {
  return `ETB ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function statusTone(status: string) {
  if (["COMPLETED", "READY_FOR_PICKUP"].includes(status)) return "border-success/30 bg-success/10 text-success";
  if (["EXPIRED", "EXPIRED_JUNK"].includes(status)) return "border-danger/30 bg-danger/10 text-danger";
  if (["IN_PRODUCTION", "JOB_CARD_CREATED"].includes(status)) return "border-cyan/30 bg-cyan/10 text-cyan-dark";
  return "border-border bg-muted/20 text-muted-foreground";
}

function displayStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className="mt-1 text-[12px] font-medium text-foreground">{value}</p></div>;
}

function LoadingBody() {
  return <div className="space-y-4 p-5">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-muted/30" />)}</div>;
}

export function OrderDetailDrawer({ orderId, onClose }: { orderId: Id<"customerOrders"> | null; onClose: () => void }) {
  const detail = useQuery(api.orderDetails.get, orderId ? { orderId } : "skip");

  useEffect(() => {
    if (!orderId) return;
    const previous = document.activeElement as HTMLElement | null;
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => { window.removeEventListener("keydown", handleKey); previous?.focus?.(); };
  }, [orderId, onClose]);

  if (!orderId) return null;

  const paymentTotal = detail?.amount ?? 0;
  const paymentStatus = detail?.paymentStatus ?? "UNPAID";
  const overdue = Boolean(detail?.preferredDueDate && detail.preferredDueDate < Date.now() && !["COMPLETED", "READY_FOR_PICKUP", "EXPIRED", "EXPIRED_JUNK"].includes(detail.status));

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Order details">
      <button type="button" aria-label="Close order details" className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="animate-slide-in-right relative flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl">
        <header className="shrink-0 border-b border-border/60 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><ClipboardList size={18} /></span>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">Order overview</p>
                <h2 className="mt-1 text-lg font-bold text-foreground">{detail?.code ?? "Loading order…"}</h2>
                {detail ? <span className={cn("mt-2 inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold", statusTone(detail.status))}>{displayStatus(detail.status)}</span> : null}
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close order details" className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 text-muted-foreground hover:bg-muted/20 hover:text-foreground"><X size={15} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 [scrollbar-width:thin]">
          {!detail ? <LoadingBody /> : <div className="space-y-5">
            <section className="rounded-xl border border-border/60 bg-background/30 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground"><UserRound size={14} className="text-primary" /> Customer</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailRow label="Customer" value={detail.clientName} />
                <DetailRow label="Client type" value={detail.clientType} />
                <DetailRow label="Phone" value={<span className="inline-flex items-center gap-2"><Phone size={12} />{detail.phone}<a href={`tel:${detail.phone}`} className="text-primary hover:underline">Call</a><button type="button" title="Copy phone" onClick={() => void navigator.clipboard?.writeText(detail.phone)} className="text-muted-foreground hover:text-primary"><Copy size={12} /></button></span>} />
                <DetailRow label="Order source" value={detail.source} />
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground"><ClipboardList size={14} className="text-primary" /> Services and materials</div>
              <div className="rounded-xl border border-border/60 bg-background/30">
                <div className="border-b border-border/50 px-4 py-3"><p className="text-sm font-semibold text-foreground">{detail.serviceType}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail.dimensions} · Quantity {detail.quantity}</p></div>
                {detail.items.length > 0 ? detail.items.map((item) => <div key={`${item.name}-${item.unit}`} className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3 last:border-0"><div><p className="text-[12px] font-medium text-foreground">{item.name}</p><p className="text-[10px] text-muted-foreground">{item.category} · {item.status.replaceAll("_", " ").toLowerCase()}</p></div><div className="text-right font-mono text-[10px] text-muted-foreground"><p>Planned {item.planned} {item.unit}</p><p>Issued {item.issued ?? 0} · Used {item.consumed ?? 0} {item.unit}</p></div></div>) : <p className="px-4 py-3 text-[11px] italic text-muted-foreground">No material breakdown has been recorded yet.</p>}
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-background/30 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground"><Factory size={14} className="text-primary" /> Fulfillment</div><div className="space-y-3"><DetailRow label="Machine" value={detail.machineName ? `${detail.machineName}${detail.machineCode ? ` · ${detail.machineCode}` : ""}` : "Awaiting assignment"} /><DetailRow label="Operator group" value={detail.operatorRole ?? "Not assigned"} /><DetailRow label="Job" value={detail.job ? `${detail.job.code} · ${displayStatus(detail.job.status)}` : "No job card"} /></div></div>
              <div className={cn("rounded-xl border p-4", overdue ? "border-danger/30 bg-danger/5" : "border-border/60 bg-background/30")}><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground"><CalendarClock size={14} className={overdue ? "text-danger" : "text-primary"} /> Deadline</div><DetailRow label="Due date" value={<span className="inline-flex items-center gap-1">{overdue ? <AlertTriangle size={12} className="text-danger" /> : null}{formatDate(detail.preferredDueDate)}</span>} /><p className={cn("mt-2 text-[10px]", overdue ? "text-danger" : "text-muted-foreground")}>{overdue ? "This order is past its target date." : "Within the target completion window."}</p></div>
            </section>

            <section className="rounded-xl border border-border/60 bg-background/30 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground"><CreditCard size={14} className="text-primary" /> Payment summary</div><div className="grid gap-4 sm:grid-cols-3"><DetailRow label="Total" value={formatMoney(paymentTotal)} /><DetailRow label="Advance" value={paymentStatus === "PAID" ? formatMoney(paymentTotal) : "Not recorded"} /><DetailRow label="Balance" value={paymentStatus === "PAID" ? formatMoney(0) : formatMoney(paymentTotal)} /></div><p className="mt-3 inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Check size={11} /> {displayStatus(paymentStatus)}{detail.paymentMethod ? ` · ${detail.paymentMethod}` : ""}</p></section>

            <section><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground"><Clock3 size={14} className="text-primary" /> Activity</div><div className="space-y-2">{detail.timeline.map((event, index) => <div key={`${event.type}-${event.at}-${index}`} className="flex gap-3 rounded-lg border border-border/50 bg-background/30 px-3 py-2.5"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" /><div className="min-w-0"><p className="text-[11px] font-medium capitalize text-foreground">{event.label}</p><p className="text-[10px] text-muted-foreground">{event.detail}</p></div><time className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground">{formatDate(event.at)}</time></div>)}</div></section>
          </div>}
        </div>
        <footer className="shrink-0 border-t border-border/60 px-5 py-3"><p className="text-center text-[9px] uppercase tracking-[0.16em] text-muted-foreground/60">Read-only oversight · Press Esc to close</p></footer>
      </aside>
    </div>
  );
}
