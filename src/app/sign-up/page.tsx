"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button, Input } from "@/components/ui";

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
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* Brand Header */}
          <div className="text-center mb-8">
            <div className="relative w-16 h-16 mx-auto mb-4 grid place-items-center rounded-2xl overflow-hidden border border-cyan bg-gradient-to-br from-[#00799a] to-[#18c1ce] text-white text-2xl font-extrabold">
              <span>Y</span>
              <i className="absolute w-4 h-4 -right-1 -bottom-1 bg-gold rotate-45" />
            </div>
            <h1 className="text-2xl font-bold text-navy mb-2">YT Advertising</h1>
            <p className="text-sm text-gray-500 font-mono tracking-wide">
              Operations Control · create your account
            </p>
          </div>

          {/* Sign-up Form */}
          <form className="space-y-6" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Full name</label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Yordanos"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Email</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Password</label>
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full"
              />
            </div>

            {error ? (
              <div className="p-4 bg-red/10 border border-red/20 rounded-lg">
                <p className="text-sm text-red font-medium">{error}</p>
              </div>
            ) : null}

            <div className="space-y-3">
              <Button
                type="submit"
                variant="primary"
                size="full"
                disabled={loading}
                className="w-full"
              >
                {loading ? "Creating account…" : "Create account"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="full"
                onClick={() => void signUpWithGoogle()}
                disabled={loading}
                className="w-full"
              >
                Continue with Google
              </Button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/sign-in" className="font-medium text-cyan hover:text-cyan-dark transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Need help? Contact your system administrator or{" "}
            <Link href="/" className="text-cyan hover:text-cyan-dark transition-colors">
              return to homepage
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
