"use client";

export function CustomerProfileView({ name, phone, telegramId }: { name: string | null; phone: string | null; telegramId: string | null }) {
  return (
    <section className="p-4 pb-28 space-y-4 max-w-xl mx-auto">
      <h2 className="text-lg font-semibold text-white">መገለጫ</h2>
      <div className="rounded border border-white/[0.08] bg-[#131418] p-4 space-y-3 text-sm">
        <div><span className="text-xs text-neutral-500">ስም</span><p className="text-neutral-100">{name ?? "አልተገኘም"}</p></div>
        <div><span className="text-xs text-neutral-500">ስልክ</span><p className="text-neutral-100">{phone ?? "ስልክ አልተረጋገጠም"}</p></div>
        <div><span className="text-xs text-neutral-500">የቴሌግራም መለያ</span><p className="font-mono text-neutral-100">{telegramId ?? "አልተገኘም"}</p></div>
      </div>
    </section>
  );
}
