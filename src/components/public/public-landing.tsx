"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, FileUp, MapPin, Phone, Send, Sparkles } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

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

  return <main className="min-h-screen bg-gradient-to-b from-white to-gray-50">
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative w-10 h-10 grid place-items-center rounded-xl overflow-hidden border border-cyan bg-gradient-to-br from-[#00799a] to-[#18c1ce] text-white text-lg font-extrabold">
            <span>Y</span>
            <i className="absolute w-3 h-3 -right-1 -bottom-1 bg-gold rotate-45" />
          </div>
          <div>
            <strong className="block text-lg font-bold text-navy leading-tight">{company.companyName}</strong>
            <small className="block text-xs font-mono tracking-wider text-gray-500 uppercase">Signage · Print · Production</small>
          </div>
        </Link>
        
        <div className="hidden md:flex items-center gap-8">
          <a href="#services" className="text-sm font-medium text-gray-600 hover:text-navy transition-colors">Capabilities</a>
          <a href="#request" className="text-sm font-medium text-gray-600 hover:text-navy transition-colors">Request a project</a>
          <Link href="/track"><Button size="small" variant="secondary">Track order</Button></Link>
          <Link href="/sign-in"><Button size="small" variant="primary">Team sign in</Button></Link>
        </div>
      </div>
    </nav>

    <section className="relative px-6 py-20 lg:py-32">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan/10 text-cyan-dark text-sm font-semibold">
            <Sparkles size={14} /> 
            BUILT FOR VISIBLE BRANDS
          </div>
          
          <h1 className="text-4xl lg:text-6xl font-black text-navy leading-tight">
            Make your next space impossible to miss.
          </h1>
          
          <p className="text-lg text-gray-600 leading-relaxed max-w-xl">
            YT Advertisement turns ideas into high-impact signage, print, cut, and installation-ready production from Jemo Kafdem Building in Addis Ababa.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="#request" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-navy text-white font-semibold rounded-lg shadow-lg hover:bg-[#074d76] transition-colors">
              Start a project <ArrowRight size={16} />
            </a>
            <Link href="/track">
              <Button variant="ghost" className="w-full sm:w-auto">Check order status</Button>
            </Link>
          </div>
          
          <div className="flex items-center gap-8 pt-8 border-t border-gray-100">
            <div className="text-center">
              <strong className="block text-2xl font-bold text-navy">6</strong>
              <span className="text-sm text-gray-500">workshop capabilities</span>
            </div>
            <div className="text-center">
              <strong className="block text-2xl font-bold text-navy">1</strong>
              <span className="text-sm text-gray-500">realtime production queue</span>
            </div>
            <div className="text-center">
              <strong className="block text-2xl font-bold text-navy">24/7</strong>
              <span className="text-sm text-gray-500">client tracking</span>
            </div>
          </div>
        </div>
        
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan/20 to-blue/20 rounded-3xl blur-3xl" />
          <div className="relative bg-gradient-to-br from-navy to-[#0a2f47] text-white p-8 lg:p-12 rounded-3xl shadow-2xl">
            <div className="text-4xl lg:text-6xl font-black mb-4">YT</div>
            <div className="text-xl lg:text-2xl font-bold mb-2">MAKE IT<br />VISIBLE</div>
            <div className="text-sm font-mono tracking-wider text-cyan opacity-75">ADVERTISE WITH INTENT</div>
            <div className="absolute -bottom-4 left-8 right-8 bg-black/20 text-xs font-mono tracking-wider text-center py-2 rounded-lg">
              LARGE FORMAT · UV · CNC · LASER · DTF
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="services" className="px-6 py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan/10 text-cyan-dark text-sm font-semibold mb-6">
            WORKSHOP CAPABILITIES
          </div>
          <h2 className="text-3xl lg:text-4xl font-black text-navy mb-4">From first cut to finished face.</h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">One team, one realtime workflow, and the machinery to move a project from request to pickup.</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <article key={service} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4 mb-4">
                <span className="flex-none w-8 h-8 bg-cyan/10 text-cyan-dark rounded-lg grid place-items-center text-sm font-bold">
                  0{index + 1}
                </span>
                <h3 className="text-xl font-bold text-navy">{service}</h3>
              </div>
              <p className="text-gray-600 leading-relaxed">
                {["Banners, wall graphics, vehicle wraps, and high-volume branded surfaces.", "Direct-to-board production for rigid, detailed, and durable graphics.", "Precision routing for dimensional letters, panels, and branded fixtures.", "Clean profile cuts for acrylic, foam, and detailed signage parts.", "Apparel and transfer production with color-controlled output.", "Fast vinyl graphics, decals, and repeatable contour cutting."][index]}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section id="request" className="px-6 py-20">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan/10 text-cyan-dark text-sm font-semibold mb-6">
            CLIENT REQUEST PORTAL
          </div>
          <h2 className="text-3xl lg:text-4xl font-black text-navy mb-4">Tell us what needs to be made.</h2>
          <p className="text-lg text-gray-600 mb-8">Share the essentials. Our team will review the request, assign the right machine, and return a clear production path.</p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <MapPin size={18} className="text-cyan" />
              <div>
                <strong className="block font-semibold text-navy">Visit the workshop</strong>
                <span className="text-gray-600">{company.address}</span>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <Phone size={18} className="text-cyan" />
              <div>
                <strong className="block font-semibold text-navy">Call the team</strong>
                <a href={`tel:${company.phone}`} className="text-cyan hover:text-cyan-dark transition-colors">{company.phone}</a>
              </div>
            </div>
          </div>
        </div>

        <form className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100" onSubmit={submit}>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <label className="block">
              <span className="block text-sm font-semibold text-navy mb-2">Your name or company</span>
              <Input required value={form.clientName} onChange={(event) => setForm({ ...form, clientName: event.target.value })} placeholder="e.g. Addis Breweries" />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-navy mb-2">Phone number</span>
              <Input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="09…" />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-navy mb-2">Service type</span>
              <Select value={form.serviceType} onChange={(event) => setForm({ ...form, serviceType: event.target.value })}>
                {serviceTypes.map((service) => <option key={service}>{service}</option>)}
              </Select>
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-navy mb-2">Preferred due date</span>
              <Input required type="date" value={form.preferredDueDate} onChange={(event) => setForm({ ...form, preferredDueDate: event.target.value })} />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-navy mb-2">Dimensions / specification</span>
              <Input required value={form.dimensions} onChange={(event) => setForm({ ...form, dimensions: event.target.value })} placeholder="e.g. 3m × 1.2m, acrylic 5mm" />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-navy mb-2">Quantity</span>
              <Input required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="e.g. 4 pieces or 18 m²" />
            </label>
          </div>
          
          <label className="block mb-6">
            <span className="block text-sm font-semibold text-navy mb-2">Project notes</span>
            <textarea 
              rows={3} 
              value={form.notes} 
              onChange={(event) => setForm({ ...form, notes: event.target.value })} 
              placeholder="Colors, installation notes, or anything the workshop should know"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan focus:border-transparent resize-none"
            />
          </label>
          
          <label className="flex items-center gap-4 p-4 border-2 border-dashed border-gray-200 rounded-lg mb-6 cursor-pointer hover:border-cyan transition-colors">
            <FileUp size={17} className="text-gray-400" />
            <div className="flex-1">
              <span className="block font-medium text-navy">
                {file ? file.name : "Attach artwork or reference file (optional)"}
              </span>
              <small className="text-gray-500">PDF, PNG, JPG, SVG, or other production reference</small>
            </div>
            <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="sr-only" />
          </label>
          
          {message ? (
            <div className={cn(
              "flex items-center gap-3 p-4 rounded-lg mb-6",
              message.tone === "success" ? "bg-green/10 text-green-dark" : "bg-red/10 text-red"
            )}>
              {message.tone === "success" ? <CheckCircle2 size={16} /> : null}
              {message.text}
            </div>
          ) : null}
          
          <Button size="full" variant="primary" type="submit" disabled={busy}>
            {busy ? "Sending request…" : "Send project request"} <Send size={16} />
          </Button>
        </form>
      </div>
    </section>

    <footer className="px-6 py-8 bg-navy text-white">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <span>© {new Date().getFullYear()} {company.companyName}</span>
        <span className="text-sm text-gray-300">{company.address}</span>
        <Link href="/track" className="text-cyan hover:text-white transition-colors">Track an order →</Link>
      </div>
    </footer>
  </main>;
}
