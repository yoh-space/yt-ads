import { MATERIAL_SPECIFICATIONS } from "@/shared/material-specifications";
import type { Role } from "@/lib/operations-types";
import { WORKSPACE_REGISTRY } from "./workspace-registry";
import { ROUTE_DESCRIPTORS } from "@/lib/role-routing";
import type { View } from "@/types/dashboard-types";
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
export type Modal =
  | "stock"
  | "job"
  | "offcut"
  | "scrap"
  | "material"
  | "machine"
  | "exception"
  | "order"
  | "reconciliation"
  | null;

export type SettingsCategory = "profile" | "security" | "team" | "company" | "migration" | "system-reset";

const roleVisibleViews: Record<Role, View[]> = Object.fromEntries(
  (Object.keys(WORKSPACE_REGISTRY) as Array<keyof typeof WORKSPACE_REGISTRY>).flatMap((workspaceId) =>
    WORKSPACE_REGISTRY[workspaceId].roles.map((role) => [role, WORKSPACE_REGISTRY[workspaceId].navViews] as const),
  ),
) as Record<Role, View[]>;

export function canAccessView(role: Role, view: View) {
  return roleVisibleViews[role]?.includes(view) ?? false;
}

export function getNavItemHref(view: View, role: Role): string {
  const descriptor = ROUTE_DESCRIPTORS[view];
  if (descriptor) {
    return descriptor.href(role);
  }
  return "/dashboard";
}

const OVERVIEW_LABEL_OVERRIDE: Partial<Record<Role, { label: string; english: string }>> = {
  laser_operator: { label: "የሌዘር ማሽን ሥራ", english: "Laser Machine Workspace" },
  cnc_operator: { label: "የሲኤንሲ ማሽን ሥራ", english: "CNC Machine Workspace" },
  plotter_operator: { label: "የፕሎተር ማሽን ሥራ", english: "Plotter Machine Workspace" },
  printer_operator: { label: "የፕሪንተር ማሽን ሥራ", english: "Printer Machine Workspace" },
};

export function getNavLabel(view: View, role: Role): { label: string; english: string } {
  const base = navItems.find((item) => item.id === view);
  if (!base) return { label: view, english: view };
  if (view === "overview" && OVERVIEW_LABEL_OVERRIDE[role]) {
    return OVERVIEW_LABEL_OVERRIDE[role]!;
  }
  return { label: base.label, english: base.english };
}

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
export const purchaseUnitOptions = ["roll", "sheet", "pack", "canister", "liter", "piece"] as const;
export const materialDefinitionOptions = MATERIAL_SPECIFICATIONS.map((material) => material.name);
