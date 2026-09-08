import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Admin workspace root. The admin console lives under `/dashboard/admin/*`
 * (isolated shell + role-gated pages); this node points to the Overview so the
 * `[workspace]` fallback is never rendered for the admin role.
 */
export default function AdminHomePage() {
  redirect("/dashboard/admin/overview");
}