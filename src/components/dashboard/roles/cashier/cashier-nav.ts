import type { WorkspaceNavItem } from "@/components/dashboard/shell/workspace-shell";

export const cashierNavItems: WorkspaceNavItem[] = [
  {
    href: "/dashboard/cashier/overview",
    label: "Payment Queue",
    english: "የክፍያ ወረፋ",
    icon: "circleDollarSign",
  },
  {
    href: "/dashboard/cashier/settings",
    label: "Settings",
    english: "ማስተካከያ",
    icon: "settings",
  },
];
