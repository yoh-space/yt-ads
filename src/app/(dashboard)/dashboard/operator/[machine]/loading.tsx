import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";

export default function OperatorMachineLoading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <InventoryLoader label="የኦፕሬተር ገጽ በመጫን ላይ…" />
    </div>
  );
}
