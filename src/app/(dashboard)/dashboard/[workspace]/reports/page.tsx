"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ReportsView } from "@/components/dashboard/views/reports";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import type { Role } from "@/lib/operations-types";

export default function WorkspaceReportsPage() {
  const profile = useQuery(api.users.getCurrentProfile);

  if (!profile) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading Executive Reports…" />
      </div>
    );
  }

  const role: Role = profile.role;
  const isOwner = role === "owner" || role === "admin";

  return (
    <div className="space-y-6">
      <div className="border-b border-[#1E293B] pb-5">
        <span className="font-mono text-xs uppercase tracking-widest text-[#00B4D8]">
          Operations Analytics & Intelligence
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
          Executive Reports & Production Metrics
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Periodic throughput, material consumption, machine productivity, and scrap telemetry.
          {!isOwner ? " (Financial ETB figures strictly restricted to Owner)" : ""}
        </p>
      </div>

      <ReportsView canSeeFinancial={isOwner} />
    </div>
  );
}
