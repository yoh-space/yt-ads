import { MATERIAL_SPECIFICATIONS } from "@/shared/material-specifications";
import {
  Boxes,
  ClipboardList,
  Inbox,
  Factory,
  LayoutDashboard,
  Scissors,
  FileBarChart,
  History,
  type LucideIcon,
} from "lucide-react";

export type View = "overview" | "orders" | "inventory" | "jobs" | "machines" | "offcuts" | "reports" | "audit";
export type Modal =
  | "stock"
  | "job"
  | "offcut"
  | "scrap"
  | "material"
  | "machine"
  | "request"
  | "exception"
  | null;

export const navItems: Array<{
  id: View;
  label: string;
  english: string;
  icon: LucideIcon;
}> = [
  { id: "overview", label: "ዋና ማዕከል", english: "Overview", icon: LayoutDashboard },
  { id: "orders", label: "የደንበኛ ትዕዛዞች", english: "Orders Queue", icon: Inbox },
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
export const materialDefinitionOptions = MATERIAL_SPECIFICATIONS.map((material) => material.name);
export const neonLightColorOptions = MATERIAL_SPECIFICATIONS.find((material) => material.name === "Neon Light")?.specificationOptions ?? [];
export const bannerRollOptions = MATERIAL_SPECIFICATIONS.find((material) => material.name === "Banner")?.specificationOptions ?? [];
export const foamThicknessOptions = MATERIAL_SPECIFICATIONS.find((material) => material.name === "Foam")?.specificationOptions ?? [];
export const micaFinishOptions = MATERIAL_SPECIFICATIONS.find((material) => material.name === "Mica Sheet")?.specificationOptions ?? [];
export const acrylicThicknessOptions = MATERIAL_SPECIFICATIONS.find((material) => material.name === "Acrylic")?.specificationOptions ?? [];
export const canvasRollOptions = MATERIAL_SPECIFICATIONS.find((material) => material.name === "Canvas (Canva)")?.specificationOptions ?? [];
export const machineInkOptions = MATERIAL_SPECIFICATIONS.find((material) => material.name === "DTF Ink")?.specificationOptions ?? [];
export const powerSupplyWattageOptions = MATERIAL_SPECIFICATIONS.find((material) => material.name === "Power Supply")?.specificationOptions ?? [];
export const ledColorOptions = MATERIAL_SPECIFICATIONS.find((material) => material.name === "LED Module / Strip")?.specificationOptions ?? [];
export const zocoloHeightOptions = MATERIAL_SPECIFICATIONS.find((material) => material.name === "Zocolo (Base / Skirting)")?.specificationOptions ?? [];
