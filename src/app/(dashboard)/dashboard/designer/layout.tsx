import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/dashboard/shell/workspace-shell";
import { designerNavItems } from "@/components/dashboard/roles/designer/designer-nav";

export const dynamic = "force-dynamic";

export default function DesignerDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceShell
      roles={["designer"]}
      navItems={designerNavItems}
      brandLabel="Design"
      consoleLabel="Design console"
    >
      {children}
    </WorkspaceShell>
  );
}
