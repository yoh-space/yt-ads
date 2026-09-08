import {
  Boxes,
  CircleDollarSign,
  Factory,
  FileBarChart,
  History,
  Inbox,
  LayoutDashboard,
  Scale,
  Settings,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface OwnerNavItem {
  href: string;
  label: string;
  english: string;
  icon: LucideIcon;
}

export const ownerNavItems: OwnerNavItem[] = [
  { href: "/dashboard/owner/overview", label: "ዋና ማዕከል", english: "Main Overview", icon: LayoutDashboard },
  { href: "/dashboard/owner/revenue", label: "ገቢ እና ትርፍ", english: "Revenue & Profit", icon: CircleDollarSign },
  { href: "/dashboard/owner/orders", label: "የደንበኛ ትዕዛዞች", english: "Orders", icon: Inbox },
  { href: "/dashboard/owner/machines", label: "የማሽን ሁኔታ", english: "Machine Status", icon: Factory },
  { href: "/dashboard/owner/inventory", label: "ክምችት ደረጃ", english: "Stock Levels", icon: Boxes },
  {
    href: "/dashboard/owner/reconciliation-clearance",
    label: "ክምችት ማረጋገጫ",
    english: "Reconciliation Clearance",
    icon: Scale,
  },
  { href: "/dashboard/owner/reports", label: "ሪፖርቶች", english: "Reports", icon: FileBarChart },
  { href: "/dashboard/owner/audit-logs", label: "የእንቅስቃሴ መዝገብ", english: "Audit Logs", icon: History },
  {
    href: "/dashboard/owner/operational-configuration",
    label: "የሥራ ማስተካከያ",
    english: "Operational Configuration",
    icon: SlidersHorizontal,
  },
  { href: "/dashboard/owner/team", label: "የሥራ ቡድን", english: "Team", icon: Users },
  { href: "/dashboard/owner/settings", label: "ማስተካከያ", english: "Settings", icon: Settings },
];