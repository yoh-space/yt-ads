import { redirect } from "next/navigation";

export default function ManagerDashboardHome() {
  redirect("/dashboard/manager/overview");
}