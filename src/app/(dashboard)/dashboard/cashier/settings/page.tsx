import { Panel, PanelHeader } from "@/components/shared/ui/panel";

export default function CashierSettingsPage() {
  return (
    <Panel>
      <PanelHeader title="Cashier Settings" subtitle="Payment-desk preferences will be configured in the cashier workflow phase." />
      <div className="p-6 text-sm text-muted-foreground">No cashier-specific settings are available yet.</div>
    </Panel>
  );
}
