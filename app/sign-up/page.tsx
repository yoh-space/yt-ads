"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function SignUpPage() {
  const router = useRouter();
  const ensureProfile = useMutation(api.users.ensureProfile);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signUpWithGoogle() {
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
      if (result.error) throw new Error(result.error.message ?? "Google sign-up failed.");
      if (result.data?.url) window.location.assign(result.data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-up is not configured yet.");
      setLoading(false);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authClient.signUp.email({ name, email, password });
      await ensureProfile();
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="brand-mark"><span>Y</span><i /></div>
        <h1>Create your account</h1>
        <p className="auth-sub">YT Advertising · Operations Control</p>
        <form className="auth-form" onSubmit={onSubmit}>
          <label>Full name<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Yordanos" /></label>
          <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></label>
          <label>Password<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
          {error ? <p className="auth-error">{error}</p> : null}
          <button className="button primary full" type="submit" disabled={loading}>{loading ? "Creating account…" : "Create account"}</button>
          <button className="button secondary full" type="button" onClick={() => void signUpWithGoogle()} disabled={loading}>Continue with Google</button>
        </form>
        <p className="auth-foot">Already have an account? <Link href="/sign-in">Sign in</Link></p>
      </div>
    </main>
  );
}
