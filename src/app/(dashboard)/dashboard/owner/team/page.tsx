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
import { Users, UserCheck, UserX, ShieldCheck } from "lucide-react";
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
        subtitle={`${summary.totalStaff} staff profiles across the business.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Users size={16} />}
          label="Total Staff"
          subtitle="ጠቅላላ ሠራተኞች"
          value={summary.totalStaff}
          variant="default"
        />
        <StatCard
          icon={<UserCheck size={16} />}
          label="Active Profiles"
          subtitle="ንቁ መገለጫዎች"
          value={summary.activeStaff}
          variant="sales"
        />
        <StatCard
          icon={<UserX size={16} />}
          label="Inactive Profiles"
          subtitle="ያልተነቃቁ"
          value={summary.totalStaff - summary.activeStaff}
          variant="alert"
          isAlert={summary.totalStaff - summary.activeStaff > 0}
        />
        <StatCard
          icon={<ShieldCheck size={16} />}
          label="Roles in System"
          subtitle="በስርዓቱ ያሉ ሚናዎች"
          value={byRole.length}
          variant="cost"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <PanelHeader
            title="Staff by Role"
            subtitle="በሚና የተከፋፈለ"
            kicker="Composition"
            icon={<Users size={16} />}
          />
          <div className="p-[17px] space-y-3">
            {byRole.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">No staff profiles yet.</p>
            ) : (
              byRole.map(([role, count]) => (
                <div
                  key={role}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
                >
                  <span className="text-[12px] text-muted-foreground">{role}</span>
                  <span className="font-mono text-[13px] font-bold text-foreground">{count}</span>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Staff Directory"
            subtitle="የሠራተኞች ዝርዝር"
            kicker="People"
            icon={<UserCheck size={16} />}
          />
          {summary.team.length === 0 ? (
            <p className="p-[17px] text-[12px] text-muted-foreground">No staff profiles yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table dense>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.team.map((member) => (
                    <TableRow key={member.id} interactive selected={selectedId === member.id} onClick={() => setSelectedId(member.id)}>
                      <TableCell className="font-medium text-foreground">{member.name}</TableCell>
                      <TableCell muted>{member.email}</TableCell>
                      <TableCell muted>{member.role}</TableCell>
                      <TableCell>
                        {member.active ? (
                          <span className="rounded-full border border-green/50 bg-green/10 px-2 py-0.5 text-[10px] font-medium text-green">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full border border-danger/50 bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">
                            Inactive
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>
      <StaffDetailDrawer
        member={selectedMember}
        machines={summary.machines}
        onSave={saveMember}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
