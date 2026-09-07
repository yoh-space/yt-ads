"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowRight } from "lucide-react";

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
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" });
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
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0C0D10] text-[#D4D4D4] flex items-center justify-center p-4 selection:bg-[#E5C07B]/30 selection:text-[#E5C07B]">
      <div className="w-full max-w-md space-y-4">
        {/* Main Card */}
        <div className="bg-[#121316] border border-white/[0.08] rounded-sm p-7 shadow-2xl relative">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-9 h-9 rounded-sm bg-[#E5C07B] text-[#0C0D10] font-mono font-bold text-sm grid place-items-center tracking-tight mx-auto mb-3 shadow-sm">
              YT
            </div>
            <h1 className="font-mono text-sm uppercase tracking-[0.16em] text-neutral-100 font-semibold">
              YT ADVERTISEMENT
            </h1>
            <p className="font-mono text-[11px] text-neutral-400 mt-1">
              Staff Registration · አዲስ የሰራተኛ መለያ
            </p>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block font-mono text-[11px] text-neutral-300 uppercase tracking-wider mb-1.5 font-medium">
                Full Name / ሙሉ ስም
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Yordanos"
                className="w-full bg-[#17181D] border border-white/[0.1] focus:border-[#E5C07B] text-neutral-100 placeholder:text-neutral-600 text-xs px-3 py-2.5 rounded-sm outline-none transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] text-neutral-300 uppercase tracking-wider mb-1.5 font-medium">
                Email / ኢሜይል
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@ytadvert.com"
                className="w-full bg-[#17181D] border border-white/[0.1] focus:border-[#E5C07B] text-neutral-100 placeholder:text-neutral-600 text-xs px-3 py-2.5 rounded-sm outline-none transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] text-neutral-300 uppercase tracking-wider mb-1.5 font-medium">
                Password / የይለፍ ቃል
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full bg-[#17181D] border border-white/[0.1] focus:border-[#E5C07B] text-neutral-100 placeholder:text-neutral-600 text-xs px-3 py-2.5 rounded-sm outline-none transition-colors font-mono"
              />
            </div>

            {error ? (
              <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-sm text-xs font-mono text-rose-300">
                {error}
              </div>
            ) : null}

            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#E5C07B] hover:bg-[#d8b067] text-[#0C0D10] font-mono text-xs font-bold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? "Creating Account…" : "Register Staff Account"}
                <ArrowRight size={13} />
              </button>

              <button
                type="button"
                onClick={() => void signUpWithGoogle()}
                disabled={loading}
                className="w-full py-2 px-4 bg-[#17181D] hover:bg-[#1E2026] text-neutral-300 hover:text-white border border-white/[0.1] font-mono text-xs rounded-sm transition-colors disabled:opacity-50"
              >
                Continue with Google Workspace
              </button>
            </div>
          </form>

          {/* Account footer */}
          <div className="mt-6 text-center font-mono text-[11px] text-neutral-400 border-t border-white/[0.06] pt-4">
            <span>Already have an account? </span>
            <Link href="/sign-in" className="text-[#E5C07B] hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </div>

        {/* System Support & Return Links - HIGH CONTRAST & VISIBLE */}
        <div className="text-center font-mono text-xs text-neutral-300 bg-[#121316] border border-white/[0.08] p-3 rounded-sm space-y-1">
          <p className="font-medium text-neutral-200">
            Need help? Contact your system administrator or{" "}
            <Link href="/" className="text-[#E5C07B] hover:underline font-semibold transition-colors inline-flex items-center gap-1">
              <span>return to homepage</span>
            </Link>
          </p>
          <p className="text-[10px] text-neutral-400">
            YT Advertisement Operations v3.0 
          </p>
        </div>
      </div>
    </main>
  );
}
