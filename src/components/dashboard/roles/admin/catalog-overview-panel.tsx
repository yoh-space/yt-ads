"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Layers3, Link2, ShieldCheck, Wrench } from "lucide-react";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shared/ui/table";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";

export function CatalogOverviewPanel() {
  const overview = useQuery(api.catalog.getCatalogOverview);

  if (overview === undefined) {
    return (
      <Panel>
        <div className="flex min-h-32 items-center justify-center">
          <InventoryLoader label="Loading master catalog…" />
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Wrench size={16} />} label="Active Machines" subtitle="Owner-managed assets" value={overview.counts.activeMachines} variant="default" />
        <StatCard icon={<Layers3 size={16} />} label="Material Variants" subtitle="Structured stock identities" value={overview.counts.activeMaterials} variant="sales" />
        <StatCard icon={<Link2 size={16} />} label="Machine Links" subtitle="Supported material paths" value={overview.counts.activeLinks} variant="default" />
        <StatCard icon={<ShieldCheck size={16} />} label="Operator Roles" subtitle="Capability-aware roles" value={overview.counts.activeOperatorRoles} variant="sales" />
      </div>

      <Panel>
        <PanelHeader title="Machine-to-material coverage" subtitle="The normalized relationship is now visible before CRUD controls are enabled." kicker="Single source" icon={<Link2 size={16} />} />
        <div className="overflow-x-auto">
          <Table dense>
            <TableHeader>
              <TableRow>
                <TableHead>Machine</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Operator role</TableHead>
                <TableHead>Linked materials</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.machines.map((machine) => {
                const links = overview.links.filter((link) => link.machineId === machine.id);
                return (
                  <TableRow key={machine.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{machine.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{machine.code}{machine.catalogKey ? ` · ${machine.catalogKey}` : ""}</div>
                    </TableCell>
                    <TableCell muted>{machine.status}</TableCell>
                    <TableCell muted>{machine.operatorRole.replace(/_/g, " ")}</TableCell>
                    <TableCell mono>{links.length}</TableCell>
                  </TableRow>
                );
              })}
              {overview.machines.length === 0 ? (
                <TableRow><TableCell colSpan={4} muted>No active machines are configured.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}
