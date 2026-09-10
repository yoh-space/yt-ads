"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { OrdersView, OrderConfirmModal, OrderPriceModal } from "@/components/dashboard/roles/common/orders";
import { OrderCreateModal, type NewOrderInput } from "@/components/dashboard/modals/order-create-modal";
import { useSafeMutation } from "@/utils/pending-store";
import { hasPermission } from "@/lib/permissions";
import type { CustomerOrder, CustomerOrderStatus, Machine, Material, Role } from "@/lib/operations-types";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map(({ _id, ...rest }) => ({ ...rest, id: _id }));
}

export default function ReceptionistOrdersPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const ordersQuery = useQuery(api.receptionist.orders.list, profile?.active ? {} : "skip");

  const { isPending, safeMutation } = useSafeMutation();

  const setOrderStatus = useMutation(api.receptionist.orders.setStatus);
  const priceOrder = useMutation(api.receptionist.orders.priceOrder);
  const confirmOrderAndIssueJobCard = useMutation(api.orders.confirmOrderAndIssueJobCard);
  const settleOrder = useMutation(api.orders.settleOrder);
  const createWalkIn = useMutation(api.receptionist.orders.createWalkIn);

  const [priceTarget, setPriceTarget] = useState<CustomerOrder | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<CustomerOrder | null>(null);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [settlement, setSettlement] = useState<{ id: string; code: string; amount: number } | null>(null);
  const [settlementMethod, setSettlementMethod] = useState("Cash");
  const [settlementReference, setSettlementReference] = useState("");

  if (!profile || ordersQuery === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading Reception Orders Queue…" />
      </div>
    );
  }

  const role: Role = profile.role;
  const orders = withIds(ordersQuery) as CustomerOrder[];
  const machines: Machine[] = [];
  const materials: Material[] = [];

  const canManage = hasPermission(role, "order.manage");
  const canCreateOrder = hasPermission(role, "order.create");

  return (
    <>
      <div className="space-y-6">
        <WorkspacePageHeader
          kicker="Reception Desk · የተቀበል ዴስክ"
          title="Customer Orders Queue"
          subtitle="Register walk-ins, price orders, confirm payment, and issue job cards."
        />

        <OrdersView
          orders={orders}
          machines={machines}
          materials={materials}
          canManage={canManage}
          canCreateOrder={canCreateOrder}
          onConvert={(order) => {
            if (order.status === "PENDING_REVIEW") {
              setPriceTarget(order);
            } else if (order.status === "PRICED_AND_PENDING_PAYMENT") {
              setConfirmTarget(order);
            }
          }}
          onStatus={(orderId, status) => {
            void safeMutation(
              `receptionist-order-status-${orderId}`,
              setOrderStatus({
                orderId: orderId as Id<"customerOrders">,
                status: status as CustomerOrderStatus,
              }),
              () => toast.success(`Order status changed to ${status}`),
            );
          }}
          onCreateOrder={() => setCreateOrderOpen(true)}
          isPending={isPending}
        />
        {orders.some((order) => order.status === "READY_FOR_PICKUP" && order.paymentStatus !== "FULLY_PAID") ? <div className="rounded-xl border border-gold/30 bg-gold/5 p-4"><p className="mb-3 text-sm font-semibold text-foreground">Pickup settlement queue</p><div className="space-y-2">{orders.filter((order) => order.status === "READY_FOR_PICKUP" && order.paymentStatus !== "FULLY_PAID").map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"><div><p className="text-xs font-semibold text-foreground">{order.code} · {order.clientName}</p><p className="text-[11px] text-muted-foreground">Remaining balance: {(order.remainingDueAmount ?? order.amount ?? 0).toFixed(2)} ETB</p></div><button type="button" onClick={() => setSettlement({ id: order.id, code: order.code, amount: order.remainingDueAmount ?? order.amount ?? 0 })} className="rounded-md bg-primary px-3 py-2 text-[11px] font-semibold text-white">Record final payment</button></div>)}</div></div> : null}
      </div>

      {priceTarget ? (
        <OrderPriceModal
          order={priceTarget}
          onClose={() => setPriceTarget(null)}
          onSave={(amount) =>
            safeMutation(
              `receptionist-price-${priceTarget.id}`,
              priceOrder({
                orderId: priceTarget.id as Id<"customerOrders">,
                amount,
              }).then((result) => {
                setPriceTarget(null);
                return result;
              }),
              () => toast.success(`${priceTarget.code} priced · awaiting payment`),
            )
          }
        />
      ) : null}
      {confirmTarget ? (
        <OrderConfirmModal
          order={confirmTarget}
          machines={machines}
          materials={materials}
          onClose={() => setConfirmTarget(null)}
          onSave={(input) =>
            safeMutation(
              `receptionist-confirm-${confirmTarget.id}`,
              confirmOrderAndIssueJobCard({
                orderId: confirmTarget.id as Id<"customerOrders">,
                paymentDecision: input.paymentDecision,
                paymentMethod: input.paymentMethod,
                advancePaidAmount: input.advancePaidAmount,
                priority: input.priority,
              }).then((result) => {
                setConfirmTarget(null);
                return result;
              }),
              () => toast.success("Order confirmed · job card issued"),
            )
          }
        />
      ) : null}
      {createOrderOpen ? (
        <OrderCreateModal
          onClose={() => setCreateOrderOpen(false)}
          onSave={(input: NewOrderInput) => {
            void safeMutation(
              "receptionist-create-order",
              createWalkIn(input).then((result) => {
                setCreateOrderOpen(false);
                return result;
              }),
              (result) => toast.success(`${result.code} created and added to the reception queue`),
            );
          }}
        />
      ) : null}
      {settlement ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"><h2 className="text-base font-semibold text-foreground">Settle {settlement.code}</h2><p className="mt-1 text-xs text-muted-foreground">Exact remaining balance: {settlement.amount.toFixed(2)} ETB</p><label className="mt-4 block text-xs text-muted-foreground">Payment method<select value={settlementMethod} onChange={(event) => setSettlementMethod(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground"><option>Cash</option><option>CBE</option><option>BOA</option><option>Telebirr</option><option>CBE Birr</option></select></label><label className="mt-3 block text-xs text-muted-foreground">Reference (optional)<input value={settlementReference} onChange={(event) => setSettlementReference(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setSettlement(null)} className="rounded-md border border-border px-4 py-2 text-xs">Cancel</button><button type="button" onClick={() => { void safeMutation(`settle-${settlement.id}`, settleOrder({ orderId: settlement.id as Id<"customerOrders">, amount: settlement.amount, paymentMethod: settlementMethod, paymentReference: settlementReference || undefined }).then((result) => { setSettlement(null); return result; }), () => toast.success(`${settlement.code} fully paid`)); }} className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white">Confirm settlement</button></div></div></div> : null}
    </>
  );
}
