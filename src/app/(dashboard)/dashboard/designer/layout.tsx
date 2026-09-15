import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/dashboard/shell/workspace-shell";
import { designerNavItems } from "@/components/dashboard/roles/designer/designer-nav";
import { Scissors } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Designer-only workspace layout. Renders the design task and submission workspace.
 */
export default function DesignerDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceShell
      roles={["designer"]}
      navItems={designerNavItems}
      brandLabel="Design Studio"
      consoleLabel="Designer workspace"
      icon={Scissors}
    >
      {children}
    </WorkspaceShell>
  );
}
