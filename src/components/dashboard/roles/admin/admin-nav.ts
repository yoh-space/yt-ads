import type { WorkspaceIconName } from "@/components/dashboard/shell/workspace-shell";

export interface AdminNavItem {
  href: string;
  label: string;
  english: string;
  icon: WorkspaceIconName;
}

export const adminNavItems: AdminNavItem[] = [
  { href: "/dashboard/admin/overview", label: "ዋና ማዕከል", english: "Overview", icon: "layoutDashboard" },
  { href: "/dashboard/admin/orders", label: "የደንበኛ ትዕዛዞች", english: "Orders", icon: "inbox" },
  { href: "/dashboard/admin/jobs", label: "የሥራ ካርዶች", english: "Job Cards", icon: "folderKanban" },
  { href: "/dashboard/admin/machines", label: "ማሽኖች", english: "Machines", icon: "factory" },
  { href: "/dashboard/admin/inventory", label: "ክምችት", english: "Stock Levels", icon: "boxes" },
  { href: "/dashboard/admin/reconciliation", label: "ክምችት ማረጋገጫ", english: "Reconciliation", icon: "scale" },
  { href: "/dashboard/admin/reports", label: "ሪፖርቶች", english: "Reports", icon: "fileBarChart" },
  {
    href: "/dashboard/admin/config",
    label: "የሥራ ማስተካከያ",
    english: "Operational Configuration",
    icon: "slidersHorizontal",
  },
  { href: "/dashboard/admin/settings", label: "ማስተካከያ", english: "Settings", icon: "settings" },
];