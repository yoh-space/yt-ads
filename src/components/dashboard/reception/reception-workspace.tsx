"use client";

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Inbox, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useDashboardModal } from "@/components/dashboard/modal-context";
import { useSafeMutation } from "@/components/dashboard/pending-store";
import { OrdersView } from "@/components/dashboard/views/orders";
import { hasPermission } from "@/lib/permissions";
import type { CustomerOrder, CustomerOrderStatus, Machine, Material, Profile, Role } from "@/lib/operations-types";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map(({ _id, ...rest }) => ({ ...rest, id: _id }));
}

export default function ReceptionWorkspace({
  profile,
  ordersQuery,
}: {
  profile: Pick<Profile, "role" | "active">;
  ordersQuery: Array<{ _id: string; [key: string]: unknown }>;
}) {
  const role: Role = profile.role;
  const { openModal, setConvertOrderTarget } = useDashboardModal();
  const { isPending, safeMutation } = useSafeMutation();

  const canViewMachines = Boolean(profile.active && hasPermission(role, "machine.view"));
  const canViewMaterials = Boolean(profile.active && hasPermission(role, "material.view"));

  const machinesQuery = useQuery(api.machines.list, canViewMachines ? {} : "skip");
  const materialsQuery = useQuery(api.materials.list, canViewMaterials ? {} : "skip");

  const updateOrderStatus = useMutation(api.orders.setStatus);

  if (
    ordersQuery === undefined ||
    (canViewMachines && machinesQuery === undefined) ||
    (canViewMaterials && materialsQuery === undefined)
  ) {
    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-4 border-b border-border-token pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-primary/30 bg-brand-primary-bg px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand-primary-light">
              <Inbox size={12} /> Reception Order Desk
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-text-primary">
              የደንበኛ ትዕዛዝ ወረፋ <span className="text-brand-primary-light">(Orders Queue)</span>
            </h1>
            <p className="mt-2 text-sm text-text-secondary">የትዕዛዝ ዝርዝር መመልከት እና ዋጋ ማስቀመጥ</p>
          </div>
        </header>
        <div className="flex min-h-[320px] items-center justify-center">
          <span className="font-mono text-xs text-text-dim">Loading reception orders queue…</span>
        </div>
      </div>
    );
  }

  const orders = withIds(ordersQuery) as CustomerOrder[];
  const machines = withIds(machinesQuery ?? []) as Machine[];
  const materials = withIds(materialsQuery ?? []) as Material[];

  const canManage = hasPermission(role, "order.manage");
  const canCreateOrder = hasPermission(role, "order.create");

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border-token pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-primary/30 bg-brand-primary-bg px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand-primary-light">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-status-success" />
            </span>
            Reception Order Desk
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-text-primary">
            የደንበኛ ትዕዛዝ ወረፋ <span className="text-brand-primary-light">(Orders Queue)</span>
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            የትዕዛዝ ዝርዝር ይመልከቱ፣ ዋጋ ያስቀምጡ እና ክፍያ ያረጋግጡ — ሙሉ የአስተዳዳሪ ትዕዛዝ ወረፋ
          </p>
        </div>
        {canCreateOrder ? (
          <button
            type="button"
            onClick={() => openModal("order")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-primary to-brand-primary-light px-5 py-3 text-sm font-extrabold text-main shadow-brand-glow transition hover:brightness-110"
          >
            <Plus size={16} /> አዲስ ትዕዛዝ
          </button>
        ) : null}
      </header>

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

