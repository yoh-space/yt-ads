import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { storekeeperNavItems } from "@/components/dashboard/storekeeper/storekeeper-nav";

export const dynamic = "force-dynamic";

/**
 * Storekeeper-only workspace layout. Renders the isolated role shell (sidebar,
 * topbar, loading and access guards) so storekeeper routes are fully separated
 * from the management workspaces. Authorization is enforced again inside every
 * storekeeper query via `requireStorekeeper`.
 */
export default function StorekeeperDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceShell
      roles={["storekeeper"]}
      navItems={storekeeperNavItems}
      brandLabel="Storekeeper"
      workspaceTitle="የመጋዘን ቁጥጥር"
      consoleLabel="Storekeeper console"
    >
      {children}
    </WorkspaceShell>
  );
}