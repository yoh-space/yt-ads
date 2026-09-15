import { redirect } from "next/navigation";

export default function CashierIndexPage() {
  redirect("/dashboard/cashier/overview");
}
