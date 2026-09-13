"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Clock3, Copy, Search } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { CustomerOrderStatus, TrackedOrder } from "@/lib/operations-types";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

const steps = ["Received", "In Production", "Ready for Pickup", "Completed"] as const;

const STATUS_STEP: Record<string, number> = {
  PENDING_REVIEW: 0,
  PRICED_AND_PENDING_PAYMENT: 0,
  CONFIRMED_PAID_OR_CREDIT: 0,
  JOB_CARD_CREATED: 0,
  IN_PRODUCTION: 1,
  COMPLETED: 3,
  READY_FOR_PICKUP: 2,
  EXPIRED: 0,
  EXPIRED_JUNK: 0,
};

function statusStep(status: CustomerOrderStatus): number {
  return STATUS_STEP[status] ?? 0;
}

function formatDue(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-ET", { dateStyle: "medium", timeStyle: "short" });
}

export function OrderTracker() {
  const [lookup, setLookup] = useState("");
  const [submittedLookup, setSubmittedLookup] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const orders = useQuery(api.orders.track, submittedLookup ? { lookup: submittedLookup } : "skip") as TrackedOrder[] | undefined;
  const requestOverdueInquiry = useMutation(api.orders.requestOverdueInquiry);

  async function inquire(order: TrackedOrder) {
    setNotice(null);
    try {
      await requestOverdueInquiry({ orderId: order.id as Id<"customerOrders"> });
      setNotice("Your update inquiry has been recorded for the workshop team.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to send the update request.");
    }
  }

  async function copyAccount(account: string) {
    try {
      await navigator.clipboard.writeText(account);
      setCopiedAccount(account);
      window.setTimeout(() => setCopiedAccount(null), 1600);
    } catch {
      setCopiedAccount(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#0C0D10] text-[#D4D4D4] font-sans antialiased pb-24">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#121316] border-b border-white/[0.08] px-6 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-sm bg-[#E5C07B] text-[#0C0D10] font-mono font-bold text-xs grid place-items-center">
              <span>Y</span>
            </div>
            <div>
              <strong className="block font-mono text-xs uppercase tracking-[0.14em] text-neutral-100 font-semibold leading-none">
                YT ADVERTISEMENT
              </strong>
              <small className="block font-mono text-[10px] tracking-wider text-neutral-400 mt-0.5 uppercase">
                Order Tracking
              </small>
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-mono text-xs text-neutral-400 hover:text-neutral-200 bg-[#17181D] border border-white/[0.1] hover:border-white/[0.2] transition-colors"
          >
            <ArrowLeft size={13} />
            ወደ ማዘዣ (New Order)
          </Link>
        </div>
      </nav>

      {/* Search Header */}
      <section className="px-6 py-12 lg:py-16">
        <div className="max-w-2xl mx-auto text-center space-y-3.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#18191E] border border-white/[0.08] text-neutral-300 font-mono text-[11px] uppercase tracking-[0.16em]">
            <Clock3 size={12} className="text-[#E5C07B]" />
            LIVE ORDER RADAR
          </div>

          <h1 className="text-xl lg:text-3xl font-semibold text-neutral-100 tracking-tight">
            የትዕዛዝዎን ሁኔታ ይከታተሉ
          </h1>

          <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
            ከትዕዛዝ ማረጋገጫዎ ላይ የተሰጠውን መለያ ኮድ (ምሳሌ፡ ORD-…) ወይም ያስመዘገቡትን ስልክ ቁጥር ያስገቡ።
          </p>

          <form
            className="flex items-center gap-2 max-w-md mx-auto p-1 bg-[#131418] rounded-sm border border-white/[0.12] focus-within:border-[#E5C07B] transition-colors"
            onSubmit={(event) => {
              event.preventDefault();
              setNotice(null);
              setSubmittedLookup(lookup.trim());
            }}
          >
            <Search size={14} className="ml-2.5 text-neutral-500 shrink-0" />
            <input
              autoFocus
              value={lookup}
              onChange={(event) => setLookup(event.target.value)}
              placeholder="ORD-2026-... ወይም 09…"
              className="flex-1 px-2 py-2 border-0 outline-0 bg-transparent text-neutral-100 placeholder:text-neutral-600 text-xs font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#E5C07B] hover:bg-[#EED08F] active:bg-[#D4AF37] text-[#0C0D10] font-mono font-semibold text-xs tracking-wider uppercase rounded-sm transition-colors cursor-pointer"
            >
              FIND
            </button>
          </form>

          {notice && (
            <div className="p-3 bg-[#101A18] border border-[#3E9B95]/40 rounded-sm text-xs font-mono text-[#78D5CB] text-center max-w-md mx-auto">
              {notice}
            </div>
          )}
        </div>
      </section>

      {/* Loading state */}
      {submittedLookup && orders === undefined && (
        <div className="px-6 pb-12">
          <div className="max-w-md mx-auto text-center flex items-center justify-center gap-2 text-xs font-mono text-neutral-400">
            <span className="w-3.5 h-3.5 border-2 border-[#E5C07B] border-t-transparent rounded-full animate-spin" />
            Checking queue…
          </div>
        </div>
      )}

      {/* No match state */}
      {submittedLookup && orders?.length === 0 && (
        <div className="px-6 pb-12">
          <div className="max-w-md mx-auto text-center p-6 bg-[#131418] rounded-sm border border-white/[0.08] text-xs font-mono text-neutral-400">
            ምንም የተገኘ ትዕዛዝ የለም። እባክዎ ያስገቡትን የትዕዛዝ ኮድ ወይም ስልክ ቁጥር እንደገና ያረጋግጡ።
          </div>
        </div>
      )}

      {/* Orders results list */}
      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto space-y-4">
          {orders?.map((order) => {
            const current = statusStep(order.status);
            return (
              <article
                key={order.code}
                className={cn(
                  "bg-[#131418] rounded-sm border p-5 transition-colors",
                  order.overdue ? "border-amber-500/40 bg-[#191512]" : "border-white/[0.08]"
                )}
              >
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                  <div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#1A1C22] text-[#E5C07B] text-[10px] font-mono font-bold mb-1.5 border border-white/[0.06]">
                      #{order.code}
                    </div>
                    <h2 className="text-base font-semibold text-white">{order.serviceType}</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {order.clientName} · {order.dimensions} · Qty {order.quantity}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-[#1A1C22] text-[#48B0A8] border border-[#3E9B95]/30">
                      {order.status}
                    </span>
                    <p className="text-[10px] text-neutral-500 font-mono mt-1">
                      Due: {formatDue(order.preferredDueDate)}
                    </p>
                  </div>
                </div>

                {/* Stepper */}
                <div className="py-3 border-y border-white/[0.06] mb-4">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {steps.map((stepName, index) => {
                      const done = index <= current;
                      const active = index === current;
                      return (
                        <div key={stepName} className="space-y-1.5">
                          <div
                            className={cn(
                              "w-6 h-6 mx-auto rounded-sm grid place-items-center font-mono text-[10px] font-bold transition-colors",
                              done
                                ? "bg-[#E5C07B] text-[#0C0D10]"
                                : "bg-[#1C1D24] text-neutral-500 border border-white/[0.08]"
                            )}
                          >
                            {done ? <Check size={12} strokeWidth={3} /> : index + 1}
                          </div>
                          <span
                            className={cn(
                              "text-[10px] font-mono block leading-tight",
                              active ? "text-neutral-100 font-semibold" : done ? "text-neutral-300" : "text-neutral-500"
                            )}
                          >
                            {stepName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {order.amount !== undefined ? (
                  <div className={cn("mb-4 rounded-sm border p-3", order.status === "READY_FOR_PICKUP" && order.paymentStatus !== "FULLY_PAID" ? "border-amber-500/40 bg-[#221710]" : "border-white/[0.08] bg-[#0F1014]")}>
                    <p className="text-xs font-semibold text-[#E5C07B]">Payment summary</p>
                    <div className="mt-2 grid max-w-sm grid-cols-2 gap-2 text-xs">
                      <span className="text-neutral-500">Total</span><strong className="text-neutral-200">{order.amount.toFixed(2)} ETB</strong>
                      <span className="text-neutral-500">Advance paid</span><strong className="text-neutral-200">{(order.advancePaidAmount ?? 0).toFixed(2)} ETB</strong>
                      <span className="text-neutral-500">Remaining due</span><strong className={order.remainingDueAmount ? "text-[#E5C07B]" : "text-[#48B0A8]"}>{(order.remainingDueAmount ?? 0).toFixed(2)} ETB</strong>
                    </div>
                    {order.status === "READY_FOR_PICKUP" && order.paymentStatus !== "FULLY_PAID" ? <p className="mt-3 text-xs text-amber-200">Your order is 100% complete and ready for pickup. Clear the remaining balance at collection or by transfer before pickup.</p> : null}
                    {order.paymentInstructionsSnapshot?.accounts.length ? (
                      <div className="mt-3 space-y-2 border-t border-white/[0.08] pt-3">
                        <p className="text-xs font-semibold text-[#E5C07B]">Payment accounts</p>
                        {order.paymentInstructionsSnapshot.accounts.map((account) => (
                          <div key={`${account.channel}-${account.identifier}`} className="flex items-center justify-between gap-3 rounded-sm border border-white/[0.06] bg-[#131418] px-3 py-2">
                            <div className="min-w-0"><span className="block text-xs font-semibold text-neutral-200">{account.label}</span><span className="block truncate text-[11px] text-neutral-500">{account.name} · {account.identifier}</span></div>
                            <button type="button" onClick={() => void copyAccount(account.identifier)} className="inline-flex flex-none items-center gap-1 rounded-sm border border-white/[0.12] px-2 py-1 text-[10px] text-neutral-300 hover:border-[#E5C07B] hover:text-[#E5C07B]"><Copy size={11} />{copiedAccount === account.identifier ? "Copied" : "Copy"}</button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Overdue alert */}
                {order.overdue && (
                  <div className="p-3 rounded-sm bg-[#221710] border border-amber-500/30 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-amber-200">
                      <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                      <span>ከተያዘለት ጊዜ ዘግይቷል። አፋጣኝ ሁኔታ ማረጋገጫ ለመጠየቅ ከታች ያለውን ይጫኑ።</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => inquire(order)}
                      className="px-3 py-1 rounded-sm bg-amber-500 hover:bg-amber-400 text-[#0C0D10] font-mono text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      INQUIRE
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
