import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/dashboard/shell/workspace-shell";
import { adminNavItems } from "@/components/dashboard/roles/admin/admin-nav";

export const dynamic = "force-dynamic";

/**
 * Admin-only workspace layout. Renders the isolated role shell (sidebar,
 * topbar, loading and access guards) so admin routes are fully separated from
 * the owner console. Authorization is enforced again inside every admin query
 * via `requireAdminRole`.
 */
export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceShell
      roles={["admin"]}
      navItems={adminNavItems}
      brandLabel="Admin"
      consoleLabel="Admin console"
    >
      {children}
    </WorkspaceShell>
  );
}