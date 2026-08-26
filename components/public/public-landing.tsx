"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, FileUp, MapPin, Phone, Send, Sparkles } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const services = ["Large Format", "UV Flatbed", "CNC Router", "Laser Cutter", "DTF Printing", "Plotter & Vinyl"];
const serviceTypes = ["Large Format", "UV Flatbed", "CNC Router", "Laser Cutter", "DTF Printing", "Plotter & Vinyl", "Signage / Branding"];

export function PublicLanding() {
  const info = useQuery(api.orders.publicInfo);
  const generateUploadUrl = useMutation(api.orders.generateUploadUrl);
  const submitOrder = useMutation(api.orders.submit);
  const [form, setForm] = useState({ clientName: "", phone: "", serviceType: serviceTypes[0], dimensions: "", quantity: "", preferredDueDate: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const company = info ?? { companyName: "YT Advertisement", address: "Jemo Kafdem Building, Addis Ababa", phone: "0951082102", logoUrl: undefined };

  async function uploadSelectedFile() {
    if (!file) return undefined;
    const uploadUrl = await generateUploadUrl({});
    const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
    if (!response.ok) throw new Error("The selected file could not be uploaded.");
    const result = await response.json() as { storageId: string };
    return result.storageId as Id<"_storage">;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      if (!form.preferredDueDate) throw new Error("Choose a preferred due date.");
      const fileStorageId = await uploadSelectedFile();
      const result = await submitOrder({
        clientName: form.clientName,
        phone: form.phone,
        serviceType: form.serviceType,
        dimensions: form.dimensions,
        quantity: form.quantity,
        preferredDueDate: new Date(`${form.preferredDueDate}T17:00:00`).getTime(),
        notes: form.notes || undefined,
        fileStorageId,
        fileName: file?.name,
      });
      setMessage({ tone: "success", text: `Request received. Your tracking code is ${result.code}. Save it to check progress.` });
      setForm({ clientName: "", phone: "", serviceType: serviceTypes[0], dimensions: "", quantity: "", preferredDueDate: "", notes: "" });
      setFile(null);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to submit the request." });
    } finally {
      setBusy(false);
    }
  }

  return <main className="public-shell">
    <nav className="public-nav"><Link href="/" className="public-brand"><span className="brand-mark">Y<i /></span><span><strong>{company.companyName}</strong><small>Signage · Print · Production</small></span></Link><div className="public-nav-links"><a href="#services">Capabilities</a><a href="#request">Request a project</a><Link href="/track" className="button secondary small">Track order</Link><Link href="/sign-in" className="button primary small">Team sign in</Link></div></nav>
    <section className="public-hero"><div className="hero-copy"><span className="eyebrow"><Sparkles size={14} /> BUILT FOR VISIBLE BRANDS</span><h1>Make your next space impossible to miss.</h1><p>YT Advertisement turns ideas into high-impact signage, print, cut, and installation-ready production from Jemo Kafdem Building in Addis Ababa.</p><div className="hero-actions"><a href="#request" className="button primary">Start a project <ArrowRight size={16} /></a><Link href="/track" className="button ghost">Check order status</Link></div><div className="hero-proof"><span><strong>6</strong> workshop capabilities</span><span><strong>1</strong> realtime production queue</span><span><strong>24/7</strong> client tracking</span></div></div><div className="hero-visual"><div className="hero-glow" /><div className="hero-sign"><span>YT</span><strong>MAKE IT<br />VISIBLE</strong><small>ADVERTISE WITH INTENT</small></div><div className="hero-ruler">LARGE FORMAT · UV · CNC · LASER · DTF</div></div></section>
    <section id="services" className="public-section"><div className="section-heading"><span className="eyebrow">WORKSHOP CAPABILITIES</span><h2>From first cut to finished face.</h2><p>One team, one realtime workflow, and the machinery to move a project from request to pickup.</p></div><div className="service-grid">{services.map((service, index) => <article className="service-card" key={service}><span>0{index + 1}</span><h3>{service}</h3><p>{["Banners, wall graphics, vehicle wraps, and high-volume branded surfaces.", "Direct-to-board production for rigid, detailed, and durable graphics.", "Precision routing for dimensional letters, panels, and branded fixtures.", "Clean profile cuts for acrylic, foam, and detailed signage parts.", "Apparel and transfer production with color-controlled output.", "Fast vinyl graphics, decals, and repeatable contour cutting."][index]}</p></article>)}</div></section>
    <section id="request" className="request-section"><div className="request-intro"><span className="eyebrow">CLIENT REQUEST PORTAL</span><h2>Tell us what needs to be made.</h2><p>Share the essentials. Our team will review the request, assign the right machine, and return a clear production path.</p><div className="contact-card"><MapPin size={18} /><div><strong>Visit the workshop</strong><span>{company.address}</span></div></div><div className="contact-card"><Phone size={18} /><div><strong>Call the team</strong><a href={`tel:${company.phone}`}>{company.phone}</a></div></div></div><form className="public-form" onSubmit={submit}><div className="form-grid"><label>Your name or company<input required value={form.clientName} onChange={(event) => setForm({ ...form, clientName: event.target.value })} placeholder="e.g. Addis Breweries" /></label><label>Phone number<input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="09…" /></label><label>Service type<select value={form.serviceType} onChange={(event) => setForm({ ...form, serviceType: event.target.value })}>{serviceTypes.map((service) => <option key={service}>{service}</option>)}</select></label><label>Preferred due date<input required type="date" value={form.preferredDueDate} onChange={(event) => setForm({ ...form, preferredDueDate: event.target.value })} /></label><label>Dimensions / specification<input required value={form.dimensions} onChange={(event) => setForm({ ...form, dimensions: event.target.value })} placeholder="e.g. 3m × 1.2m, acrylic 5mm" /></label><label>Quantity<input required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="e.g. 4 pieces or 18 m²" /></label></div><label>Project notes<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Colors, installation notes, or anything the workshop should know" /></label><label className="file-field"><FileUp size={17} /><span>{file ? file.name : "Attach artwork or reference file (optional)"}<small>PDF, PNG, JPG, SVG, or other production reference</small></span><input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>{message ? <p className={message.tone === "success" ? "form-success" : "form-error"}>{message.tone === "success" ? <CheckCircle2 size={16} /> : null}{message.text}</p> : null}<button className="button primary full" type="submit" disabled={busy}>{busy ? "Sending request…" : "Send project request"} <Send size={16} /></button></form></section>
    <footer className="public-footer"><span>© {new Date().getFullYear()} {company.companyName}</span><span>{company.address}</span><Link href="/track">Track an order →</Link></footer>
  </main>;
}
