"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/shared/ui/table";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import {
  CircleDollarSign,
  CheckCircle2,
  AlertCircle,
  ArrowLeftRight,
  FileText,
  Clock,
  ExternalLink,
  ShieldCheck,
  X,
  CreditCard,
  Banknote,
} from "lucide-react";

const ETB_FORMAT = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PAYMENT_METHODS = [
  "Telebirr",
  "CBE (Commercial Bank of Ethiopia)",
  "Cash",
  "Bank Transfer",
  "Awash Bank",
  "Dashen Bank",
  "Check",
  "Other",
];

export default function CashierOverviewPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const waitingOrders = useQuery(api.cashier.orders.listOrdersWaitingForPayment);
  const recentVerifications = useQuery(api.cashier.orders.listRecentPaymentVerifications);

  const verifyPaymentAndIssue = useMutation(api.cashier.orders.verifyPaymentAndIssueJobCard);
  const returnToReception = useMutation(api.cashier.orders.returnPaymentToReception);

  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [returnOrder, setReturnOrder] = useState<any | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verification form state
  const [paymentDecision, setPaymentDecision] = useState<"ADVANCE_PAID" | "APPROVED_CREDIT">("ADVANCE_PAID");
  const [paymentMethod, setPaymentMethod] = useState("Telebirr");
  const [paymentReference, setPaymentReference] = useState("");
  const [advancePaidAmount, setAdvancePaidAmount] = useState<number | undefined>(undefined);
  const [cashierNotes, setCashierNotes] = useState("");

  if (waitingOrders === undefined || recentVerifications === undefined || !profile) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Cashier Payment Queue…" />
      </div>
    );
  }

  const totalWaitingAmount = waitingOrders.reduce((acc, o) => acc + (o.advanceDueAmount ?? (o.amount ? o.amount * 0.5 : 0)), 0);

  const handleOpenVerify = (order: any) => {
    setSelectedOrder(order);
    setPaymentDecision("ADVANCE_PAID");
    setPaymentMethod("Telebirr");
    setPaymentReference("");
    setAdvancePaidAmount(order.advanceDueAmount ?? (order.amount ? Number((order.amount * 0.5).toFixed(2)) : undefined));
    setCashierNotes("");
  };

  const handleConfirmVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    if (paymentDecision === "ADVANCE_PAID") {
      if (!paymentMethod.trim()) {
        toast.error("Please select a payment method.");
        return;
      }
      if (!paymentReference.trim()) {
        toast.error("Please provide a payment reference (transaction ID / slip #).");
        return;
      }
      if (!advancePaidAmount || advancePaidAmount <= 0) {
        toast.error("Please enter a valid advance paid amount.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const res = await verifyPaymentAndIssue({
        orderId: selectedOrder._id as Id<"customerOrders">,
        amount: selectedOrder.amount,
        paymentDecision,
        paymentMethod: paymentDecision === "ADVANCE_PAID" ? paymentMethod : undefined,
        paymentReference: paymentDecision === "ADVANCE_PAID" ? paymentReference.trim() : undefined,
        advancePaidAmount: paymentDecision === "ADVANCE_PAID" ? advancePaidAmount : 0,
        cashierNotes: cashierNotes.trim() || undefined,
      });

      toast.success(`Payment verified! Job card ${res.code} issued to production.`);
      setSelectedOrder(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to verify payment and issue job card.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnOrder) return;
    if (!returnReason.trim()) {
      toast.error("Please provide a reason for returning the order to reception.");
      return;
    }

    try {
      setIsSubmitting(true);
      await returnToReception({
        orderId: returnOrder._id as Id<"customerOrders">,
        reason: returnReason.trim(),
      });
      toast.success(`Order ${returnOrder.code} returned to reception.`);
      setReturnOrder(null);
      setReturnReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to return order to reception.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Cashier Desk · ገንዘብ ተቀባይ"
        title="Payment Verification Queue"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<CircleDollarSign size={16} />}
          label="Orders Waiting"
          subtitle="ክፍያ የሚጠብቁ"
          value={waitingOrders.length}
          description="Priced orders awaiting verification"
          variant="alert"
          isAlert={waitingOrders.length > 0}
        />
        <StatCard
          icon={<CreditCard size={16} />}
          label="Advance Due Total"
          subtitle="የቅድመ ክፍያ ድምር"
          value={`ETB ${ETB_FORMAT.format(totalWaitingAmount)}`}
          description="Pending advance collection"
          variant="sales"
        />
        <StatCard
          icon={<CheckCircle2 size={16} />}
          label="Verified Payments"
          subtitle="የተረጋገጡ ክፍያዎች"
          value={recentVerifications.length}
          description="Recent payment verifications"
          variant="cost"
        />
      </div>

      <Panel>
        <PanelHeader
          title="Orders Ready for Payment Verification"
          subtitle="Verify advance receipt and trigger automatic machine dispatch"
          kicker="Cashier Action Required"
          icon={<Banknote size={16} />}
        />

        {waitingOrders.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <CheckCircle2 size={36} className="mx-auto mb-2 text-status-success opacity-80" />
            <p className="text-sm font-medium">All caught up! No orders waiting for payment verification.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Code</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service & Specs</TableHead>
                  <TableHead>Total Price</TableHead>
                  <TableHead>Advance Due</TableHead>
                  <TableHead>Artwork File</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waitingOrders.map((order) => (
                  <TableRow key={order._id} className="hover:bg-muted/50">
                    <TableCell className="font-mono font-semibold text-primary">
                      {order.code}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.clientName}</div>
                      <div className="text-xs text-muted-foreground">{order.phone}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-xs">{order.serviceType}</div>
                      <div className="text-xs text-muted-foreground">{order.dimensions} (Qty: {order.quantity})</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      ETB {ETB_FORMAT.format(order.amount ?? 0)}
                    </TableCell>
                    <TableCell className="font-mono font-semibold text-xs text-emerald-600 dark:text-emerald-400">
                      ETB {ETB_FORMAT.format(order.advanceDueAmount ?? 0)}
                    </TableCell>
                    <TableCell>
                      {order.approvedDesignUrl ? (
                        <a
                          href={order.approvedDesignUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-brand-primary-light hover:underline"
                        >
                          <FileText size={13} />
                          <span>Approved Design</span>
                          <ExternalLink size={10} />
                        </a>
                      ) : order.fileUrl ? (
                        <a
                          href={order.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-brand-primary-light hover:underline"
                        >
                          <FileText size={13} />
                          <span>Customer File</span>
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">No file</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReturnOrder(order);
                            setReturnReason("");
                          }}
                          className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
                        >
                          Return
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenVerify(order)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                        >
                          <ShieldCheck size={14} />
                          <span>Verify & Issue Job Card</span>
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Recent Payment Verifications"
          subtitle="Audit log of confirmed payments and issued job cards"
          kicker="History"
          icon={<Clock size={16} />}
        />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Job Card</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Verified Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentVerifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                    No recent payment records found.
                  </TableCell>
                </TableRow>
              ) : (
                recentVerifications.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-mono text-xs font-medium">{item.code}</TableCell>
                    <TableCell className="text-xs">{item.clientName}</TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-primary">
                      {item.jobCardCode ?? item.jobCardId ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{item.paymentMethod ?? item.advancePaymentMethod ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.advancePaymentReference ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium">
                      ETB {ETB_FORMAT.format(item.advancePaidAmount ?? item.amount ?? 0)}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {item.paymentStatus ?? "VERIFIED"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>

      {/* Verification Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-foreground">Verify Payment & Issue Job Card</h3>
                <p className="text-xs text-muted-foreground font-mono">{selectedOrder.code} · {selectedOrder.clientName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmVerify} className="mt-4 space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                <div className="flex justify-between font-medium">
                  <span>Total Order Price:</span>
                  <span className="font-mono">ETB {ETB_FORMAT.format(selectedOrder.amount ?? 0)}</span>
                </div>
                <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>Advance Due (Required):</span>
                  <span className="font-mono">ETB {ETB_FORMAT.format(selectedOrder.advanceDueAmount ?? 0)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Remaining Due on Pickup:</span>
                  <span className="font-mono">ETB {ETB_FORMAT.format(selectedOrder.remainingDueAmount ?? 0)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Payment Decision</label>
                <div className="mt-1.5 flex gap-4">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="decision"
                      value="ADVANCE_PAID"
                      checked={paymentDecision === "ADVANCE_PAID"}
                      onChange={() => setPaymentDecision("ADVANCE_PAID")}
                    />
                    <span>Advance Paid (Standard)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="decision"
                      value="APPROVED_CREDIT"
                      checked={paymentDecision === "APPROVED_CREDIT"}
                      onChange={() => setPaymentDecision("APPROVED_CREDIT")}
                    />
                    <span>Approved Credit</span>
                  </label>
                </div>
              </div>

              {paymentDecision === "ADVANCE_PAID" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground">Payment Channel</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground"
                      >
                        {PAYMENT_METHODS.map((method) => (
                          <option key={method} value={method}>{method}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground">Amount Paid (ETB)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={advancePaidAmount ?? ""}
                        onChange={(e) => setAdvancePaidAmount(e.target.value ? Number(e.target.value) : undefined)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground">Payment Reference (Slip / Trans ID)</label>
                    <input
                      type="text"
                      placeholder="e.g. TXN-89423910 or Receipt #104"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground font-mono"
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-medium text-foreground">Cashier Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Additional payment details or remarks..."
                  value={cashierNotes}
                  onChange={(e) => setCashierNotes(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  <span>{isSubmitting ? "Issuing..." : "Confirm & Issue Job Card"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return to Reception Modal */}
      {returnOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-foreground">Return Order to Reception</h3>
                <p className="text-xs text-muted-foreground font-mono">{returnOrder.code} · {returnOrder.clientName}</p>
              </div>
              <button
                type="button"
                onClick={() => setReturnOrder(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Return Reason</label>
                <textarea
                  rows={3}
                  placeholder="Explain why payment cannot be verified (e.g. invalid receipt, incorrect price calculation, wrong order specs)..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs text-foreground"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnOrder(null)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                >
                  <ArrowLeftRight size={14} />
                  <span>{isSubmitting ? "Returning..." : "Return to Reception"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
