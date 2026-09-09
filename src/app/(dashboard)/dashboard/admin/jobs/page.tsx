"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/shared/ui/table";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { ClipboardList, Play, Hourglass } from "lucide-react";

function makeTime(timestamp: number) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function AdminJobsPage() {
  const summary = useQuery(api.admin.jobs.getJobSummary);

  if (summary === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Job Cards…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Job Cards · የሥራ ካርዶች"
        title="Job Cards"
        subtitle={`${summary.totalJobs} job cards on record.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<ClipboardList size={16} />}
          label="Total Jobs"
          subtitle="ጠቅላላ ሥራዎች"
          value={summary.totalJobs}
          variant="default"
        />
        <StatCard
          icon={<Play size={16} />}
          label="In Production"
          subtitle="በምርት ላይ"
          value={summary.inProduction}
          variant="sales"
        />
        <StatCard
          icon={<Hourglass size={16} />}
          label="Queued"
          subtitle="በወረፋ"
          value={summary.queued}
          variant="cost"
        />
      </div>

      <Panel>
        <PanelHeader
          title="Recent Job Cards"
          subtitle="የቅርብ ሥራዎች"
          kicker="Latest"
          icon={<ClipboardList size={16} />}
        />
        {summary.recent.length === 0 ? (
          <p className="p-[17px] text-[12px] text-muted-foreground">No job cards yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Machine</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.recent.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell mono>{job.code}</TableCell>
                    <TableCell className="font-medium text-foreground">{job.title}</TableCell>
                    <TableCell muted>{job.client}</TableCell>
                    <TableCell muted>{job.machineName}</TableCell>
                    <TableCell muted>{job.status}</TableCell>
                    <TableCell muted>{job.priority}</TableCell>
                    <TableCell mono muted>{makeTime(job.createdAt)}</TableCell>
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