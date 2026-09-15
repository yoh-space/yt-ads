"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OwnerPageHeader } from "@/components/dashboard/roles/owner/owner-page-header";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/shared/ui/table";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { Users, UserCheck, UserX, ShieldCheck, UserPlus } from "lucide-react";
import { StaffDetailDrawer } from "@/components/dashboard/roles/owner/staff-detail-drawer";
import type { Role } from "@/lib/operations-types";

export default function OwnerTeamPage() {
  const summary = useQuery(api.owner.team.getTeamSummary);
  const setRole = useMutation(api.users.setRole);
  const setActive = useMutation(api.users.setActive);
  const setMachineScope = useMutation(api.users.setMachineScope);
  const [selectedId, setSelectedId] = useState<Id<"users"> | null>(null);

  if (summary === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Team…" />
      </div>
    );
  }

  const byRole = Object.entries(summary.byRole).sort((a, b) => b[1] - a[1]);
  const assignedStaff = summary.team.filter((member) => member.assigned);
  const unassignedStaff = summary.team.filter((member) => !member.assigned);
  const selectedMember = summary.team.find((member) => member.id === selectedId) ?? null;

  async function saveMember(userId: Id<"users">, values: { role: Role; active: boolean; machineIds: Id<"machines">[] }) {
    await setRole({ userId, role: values.role });
    await setActive({ userId, active: values.active });
    await setMachineScope({ userId, machineIds: values.machineIds });
  }

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        kicker="Team · የሥራ ቡድን"
        title="Team"
        subtitle={`${summary.totalStaff} staff profiles. Assign new staff before they can enter a workspace.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Users size={16} />} label="Total Staff" subtitle="ጠቅላላ ሠራተኞች" value={summary.totalStaff} variant="default" />
        <StatCard icon={<UserCheck size={16} />} label="Assigned Staff" subtitle="የተመደቡ" value={assignedStaff.length} variant="sales" />
        <StatCard icon={<UserX size={16} />} label="Needs Assignment" subtitle="መመደብ የሚፈልጉ" value={unassignedStaff.length} variant="alert" isAlert={unassignedStaff.length > 0} />
        <StatCard icon={<ShieldCheck size={16} />} label="Roles in System" subtitle="በስርዓቱ ያሉ ሚናዎች" value={byRole.length} variant="cost" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Panel className="h-fit">
          <PanelHeader title="Unassigned Staff" subtitle="Assign a role and machine" kicker="Owner action" icon={<UserPlus size={16} />} />
          {unassignedStaff.length === 0 ? (
            <p className="p-4 text-[11px] text-muted-foreground">All registered staff have been assigned.</p>
          ) : (
            <div className="space-y-2 p-3">
              {unassignedStaff.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedId(member.id)}
                  className="w-full rounded-lg border border-border/60 bg-background/30 p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5"
                >
                  <p className="truncate text-xs font-semibold text-foreground">{member.name}</p>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">{member.email}</p>
                  <span className="mt-2 inline-flex rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[9px] font-semibold text-primary">Assign role</span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Assigned Staff" subtitle="የተመደቡ ሠራተኞች" kicker="People" icon={<UserCheck size={16} />} />
          {assignedStaff.length === 0 ? (
            <p className="p-[17px] text-[12px] text-muted-foreground">No assigned staff profiles yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table dense>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {assignedStaff.map((member) => (
                    <TableRow key={member.id} interactive selected={selectedId === member.id} onClick={() => setSelectedId(member.id)}>
                      <TableCell className="font-medium text-foreground">{member.name}</TableCell>
                      <TableCell muted>{member.email}</TableCell>
                      <TableCell muted>{member.role}</TableCell>
                      <TableCell>{member.active ? <span className="rounded-full border border-green/50 bg-green/10 px-2 py-0.5 text-[10px] font-medium text-green">Active</span> : <span className="rounded-full border border-danger/50 bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">Inactive</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>

      <StaffDetailDrawer member={selectedMember} machines={summary.machines} onSave={saveMember} onClose={() => setSelectedId(null)} />
    </div>
  );
}
