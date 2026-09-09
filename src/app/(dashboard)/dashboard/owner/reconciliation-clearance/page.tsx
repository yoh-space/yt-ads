"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OwnerPageHeader } from "@/components/dashboard/roles/owner/owner-page-header";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/shared/ui/table";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { Scale, Hourglass, TrendingDown, TrendingUp } from "lucide-react";

function makeTime(timestamp: number) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function OwnerReconciliationClearancePage() {
  const summary = useQuery(api.owner.reconciliation.getReconciliationSummary);

  if (summary === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Clearances…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        kicker="Reconciliation Clearance · ክምችት ማረጋገጫ"
        title="Reconciliation Clearance"
        subtitle="Floor stock batches waiting on owner review, plus recent audit outcomes."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Hourglass size={16} />}
          label="Pending Clearance"
          subtitle="በጥበቃ ላይ"
          value={summary.pendingCount}
          description="Batches awaiting review."
          variant="cost"
          isAlert={summary.pendingCount > 0}
        />
        <StatCard
          icon={<TrendingDown size={16} />}
          label="Shortages Found"
          subtitle="የተገኘ ጉድለት"
          value={summary.shortagesCount}
          variant="alert"
          isAlert={summary.shortagesCount > 0}
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Surpluses Found"
          subtitle="የተገኘ ትርፍ"
          value={summary.surplusesCount}
          variant="profit"
        />
        <StatCard
          icon={<Scale size={16} />}
          label="Total Reconciliations"
          subtitle="መላ የማረጋገጫዎች"
          value={summary.totalReconciliations}
          variant="default"
        />
      </div>

      <Panel>
        <PanelHeader
          title="Awaiting Clearance"
          subtitle="ማጽደቂያ በመጠባበቅ ላይ"
          kicker="Pending"
          icon={<Scale size={16} />}
        />
        {summary.pendingClearances.length === 0 ? (
          <p className="p-[17px] text-[12px] text-muted-foreground">
            Nothing waiting on review — the floor is fully cleared.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Machine</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.pendingClearances.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell muted>{batch.machineName}</TableCell>
                    <TableCell muted>{batch.operatorName}</TableCell>
                    <TableCell mono>{batch.issued}</TableCell>
                    <TableCell mono>{batch.remaining}</TableCell>
                    <TableCell muted>{batch.unit}</TableCell>
                    <TableCell mono muted>{makeTime(batch.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}