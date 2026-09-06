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
        <InventoryLoader label="የፖርቶች መረጃ በመጫን ላይ…" />
      </div>
    );
  }

  const role: Role = profile.role;
  const isOwner = role === "owner" || role === "admin";

  return (
    <div className="space-y-6">
      <div className="border-b border-[#1E293B] pb-5">
        <span className="font-mono text-xs uppercase tracking-widest text-[#00B4D8]">
          የስራ ትንታኔ እና መረጃ
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
          የፖርቶች ሪፖርቶች እና የምርት መጠን
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          የጊዜ ሰንጠረዥ፣ የእቃ ተጠቀም፣ የማሽን ተግባርነት እና የቅሪት መጠን።
          {!isOwner ? " (Financial ETB figures strictly restricted to Owner)" : ""}
        </p>
      </div>

      <ReportsView canSeeFinancial={isOwner} />
    </div>
  );
}
