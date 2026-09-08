import { Boxes, ClipboardList, Factory, LayoutDashboard, Settings, ShoppingCart } from "lucide-react";
import type { WorkspaceNavItem } from "@/components/dashboard/workspace-shell";

export const managerNavItems: WorkspaceNavItem[] = [
  {
    href: "/dashboard/manager/overview",
    label: "Overview",
    english: "አጠቃላይ እይታ",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/manager/orders",
    label: "Orders",
    english: "የእቃ ማዘዣዎች",
    icon: ShoppingCart,
  },
  {
    href: "/dashboard/manager/jobs",
    label: "Job Cards",
    english: "የሥራ ካርዶች",
    icon: ClipboardList,
  },
  {
    href: "/dashboard/manager/machines",
    label: "Machines",
    english: "ማሽኖች",
    icon: Factory,
  },
  {
    href: "/dashboard/manager/inventory",
    label: "Inventory",
    english: "እቃዎች",
    icon: Boxes,
  },
  {
    href: "/dashboard/manager/settings",
    label: "Settings",
    english: "ቅንብሮች",
    icon: Settings,
  },
];