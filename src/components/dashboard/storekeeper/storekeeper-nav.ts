import { Boxes, ClipboardList, LayoutDashboard, Scale, Settings } from "lucide-react";
import type { WorkspaceNavItem } from "@/components/dashboard/workspace-shell";

export const storekeeperNavItems: WorkspaceNavItem[] = [
  {
    href: "/dashboard/storekeeper/overview",
    label: "Overview",
    english: "አጠቃላይ እይታ",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/storekeeper/inventory",
    label: "Inventory",
    english: "የዋና እቃ ግምጃ ቤት",
    icon: Boxes,
  },
  {
    href: "/dashboard/storekeeper/requisitions",
    label: "Requisitions",
    english: "የዕቃ ጥያቄዎች",
    icon: ClipboardList,
  },
  {
    href: "/dashboard/storekeeper/reconciliation",
    label: "Reconciliation",
    english: "ማስታረቅ",
    icon: Scale,
  },
  {
    href: "/dashboard/storekeeper/settings",
    label: "Settings",
    english: "ቅንብሮች",
    icon: Settings,
  },
];