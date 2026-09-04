"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { KeyRound, ArrowRight, ShieldCheck } from "lucide-react";

const DEMO_ACCOUNTS = [
  { role: "Manager (ማኔጀር)", email: "ytadvert+manager@gmail.com", desc: "Staff oversight, team coordination, cross-role visibility" },
  { role: "Admin (ዋና አስተዳዳሪ)", email: "ytadvert+admin@gmail.com", desc: "System configuration, staff management, audit log" },
  { role: "Storekeeper (ክምችት)", email: "ytadvert+storekeeper@gmail.com", desc: "Parent inventory, roll/sheet custody, material transfers" },
  { role: "Receptionist (ተቀባይ)", email: "ytadvert+reception@gmail.com", desc: "Customer orders queue, payment verification, TIN/invoices" },
  { role: "Laser Operator (ኦፕሬተር)", email: "ytadvert+laser@gmail.com", desc: "Job cards, floor sub-stock, scrap and offcut tracking" },
  { role: "CNC Operator (ኦፕሬተር)", email: "ytadvert+cnc@gmail.com", desc: "CNC router job cards and floor stock" },
  { role: "Plotter Operator (ኦፕሬተር)", email: "ytadvert+plotter@gmail.com", desc: "Print & cut job cards and floor stock" },
  { role: "Printer Operator (ኦፕሬተር)", email: "ytadvert+printer@gmail.com", desc: "Banner / DTF / UV job cards and floor stock" },
];

export default function SignInPage() {
  const router = useRouter();
  const ensureProfile = useMutation(api.users.ensureProfile);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemoCredentials, setShowDemoCredentials] = useState(false);

  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" });
      if (result.error) throw new Error(result.error.message ?? "Google sign-in failed.");
      if (result.data?.url) window.location.assign(result.data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in is not configured yet.");
      setLoading(false);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        throw new Error(result.error.message ?? "Invalid email or password.");
      }
      await ensureProfile().catch(() => {});
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Check your email and password.");
      setLoading(false);
    }
  }

  function fillCredentials(testEmail: string) {
    setEmail(testEmail);
    setPassword("password123");
    setError(null);
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
              Operations Console · የሰራተኞች መግቢያ
            </p>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={onSubmit}>
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-mono text-[11px] text-neutral-300 uppercase tracking-wider font-medium">
                  Password / የይለፍ ቃል
                </label>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
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
                {loading ? "Signing in…" : "Sign In to Operations"}
                <ArrowRight size={13} />
              </button>

              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                disabled={loading}
                className="w-full py-2 px-4 bg-[#17181D] hover:bg-[#1E2026] text-neutral-300 hover:text-white border border-white/[0.1] font-mono text-xs rounded-sm transition-colors disabled:opacity-50"
              >
                Sign in with Google Workspace
              </button>
            </div>
          </form>

          {/* Role Test Credentials Helper */}
          <div className="mt-5 pt-4 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={() => setShowDemoCredentials(!showDemoCredentials)}
              className="w-full flex items-center justify-between text-left font-mono text-[11px] text-neutral-400 hover:text-[#E5C07B] transition-colors py-1"
            >
              <span className="flex items-center gap-1.5 font-semibold">
                <KeyRound size={12} className="text-[#E5C07B]" />
                <span>Test Role Accounts (የሙከራ መለያዎች)</span>
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">
                {showDemoCredentials ? "Hide ▲" : "Show ▼"}
              </span>
            </button>

            {showDemoCredentials ? (
              <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                <p className="font-mono text-[10px] text-neutral-400 leading-relaxed">
                  Default password for all demo accounts is <code className="bg-[#17181D] text-[#E5C07B] px-1 py-0.5 rounded border border-white/[0.1]">password123</code>. Click any role to auto-fill:
                </p>
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillCredentials(acc.email)}
                    className="w-full text-left p-2 rounded-sm bg-[#17181D] hover:bg-[#1E2026] border border-white/[0.06] hover:border-[#E5C07B]/40 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-semibold text-neutral-200 group-hover:text-[#E5C07B]">
                        {acc.role}
                      </span>
                      <span className="font-mono text-[9px] text-neutral-400 bg-white/[0.05] px-1.5 py-0.5 rounded">
                        Click to Fill
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-neutral-400 truncate mt-0.5">
                      {acc.email}
                    </div>
                    <div className="font-sans text-[10px] text-neutral-400 mt-0.5 line-clamp-1">
                      {acc.desc}
                    </div>
                  </button>
                ))}
                <p className="font-mono text-[10px] text-neutral-500 leading-relaxed pt-1">
                  The owner (<span className="text-neutral-300">ytadvert@admin.org</span>) is a real account with its own password — it is not part of the demo set.
                </p>
              </div>
            ) : null}
          </div>

          {/* Account footer */}
          <div className="mt-5 text-center font-mono text-[11px] text-neutral-400 border-t border-white/[0.06] pt-3">
            <span>New staff member? </span>
            <Link href="/sign-up" className="text-[#E5C07B] hover:underline font-medium">
              Create account
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
            YT Advertisement Operations v3.0 · Enterprise Security Enforced
          </p>
        </div>
      </div>
    </main>
  );
}
