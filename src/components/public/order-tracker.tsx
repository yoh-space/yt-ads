"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Clock3, Search } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { CustomerOrderStatus, TrackedOrder } from "@/lib/operations-types";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui";
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
  Expired: 0,
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
  const orders = useQuery(api.orders.track, submittedLookup ? { lookup: submittedLookup } : "skip") as TrackedOrder[] | undefined;
  const requestOverdueInquiry = useMutation(api.orders.requestOverdueInquiry);

  async function inquire(order: TrackedOrder) {
    setNotice(null);
    try {
      await requestOverdueInquiry({ orderId: order.id as Id<"customerOrders"> });
      setNotice("Your update request was sent to the YT Advertisement team.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to send the update request.");
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative w-10 h-10 grid place-items-center rounded-xl overflow-hidden border border-cyan bg-gradient-to-br from-[#00799a] to-[#18c1ce] text-white text-lg font-extrabold">
              <span>Y</span>
              <i className="absolute w-3 h-3 -right-1 -bottom-1 bg-gold rotate-45" />
            </div>
            <div>
              <strong className="block text-lg font-bold text-navy leading-tight">YT Advertisement</strong>
              <small className="block text-xs font-mono tracking-wider text-gray-500 uppercase">Client tracking</small>
            </div>
          </Link>
          
          <Link href="/">
            <Button size="small" variant="ghost">
              <ArrowLeft size={15} />Back to website
            </Button>
          </Link>
        </div>
      </nav>

      <section className="px-6 py-16 lg:py-24">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan/10 text-cyan-dark text-sm font-semibold mb-6">
            <Clock3 size={14} /> 
            REALTIME ORDER TRACKING
          </div>
          
          <h1 className="text-3xl lg:text-4xl font-black text-navy mb-4">
            Know where your project is.
          </h1>
          
          <p className="text-lg text-gray-600 mb-8">
            Enter the tracking code from your request confirmation or the phone number used when you submitted it.
          </p>
          
          <form 
            className="flex items-center gap-4 max-w-lg mx-auto p-2 bg-white rounded-2xl shadow-lg border border-gray-100"
            onSubmit={(event) => { 
              event.preventDefault(); 
              setNotice(null); 
              setSubmittedLookup(lookup.trim()); 
            }}
          >
            <Search size={18} className="ml-4 text-gray-400" />
            <input 
              autoFocus 
              value={lookup} 
              onChange={(event) => setLookup(event.target.value)} 
              placeholder="ORD-2026-123456 or 09…"
              className="flex-1 px-2 py-3 border-0 outline-0 bg-transparent text-navy placeholder:text-gray-400"
            />
            <Button variant="primary" type="submit" className="m-1">
              Find order
            </Button>
          </form>
          
          {notice ? (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">{notice}</p>
            </div>
          ) : null}
        </div>
      </section>

      {submittedLookup && orders === undefined ? (
        <div className="px-6 pb-16">
          <div className="max-w-2xl mx-auto text-center">
            <div className="animate-pulse">
              <div className="inline-block w-6 h-6 border-2 border-cyan border-t-transparent rounded-full animate-spin mr-3"></div>
              <span className="text-gray-600">Checking the live production queue…</span>
            </div>
          </div>
        </div>
      ) : null}

      {submittedLookup && orders?.length === 0 ? (
        <div className="px-6 pb-16">
          <div className="max-w-2xl mx-auto text-center">
            <div className="p-8 bg-gray-50 rounded-2xl">
              <p className="text-gray-600">No matching order found. Check the code or phone number and try again.</p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto space-y-6">
          {orders?.map((order) => {
            const current = statusStep(order.status);
            return (
              <article 
                key={order.code}
                className={cn(
                  "bg-white rounded-2xl shadow-sm border p-8",
                  order.overdue ? "border-orange-200 bg-orange-50" : "border-gray-100"
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-mono font-semibold mb-2">
                      {order.code}
                    </div>
                    <h2 className="text-2xl font-bold text-navy mb-2">{order.serviceType}</h2>
                    <p className="text-gray-600">
                      {order.clientName} · {order.dimensions} · Qty {order.quantity}
                    </p>
                  </div>
                  
                  <div className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold",
                    order.status === "COMPLETED" 
                      ? "bg-green-100 text-green-800" 
                      : order.overdue 
                        ? "bg-orange-100 text-orange-800"
                        : "bg-blue-100 text-blue-800"
                  )}>
                    {steps[statusStep(order.status)]}
                  </div>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-between mb-8 relative">
                  {steps.map((step, index) => {
                    const isDone = index <= current;
                    return (
                      <div key={step} className="flex flex-col items-center relative flex-1">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-2 relative z-10",
                          isDone 
                            ? "bg-cyan text-white" 
                            : "bg-gray-200 text-gray-500"
                        )}>
                          {isDone ? <Check size={16} /> : index + 1}
                        </div>
                        <small className="text-xs text-gray-600 text-center font-medium">
                          {step}
                        </small>
                        
                        {/* Progress line */}
                        {index < steps.length - 1 && (
                          <div 
                            className={cn(
                              "absolute top-5 left-1/2 h-0.5 w-full -translate-y-1/2",
                              index < current ? "bg-cyan" : "bg-gray-200"
                            )}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Meta Information */}
                <div className="grid md:grid-cols-3 gap-4 pt-6 border-t border-gray-100">
                  <div>
                    <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Preferred due date
                    </span>
                    <strong className="text-sm text-navy">{formatDue(order.preferredDueDate)}</strong>
                  </div>
                  
                  <div>
                    <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Last update
                    </span>
                    <strong className="text-sm text-navy">{formatDue(order.updatedAt)}</strong>
                  </div>
                  
                  {order.overdue ? (
                    <div className="md:justify-self-end">
                      <button 
                        className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-800 rounded-lg font-medium text-sm hover:bg-orange-200 transition-colors"
                        onClick={() => void inquire(order)}
                      >
                        <AlertTriangle size={15} />
                        Request overdue update
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="px-6 py-8 bg-navy text-white">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span>Need a new project?</span>
          <Link href="/#request" className="text-cyan hover:text-white transition-colors">
            Send a request →
          </Link>
        </div>
      </footer>
    </main>
  );
}
