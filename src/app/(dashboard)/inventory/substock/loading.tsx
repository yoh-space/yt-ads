import { InventoryLoader } from "@/components/dashboard/inventory-loader";

export default function SubstockLoading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <InventoryLoader label="Loading Floor Sub-Stock…" />
    </div>
  );
}
