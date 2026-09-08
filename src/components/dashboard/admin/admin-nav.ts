import {
  Boxes,
  Factory,
  FileBarChart,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  Scale,
  Settings,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  english: string;
  icon: LucideIcon;
}

export const adminNavItems: AdminNavItem[] = [
  { href: "/dashboard/admin/overview", label: "ዋና ማዕከል", english: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/admin/orders", label: "የደንበኛ ትዕዛዞች", english: "Orders", icon: Inbox },
  { href: "/dashboard/admin/jobs", label: "የሥራ ካርዶች", english: "Job Cards", icon: FolderKanban },
  { href: "/dashboard/admin/machines", label: "ማሽኖች", english: "Machines", icon: Factory },
  { href: "/dashboard/admin/inventory", label: "ክምችት", english: "Stock Levels", icon: Boxes },
  { href: "/dashboard/admin/reconciliation", label: "ክምችት ማረጋገጫ", english: "Reconciliation", icon: Scale },
  { href: "/dashboard/admin/reports", label: "ሪፖርቶች", english: "Reports", icon: FileBarChart },
  {
    href: "/dashboard/admin/config",
    label: "የሥራ ማስተካከያ",
    english: "Operational Configuration",
    icon: SlidersHorizontal,
  },
  { href: "/dashboard/admin/settings", label: "ማስተካከያ", english: "Settings", icon: Settings },
];