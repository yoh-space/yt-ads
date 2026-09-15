import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/dashboard/shell/workspace-shell";
import { cashierNavItems } from "@/components/dashboard/roles/cashier/cashier-nav";

export const dynamic = "force-dynamic";

export default function CashierDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceShell
      roles={["cashier"]}
      navItems={cashierNavItems}
      brandLabel="Cashier"
      consoleLabel="Payment console"
    >
      {children}
    </WorkspaceShell>
  );
}
