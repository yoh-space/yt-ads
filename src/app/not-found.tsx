import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0C0D10] text-[#D4D4D4] grid place-items-center p-6 font-mono">
      <section className="w-full max-w-md rounded-sm border border-white/[0.08] bg-[#121316] p-8 text-center shadow-2xl space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-[#E5C07B] font-bold">404 · NOT FOUND</p>
        <h1 className="text-base font-semibold text-neutral-100 uppercase tracking-wider">
          Page Not Found
        </h1>
        <p className="text-xs text-neutral-400">
          The requested workspace resource or page does not exist.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-sm bg-[#E5C07B] hover:bg-[#d8b067] text-[#0C0D10] px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Return home</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
