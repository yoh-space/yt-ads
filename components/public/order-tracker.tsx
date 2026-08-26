"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Clock3, Search } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { TrackedOrder } from "@/lib/operations-types";
import type { Id } from "@/convex/_generated/dataModel";

const steps = ["Received", "In Production", "Ready for Pickup", "Completed"] as const;

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

  return <main className="tracker-shell"><nav className="public-nav tracker-nav"><Link href="/" className="public-brand"><span className="brand-mark">Y<i /></span><span><strong>YT Advertisement</strong><small>Client tracking</small></span></Link><Link href="/" className="button ghost small"><ArrowLeft size={15} />Back to website</Link></nav><section className="tracker-intro"><span className="eyebrow"><Clock3 size={14} /> REALTIME ORDER TRACKING</span><h1>Know where your project is.</h1><p>Enter the tracking code from your request confirmation or the phone number used when you submitted it.</p><form className="tracker-search" onSubmit={(event) => { event.preventDefault(); setNotice(null); setSubmittedLookup(lookup.trim()); }}><Search size={18} /><input autoFocus value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="ORD-2026-123456 or 09…" /><button className="button primary" type="submit">Find order</button></form>{notice ? <p className="tracker-notice">{notice}</p> : null}</section>{submittedLookup && orders === undefined ? <div className="tracker-empty">Checking the live production queue…</div> : null}{submittedLookup && orders?.length === 0 ? <div className="tracker-empty">No matching order found. Check the code or phone number and try again.</div> : null}<section className="tracker-results">{orders?.map((order) => { const current = steps.indexOf(order.status); return <article className={`tracking-card ${order.overdue ? "tracking-overdue" : ""}`} key={order.code}><div className="tracking-card-header"><div><span className="eyebrow">{order.code}</span><h2>{order.serviceType}</h2><p>{order.clientName} · {order.dimensions} · Qty {order.quantity}</p></div><span className={`status-pill ${order.status === "Completed" ? "success" : order.overdue ? "warning" : "info"}`}>{order.status}</span></div><div className="tracking-line">{steps.map((step, index) => <div className={`tracking-step ${index <= current ? "done" : ""}`} key={step}><span>{index <= current ? <Check size={13} /> : index + 1}</span><small>{step}</small></div>)}</div><div className="tracking-meta"><span>Preferred due date<strong>{formatDue(order.preferredDueDate)}</strong></span><span>Last update<strong>{formatDue(order.updatedAt)}</strong></span>{order.overdue ? <button className="button warning-button" onClick={() => void inquire(order)}><AlertTriangle size={15} />Request overdue update</button> : null}</div></article>})}</section><footer className="public-footer"><span>Need a new project?</span><Link href="/#request">Send a request →</Link></footer></main>;
}
