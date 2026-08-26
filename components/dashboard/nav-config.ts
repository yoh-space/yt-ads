import {
  Boxes,
  ClipboardList,
  Factory,
  LayoutDashboard,
  Scissors,
  FileBarChart,
  History,
  type LucideIcon,
} from "lucide-react";

export type View = "overview" | "inventory" | "jobs" | "machines" | "offcuts" | "reports" | "audit";
export type Modal =
  | "stock"
  | "job"
  | "offcut"
  | "scrap"
  | "material"
  | "machine"
  | "request"
  | null;

export const navItems: Array<{
  id: View;
  label: string;
  english: string;
  icon: LucideIcon;
}> = [
  { id: "overview", label: "ዋና ማዕከል", english: "Overview", icon: LayoutDashboard },
  { id: "inventory", label: "ክምችት", english: "Inventory", icon: Boxes },
  { id: "jobs", label: "የሥራ ካርዶች", english: "Job cards", icon: ClipboardList },
  { id: "machines", label: "ማሽኖች", english: "Machines", icon: Factory },
  { id: "offcuts", label: "ቅሪት እቃ", english: "Offcuts", icon: Scissors },
  { id: "reports", label: "ሪፖርቶች", english: "Reports", icon: FileBarChart },
  { id: "audit", label: "የእንቅስቃሴ መዝገብ", english: "Audit Log", icon: History },
];

export const baseUnitOptions = ["m²", "m", "pcs", "L"] as const;
export const purchaseUnitOptions = ["roll", "sheet", "pack", "liter", "piece"] as const;
export const unitOptions = ["m²", "m", "sheet", "piece", "pcs", "L"] as const;
