import {
  Boxes,
  ClipboardList,
  Factory,
  LayoutDashboard,
  Scissors,
  type LucideIcon,
} from "lucide-react";

export type View = "overview" | "inventory" | "jobs" | "machines" | "offcuts";
export type Modal =
  | "stock"
  | "job"
  | "offcut"
  | "scrap"
  | "material"
  | "machine"
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
];

export const unitOptions = ["m²", "m", "sheet", "piece", "L"] as const;
