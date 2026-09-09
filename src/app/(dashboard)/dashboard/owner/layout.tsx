import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/dashboard/shell/workspace-shell";
import { ownerNavItems } from "@/components/dashboard/roles/owner/owner-nav";

export const dynamic = "force-dynamic";

/**
 * Owner-only workspace layout.
 *
 * Uses the shared WorkspaceShell (collapsible sidebar + unified topbar) so the
 * owner gets identical chrome to admin/manager while retaining full isolation:
 *  - `roles={["owner"]}` means any non-owner profile is hard-blocked by the
 *    shell before a single page component renders.
 *  - Every Convex query under /dashboard/owner/* calls `requireOwner` on the
 *    backend, giving defence-in-depth independent of this UI guard.
 */
export default function OwnerDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceShell
      roles={["owner"]}
      navItems={ownerNavItems}
      brandLabel="Owner"
      consoleLabel="Owner console"
      accessDeniedReason="This area is reserved for the owner's profile only."
    >
      {children}
    </WorkspaceShell>
  );
}
