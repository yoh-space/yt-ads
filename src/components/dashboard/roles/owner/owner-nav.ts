import type { WorkspaceNavItem } from "@/components/dashboard/shell/workspace-shell";

export const ownerNavItems: WorkspaceNavItem[] = [
  // Overview
  { href: "/dashboard/owner/overview",                  label: "ዋና ማዕከል",      english: "Main Overview",              icon: "layoutDashboard",   section: "Overview" },
  { href: "/dashboard/owner/revenue",                   label: "ገቢ እና ትርፍ",    english: "Revenue & Profit",           icon: "circleDollarSign",  section: "Overview" },

  // Operations
  { href: "/dashboard/owner/orders",                    label: "የደንበኛ ትዕዛዞች", english: "Orders",                     icon: "inbox",              section: "Operations" },
  { href: "/dashboard/owner/machines",                  label: "የማሽን ሁኔታ",    english: "Machine Status",             icon: "factory",            section: "Operations" },
  { href: "/dashboard/owner/inventory",                 label: "ክምችት ደረጃ",    english: "Stock Levels",               icon: "boxes",              section: "Operations" },
  { href: "/dashboard/owner/reconciliation-clearance",  label: "ክምችት ማረጋገጫ",  english: "Reconciliation Clearance",   icon: "scale",              section: "Operations" },

  // Insights
  { href: "/dashboard/owner/reports",                   label: "ሪፖርቶች",        english: "Reports",                    icon: "fileBarChart",       section: "Insights" },
  { href: "/dashboard/owner/audit-logs",                label: "የእንቅስቃሴ መዝገብ", english: "Audit Logs",                 icon: "history",            section: "Insights" },

  // Configuration
  { href: "/dashboard/owner/operational-configuration", label: "የሥራ ማስተካከያ",  english: "Operational Configuration", icon: "slidersHorizontal", section: "Configuration" },

  // Administration
  { href: "/dashboard/owner/team",                      label: "የሥራ ቡድን",      english: "Team",                       icon: "users",              section: "Administration" },
  { href: "/dashboard/owner/settings",                  label: "ማስተካከያ",        english: "Settings",                   icon: "settings",           section: "Administration" },
];

