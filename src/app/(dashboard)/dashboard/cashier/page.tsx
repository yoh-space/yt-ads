import { WalletCards } from "lucide-react";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";

export default function CashierDashboardPage() {
  return (
    <Panel>
      <PanelHeader
        title="Payment Queue"
        subtitle="Orders priced by reception and waiting for payment verification."
        kicker="Cashier"
        icon={<WalletCards size={16} />}
      />
      <div className="p-6 text-sm text-muted-foreground">
        The payment verification queue will be enabled in the cashier workflow phase.
      </div>
    </Panel>
  );
}
