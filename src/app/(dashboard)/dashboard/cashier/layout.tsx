import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/dashboard/shell/workspace-shell";
import { cashierNavItems } from "@/components/dashboard/roles/cashier/cashier-nav";

export const dynamic = "force-dynamic";

/**
 * Cashier-only workspace layout. Renders the isolated payment verification shell.
 * Strict authorization enforced by Convex mutations and queries.
 */
export default function CashierDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceShell
      roles={["cashier"]}
      navItems={cashierNavItems}
      brandLabel="Cashier Desk"
      consoleLabel="Cashier payment console"
      iconName="circleDollarSign"
    >
      {children}
    </WorkspaceShell>
  );
}
