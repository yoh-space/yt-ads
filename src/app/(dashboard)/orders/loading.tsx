import { InventoryLoader } from "@/components/dashboard/inventory-loader";

export default function OrdersLoading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <InventoryLoader label="Loading Customer Orders Queue…" />
    </div>
  );
}
