import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background text-foreground grid place-items-center p-6">
      <section className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-custom">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan">404</p>
        <h1 className="mt-3 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The requested workspace page does not exist.</p>
        <Link href="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Return home
        </Link>
      </section>
    </main>
  );
}
