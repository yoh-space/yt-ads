// Shared types for dashboard components to prevent circular dependencies
import type { Id } from "@/convex/_generated/dataModel";

export type OperatorStockEntry = {
  _id: Id<"operatorSubStock">;
  machineId: string;
  machineName?: string;
  materialName: string;
  baseUnit: string;
  issuedQuantity: number;
  currentRemaining: number;
  usagePercent: number;
  status: string;
  reorderAt?: number;
  conversionRatio?: number;
  lowStockThreshold?: number;
};

export type View = "overview" | "orders" | "inventory" | "jobs" | "machines" | "offcuts" | "reports" | "reconciliation" | "audit" | "financial" | "config" | "settings";