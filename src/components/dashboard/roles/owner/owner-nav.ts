import type { WorkspaceNavItem } from "@/components/dashboard/shell/workspace-shell";

export const ownerNavItems: WorkspaceNavItem[] = [
  { href: "/dashboard/owner/overview",                  label: "ዋና ማዕከል",      english: "Main Overview",              icon: "layoutDashboard" },
  { href: "/dashboard/owner/revenue",                   label: "ገቢ እና ትርፍ",    english: "Revenue & Profit",           icon: "circleDollarSign" },
  { href: "/dashboard/owner/orders",                    label: "የደንበኛ ትዕዛዞች", english: "Orders",                     icon: "inbox" },
  { href: "/dashboard/owner/machines",                  label: "የማሽን ሁኔታ",    english: "Machine Status",             icon: "factory" },
  { href: "/dashboard/owner/inventory",                 label: "ክምችት ደረጃ",    english: "Stock Levels",               icon: "boxes" },
  { href: "/dashboard/owner/reconciliation-clearance",  label: "ክምችት ማረጋገጫ",  english: "Reconciliation Clearance",   icon: "scale" },
  { href: "/dashboard/owner/reports",                   label: "ሪፖርቶች",        english: "Reports",                    icon: "fileBarChart" },
  { href: "/dashboard/owner/audit-logs",                label: "የእንቅስቃሴ መዝገብ", english: "Audit Logs",                 icon: "history" },
  { href: "/dashboard/owner/operational-configuration", label: "የሥራ ማስተካከያ",  english: "Operational Configuration", icon: "slidersHorizontal" },
  { href: "/dashboard/owner/team",                      label: "የሥራ ቡድን",      english: "Team",                       icon: "users" },
  { href: "/dashboard/owner/settings",                  label: "ማስተካከያ",        english: "Settings",                   icon: "settings" },
];
