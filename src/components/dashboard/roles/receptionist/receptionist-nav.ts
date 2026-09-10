import type { WorkspaceNavItem } from "@/components/dashboard/shell/workspace-shell";

export const receptionistNavItems: WorkspaceNavItem[] = [
  {
    href: "/dashboard/receptionist/overview",
    label: "Overview",
    english: "አጠቃላይ እይታ",
    icon: "layoutDashboard",
  },
  {
    href: "/dashboard/receptionist/orders",
    label: "Orders",
    english: "የደንበኞች ትዛዞች",
    icon: "shoppingCart",
  },
  {
    href: "/dashboard/receptionist/jobs",
    label: "Job Cards",
    english: "የሥራ ካርዶች",
    icon: "clipboardList",
  },
  {
    href: "/dashboard/receptionist/settings",
    label: "Settings",
    english: "ማስተካከያ",
    icon: "settings",
  },
];
