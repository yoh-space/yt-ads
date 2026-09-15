import { redirect } from "next/navigation";
import { isAuthenticated, fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

export default async function PendingAssignmentPage() {
  if (!(await isAuthenticated().catch(() => false))) {
    redirect("/sign-in?redirect=/dashboard");
  }
  const profile = await fetchAuthQuery(api.users.getCurrentProfile, {}).catch(() => null);
  if (!profile) redirect("/sign-in?redirect=/dashboard");
  if (profile.assigned !== false) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">YT Advertisement</p>
        <h1 className="mt-3 text-xl font-semibold">Waiting for owner assignment</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account was registered successfully. An owner must assign your workspace role before you can access the system.
        </p>
        <p className="mt-5 text-xs text-muted-foreground">You can close this page and sign in again after the owner completes the assignment.</p>
      </section>
    </main>
  );
}
