"use client";

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { OrdersView } from "@/components/dashboard/views/orders";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { useSafeMutation } from "@/components/dashboard/pending-store";
import { useDashboardModal } from "@/components/dashboard/modal-context";
import { hasPermission } from "@/lib/permissions";
import type { CustomerOrder, CustomerOrderStatus, Machine, Material, Role } from "@/lib/operations-types";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  });
}

export default function ManagerOrdersPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const ordersQuery = useQuery(api.orders.list, profile?.active ? {} : "skip");

  const canViewMachines = Boolean(profile?.active && hasPermission(profile.role, "machine.view"));
  const canViewMaterials = Boolean(profile?.active && hasPermission(profile.role, "material.view"));

  const machinesQuery = useQuery(api.machines.list, canViewMachines ? {} : "skip");
  const materialsQuery = useQuery(api.materials.list, canViewMaterials ? {} : "skip");

  const { isPending, safeMutation } = useSafeMutation();
  const { openModal, setConvertOrderTarget } = useDashboardModal();

  const updateOrderStatus = useMutation(api.orders.setStatus);

  if (
    !profile ||
    ordersQuery === undefined ||
    (canViewMachines && machinesQuery === undefined) ||
    (canViewMaterials && materialsQuery === undefined)
  ) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading Customer Orders Queue…" />
      </div>
    );
  }

  const role: Role = profile.role;
  const orders = withIds(ordersQuery) as CustomerOrder[];
  const machines = withIds(machinesQuery ?? []) as Machine[];
  const materials = withIds(materialsQuery ?? []) as Material[];

  const canManage = hasPermission(role, "order.manage");
  const canCreateOrder = hasPermission(role, "order.create");

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Customer Intake & Fulfillment · የደንበኛ ማዘዣ"
        title="Customer Orders Queue"
        subtitle="Review client specifications, price orders, confirm payments, and issue job cards."
      />

      <OrdersView
        orders={orders}
        machines={machines}
        materials={materials}
        canManage={canManage}
        canCreateOrder={canCreateOrder}
        onConvert={(order) => setConvertOrderTarget(order)}
        onStatus={(orderId, status) => {
          void safeMutation(
            `order-status-${orderId}`,
            updateOrderStatus({
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
  );
}