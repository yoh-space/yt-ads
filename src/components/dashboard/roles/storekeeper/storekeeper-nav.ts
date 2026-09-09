import type { WorkspaceNavItem } from "@/components/dashboard/shell/workspace-shell";

export const storekeeperNavItems: WorkspaceNavItem[] = [
  {
    href: "/dashboard/storekeeper/overview",
    label: "Overview",
    english: "አጠቃላይ እይታ",
    icon: "layoutDashboard",
  },
  {
    href: "/dashboard/storekeeper/inventory",
    label: "Inventory",
    english: "የዋና እቃ ግምጃ ቤት",
    icon: "boxes",
  },
  {
    href: "/dashboard/storekeeper/requisitions",
    label: "Requisitions",
    english: "የዕቃ ጥያቄዎች",
    icon: "clipboardList",
  },
  {
    href: "/dashboard/storekeeper/reconciliation",
    label: "Reconciliation",
    english: "ማስታረቅ",
    icon: "scale",
  },
  {
    href: "/dashboard/storekeeper/settings",
    label: "Settings",
    english: "ቅንብሮች",
    icon: "settings",
  },
];