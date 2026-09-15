import { PenTool } from "lucide-react";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";

export default function DesignerDashboardPage() {
  return (
    <Panel>
      <PanelHeader
        title="Design Tasks"
        subtitle="Assigned customer artwork and production-ready submissions."
        kicker="Designer"
        icon={<PenTool size={16} />}
      />
      <div className="p-6 text-sm text-muted-foreground">
        The assigned design-task queue will be enabled in the designer workflow phase.
      </div>
    </Panel>
  );
}
