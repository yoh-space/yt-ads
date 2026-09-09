import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/dashboard/shell/workspace-shell";
import { managerNavItems } from "@/components/dashboard/roles/manager/manager-nav";

export const dynamic = "force-dynamic";

/**
 * Manager-only workspace layout. Renders the isolated role shell (sidebar,
 * topbar, loading and access guards) so manager routes are fully separated from
 * the owner/admin consoles. Authorization is enforced again inside every
 * manager query via `requireManagerRole`.
 */
export default function ManagerDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceShell
      roles={["manager"]}
      navItems={managerNavItems}
      brandLabel="Manager"
      consoleLabel="Manager console"
    >
      {children}
    </WorkspaceShell>
  );
}