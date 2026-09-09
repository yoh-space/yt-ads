import { redirect } from "next/navigation";
import { isAuthenticated, fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { isValidRole } from "@/lib/role-routing";
import { routeForWorkspace } from "@/components/dashboard/shell/workspace-registry";

export const dynamic = "force-dynamic";

export default async function DashboardRootPage() {
  const authed = await isAuthenticated().catch(() => false);
  if (!authed) {
    redirect("/sign-in?redirect=/dashboard");
  }

  const profile = await fetchAuthQuery(api.users.getCurrentProfile, {}).catch(() => null);
  const role = profile?.role;
  if (isValidRole(role)) {
    redirect(routeForWorkspace({ profile: { role, active: profile?.active ?? true } }) ?? "/dashboard/owner");
  }

  redirect("/dashboard/owner");
}
