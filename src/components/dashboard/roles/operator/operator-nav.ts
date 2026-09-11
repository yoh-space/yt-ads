import type { WorkspaceNavItem } from "@/components/dashboard/shell/workspace-shell";
import type { Role } from "@/lib/operations-types";
import { CANONICAL_OPERATOR_ROLES } from "@/shared/production-manifest";

export const OPERATOR_ROLES: Role[] = [...CANONICAL_OPERATOR_ROLES];

/**
 * Operator workspace navigation. All operator routes live under the machine
 * segment (`/dashboard/operator/<machine>/...`); every route including settings
 * is wrapped by the machine-scoped shell for consistent header and sidebar.
 */
export function operatorNavItems(machineSlug: string): WorkspaceNavItem[] {
  const base = `/dashboard/operator/${machineSlug}`;
  return [
    {
      href: `${base}/overview`,
      label: "Overview",
      english: "ዋና ማዕከል",
      icon: "layoutDashboard",
    },
    {
      href: `${base}/jobs`,
      label: "Jobs",
      english: "የሥራ ካርዶች",
      icon: "clipboardList",
    },
    {
      href: `${base}/inventory`,
      label: "Machine Stock",
      english: "የማሽን ዕቃ",
      icon: "boxes",
    },
    {
      href: `${base}/requests`,
      label: "Requests",
      english: "የዕቃ ጥያቄዎች",
      icon: "inbox",
    },
    {
      href: `${base}/reconciliation`,
      label: "Reconciliation",
      english: "ማስታረቅ",
      icon: "scale",
    },
    {
      href: `${base}/settings`,
      label: "Settings",
      english: "ቅንብሮች",
      icon: "settings",
    },
  ];
}
