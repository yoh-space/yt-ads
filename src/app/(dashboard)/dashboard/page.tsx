import { redirect } from "next/navigation";
import { isAuthenticated, fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { getRoleHomeRoute, isValidRole } from "@/lib/role-routing";

export const dynamic = "force-dynamic";

export default async function DashboardRootPage() {
  const authed = await isAuthenticated().catch(() => false);
  if (!authed) {
    redirect("/sign-in?redirect=/dashboard");
  }

  const profile = await fetchAuthQuery(api.users.getCurrentProfile, {}).catch(() => null);
  const role = profile?.role;
  if (isValidRole(role)) {
    redirect(getRoleHomeRoute(role));
  }

  redirect("/dashboard/owner");
}
