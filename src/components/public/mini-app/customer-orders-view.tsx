"use client";

import { getServiceLabel } from "@/constants/services";
import type { CustomerOrderSummary } from "./types";

export function CustomerOrdersView({ orders }: { orders: CustomerOrderSummary[] | undefined }) {
  return (
    <section className="p-4 pb-28 space-y-4 max-w-xl mx-auto">
      <h2 className="text-lg font-semibold text-white">የእኔ ትዕዛዞች</h2>
      {!orders ? <div className="text-sm text-neutral-400">ትዕዛዞችን በመጫን ላይ…</div> : orders.length === 0 ? <div className="rounded border border-white/[0.08] p-5 text-center text-sm text-neutral-400">እስካሁን ምንም ትዕዛዝ የለዎትም።</div> : orders.map((order) => (
        <article key={order.id} className="rounded border border-white/[0.08] bg-[#131418] p-4 space-y-2">
          <div className="flex justify-between"><strong className="font-mono text-[#E5C07B]">{order.code}</strong><span className="text-xs text-[#78D5CB]">{order.status}</span></div>
          <p className="text-sm text-neutral-200">{getServiceLabel(order.serviceType, "am") ?? order.serviceType}</p>
          <p className="text-xs text-neutral-400">{order.dimensions} · {order.quantity} ብዛት</p>
        </article>
      ))}
    </section>
  );
}
