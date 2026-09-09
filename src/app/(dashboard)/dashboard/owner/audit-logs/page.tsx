"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OwnerPageHeader } from "@/components/dashboard/roles/owner/owner-page-header";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { History, Activity } from "lucide-react";

function makeTime(timestamp: number) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function OwnerAuditLogsPage() {
  const events = useQuery(api.owner.audit.getAuditSummary);

  if (events === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Audit Logs…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        kicker="Audit Logs · የእንቅስቃሴ መዝገብ"
        title="Audit Logs"
        subtitle={`Latest activity across stock, jobs, production, and orders (${events.length} shown).`}
      />

      <Panel>
        <PanelHeader
          title="Activity Timeline"
          subtitle="የእንቅስቃሴ መዝገብ"
          kicker="Latest first"
          icon={<History size={16} />}
        />
        {events.length === 0 ? (
          <p className="p-[17px] text-[12px] text-muted-foreground">No recorded activity yet.</p>
        ) : (
          <ol className="divide-y divide-border/60">
            {events.map((event) => (
              <li key={event.id} className="flex gap-3 px-[17px] py-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Activity size={12} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-[13px] font-medium text-foreground">{event.action}</p>
                    <time className="font-mono text-[9px] tabular-nums text-muted-foreground">
                      {makeTime(event.at)}
                    </time>
                  </div>
                  <p className="mt-0.5 text-[12px] text-foreground/80">{event.summary}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{event.detail}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground/70">By: {event.actorName}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}