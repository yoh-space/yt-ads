import type { WorkspaceNavItem } from "@/components/dashboard/shell/workspace-shell";

export const cashierNavItems: WorkspaceNavItem[] = [
  {
    href: "/dashboard/cashier",
    label: "Payment Queue",
    english: "የክፍያ ማረጋገጫ",
    icon: "walletCards",
  },
  {
    href: "/dashboard/cashier/settings",
    label: "Settings",
    english: "ማስተካከያ",
    icon: "settings",
  },
];
