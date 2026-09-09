"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { OrdersView, OrderConfirmModal, OrderPriceModal } from "@/components/dashboard/roles/common/orders";
import { useSafeMutation } from "@/utils/pending-store";
import { useDashboardModal } from "@/components/dashboard/modals/modal-context";
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
  const { openModal } = useDashboardModal();

  const setOrderStatus = useMutation(api.receptionist.orders.setStatus);
  const priceOrder = useMutation(api.receptionist.orders.priceOrder);
  const confirmOrderAndIssueJobCard = useMutation(api.orders.confirmOrderAndIssueJobCard);

  const [priceTarget, setPriceTarget] = useState<CustomerOrder | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<CustomerOrder | null>(null);

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
          onCreateOrder={() => openModal("order")}
          isPending={isPending}
        />
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
    </>
  );
}