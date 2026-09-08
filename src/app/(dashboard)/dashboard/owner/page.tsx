import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Owner workspace root. The owner's dashboard lives under `/dashboard/owner/*`
 * (isolated shell + role-gated pages); this node points to the Overview so the
 * `[workspace]` fallback is never rendered for the owner role.
 */
export default function OwnerHomePage() {
  redirect("/dashboard/owner/overview");
}