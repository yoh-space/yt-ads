import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

/**
 * The owner workspace renders its own fully-isolated shell (sidebar, topbar,
 * and role guard) inside `dashboard/owner/layout.tsx`. The shared shell bypasses
 * `/dashboard/owner/*` client-side so owner pages are never double-wrapped and
 * can never surface the storekeeper/operator sidebar — including on client-side
 * navigation between shared and owner routes.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}