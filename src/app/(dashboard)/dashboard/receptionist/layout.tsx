import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { receptionistNavItems } from "@/components/dashboard/receptionist/receptionist-nav";

export const dynamic = "force-dynamic";

/**
 * Receptionist-only workspace layout. Renders the isolated role shell (sidebar,
 * topbar, loading and access guards) so the desk never sees the operation
 * consoles. Authorization is enforced again inside every receptionist query via
 * `requireReceptionist`.
 */
export default function ReceptionistDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceShell
      roles={["receptionist"]}
      navItems={receptionistNavItems}
      brandLabel="Reception"
      consoleLabel="Reception console"
    >
      {children}
    </WorkspaceShell>
  );
}