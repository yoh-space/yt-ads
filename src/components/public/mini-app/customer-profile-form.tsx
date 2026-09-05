"use client";

import { useState } from "react";

export function CustomerProfileForm({
  initialName,
  initialPhone,
  initialCompany,
  initialTin,
  initialNotes,
  onSave,
}: {
  initialName: string;
  initialPhone: string;
  initialCompany: string;
  initialTin: string;
  initialNotes: string;
  onSave: (profile: { name: string; phone: string; companyLegalName: string; tinNumber: string; notes: string }) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [companyLegalName, setCompanyLegalName] = useState(initialCompany);
  const [tinNumber, setTinNumber] = useState(initialTin);
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try { await onSave({ name: name.trim(), phone: phone.replace(/[^\d+]/g, ""), companyLegalName: companyLegalName.trim(), tinNumber: tinNumber.replace(/\D/g, "").slice(0, 10), notes: notes.trim() }); } finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded border border-border bg-card p-4"><h2 className="text-lg font-semibold text-white">መገለጫ</h2><Field label="ስም" value={name} onChange={setName} /><Field label="ስልክ" value={phone} onChange={setPhone} type="tel" /><Field label="የድርጅት ስም (ካለ)" value={companyLegalName} onChange={setCompanyLegalName} /><Field label="TIN (ካለ)" value={tinNumber} onChange={(value) => setTinNumber(value.replace(/\D/g, "").slice(0, 10))} /><label className="block text-xs text-neutral-400">ማስታወሻ<textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 2000))} rows={3} className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-primary" /></label><button type="button" onClick={() => void save()} disabled={busy} className="w-full rounded bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? "በማስቀመጥ ላይ…" : "መገለጫውን አስቀምጥ"}</button></section>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "tel" }) {
  return <label className="block text-xs text-neutral-400">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-2.5 text-sm text-white outline-none focus:border-primary" /></label>;
}
