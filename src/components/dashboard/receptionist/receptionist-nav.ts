import { LayoutDashboard, Settings, ShoppingCart } from "lucide-react";
import type { WorkspaceNavItem } from "@/components/dashboard/workspace-shell";

export const receptionistNavItems: WorkspaceNavItem[] = [
  {
    href: "/dashboard/receptionist/overview",
    label: "Overview",
    english: "አጠቃላይ እይታ",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/receptionist/orders",
    label: "Orders",
    english: "የደንበኞች ትዛዞች",
    icon: ShoppingCart,
  },
  {
    href: "/dashboard/receptionist/settings",
    label: "Settings",
    english: "ማስተካከያ",
    icon: Settings,
  },
];