import type { WorkspaceNavItem } from "@/components/dashboard/workspace-shell";
import type { Role } from "@/lib/operations-types";

export const OPERATOR_ROLES: Role[] = ["laser_operator", "cnc_operator", "plotter_operator", "printer_operator"];

/**
 * Operator workspace navigation. All operator routes live under the machine
 * segment (`/dashboard/operator/<machine>/...`); inventory/substock and
 * settings stay flat per the routing conflict rule, so those items point at
 * the shared flat routes.
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
      href: `${base}/reconciliation`,
      label: "Reconciliation",
      english: "ማስታረቅ",
      icon: "scale",
    },
    {
      href: "/settings",
      label: "Settings",
      english: "ቅንብሮች",
      icon: "settings",
    },
  ];
}