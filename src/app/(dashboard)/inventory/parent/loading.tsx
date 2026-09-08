import { InventoryLoader } from "@/components/dashboard/inventory-loader";

export default function ParentInventoryLoading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <InventoryLoader label="Loading Central Packaging Inventory…" />
    </div>
  );
}
