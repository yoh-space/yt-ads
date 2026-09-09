import type { ReactNode } from "react";
import { OwnerShell } from "@/components/dashboard/roles/owner/owner-shell";

export const dynamic = "force-dynamic";

/**
 * Owner-only workspace layout. Renders its own full shell (sidebar, topbar,
 * loading and access guards). Authorization is enforced again inside every
 * Convex owner-analytics query via `requireOwner`.
 */
export default function OwnerDashboardLayout({ children }: { children: ReactNode }) {
  return <OwnerShell>{children}</OwnerShell>;
}