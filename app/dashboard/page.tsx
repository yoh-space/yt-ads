import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { OperationsDashboard } from "@/components/dashboard/operations-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  if (configured && !(await isAuthenticated().catch(() => false))) {
    redirect("/sign-in");
  }
  return <OperationsDashboard />;
}
