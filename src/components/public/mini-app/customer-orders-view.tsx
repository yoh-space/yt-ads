"use client";

import { useState } from "react";
import { getServiceLabel } from "@/shared/services";
import { Lock, Edit3, Loader2 } from "lucide-react";

type CustomerOrder = {
  id: string;
  code: string;
  clientName: string;
  phone: string;
  serviceType: string;
  serviceId?: string;
  specifications?: Record<string, string>;
  dimensions: string;
  length?: number;
  width?: number;
  quantity: string;
  status: string;
  editRevision?: number;
  customerEditable?: boolean;
  customerEditLockedAt?: number;
  reviewLockReason?: string;
  lastCustomerEditedAt?: number;
  preferredDueDate: number;
  notes?: string;
  updatedAt: number;
  accountType?: "individual" | "corporate" | "government";
  companyLegalName?: string;
  tinNumber?: string;
};

export function CustomerOrdersView({
  orders,
  onEditOrder,
}: {
  orders: CustomerOrder[] | undefined;
  onEditOrder?: (order: CustomerOrder) => void;
}) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  if (!orders) {
    return <div className="p-4 text-sm text-neutral-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> ትዕዛዞችን በመጫን ላይ…</div>;
  }
  if (orders.length === 0) {
    return <div className="p-4 text-sm text-neutral-400">እስካሁን ምንም ትዕዛዝ የለዎትም።</div>;
  }

  const selectedOrder = selectedOrderId ? orders.find((o) => o.id === selectedOrderId) : null;
  if (selectedOrder) {
    return <OrderDetail order={selectedOrder} onBack={() => setSelectedOrderId(null)} onEditOrder={onEditOrder} />;
  }

  return (
    <section className="p-4 pb-28 space-y-3 max-w-xl mx-auto">
      <h2 className="text-lg font-semibold text-white">የእኔ ትዕዛዞች</h2>
      {orders.map((order) => (
        <article key={order.id} onClick={() => setSelectedOrderId(order.id)} className="rounded-sm border border-white/[0.08] bg-[#131418] p-4 space-y-2 cursor-pointer hover:border-white/[0.15] transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <strong className="font-mono text-[#E5C07B] text-sm">{order.code}</strong>
              <p className="text-xs text-neutral-400 mt-0.5">{order.clientName}</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-sm bg-[#1A1C22] text-[#48B0A8] border border-[#3E9B95]/30 font-mono">{order.status}</span>
          </div>
          <p className="text-sm text-neutral-200">{getServiceLabel(order.serviceType, "am") ?? order.serviceType}</p>
          <p className="text-xs text-neutral-500">{order.dimensions} · {order.quantity} ብዛት</p>
          <div className="flex items-center gap-2 pt-1">
            {order.customerEditable ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-sm"><Edit3 size={10} /> ማስተካከያ ይቻላል</span>
            ) : null}
            {order.customerEditLockedAt ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-sm"><Lock size={10} /> በግምገማ ላይ</span>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}

function OrderDetail({ order, onBack, onEditOrder }: { order: CustomerOrder; onBack: () => void; onEditOrder?: (order: CustomerOrder) => void; }) {
  const specEntries = order.specifications ? Object.entries(order.specifications) : [];

  return (
    <section className="p-4 pb-28 space-y-4 max-w-xl mx-auto">
      <button onClick={onBack} className="text-xs text-[#E5C07B] hover:underline">← ተመለስ</button>
      <div className="rounded-sm border border-white/[0.08] bg-[#131418] p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <strong className="font-mono text-[#E5C07B] text-lg">{order.code}</strong>
            <p className="text-sm text-neutral-400 mt-0.5">{order.clientName} · {order.phone}</p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-sm bg-[#1A1C22] text-[#48B0A8] border border-[#3E9B95]/30 font-mono">{order.status}</span>
        </div>
        {order.customerEditLockedAt ? (
          <div className="flex items-center gap-2 p-2.5 rounded-sm bg-cyan-500/10 border border-cyan-500/20">
            <Lock size={14} className="text-cyan-400 flex-none" />
            <span className="text-xs text-cyan-300">ይህ ትዕዛዝ በግምገማ ላይ ነው። ማስተካከያ አይቻልም።</span>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-xs text-neutral-500 block">አይነቶች</span><strong className="text-neutral-200">{getServiceLabel(order.serviceType, "am") ?? order.serviceType}</strong></div>
          <div><span className="text-xs text-neutral-500 block">መጠን</span><strong className="text-neutral-200">{order.dimensions}</strong></div>
          <div><span className="text-xs text-neutral-500 block">ብዛት</span><strong className="text-neutral-200">{order.quantity}</strong></div>
          <div><span className="text-xs text-neutral-500 block">የመጨረሻ ቀን</span><strong className="text-neutral-200">{new Date(order.preferredDueDate).toLocaleDateString("en-ET")}</strong></div>
        </div>
        {specEntries.length > 0 ? (
          <div className="pt-2 border-t border-white/[0.06]">
            <span className="text-xs text-neutral-500 block mb-2">የቦታ መጠመኛ</span>
            <div className="grid grid-cols-2 gap-2">
              {specEntries.map(([key, value]) => (
                <div key={key} className="text-xs"><span className="text-neutral-500">{key}: </span><span className="text-neutral-200">{value}</span></div>
              ))}
            </div>
          </div>
        ) : null}
        {order.notes ? (
          <div className="pt-2 border-t border-white/[0.06]">
            <span className="text-xs text-neutral-500 block mb-1">ማስታወሻ</span>
            <p className="text-xs text-neutral-300 whitespace-pre-wrap">{order.notes}</p>
          </div>
        ) : null}
        {order.lastCustomerEditedAt ? (
          <p className="text-[10px] text-neutral-500 pt-1">መጨረሻ ማስተካከያ: {new Date(order.lastCustomerEditedAt).toLocaleString("en-ET")}</p>
        ) : null}
      </div>
      {order.customerEditable ? (
        onEditOrder ? (
          <button
            type="button"
            onClick={() => onEditOrder(order)}
            className="block w-full h-11 rounded-sm border border-[#E5C07B] text-[#E5C07B] font-mono text-xs hover:bg-[#E5C07B]/10 transition-colors text-center leading-11"
          >
            ትዕዛዝ አስተካል
          </button>
        ) : (
          <a href="#create" className="block w-full h-11 rounded-sm border border-[#E5C07B] text-[#E5C07B] font-mono text-xs hover:bg-[#E5C07B]/10 transition-colors text-center leading-11">
            ትዕዛዝ አስተካል
          </a>
        )
      ) : null}
    </section>
  );
}
