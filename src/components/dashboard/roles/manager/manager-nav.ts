import type { WorkspaceNavItem } from "@/components/dashboard/shell/workspace-shell";

export const managerNavItems: WorkspaceNavItem[] = [
  {
    href: "/dashboard/manager/overview",
    label: "Overview",
    english: "አጠቃላይ እይታ",
    icon: "layoutDashboard",
  },
  {
    href: "/dashboard/manager/orders",
    label: "Orders",
    english: "የደንበኞች ትእዛዞች",
    icon: "shoppingCart",
  },
  {
    href: "/dashboard/manager/jobs",
    label: "Job Cards",
    english: "የሥራ ካርዶች",
    icon: "clipboardList",
  },
  {
    href: "/dashboard/manager/machines",
    label: "Machines",
    english: "ማሽኖች",
    icon: "factory",
  },
  {
    href: "/dashboard/manager/inventory",
    label: "Inventory",
    english: "እቃዎች",
    icon: "boxes",
  },
  {
    href: "/dashboard/manager/settings",
    label: "Settings",
    english: "ቅንብሮች",
    icon: "settings",
  },
];