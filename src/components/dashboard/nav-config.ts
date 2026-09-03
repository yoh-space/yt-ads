import { MATERIAL_SPECIFICATIONS } from "@/shared/material-specifications";
import type { Role } from "@/lib/operations-types";
import {
  Boxes,
  ClipboardList,
  Inbox,
  Factory,
  LayoutDashboard,
  Scissors,
  FileBarChart,
  History,
  CircleDollarSign,
  Settings,
  Scale,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export type View = "overview" | "orders" | "inventory" | "jobs" | "machines" | "offcuts" | "reports" | "reconciliation" | "audit" | "financial" | "config" | "settings";
export type Modal =
  | "stock"
  | "job"
  | "offcut"
  | "scrap"
  | "material"
  | "machine"
  | "request"
  | "exception"
  | "order"
  | "reconciliation"
  | null;

export type SettingsCategory = "profile" | "security" | "team" | "company";

export const roleVisibleViews: Record<Role, View[]> = {
  owner: ["overview", "orders", "inventory", "jobs", "reports", "reconciliation", "audit", "financial", "config", "settings"],
  manager: ["overview", "orders", "inventory", "jobs", "machines", "offcuts", "reports", "reconciliation", "audit", "settings"],
  admin: ["overview", "orders", "inventory", "jobs", "machines", "offcuts", "reports", "reconciliation", "audit", "config", "settings"],
  storekeeper: ["overview", "orders", "inventory", "jobs", "machines", "offcuts", "reconciliation", "audit", "settings"],
  receptionist: ["orders"],
  laser_operator: ["jobs", "machines", "offcuts", "settings"],
  cnc_operator: ["jobs", "machines", "offcuts", "settings"],
  plotter_operator: ["jobs", "machines", "offcuts", "settings"],
  printer_operator: ["jobs", "machines", "offcuts", "settings"],
};

export function canAccessView(role: Role, view: View) {
  return roleVisibleViews[role].includes(view);
}

export function defaultViewForRole(role: Role): View {
  return ROLE_WORKSPACE[role].view;
}

/**
 * Desktop workspace landing mapping. Each staff role is redirected to a
 * dedicated workspace when the Tauri shell signs in, mirroring the role-scoped
 * routing described for the desktop build. Keep in sync with roleVisibleViews.
 */
export const ROLE_WORKSPACE: Record<Role, { view: View; label: string; english: string }> = {
  owner: { view: "overview", label: "የባለቤት የፋይናንስ እና የክምችት ኦዲት", english: "Owner Analytics & Control" },
  manager: { view: "overview", label: "የማኔጀር ማዕከል", english: "Manager Analytics" },
  admin: { view: "overview", label: "ዋና ማዕከል", english: "Admin Analytics & Control" },
  storekeeper: { view: "inventory", label: "ክምችት", english: "Storekeeper Inventory" },
  receptionist: { view: "orders", label: "የተቀባይ ትዕዛዝ ማዕከል", english: "Reception Order Desk" },
  laser_operator: { view: "jobs", label: "የሥራ ካርዶች", english: "Operator Queue" },
  cnc_operator: { view: "jobs", label: "የሥራ ካርዶች", english: "Operator Queue" },
  plotter_operator: { view: "jobs", label: "የሥራ ካርዶች", english: "Operator Queue" },
  printer_operator: { view: "jobs", label: "የሥራ ካርዶች", english: "Operator Queue" },
};

export const navItems: Array<{
  id: View;
  label: string;
  english: string;
  icon: LucideIcon;
}> = [
  { id: "overview", label: "ዋና ማዕከል", english: "Overview", icon: LayoutDashboard },
  { id: "orders", label: "የደንበኛ ትዕዛዞች", english: "Orders Queue", icon: Inbox },
  { id: "jobs", label: "የሥራ ካርዶች", english: "Job cards", icon: ClipboardList },
  { id: "machines", label: "ማሽኖች", english: "Machines", icon: Factory },
  { id: "inventory", label: "ክምችት", english: "Inventory", icon: Boxes },
  { id: "offcuts", label: "ቅሪት እቃ", english: "Offcuts", icon: Scissors },
  { id: "reports", label: "ሪፖርቶች", english: "Reports", icon: FileBarChart },
  { id: "reconciliation", label: "ክምችት ማረጋገጫ", english: "Reconciliation", icon: Scale },
  { id: "audit", label: "የእንቅስቃሴ መዝገብ", english: "Audit Log", icon: History },
  { id: "financial", label: "የፋይናንስ አሠራር", english: "Financial Operations", icon: CircleDollarSign },
  { id: "config", label: "የሥራ ማስተካከያ", english: "Operational Configuration", icon: SlidersHorizontal },
  { id: "settings", label: "ማስተካከያ", english: "Settings", icon: Settings },
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
