"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OwnerPageHeader } from "@/components/dashboard/roles/owner/owner-page-header";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { SectionLabel } from "@/components/shared/ui/typography";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { Settings, Building2, UserRound, CalendarClock } from "lucide-react";

function InformationalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[12px] font-medium text-foreground text-right truncate">{value}</span>
    </div>
  );
}

export default function OwnerSettingsPage() {
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
      <OwnerPageHeader
        kicker="Settings · ማስተካከያ"
        title="Settings"
        subtitle="Company and profile information for this workspace."
      />

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

      <Panel>
        <PanelHeader
          title="Automated Reporting Schedules"
          subtitle="አውቶማቲክ ሪፖርቶች"
          kicker="Schedules"
          icon={<CalendarClock size={16} />}
        />
        <div className="px-[17px] grid gap-3 sm:grid-cols-2 py-4">
          <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
            <SectionLabel tone="cyan">Daily report · የዕለት ሪፖርት</SectionLabel>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {company?.dailyReportEnabled ? "Enabled" : "Disabled"}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
            <SectionLabel tone="cyan">Monthly audit · ወርሃዊ ምርመራ</SectionLabel>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {company?.monthlyAuditEnabled ? "Enabled" : "Disabled"}
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}