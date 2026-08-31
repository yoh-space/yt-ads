"use client";

import Link from "next/link";

export function DashboardAccessDenied({ reason = "Your profile is inactive or has not been linked to this workspace." }: { reason?: string }) {
  return (
    <main className="access-denied-page">
      <section className="access-denied-card">
        <span className="panel-kicker coral">ACCESS RESTRICTED</span>
        <h1>Workspace access unavailable</h1>
        <p>{reason} Ask the owner or manager to activate the correct profile before returning to operations.</p>
        <div className="access-denied-actions">
          <Link className="button primary" href="/">Back to website</Link>
          <Link className="button secondary" href="/sign-in">Sign in again</Link>
        </div>
      </section>
    </main>
  );
}
