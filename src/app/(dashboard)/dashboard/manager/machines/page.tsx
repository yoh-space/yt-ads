"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Activity, CheckCircle2, CircleAlert, Clock3, Factory, Search, Wrench } from "lucide-react";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { StatCard } from "@/components/shared/ui/stat-card";
import { cn } from "@/lib/utils";

type MachineStatus = "All" | "Running" | "Available" | "Maintenance" | "Unavailable";

const statusStyles = {
  Running: "border-success/30 bg-success/10 text-success",
  Available: "border-cyan/30 bg-cyan/10 text-cyan-dark",
  Maintenance: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  Unavailable: "border-danger/30 bg-danger/10 text-danger",
};

const statusIcons = {
  Running: Activity,
  Available: CheckCircle2,
  Maintenance: Wrench,
  Unavailable: CircleAlert,
};

function formatOperatorRole(role: string) {
  return role.replace("_operator", " operator").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export default function ManagerMachinesPage() {
  const machineOverview = useQuery(api.manager.machines.getOverview);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<MachineStatus>("All");

  const machines = machineOverview?.machines ?? [];
  const filteredMachines = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return machines.filter((machine) => {
      const matchesStatus = statusFilter === "All" || machine.status === statusFilter;
      const matchesSearch = !query || [machine.name, machine.code, machine.type, machine.operatorRole, machine.activeJobCode ?? "", machine.activeJobTitle ?? ""].join(" ").toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [machines, searchTerm, statusFilter]);

  if (machineOverview === undefined) {
    return <div className="flex min-h-[400px] items-center justify-center"><InventoryLoader label="Loading machine status..." /></div>;
  }

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Machines · የማሽኖች ሁኔታ"
        title="Machine status"
        subtitle="See which machines are working, ready, or need attention."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Factory size={16} />} label="All machines" subtitle="ሁሉም ማሽኖች" value={machineOverview.total} />
        <StatCard icon={<Activity size={16} />} label="Working now" subtitle="በሥራ ላይ" value={machineOverview.running} variant="profit" />
        <StatCard icon={<CheckCircle2 size={16} />} label="Ready" subtitle="ዝግጁ" value={machineOverview.available} variant="sales" />
        <StatCard icon={<Wrench size={16} />} label="Needs attention" subtitle="ክትትል የሚፈልግ" value={machineOverview.maintenance + machineOverview.unavailable} variant="alert" isAlert={machineOverview.maintenance + machineOverview.unavailable > 0} />
      </div>

      <Panel>
        <PanelHeader title="Machines" subtitle="Current status and active work." icon={<Factory size={16} />} />
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search machines or jobs..." className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["All", "Running", "Available", "Maintenance", "Unavailable"] as MachineStatus[]).map((status) => (
              <button key={status} type="button" onClick={() => setStatusFilter(status)} className={cn("rounded-full border px-2.5 py-1.5 text-[10px] font-semibold transition", statusFilter === status ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground")}>
                {status}
              </button>
            ))}
          </div>
        </div>

        {filteredMachines.length === 0 ? (
          <p className="p-8 text-center text-xs text-muted-foreground">No machines match your search.</p>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredMachines.map((machine) => {
              const StatusIcon = statusIcons[machine.status];
              return (
                <article key={machine.id} className="rounded-lg border border-border/60 bg-background/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", statusStyles[machine.status])}><StatusIcon size={17} /></span>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-foreground">{machine.name}</h2>
                        <p className="truncate text-[10px] text-muted-foreground">{machine.code} · {machine.type}</p>
                      </div>
                    </div>
                    <span className={cn("shrink-0 rounded-full border px-2 py-1 text-[9px] font-semibold", statusStyles[machine.status])}>{machine.status}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
                    <div><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Operator</p><p className="mt-1 truncate text-xs font-medium text-foreground">{formatOperatorRole(machine.operatorRole)}</p></div>
                    <div><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Current job</p><p className="mt-1 truncate text-xs font-medium text-foreground">{machine.activeJobCode ?? "No active job"}</p></div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock3 size={13} />
                    <span className="truncate">{machine.activeJobTitle ?? "Waiting for the next job"}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}