import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { OPERATOR_ROLES, operatorNavItems } from "@/components/dashboard/operator/operator-nav";

export const dynamic = "force-dynamic";

/**
 * Operator-only machine workspace layout. Renders the isolated role shell over
 * every `/dashboard/operator/[machine]/*` child route. The shell gates access
 * to the four production operator roles; every namespace query/mutation
 * re-enforces the role and resolves the machine slug with `requireOperator`.
 */
export default async function OperatorMachineLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ machine: string }>;
}) {
  const { machine } = await params;
  return (
    <WorkspaceShell
      roles={OPERATOR_ROLES}
      navItems={operatorNavItems(machine.toLowerCase())}
      brandLabel="Operator"
      consoleLabel="Operator console"
    >
      {children}
    </WorkspaceShell>
  );
}