"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  FileImage,
  Inbox,
  Plus,
  Search,
} from "lucide-react";
import { useDashboardModal } from "@/components/dashboard/modal-context";
import { StatusPill } from "@/components/ui/status-pill";
import { getServiceLabel } from "@/constants/services";
import type { CustomerOrder, Profile } from "@/lib/operations-types";
import type { AccessContext } from "@/lib/access-policy";
import { WorkspaceModuleGate } from "@/components/dashboard/workspace-renderer";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  });
}

export default function ReceptionWorkspace({
  profile,
  ordersQuery,
}: {
  profile: Pick<Profile, "role" | "active">;
  ordersQuery: Array<{ _id: string; [key: string]: unknown }>;
}) {
  const router = useRouter();
  const { openModal } = useDashboardModal();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const orders = withIds(ordersQuery) as CustomerOrder[];
  const accessContext: AccessContext = {
    profile: { role: profile.role, active: profile.active },
  };

  function copyToClipboard(text: string, label: string, key: string) {
    if (!text || text === "—") {
      toast.error(`No ${label} available to copy`);
      return;
    }
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      toast.success(`${label} copied: ${text}`);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }

  const filteredOrders = orders.filter((order) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch =
      order.code.toLowerCase().includes(query) ||
      order.clientName.toLowerCase().includes(query) ||
      (order.tinNumber && order.tinNumber.toLowerCase().includes(query)) ||
      (order.companyLegalName && order.companyLegalName.toLowerCase().includes(query)) ||
      order.phone.includes(query);

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "PENDING_REVIEW" && order.status === "PENDING_REVIEW") ||
      (statusFilter === "IN_PROGRESS" && (order.status === "CONFIRMED_PAID_OR_CREDIT" || order.status === "JOB_CARD_CREATED" || order.status === "IN_PRODUCTION")) ||
      (statusFilter === "COMPLETED" && (order.status === "COMPLETED" || order.status === "READY_FOR_PICKUP"));

    return matchesSearch && matchesStatus;
  });

  const pendingCount = orders.filter((o) => o.status === "PENDING_REVIEW").length;
  const inProgressCount = orders.filter((o) =>
    ["CONFIRMED_PAID_OR_CREDIT", "JOB_CARD_CREATED", "IN_PRODUCTION"].includes(o.status)
  ).length;
  const completedCount = orders.filter((o) => ["COMPLETED", "READY_FOR_PICKUP"].includes(o.status)).length;

  return (
    <WorkspaceModuleGate context={accessContext} moduleId="orders.queue">
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1E293B] pb-5">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[#00B4D8]">
            ስለሰጥ ቦታ
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
            ቴሌግራም እና በመግቢያ ቦታ ትዕዛዝ መቀበያ
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            TIN፣ የኩንፓኒ ስም፣ የትዕዛዝ PIN፣ እና የተያያዙ ፋይሎች ያስገቡ። ክፍያ በPOS በመሳሰሉ መንገዶች ይከሰተዋል።
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/orders")}
            className="px-3.5 py-1.5 rounded-sm border border-[#1E293B] bg-[#14161D] text-xs font-semibold text-slate-300 hover:text-white hover:border-[#00B4D8] transition-colors"
          >
            All Orders List
          </button>
          <button
            onClick={() => openModal("order")}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-[#00B4D8] text-xs font-semibold text-[#0B132B] hover:bg-[#90E0EF] transition-colors"
          >
            <Plus size={14} /> New Walk-in Order
          </button>
        </div>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setStatusFilter("PENDING_REVIEW")}
          className={`p-4 rounded-sm border cursor-pointer transition-all ${
            statusFilter === "PENDING_REVIEW"
              ? "border-[#FFB703] bg-[#FFB703]/10"
              : "border-[#1E293B] bg-[#14161D] hover:border-slate-600"
          }`}
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Pending Intake Review
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-[#FFB703] tabular-nums">
              {pendingCount}
            </span>
            <span className="font-mono text-xs text-slate-400">Awaiting Price</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter("IN_PROGRESS")}
          className={`p-4 rounded-sm border cursor-pointer transition-all ${
            statusFilter === "IN_PROGRESS"
              ? "border-[#00B4D8] bg-[#00B4D8]/10"
              : "border-[#1E293B] bg-[#14161D] hover:border-slate-600"
          }`}
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            In Production Run
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-[#00B4D8] tabular-nums">
              {inProgressCount}
            </span>
            <span className="font-mono text-xs text-slate-400">በምርት ላይ</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter("COMPLETED")}
          className={`p-4 rounded-sm border cursor-pointer transition-all ${
            statusFilter === "COMPLETED"
              ? "border-[#38B000] bg-[#38B000]/10"
              : "border-[#1E293B] bg-[#14161D] hover:border-slate-600"
          }`}
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Completed / Pickup Ready
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-[#38B000] tabular-nums">
              {completedCount}
            </span>
            <span className="font-mono text-xs text-slate-400">Ready for Client</span>
          </div>
        </div>
      </div>

      {/* Orders Table with Telegram Intake Actions */}
      <div className="border border-[#1E293B] rounded-sm bg-[#14161D]">
        <div className="p-4 border-b border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-slate-400">Filter:</span>
            <div className="flex items-center gap-1.5">
              {["ALL", "PENDING_REVIEW", "IN_PROGRESS", "COMPLETED"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-sm text-[11px] font-semibold transition-colors ${
                    statusFilter === s
                      ? "bg-[#00B4D8] text-[#0B132B]"
                      : "bg-[#0C0D10] text-slate-400 hover:text-white"
                  }`}
                >
                  {s.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search PIN, Client, Company, TIN…"
              className="w-full pl-8 pr-3 py-1.5 rounded-sm border border-[#1E293B] bg-[#0C0D10] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00B4D8]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1E293B] bg-[#0C0D10]/50 font-mono text-[10px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Order PIN</th>
                <th className="px-4 py-3">Client / Company</th>
                <th className="px-4 py-3">Customer TIN</th>
                <th className="px-4 py-3">Service & Spec</th>
                <th className="px-4 py-3">Artwork File</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Quick Intake Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B] text-slate-300 font-mono">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No orders match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const tin = order.tinNumber?.trim() || "";
                  const company = order.companyLegalName?.trim() || order.clientName;
                  const pin = order.code;

                  return (
                    <tr key={order.id} className="hover:bg-[#1E293B]/40 transition-colors">
                      {/* Order PIN */}
                      <td className="px-4 py-3 font-bold text-[#00B4D8]">
                        {pin}
                      </td>

                      {/* Client / Company */}
                      <td className="px-4 py-3 font-sans">
                        <strong className="block text-white font-semibold">{order.clientName}</strong>
                        {order.companyLegalName ? (
                          <span className="text-[11px] text-slate-400 block truncate max-w-[180px]">
                            {order.companyLegalName}
                          </span>
                        ) : null}
                        <span className="text-[10px] text-slate-500 font-mono">{order.phone}</span>
                      </td>

                      {/* Customer TIN */}
                      <td className="px-4 py-3">
                        {tin ? (
                          <span className="font-semibold text-emerald-400">{tin}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Service & Dimensions */}
                      <td className="px-4 py-3 font-sans">
                        <span className="text-white font-medium">
                          {getServiceLabel(order.serviceType) ?? order.serviceType}
                        </span>
                        <span className="block text-[11px] text-slate-400 font-mono">
                          {order.dimensions} · Qty: {order.quantity}
                        </span>
                      </td>

                      {/* Artwork File */}
                      <td className="px-4 py-3 font-sans">
                        {order.fileUrl ? (
                          <a
                            href={order.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#00B4D8] hover:underline"
                          >
                            <FileImage size={13} />
                            <span className="max-w-[110px] truncate">{order.fileName ?? "Design file"}</span>
                          </a>
                        ) : (
                          <span className="text-slate-600 text-[11px]">No file</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusPill variant={order.status === "COMPLETED" ? "success" : order.status === "PENDING_REVIEW" ? "warning" : "info"}>
                          {order.status}
                        </StatusPill>
                      </td>

                      {/* Quick Copy Action Buttons */}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1 font-sans">
                          {/* Copy PIN button */}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(pin, "Order PIN", `pin-${order.id}`)}
                            title="Copy Order PIN"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-[#1E293B] bg-[#0C0D10] text-[10px] font-semibold text-slate-300 hover:text-white hover:border-[#00B4D8] transition-colors"
                          >
                            {copiedKey === `pin-${order.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            PIN
                          </button>

                          {/* Copy Company Name button */}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(company, "Company Name", `comp-${order.id}`)}
                            title="Copy Verified Company Name"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-[#1E293B] bg-[#0C0D10] text-[10px] font-semibold text-slate-300 hover:text-white hover:border-[#00B4D8] transition-colors"
                          >
                            {copiedKey === `comp-${order.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            Company
                          </button>

                          {/* Copy TIN button */}
                          <button
                            type="button"
                            disabled={!tin}
                            onClick={() => copyToClipboard(tin, "TIN Number", `tin-${order.id}`)}
                            title={tin ? "Copy TIN Number" : "No TIN available"}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm border text-[10px] font-semibold transition-colors ${
                              tin
                                ? "border-[#1E293B] bg-[#0C0D10] text-slate-300 hover:text-white hover:border-emerald-500"
                                : "border-slate-800 bg-transparent text-slate-600 cursor-not-allowed"
                            }`}
                          >
                            {copiedKey === `tin-${order.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            TIN
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </WorkspaceModuleGate>
  );
}
