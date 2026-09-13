"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { SectionLabel } from "@/components/shared/ui/typography";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { Settings, Building2, UserRound, CalendarClock } from "lucide-react";
import { DevReseedControl } from "@/components/dashboard/roles/admin/dev-reseed-control";

function InformationalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[12px] font-medium text-foreground text-right truncate">{value}</span>
    </div>
  );
}

export default function AdminSettingsPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const company = useQuery(api.users.getCompanySettings);

  if (profile === undefined || company === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Settings…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Settings · ማስተካከያ"
        title="Settings"
      />

      <DevReseedControl />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Company Profile"
            subtitle="የኩባንያ መረጃ"
            kicker="Business"
            icon={<Building2 size={16} />}
          />
          <div className="px-[17px] divide-y divide-border/60">
            <InformationalRow label="Company name" value={company?.companyName ?? "—"} />
            <InformationalRow label="Industry" value={company?.industry ?? "—"} />
            <InformationalRow label="Address" value={company?.address ?? "—"} />
            <InformationalRow label="Phone" value={company?.phone ?? "—"} />
            <InformationalRow label="Timezone" value={company?.timezone ?? "—"} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Signed-in Profile"
            subtitle="የተጠቃሚ መረጃ"
            kicker="Account"
            icon={<UserRound size={16} />}
          />
          {profile ? (
            <div className="px-[17px] divide-y divide-border/60">
              <InformationalRow label="Name" value={profile.name} />
              <InformationalRow label="Email" value={profile.email} />
              <InformationalRow label="Role" value={profile.role} />
              <InformationalRow
                label="Status"
                value={profile.active ? "Active · ንቁ" : "Inactive · ተጠብቆ"}
              />
            </div>
          ) : (
            <p className="p-[17px] text-[12px] text-muted-foreground">No profile found for this account.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}