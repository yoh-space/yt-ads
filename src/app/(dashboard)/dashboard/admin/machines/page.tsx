"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { Factory, PlayCircle, Wrench, CirclePause } from "lucide-react";

export default function AdminMachinesPage() {
  const summary = useQuery(api.admin.machines.getMachineSummary);

  if (summary === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Machines…" />
      </div>
    );
  }

  const running = summary.byStatus["Running"] ?? 0;
  const maintenance = summary.byStatus["Maintenance"] ?? 0;
  const unavailable = summary.byStatus["Unavailable"] ?? 0;

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Machine Status · የማሽን ሁኔታ"
        title="Machines"
        subtitle={`${summary.machinesCount} active machines on the floor.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Factory size={16} />}
          label="Total Machines"
          subtitle="ጠቅላላ ማሽኖች"
          value={summary.machinesCount}
          variant="default"
        />
        <StatCard
          icon={<PlayCircle size={16} />}
          label="Running Now"
          subtitle="አሁን በሥራ ላይ"
          value={running}
          variant="sales"
        />
        <StatCard
          icon={<Wrench size={16} />}
          label="In Maintenance"
          subtitle="ጥገና ላይ"
          value={maintenance}
          variant="cost"
        />
        <StatCard
          icon={<CirclePause size={16} />}
          label="Unavailable"
          subtitle="አገልግሎት የሌለው"
          value={unavailable}
          variant="alert"
          isAlert={unavailable > 0}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Machine Details"
          subtitle="የማሽን ዝርዝር"
          kicker="Floor"
          icon={<Factory size={16} />}
        />
        {summary.machines.length === 0 ? (
          <p className="p-[17px] text-[12px] text-muted-foreground">No active machines.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Machine</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active job</TableHead>
                  <TableHead>Queued</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.machines.map((machine) => (
                  <TableRow key={machine.id}>
                    <TableCell className="font-medium text-foreground">{machine.name}</TableCell>
                    <TableCell mono muted>{machine.code}</TableCell>
                    <TableCell muted>{machine.type}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] font-medium">
                        {machine.status === "Running" && <span className="h-1.5 w-1.5 rounded-full bg-green" />}
                        {machine.status === "Available" && <span className="h-1.5 w-1.5 rounded-full bg-cyan" />}
                        {machine.status === "Maintenance" && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
                        {machine.status === "Unavailable" && <span className="h-1.5 w-1.5 rounded-full bg-danger" />}
                        {machine.status}
                      </span>
                    </TableCell>
                    <TableCell muted>
                      {machine.activeJob ? `${machine.activeJob.code} · ${machine.activeJob.title}` : "—"}
                    </TableCell>
                    <TableCell mono>{machine.queuedCount}</TableCell>
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