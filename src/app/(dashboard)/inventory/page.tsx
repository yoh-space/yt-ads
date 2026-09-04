import { redirect } from "next/navigation";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

export default async function InventoryIndexPage() {
  const profile = await fetchAuthQuery(api.users.getCurrentProfile, {}).catch(() => null);
  const role = profile?.role;

  if (role === "storekeeper") {
    redirect("/inventory/parent");
  }

  if (
    role === "laser_operator" ||
    role === "cnc_operator" ||
    role === "plotter_operator" ||
    role === "printer_operator"
  ) {
    redirect("/inventory/substock");
  }

  // Default for owners, managers, admin
  redirect("/inventory/parent");
}
