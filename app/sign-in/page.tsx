"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function SignInPage() {
  const router = useRouter();
  const ensureProfile = useMutation(api.users.ensureProfile);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authClient.signIn.email({ email, password });
      await ensureProfile().catch(() => {});
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="brand-mark"><span>Y</span><i /></div>
        <h1>YT Advertising</h1>
        <p className="auth-sub">Operations Control · sign in to continue</p>
        <form className="auth-form" onSubmit={onSubmit}>
          <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></label>
          <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>
          {error ? <p className="auth-error">{error}</p> : null}
          <button className="button primary full" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="auth-foot">No account? <Link href="/sign-up">Create one</Link></p>
      </div>
    </main>
  );
}
