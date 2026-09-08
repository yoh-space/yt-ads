import { redirect } from "next/navigation";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { getWorkspaceForRole } from "@/lib/role-routing";

export const dynamic = "force-dynamic";

export default async function InventoryIndexPage() {
  const profile = await fetchAuthQuery(api.users.getCurrentProfile, {}).catch(() => null);
  const role = profile?.role;
  if (!role) {
    redirect("/sign-in?redirect=/inventory");
  }

  const workspace = getWorkspaceForRole(role);
  if (
    role === "laser_operator" ||
    role === "cnc_operator" ||
    role === "plotter_operator" ||
    role === "printer_operator"
  ) {
    redirect(`/dashboard/${workspace}/inventory/substock`);
  }

  redirect(`/dashboard/${workspace}/inventory/parent`);
}
