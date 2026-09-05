"use client";

import { useState } from "react";
import { Phone, ShieldCheck } from "lucide-react";

export function PhoneVerificationGate({
  initialName,
  onSubmit,
  busy,
}: {
  initialName: string;
  onSubmit: (phone: string) => Promise<void>;
  busy: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const normalized = phone.replace(/[^\d+]/g, "").trim();
    if (!/^\+?\d{7,15}$/.test(normalized)) {
      setError("እባክዎ ትክክለኛ ስልክ ቁጥር ያስገቡ።");
      return;
    }
    setError(null);
    await onSubmit(normalized);
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <section className="w-full rounded border border-amber-500/30 bg-card p-5 shadow-xl">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
          <Phone size={20} />
        </div>
        <h1 className="text-xl font-bold text-white">ስልክ ቁጥርዎን ያስገቡ</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-400">
          ትዕዛዝ ለመፍጠር ስልክ ቁጥርዎ ያስፈልጋል። ቁጥርዎ ከቴሌግራም ቦት ካልመጣ፣ እዚህ ያስገቡ።
        </p>
        {initialName ? <p className="mt-3 text-xs text-neutral-500">ስም: {initialName}</p> : null}
        <label className="mt-5 block text-xs font-semibold text-neutral-300">
          ስልክ ቁጥር
          <input type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+251..." className="mt-2 w-full rounded border border-border bg-background px-3 py-3 font-mono text-sm text-white outline-none focus:border-amber-400" />
        </label>
        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        <button type="button" onClick={() => void submit()} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
          <ShieldCheck size={16} />{busy ? "በማረጋገጥ ላይ…" : "ስልክ አረጋግጥ"}
        </button>
      </section>
    </main>
  );
}
